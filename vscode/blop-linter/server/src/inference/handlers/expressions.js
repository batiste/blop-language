// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

import { visit, visitChildren, resolveTypes, pushToParent } from '../visitor.js';
import { inferGenericArguments, substituteType, parseTypeExpression, getPropertyType, resolveTypeAlias, getBaseTypeOfLiteral, createUnionType } from '../typeSystem.js';
import { ObjectType, PrimitiveType, AnyType, ArrayType, FunctionType, AnyFunctionType, UndefinedType, TypeAlias } from '../Type.js';
import { detectTypeofCheck, detectEqualityCheck, detectTruthinessCheck, applyIfBranchGuard, applyElseBranchGuard } from '../typeGuards.js';
import TypeChecker from '../typeChecker.js';
import { getBuiltinObjectType, isBuiltinObjectType, getArrayMemberType, getPrimitiveMemberType } from '../builtinTypes.js';
import { extractPropertyNodesFromAccess } from './utils.js';

/**
 * Extract explicit type arguments from type_arguments node
 * @param {Object} typeArgsNode - The type_arguments AST node
 * @returns {string[]} Array of type strings
 */
function extractExplicitTypeArguments(typeArgsNode) {
  if (!typeArgsNode) return null;
  
  const args = [];
  
  function collectArgs(node) {
    if (!node) return;
    
    // Check if this node itself has a named.arg (type_expression)
    if (node.named && node.named.arg) {
      const typeArg = parseTypeExpression(node.named.arg);
      if (typeArg) {
        args.push(typeArg);
      }
    }
    
    // Check if it has a named.rest (for comma-separated list)
    if (node.named && node.named.rest) {
      collectArgs(node.named.rest);
    }
  }
  
  // Start with the args node (type_argument_list)
  if (typeArgsNode.named && typeArgsNode.named.args) {
    collectArgs(typeArgsNode.named.args);
  }
  
  return args.length > 0 ? args : null;
}

/**
 * Get the member name and its AST node from an object access node
 * Used when we need to annotate the node with inferred type
 */
function getObjectAccessMemberInfo(access) {
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const memberName = objectAccess?.children?.find(child => child.type === 'name')?.value;
  const memberNode = objectAccess?.children?.find(child => child.type === 'name');
  return { memberName, memberNode };
}

/**
 * Extract return type from a Type (if it's a FunctionType, get returnType; otherwise return as-is)
 */
function extractReturnType(type) {
  if (type instanceof FunctionType) {
    return type.returnType;
  }
  return type ?? AnyType;
}

/**
 * Check if a type is a concrete primitive type (string, number, or boolean)
 */
function isValidPrimitiveType(type) {
  const baseType = getBaseTypeOfLiteral(type);
  return baseType instanceof PrimitiveType && ['string', 'number', 'boolean'].includes(baseType.name);
}

/**
 * Return true when a type is a typed object instance whose properties can be
 * resolved — covers user-defined ObjectType structs and builtin TypeAlias
 * instances (e.g. Component, Router).
 */
function isTypedObjectInstance(type) {
  return (
    type instanceof ObjectType ||
    (type instanceof TypeAlias && isBuiltinObjectType(type.name))
  );
}

/**
 * Generic handler for method calls on typed values (arrays, primitives, etc.)
 * Handles extraction of return type and stamping of AST nodes
 */
function handleTypedMethodCall(
  name,
  access,
  definition,
  parent,
  typeChecker,
  memberGetter,
  validTypeFilter,
  { pushInference, typeAliases }
) {
  const resolvedDefType = resolveTypeAlias(definition?.type, typeAliases);
  
  // Check if the resolved type matches the expected type
  if (!definition || !typeChecker(resolvedDefType)) {
    return false;
  }
  
  // Apply optional filter (e.g., exclude 'any' primitive type)
  if (validTypeFilter && !validTypeFilter(resolvedDefType)) {
    return false;
  }
  
  const { memberName, memberNode } = getObjectAccessMemberInfo(access);
  if (!memberName) {
    return false;
  }
  
  const methodDef = memberGetter(resolvedDefType, memberName);
  if (!methodDef) {
    return false;
  }
  
  const finalType = extractReturnType(methodDef);
  
  if (memberNode) memberNode.inferredType = finalType;
  pushInference(parent, finalType);
  return true;
}

