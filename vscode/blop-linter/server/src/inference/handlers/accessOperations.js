// ============================================================================
// Access Operation Handlers - Property, bracket, and function call access
// ============================================================================

import { validateObjectPropertyAccess } from '../visitor.js';
import { inferGenericArguments, substituteType, isTypeCompatible } from '../typeSystem.js';
import { FunctionType, AnyType, PredicateType } from '../Type.js';
import TypeChecker from '../typeChecker.js';
import { extractExplicitTypeArguments, countFuncCallArgs } from './utils.js';

/**
 * Get the expression node at position `argIndex` in a func_call node's argument list.
 * Returns null if the index is out of range.
 */
function getCallArgExpNode(funcCallNode, argIndex) {
  let paramsNode = funcCallNode?.children?.find(c => c.type === 'func_call_params');
  let idx = 0;
  while (paramsNode) {
    const expNode = paramsNode.children?.find(c => c.type === 'exp');
    if (idx === argIndex) return expNode ?? null;
    idx++;
    paramsNode = paramsNode.children?.find(c => c.type === 'func_call_params');
  }
  return null;
}

/**
 * Return the variable name if the expression is a plain variable reference, else null.
 */
function getSimpleVarName(expNode) {
  if (!expNode) return null;
  const firstChild = expNode.children?.[0];
  if (firstChild?.type === 'name_exp') return firstChild.named?.name?.value ?? null;
  return null;
}

/**
 * Handle dot-notation or optional-chain property access: obj.prop or obj?.prop.
 * validateObjectPropertyAccess handles both type resolution and (in checking phase) warning emission.
 */
function handlePropertyAccess(expNode, parent, objType, getState) {
  const { pushInference, inferencePhase } = getState();
  // After inlining object_access into exp, optional and prop live directly on the exp node.
  const isOptional = !!expNode.named?.optional;
  const propName = expNode.named?.prop?.value;

  // Stamp context so the assign handler can find __objectType/__propertyName
  // for property-assignment type checking (e.g. `a.b = x`).
  expNode.__objectType = objType;
  expNode.__propertyName = propName;

  if (inferencePhase === 'inference') {
    // Always pass expNode (not null) even for optional chains.
    // In the inference phase pushWarning is a no-op, so no false warnings fire.
    // Passing expNode ensures the property name sub-node gets its inferredType
    // stamped, which is required for hover support and completion lookup.
    const resolvedType = validateObjectPropertyAccess(objType, propName, expNode);
    // Tag FunctionType with the property name so handleFuncCallAccess can use it in error messages
    if (resolvedType instanceof FunctionType && propName && resolvedType.funcName === null) {
      resolvedType.__callerName = propName;
    }
    expNode.inferredType = resolvedType;
    if (parent) pushInference(parent, resolvedType);
  } else {
    // Checking phase: only validate non-optional chains (optional chaining never warns)
    if (!isOptional) {
      validateObjectPropertyAccess(objType, propName, expNode);
    }
    // pushInference is a no-op in checking phase
  }
}

/**
 * Handle bracket access: obj[i] or obj?.[i].
 */
function handleBracketAccess(expNode, parent, objType, getState) {
  const { pushInference, inferencePhase } = getState();
  const isOptional = !!expNode.named?.optional;
  // Stamp context so the assign handler can find __objectType for readonly checks
  // (bracket-access assignments like arr[0] = x need this, just like dot-access).
  expNode.__objectType = objType;
  if (inferencePhase === 'inference') {
    const resolvedType = isOptional
      ? validateObjectPropertyAccess(objType, null, null)
      : validateObjectPropertyAccess(objType, null, expNode);
    expNode.inferredType = resolvedType;
    if (parent) pushInference(parent, resolvedType);
  } else {
    if (!isOptional) {
      validateObjectPropertyAccess(objType, null, expNode);
    }
  }
}

/**
 * Handle a function call where funcType is the callee's type.
 * Covers direct calls obj(args) and generic calls obj<T>(args).
 * Emits arity and argument-type warnings during the checking phase.
 */