/**
 * Handle array instance method calls (e.g. items.map(), nums.filter(), arr.push())
 * Validates parameters and return type
 */
function handleArrayOrBuiltinMethodCall(name, access, definition, parent, { pushInference, pushWarning, typeAliases }) {
  const resolvedDefType = resolveTypeAlias(definition?.type, typeAliases);
  
  if (!definition || !(resolvedDefType instanceof ArrayType)) {
    return false;
  }

  const { memberName, memberNode } = getObjectAccessMemberInfo(access);
  if (!memberName) {
    return false;
  }

  const methodDef = getArrayMemberType(resolvedDefType, memberName);
  if (!methodDef) {
    return false;
  }

  // Extract arguments for parameter validation.
  // The path is: access(wrapper) → middleOA(['.', name, innerOA]) → innerOA → func_call
  const argTypes = access.children
    ?.find(child => child.type === 'object_access')  // middleOA
    ?.children?.find(child => child.type === 'object_access')  // innerOA
    ?.children?.find(child => child.type === 'func_call')  // func_call
    ?.inference || [];
  
  // If methodDef is a FunctionType (parameterized method like push(T)), validate parameters
  if (methodDef instanceof FunctionType && argTypes.length > 0) {
    const result = TypeChecker.checkFunctionCall(argTypes, methodDef.params, memberName, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }

  const finalType = extractReturnType(methodDef);

  if (memberNode) memberNode.inferredType = finalType;
  pushInference(parent, finalType);
  return true;
}

/**
 * Handle primitive type method calls (e.g. s.toLowerCase(), nums.includes(), n.toFixed())
 */
function handlePrimitiveTypeMethodCall(name, access, definition, parent, { pushInference, typeAliases }) {
  return handleTypedMethodCall(
    name,
    access,
    definition,
    parent,
    (type) => {
      const baseType = getBaseTypeOfLiteral(type);
      return baseType instanceof PrimitiveType;
    },
    (type, methodName) => {
      const baseType = getBaseTypeOfLiteral(type);
      return getPrimitiveMemberType(baseType.name, methodName);
    },
    (type) => {
      const baseType = getBaseTypeOfLiteral(type);
      return baseType instanceof PrimitiveType && ['string', 'number', 'boolean'].includes(baseType.name);
    },
    { pushInference, typeAliases }
  );
}

/**
 * Handle built-in object member access or calls (e.g. Math.PI, Math.cos(), Array.isArray()).
 * Used for both property access and method calls — the distinction is handled by the caller.
 */
function handleBuiltinNameAccess(name, access, parent, { pushInference, inferencePhase }) {
  if (!isBuiltinObjectType(name.value)) return false;
  
  const { memberName, memberNode } = getObjectAccessMemberInfo(access);
  if (!memberName) return false;
  
  const builtinType = getBuiltinObjectType(name.value);
  const rawMemberType = builtinType?.[memberName];
  pushInference(parent, extractReturnType(rawMemberType));

  if (inferencePhase === 'inference') {
    if (name.inferredType === undefined) name.inferredType = new TypeAlias(name.value);
    if (memberNode && memberNode.inferredType === undefined && rawMemberType)
      memberNode.inferredType = rawMemberType;
  }

  return true;
}

// handleBuiltinInstanceMethodCall has been removed.
// Method calls on builtin instance types (e.g. ctx.mount() where ctx: Component)
// are now handled by the unified instance-method section at the bottom of handleFunctionCall,
// which covers both user-defined ObjectType and builtin TypeAlias instances via getPropertyType.

/**
 * Handle generic function calls with explicit or inferred type arguments
 */
function handleGenericFunctionCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase }) {
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const typeArgsNode = objectAccess?.children?.find(child => child.type === 'type_arguments');
  const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
  
  // Stamp the name node with the function type for hover support
  if (inferencePhase === 'inference' && name.inferredType === undefined) {
    // For func_def functions, construct the FunctionType from params and return type
    const funcType = new FunctionType(definition.params, definition.type, definition.genericParams, definition.paramNames);
    name.inferredType = funcType;
  }
  
  const paramTypes = definition.params || [];
  let substitutions = {};
  let errors = [];
  
  if (explicitTypeArgs) {
    // Use explicit type arguments
    if (explicitTypeArgs.length !== definition.genericParams.length) {
      pushWarning(name, `Expected ${definition.genericParams.length} type arguments but got ${explicitTypeArgs.length}`);
    }
    
    for (let i = 0; i < Math.min(definition.genericParams.length, explicitTypeArgs.length); i++) {
      substitutions[definition.genericParams[i]] = explicitTypeArgs[i];
    }
  } else {
    // Infer type arguments from call site
    const result = inferGenericArguments(definition.genericParams, paramTypes, argTypes, typeAliases);
    substitutions = result.substitutions;
    errors = result.errors;
    
    if (errors.length > 0) {
      errors.forEach(error => pushWarning(name, error));
    }
  }
  
  // Check parameter types with substituted generics
  if (argTypes.length > 0) {
    const substitutedParams = paramTypes.map(p => substituteType(p, substitutions));
    const result = TypeChecker.checkFunctionCall(argTypes, substitutedParams, name.value, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }
  
  // Substitute type parameters in return type
  let returnType = definition.type ?? AnyType;
  returnType = substituteType(returnType, substitutions);
  pushInference(parent, returnType);
}

/**
 * Handle non-generic function calls
 */
function handleNonGenericFunctionCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase }) {
  // Stamp the name node with the function type for hover support
  if (inferencePhase === 'inference' && name.inferredType === undefined) {
    // For func_def functions, construct the FunctionType from params and return type
    const funcType = new FunctionType(definition.params, definition.type, undefined, definition.paramNames);
    name.inferredType = funcType;
  }
  
  if (argTypes.length > 0) {
    const result = TypeChecker.checkFunctionCall(argTypes, definition.params, name.value, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }
  
  const retType = definition.type ?? AnyType;
  pushInference(parent, retType);
}

/**
 * Handle function calls to variables whose type is a FunctionType (e.g., arrow functions)
 */
function handleFunctionTypedCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase, funcCallNode }) {
  const funcType = definition.type;
  if (!(funcType instanceof FunctionType)) {
    return false;
  }
  
  // Stamp the name node with the function type for hover support
  if (inferencePhase === 'inference' && name.inferredType === undefined) {
    name.inferredType = funcType;
  }
  
  // Note: arity checking for arrow functions is deferred until FunctionType tracks
  // paramHasDefault. Without that info we cannot distinguish required from optional
  // params, so we would produce false positives for functions with default args.

  // Validate argument types if the function has a defined signature
  if (funcType.params && funcType.params !== null && argTypes.length > 0) {
    const result = TypeChecker.checkFunctionCall(argTypes, funcType.params, name.value, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }
  
  // Push the return type as inference
  const returnType = funcType.returnType ?? AnyType;
  pushInference(parent, returnType);
  return true;
}

/**
 * Count the number of arguments in a func_call AST node by walking the
 * func_call_params chain. This is immune to the inference-array doubling
 * that occurs when the same AST is visited in both inference and checking
 * phases, so it gives the true call-site argument count.
 */
function countFuncCallArgs(funcCallNode) {
  let paramsNode = funcCallNode?.children?.find(c => c.type === 'func_call_params');
  if (!paramsNode) return 0;
  let count = 0;
  while (paramsNode) {
    count++;
    paramsNode = paramsNode.children?.find(c => c.type === 'func_call_params');
  }
  return count;
}

/**
 * Handle function calls in name_exp with validation
 */
function handleFunctionCall(name, access, parent, { lookupVariable, pushInference, pushWarning, typeAliases, inferencePhase }) {
  visitChildren(access);
  
  const definition = lookupVariable(name.value);
  const middleOA = access.children?.find(child => child.type === 'object_access');
  // Try 3-level path: method call like r.push(1) → middleOA('.', name, innerOA) → innerOA → func_call
  // Fall back to 2-level path: direct call like identity<T>(x) → middleOA(type_args?, func_call)
  const funcCallNode =
    middleOA?.children?.find(c => c.type === 'object_access')?.children?.find(c => c.type === 'func_call')
    ?? middleOA?.children?.find(c => c.type === 'func_call');
  const argTypes = funcCallNode?.inference || [];
  
  // Try array/builtin method calls first
  if (handleArrayOrBuiltinMethodCall(name, access, definition, parent, { pushInference, pushWarning, typeAliases })) {
    return true;
  }
  
  // Try primitive type method calls (e.g. s.toLowerCase(), n.toFixed())
  if (handlePrimitiveTypeMethodCall(name, access, definition, parent, { pushInference, typeAliases })) {
    return true;
  }
  
  // Try builtin object member access or calls (e.g. Math.cos(), Array.isArray)
  if (handleBuiltinNameAccess(name, access, parent, { pushInference, inferencePhase })) {
    return true;
  }

  // Handle function-typed variables (e.g., arrow function assignments)
  if (definition && definition.type instanceof FunctionType) {
    if (handleFunctionTypedCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase, funcCallNode })) {
      return true;
    }
  }
  
  // Handle user-defined function calls (from func_def)
  if (definition && definition.params) {
    // Arity check: use AST-based count (immune to inference-array doubling across two passes)
    // Skip if any required param is untyped (AnyType) — untyped params indicate component/VNode
    // functions whose props are optional at the call site.
    if (inferencePhase === 'checking') {
      const hasUntypedRequiredParam = definition.params.some(
        (p, i) => p === AnyType && !definition.paramHasDefault?.[i]
      );
      if (!hasUntypedRequiredParam) {
        const actualArgCount = countFuncCallArgs(funcCallNode);
        const required = definition.params.filter((_, i) => !definition.paramHasDefault?.[i]).length;
        const total = definition.params.length;
        if (actualArgCount < required || actualArgCount > total) {
          const expected = required === total ? `${total}` : `${required}-${total}`;
          pushWarning(name, `function ${name.value} takes ${expected} argument${total === 1 ? '' : 's'} but got ${actualArgCount}`);
        }
      }
    }
    if (definition.genericParams && definition.genericParams.length > 0) {
      handleGenericFunctionCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase });
    } else {
      handleNonGenericFunctionCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase });
    }
    return true;
  }

  // Unified handler for method calls on any typed variable instance:
  // covers user-defined ObjectType (e.g. this.double()) AND builtin TypeAlias
  // instances (e.g. ctx.mount() where ctx: Component).
  // getPropertyType() already resolves both cases transparently.
  const defType = definition?.type;
  if (definition && isTypedObjectInstance(defType)) {
    const outerOA = access.children?.find(c => c.type === 'object_access');
    const memberName = outerOA?.children?.find(c => c.type === 'name')?.value;
    const memberNode = outerOA?.children?.find(c => c.type === 'name');
    if (memberName) {
      const methodType = getPropertyType(defType, memberName, typeAliases);

      if (methodType === null) {
        // Property does not exist on this type.
        // Exception: class instances may have constructor-assigned properties or
        // inherited methods not tracked in the ObjectType map — suppress warning
        // for those and treat as AnyType to avoid false positives.
        if (!(defType instanceof ObjectType && defType.isClassInstance)) {
          pushWarning(memberNode ?? name, `Property '${memberName}' does not exist on type '${defType}'`);
        }
        pushInference(parent, AnyType);
        return true;
      }

      if (methodType instanceof FunctionType) {
        // Stamp member node with full FunctionType for hover
        if (inferencePhase === 'inference' && memberNode && memberNode.inferredType === undefined) {
          memberNode.inferredType = methodType;
        }

        if (methodType.genericParams?.length > 0) {
          // Generic method call (e.g. ctx.state<T>())
          // type_arguments lives in the INNER object_access (one level below the method name)
          const innerOA = outerOA?.children?.find(c => c.type === 'object_access');
          const typeArgsNode = innerOA?.children?.find(c => c.type === 'type_arguments')
                             ?? innerOA?.named?.type_args;
          const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
          let substitutions = {};
          if (explicitTypeArgs) {
            for (let i = 0; i < Math.min(methodType.genericParams.length, explicitTypeArgs.length); i++) {
              substitutions[methodType.genericParams[i]] = explicitTypeArgs[i];
            }
          } else {
            const result = inferGenericArguments(methodType.genericParams, methodType.params ?? [], argTypes, typeAliases);
            substitutions = result.substitutions;
            if (result.errors.length > 0) result.errors.forEach(e => pushWarning(memberNode ?? name, e));
          }
          pushInference(parent, substituteType(methodType.returnType ?? AnyType, substitutions));
        } else {
          if (methodType.params !== null && argTypes.length > 0) {
            const result = TypeChecker.checkFunctionCall(argTypes, methodType.params, memberName, typeAliases);
            if (!result.valid) result.warnings.forEach(w => pushWarning(memberNode ?? name, w));
          }
          pushInference(parent, methodType.returnType ?? AnyType);
        }
        return true;
      }

      // Property is not a function — handle chained array method calls
      // e.g. this.routes.find(...) where routes: Route[]
      const resolvedMethodType = resolveTypeAlias(methodType, typeAliases);
      if (resolvedMethodType instanceof ArrayType && defType instanceof ObjectType) {
        const innerOA = outerOA?.children?.find(c => c.type === 'object_access');
        if (innerOA) {
          const arrayMethodName = innerOA.children?.find(c => c.type === 'name')?.value;
          const arrayMethodNode = innerOA.children?.find(c => c.type === 'name');
          if (arrayMethodName) {
            const arrayMethodDef = getArrayMemberType(resolvedMethodType, arrayMethodName);
            if (arrayMethodDef === AnyType) {
              pushWarning(innerOA, `Property '${arrayMethodName}' does not exist on type ${resolvedMethodType}`);
            }
            if (arrayMethodDef) {
              const finalType = extractReturnType(arrayMethodDef);
              if (memberNode) memberNode.inferredType = resolvedMethodType;
              if (arrayMethodNode) arrayMethodNode.inferredType = finalType;
              pushInference(parent, finalType);
              return true;
            }
          }
        }
      }

      // Plain (non-function) property — stamp and push
      if (memberNode) memberNode.inferredType = methodType;
      pushInference(parent, methodType);
      return true;
    }
  }

  return false;
}

/**
 * Validate property chain access on a type and annotate nodes
 */
function validatePropertyChain(properties, definition, typeAliases, { pushInference, pushWarning, access }) {
  let currentType = getBaseTypeOfLiteral(definition.type);
  let validatedPath = [];
  let invalidProperty = null;
  let invalidPropertyNode = null;
  let invalidPropertyType = null;
  
  for (let i = 0; i < properties.length; i++) {
    const { name: propName, node: propNode } = properties[i];
    const resolvedCurrent = resolveTypeAlias(currentType, typeAliases);
    
    // Skip empty objects
    if (resolvedCurrent.toString() === '{}') {
      break;
    }
    
    // Check if we can continue validating
    const isCurrentPrimitive = isValidPrimitiveType(resolvedCurrent);
    const isCurrentObject = resolvedCurrent instanceof ObjectType;
    const isCurrentArray = resolvedCurrent instanceof ArrayType;
    if (!isCurrentPrimitive && !isCurrentObject && !isCurrentArray) {
      break;
    }
    
    const nextType = getPropertyType(currentType, propName, typeAliases);
    // getArrayMemberType returns AnyType (not null) for unknown members, so treat
    // AnyType result on an ArrayType as an unknown property
    if (nextType === null || (resolvedCurrent instanceof ArrayType && nextType === AnyType)) {
      invalidProperty = propName;
      invalidPropertyNode = propNode;
      invalidPropertyType = resolvedCurrent;
      validatedPath.push(propName);
      break;
    }
    
    pushInference(propNode, nextType);
    propNode.inferredType = resolveTypeAlias(nextType, typeAliases);
    validatedPath.push(propName);
    currentType = getBaseTypeOfLiteral(nextType);
  }
  
  return { currentType, validatedPath, invalidProperty, invalidPropertyNode, invalidPropertyType };
}