function handleFuncCallAccess(expNode, parent, funcType, getState) {
  const { pushInference, pushWarning, typeAliases, inferencePhase } = getState();
  if (!(funcType instanceof FunctionType) || funcType.params === null) {
    if (inferencePhase === 'inference') {
      expNode.inferredType = AnyType;
      if (parent) pushInference(parent, AnyType);
    }
    return;
  }

  // After inlining, func_call and type_arguments are direct named fields on the exp node.
  const funcCallNode = expNode.named?.call;
  const argTypes = funcCallNode?.inference || [];
  const typeArgsNode = expNode.named?.type_args;
  const funcCallName = funcType.funcName ?? funcType.__callerName ?? '';

  // Compute substitutions once — used for return-type resolution and param checking
  let substitutions = {};
  if (funcType.genericParams?.length > 0) {
    const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
    if (explicitTypeArgs) {
      for (let j = 0; j < Math.min(funcType.genericParams.length, explicitTypeArgs.length); j++) {
        substitutions[funcType.genericParams[j]] = explicitTypeArgs[j];
      }
    } else {
      const result = inferGenericArguments(funcType.genericParams, funcType.params ?? [], argTypes, typeAliases);
      substitutions = result.substitutions;
    }
  }

  const returnType = funcType.genericParams?.length > 0
    ? substituteType(funcType.returnType ?? AnyType, substitutions)
    : funcType.returnType ?? AnyType;

  if (inferencePhase === 'checking' && funcType.params !== null) {
    // Arity check — only for named user-defined functions (funcName !== null)
    if (funcType.funcName !== null) {
      const hasUntypedRequiredParam = funcType.params.some(
        (p, idx) => p === AnyType && !funcType.paramHasDefault?.[idx]
      );
      const actualArgCount = countFuncCallArgs(funcCallNode);
      const required = funcType.params.filter((_, idx) => !funcType.paramHasDefault?.[idx]).length;
      const total = funcType.params.length;
      // For untyped params, allow calling with fewer args than required (VNode component
      // pattern: def Foo(props) {} called as <Foo /> with 0 args is valid).
      // But too many args is never valid — always check that direction.
      const tooFew = !hasUntypedRequiredParam && actualArgCount < required;
      const tooMany = actualArgCount > total;
      if (tooFew || tooMany) {
        const expected = required === total ? `${total}` : `${required}-${total}`;
        pushWarning(expNode, `function ${funcCallName} takes ${expected} argument${total === 1 ? '' : 's'} but got ${actualArgCount}`);
      }
    }

    // Argument-type check
    if (argTypes.length > 0) {
      if (funcType.genericParams?.length > 0) {
        const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
        let subs = {};
        if (explicitTypeArgs) {
          for (let j = 0; j < Math.min(funcType.genericParams.length, explicitTypeArgs.length); j++) {
            subs[funcType.genericParams[j]] = explicitTypeArgs[j];
          }
          if (explicitTypeArgs.length !== funcType.genericParams.length) {
            pushWarning(expNode, `Expected ${funcType.genericParams.length} type arguments but got ${explicitTypeArgs.length}`);
          }
          // Validate explicit type args against constraints
          if (funcType.genericConstraints) {
            for (let j = 0; j < Math.min(funcType.genericParams.length, explicitTypeArgs.length); j++) {
              const paramName = funcType.genericParams[j];
              const constraint = funcType.genericConstraints.get(paramName);
              if (constraint && !isTypeCompatible(explicitTypeArgs[j], constraint, typeAliases)) {
                pushWarning(expNode, `Type '${explicitTypeArgs[j]}' does not satisfy constraint '${constraint}' for type parameter '${paramName}'`);
              }
            }
          }
        } else {
          const result = inferGenericArguments(funcType.genericParams, funcType.params ?? [], argTypes, typeAliases);
          subs = result.substitutions;
          result.errors.forEach(e => pushWarning(expNode, e));
          // Validate inferred type args against constraints
          if (funcType.genericConstraints) {
            for (const [paramName, inferredTypeVal] of subs instanceof Map ? subs.entries() : Object.entries(subs)) {
              const constraint = funcType.genericConstraints.get(paramName);
              if (constraint && !isTypeCompatible(inferredTypeVal, constraint, typeAliases)) {
                pushWarning(expNode, `Type '${inferredTypeVal}' does not satisfy constraint '${constraint}' for type parameter '${paramName}'`);
              }
            }
          }
        }
        const substitutedParams = funcType.params.map(p => substituteType(p, subs));
        const result = TypeChecker.checkFunctionCall(argTypes, substitutedParams, funcCallName, typeAliases);
        if (!result.valid) result.warnings.forEach(w => pushWarning(expNode, w));
      } else {
        const result = TypeChecker.checkFunctionCall(argTypes, funcType.params, funcCallName, typeAliases);
        if (!result.valid) result.warnings.forEach(w => pushWarning(expNode, w));
      }
    }
  }

  if (inferencePhase === 'inference') {
    expNode.inferredType = returnType;
    if (parent) pushInference(parent, returnType);
    // When the function has a predicate return type, stamp the argument variable name
    // so that detectPredicateGuard can apply narrowing in if-conditions.
    if (returnType instanceof PredicateType) {
      const paramIdx = Math.max(0, funcType.paramNames?.indexOf(returnType.paramName) ?? 0);
      const argExpNode = getCallArgExpNode(funcCallNode, paramIdx);
      const varName = getSimpleVarName(argExpNode);
      if (varName) expNode.__predicateArg = varName;
    }
  }
}

/**
 * Create access operation handlers (property, bracket, function call)
 */
export function createAccessOperationHandlers(getState) {
  return {
    handlePropertyAccess,
    handleBracketAccess,
    handleFuncCallAccess,
    getCallArgExpNode,
    getSimpleVarName,
  };
}

export default createAccessOperationHandlers;