/**
 * Handle property access on object types and primitives
 */
function handleObjectPropertyAccess(name, access, parent, definition, { pushInference, pushWarning, typeAliases }) {
  const resolvedType = resolveTypeAlias(definition.type, typeAliases);

  // When optional chaining (?.) is used, suppress missing-property warnings:
  // accessing a potentially-absent property via ?. is intentional in JS, so we
  // resolve the type normally when the property exists and silently return AnyType
  // when it doesn't (instead of emitting a spurious warning).
  const hasOptionalChain = access.children?.some(child =>
    child.type === 'object_access' && child.children?.some(c => c.type === 'optional_chain')
  );
  const effectivePushWarning = hasOptionalChain ? () => {} : pushWarning;

  // Skip validation for empty object type
  if (resolvedType instanceof ObjectType && resolvedType.properties.size === 0) {
    visitChildren(access);
    pushInference(parent, AnyType);
    return true;
  }
  
  // Handle array property access
  if (resolvedType instanceof ArrayType) {
    const { memberName: propName, memberNode: propNode } = getObjectAccessMemberInfo(access);
    if (propName) {
      const memberType = getArrayMemberType(resolvedType, propName);
      if (memberType === AnyType) {
        effectivePushWarning(access, `Property '${propName}' does not exist on type ${definition.type}`);
      }
      if (propNode) propNode.inferredType = memberType;
      name.inferredType = resolvedType;
      pushInference(parent, memberType);
      return true;
    }
  }
  
  // Handle built-in object type aliases (e.g. ctx: Component, router: Router)
  // getPropertyType already knows how to look up both user ObjectType and builtin
  // TypeAlias types, so we reuse it here for consistency.
  if (resolvedType instanceof TypeAlias && isBuiltinObjectType(resolvedType.name)) {
    const { memberName: propName, memberNode: propNode } = getObjectAccessMemberInfo(access);
    if (propName) {
      const propType = getPropertyType(resolvedType, propName, typeAliases);
      if (propType === null) {
        effectivePushWarning(propNode ?? access, `Property '${propName}' does not exist on type '${resolvedType.name}'`);
        name.inferredType = resolvedType;
        pushInference(parent, AnyType);
        return true;
      }
      // Preserve the full type (e.g. FunctionType for methods) so hover shows the
      // correct signature rather than just the return type.
      if (propNode) propNode.inferredType = propType;
      name.inferredType = resolvedType;
      pushInference(parent, propType);
      return true;
    }
  }
  
  // For class instance types: they only expose method signatures — constructor-
  // assigned properties (this.x = ...) are not tracked yet. Validate the full
  // access chain starting from any known declared property; suppress warnings
  // only when the very first property is unknown (may be constructor-assigned).
  if (resolvedType instanceof ObjectType && resolvedType.isClassInstance) {
    const properties = extractPropertyNodesFromAccess(access);
    name.inferredType = resolvedType;

    if (properties.length > 0) {
      const firstPropType = getPropertyType(resolvedType, properties[0].name, typeAliases);
      if (firstPropType === null) {
        // Unknown first property — likely constructor-assigned, suppress warning
        visitChildren(access);
        pushInference(parent, AnyType);
        return true;
      }

      // First property is declared — validate the full chain at arbitrary depth
      const { currentType, validatedPath, invalidProperty, invalidPropertyNode, invalidPropertyType } = validatePropertyChain(
        properties,
        definition,
        typeAliases,
        { pushInference, pushWarning: effectivePushWarning, access }
      );

      if (invalidProperty) {
        const onType = invalidPropertyType ?? definition.type;
        effectivePushWarning(invalidPropertyNode ?? access, `Property '${invalidProperty}' does not exist on type ${onType}`);
        visitChildren(access);
        pushInference(parent, AnyType);
        return true;
      }

      pushInference(parent, currentType);
      return true;
    }

    visitChildren(access);
    pushInference(parent, AnyType);
    return true;
  }

  // Validate property access for object types and primitive scalar types.
  const isPrimitiveType = isValidPrimitiveType(resolvedType);
  const isObjectType = resolvedType instanceof ObjectType;
  
  if (isPrimitiveType || isObjectType) {
    const properties = extractPropertyNodesFromAccess(access);
    
    if (properties.length > 0) {
      name.inferredType = resolvedType;
      
      const { currentType, validatedPath, invalidProperty, invalidPropertyNode, invalidPropertyType } = validatePropertyChain(
        properties,
        definition,
        typeAliases,
        { pushInference, pushWarning: effectivePushWarning, access }
      );
      
      if (invalidProperty) {
        const onType = invalidPropertyType ?? definition.type;
        effectivePushWarning(invalidPropertyNode ?? access, `Property '${invalidProperty}' does not exist on type ${onType}`);
        visitChildren(access);
        pushInference(parent, AnyType);
        return true;
      }
      
      pushInference(parent, currentType);
      return true;
    }
  }
  
  return false;
}

/**
 * Handle simple variable reference without property access
 */
function handleSimpleVariable(name, parent, definition, getState) {
  const { pushInference, typeAliases } = getState();  
  if (!definition) {
    // Check if the identifier is a known type alias (e.g. `User` or `choices` used
    // standalone). The inference engine's typeAliases object includes imported aliases,
    // so stamp inferredType here for hover support.
    if (name.inferredType === undefined) {
      const aliasEntry = typeAliases[name.value];
      if (aliasEntry !== undefined) {
        name.inferredType = aliasEntry;
      } else if (isBuiltinObjectType(name.value)) {
        // Bare builtin reference (e.g. `Array`, `Math`) — show its name as type
        name.inferredType = new TypeAlias(name.value);
      }
    }
    pushInference(parent, AnyType);
    return;
  }
  
  if (definition.source === 'func_def') {
    pushInference(parent, AnyFunctionType);
    const { inferencePhase } = getState();
    if (inferencePhase === 'inference' && name.inferredType === undefined) {
      // Build the full function signature for hover support
      const funcType = definition.params
        ? new FunctionType(
            definition.params,
            definition.type ?? AnyType,
            definition.genericParams ?? [],
            definition.paramNames ?? []
          )
        : AnyFunctionType;
      name.inferredType = funcType;
    }
  } else {
    pushInference(parent, definition.type);
    const { typeAliases } = getState();
    if (name.inferredType === undefined) {
      name.inferredType = resolveTypeAlias(definition.type, typeAliases);
    }
  }
}

function createExpressionHandlers(getState) {
  return {
    math: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushInference(parent, PrimitiveType.Number);
    },
    exp: (node, parent) => {
      resolveTypes(node);
      pushToParent(node, parent);
    },
    name_exp: (node, parent) => {
      const { lookupVariable, pushInference, pushWarning, typeAliases, inferencePhase } = getState();
      const { name, access } = node.named;
      
      if (access) {
        // Lookup variable definition early so we can stamp the name node
        const definition = lookupVariable(name.value);
        
        // Stamp the name node with its type for hover support
        if (definition && definition.type) {
          if (definition.source === 'func_def') {
            if (inferencePhase === 'inference' && name.inferredType === undefined) {
              const funcType = definition.params
                ? new FunctionType(
                    definition.params,
                    definition.type ?? AnyType,
                    definition.genericParams ?? [],
                    definition.paramNames ?? []
                  )
                : AnyFunctionType;
              name.inferredType = funcType;
            }
          } else {
            if (name.inferredType === undefined) {
              // Normalize literal types to their base types for hover display
              // But preserve type aliases as-is
              const typeToStamp = getBaseTypeOfLiteral(definition.type);
              name.inferredType = typeToStamp;
            }
          }
        }
        
        // Check if this is a function call (search recursively through nested
        // object_access nodes, e.g. obj.method(x) has func_call one level deeper)
        function hasFuncCallInObjectAccess(node) {
          if (!node || node.type !== 'object_access') return false;
          if (node.children?.some(c => c.type === 'func_call')) return true;
          return node.children?.some(c => hasFuncCallInObjectAccess(c)) ?? false;
        }
        const hasFuncCall = access.children?.some(child => hasFuncCallInObjectAccess(child));
        
        if (hasFuncCall) {
          if (handleFunctionCall(name, access, parent, { lookupVariable, pushInference, pushWarning, typeAliases, inferencePhase })) {
            return;
          }
        }
        
        // Try built-in member access (e.g. Math.PI, Array.isArray)
        if (handleBuiltinNameAccess(name, access, parent, { pushInference, inferencePhase })) {
          return;
        }
        
        // Try object property access
        const defTypeIsAny = !definition?.type || definition.type === AnyType ||
                              (definition.type instanceof PrimitiveType && definition.type.name === 'any');
        
        if (definition && definition.type && !defTypeIsAny) {
          if (handleObjectPropertyAccess(name, access, parent, definition, { pushInference, pushWarning, typeAliases })) {
            return;
          }
        }
        
        // Unknown variable or couldn't validate.
        // If access contains a binary operation (e.g. value + 'a'), propagate the
        // variable's type so the math/boolean type check fires on the parent.
        // For function/property accesses that fell through, keep AnyType to avoid
        // leaking the raw literal type (e.g. LiteralType(5) from index.toString()).
        visitChildren(access);
        pushInference(parent, AnyType);
        return;
      }
      
      // No access - handle simple variable reference
      const definition = lookupVariable(name.value);
      handleSimpleVariable(name, parent, definition, getState);
    },
    operation: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      pushToParent(node, parent);
      // Push the operator node itself so parent can process the binary operation
      if (node.named.math_op) {
        pushInference(parent, node.named.math_op);
      }
      if (node.named.boolean_op) {
        pushInference(parent, node.named.boolean_op);
      }
    },
    access_or_operation: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushToParent(node, parent);
      pushInference(parent, node.named.access);
    },
    new_expression: (node, parent) => {
      const { pushInference, lookupVariable } = getState();
      resolveTypes(node);
      
      // Get the expression being constructed from the properly named exp child
      const expNode = node.named?.exp;
      
      let constructorType = new ObjectType();
      
      // Try to extract constructor name and check if it's a built-in
      let constructorName = null;
      
      if (expNode && expNode.type === 'name_exp') {
        // expNode directly is a name_exp
        const nameNode = expNode.named?.name;
        if (nameNode) {
          constructorName = nameNode.value;
        }
      } else if (expNode && expNode.children) {
        // Navigate through children to find the name
        for (const child of expNode.children) {
          if (child.type === 'name_exp') {
            const nameNode = child.named?.name;
            if (nameNode) {
              constructorName = nameNode.value;
              break;
            }
          }
        }
      }
      
      // If we have a constructor name and it's a built-in, use TypeAlias for it
      if (constructorName && isBuiltinObjectType(constructorName)) {
        constructorType = new TypeAlias(constructorName);
      } else if (constructorName) {
        // Check if it's a user-defined class in scope
        const classDef = lookupVariable(constructorName);
        if (classDef && classDef.source === 'class_def' && classDef.type) {
          constructorType = classDef.type;
        } else if (expNode && expNode.inference && expNode.inference.length > 0) {
          // Fall back to inferred type from the exp node
          const inferredType = expNode.inference[0];
          if (inferredType && !(inferredType instanceof ObjectType && inferredType.properties.size === 0) && inferredType !== AnyType) {
            constructorType = inferredType;
          }
        }
      } else if (expNode && expNode.inference && expNode.inference.length > 0) {
        // Otherwise, use the inferred type from the exp node if available
        const inferredType = expNode.inference[0];
        if (inferredType && !(inferredType instanceof ObjectType && inferredType.properties.size === 0) && inferredType !== AnyType) {
          constructorType = inferredType;
        }
      }
      
      pushInference(parent, constructorType);
    },

    short_if_expression: (node, parent) => {
      const { pushInference, pushScope, popScope, lookupVariable, inferencePhase } = getState();
      const { exp1, exp2, exp3 } = node.named;

      // Visit condition so its children are type-checked
      if (exp1) visit(exp1, node);

      const typeGuard = detectTypeofCheck(exp1) || detectEqualityCheck(exp1) || detectTruthinessCheck(exp1);

      // Visit true-branch — narrow the guard variable if a type guard is present
      const trueScratch = {};
      if (typeGuard) {
        const trueScope = pushScope();
        applyIfBranchGuard(trueScope, typeGuard, lookupVariable);
        visit(exp2, trueScratch);
        popScope();
      } else {
        visit(exp2, trueScratch);
      }

      // Visit else-branch — exclude the guard type if a type guard is present
      const falseScratch = {};
      if (exp3) {
        if (typeGuard) {
          const falseScope = pushScope();
          applyElseBranchGuard(falseScope, typeGuard, lookupVariable);
          visit(exp3, falseScratch);
          popScope();
        } else {
          visit(exp3, falseScratch);
        }
      }

      // Compute and push result type only during inference phase
      // (pushInference is a no-op during checking; children are still visited above
      // with proper scopes so type warnings fire correctly in both phases)
      if (inferencePhase === 'inference') {
        const trueType = trueScratch.inference?.[0] ?? AnyType;
        const falseType = exp3 ? (falseScratch.inference?.[0] ?? AnyType) : null;

        let resultType;
        if (!falseType) {
          // No else-branch: the expression evaluates to `undefined` when the
          // condition is false, so the result type must include undefined.
          resultType = createUnionType([trueType, UndefinedType]);
        } else if (trueType.equals?.(falseType)) {
          resultType = trueType;
        } else {
          resultType = createUnionType([trueType, falseType]);
        }

        node.inferredType = resultType;
        pushInference(parent, resultType);
      }
    },
  };
}

export default createExpressionHandlers;
