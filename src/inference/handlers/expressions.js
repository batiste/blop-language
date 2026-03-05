// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

import { visit, visitChildren, resolveTypes, pushToParent } from '../visitor.js';
import { resolveTypeAlias, createUnionType, removeNullish, isUnionType, parseUnionType, getBaseTypeOfLiteral } from '../typeSystem.js';
import { parseTypeExpression } from '../typeParser.js';
import { ObjectType, PrimitiveType, AnyType, ArrayType, FunctionType, AnyFunctionType, UndefinedType, TypeAlias, GenericType, StringType, NumberType, BooleanType, NullType, NeverType } from '../Type.js';
import { detectTypeofCheck, detectEqualityCheck, detectTruthinessCheck, detectPredicateGuard, applyIfBranchGuard, applyElseBranchGuard } from '../typeGuards.js';
import TypeChecker from '../typeChecker.js';
import { isBuiltinObjectType } from '../builtinTypes.js';
import createAccessOperationHandlers from './accessOperations.js';
import { isConstAssertion, buildConstType, buildConstObjectType, buildConstArrayType } from './constAssertions.js';

/**
 * Dispatch handler for exp:obj object_access:access pairs.
 * Called from the exp handler when both named fields are present.
 * The object type is read from node.inference[0] — populated when visitChildren
 * visits the exp:obj child before this function is called.
 *
 * The handler resolves the result type, stamps node.inferredType, updates
 * node.inference to [resolvedType] (so callers like the return-statement
 * handler get the final type), and pushes to parent.
 */
function handleExpObjAccess(node, parent, getState) {
  const { inferencePhase, pushInference } = getState();
  const accessOps = createAccessOperationHandlers(getState);
  // In inference phase, node.inference[0] is the object child's type (pushed by visitChildren).
  // In checking phase, node.inference[0] is the *resolved result type* from inference phase,
  // so we must read the object type from the child's stamped inferredType instead.
  const objType = inferencePhase === 'checking'
    ? (node.named.obj?.inferredType ?? AnyType)
    : (node.inference?.[0] ?? AnyType);
  // Dispatch by which named field is present — each inlined alternative has exactly one of these.
  const hasFuncCall = !!node.named?.call;
  const hasBracket = !!node.named?.key;

  if (inferencePhase === 'inference') {
    // Use a temporary parent to capture the resolved type from the sub-handler.
    const tmp = { inference: [] };
    if (hasFuncCall) {
      accessOps.handleFuncCallAccess(node, tmp, objType, getState);
    } else if (hasBracket) {
      accessOps.handleBracketAccess(node, tmp, objType, getState);
    } else {
      accessOps.handlePropertyAccess(node, tmp, objType, getState);
    }
    const resolvedType = tmp.inference?.[0] ?? AnyType;
    // Replace intermediate obj-type with the resolved result so callers
    // reading node.inference[0] see the final expression type.
    node.inference = [resolvedType];
    if (node.inferredType === undefined) node.inferredType = resolvedType;
    pushInference(parent, resolvedType);
  } else {
    // Checking phase: sub-handlers emit warnings as side-effects; no type propagation needed.
    if (hasFuncCall) {
      accessOps.handleFuncCallAccess(node, null, objType, getState);
    } else if (hasBracket) {
      accessOps.handleBracketAccess(node, null, objType, getState);
    } else {
      accessOps.handlePropertyAccess(node, null, objType, getState);
    }
  }
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
        // Bare builtin reference (e.g. `Array`, `Math`) — push TypeAlias so that
        // validateObjectPropertyAccess in visitor.js can look up its members
        const builtinAlias = new TypeAlias(name.value);
        name.inferredType = builtinAlias;
        pushInference(parent, builtinAlias);
        return;
      }
    }
    pushInference(parent, AnyType);
    return;
  }
  
  if (definition.source === 'func_def') {
    // Build the full function type for both type resolution and hover
    const funcType = definition.params
      ? new FunctionType(
          definition.params,
          definition.type ?? AnyType,
          definition.genericParams ?? [],
          definition.paramNames ?? [],
          definition.paramHasDefault ?? null,
          definition.genericConstraints ?? null
        )
      : AnyFunctionType;
    if (definition.params) {
      funcType.funcName = name.value; // preserve for arity error messages
    }
    pushInference(parent, funcType);
    if (name.inferredType === undefined) {
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

/**
 * Handle inlined binary operation alternatives: math, boolean, nullish coalescing.
 * All five inlined operation alternatives have exp:left + one of math_op/boolean_op/nullish_op.
 */
function handleExpBinaryOp(node, parent, getState) {
  const { inferencePhase, pushInference, pushWarning, typeAliases } = getState();
  const { math_op, boolean_op, nullish_op, left, right } = node.named;

  // In inference phase the two exp children pushed their types to node.inference[0,1].
  // In checking phase use the stamped inferredType from the inference phase.
  const leftType = inferencePhase === 'checking'
    ? (left?.inferredType ?? AnyType)
    : (node.inference?.[0] ?? AnyType);
  const rightType = inferencePhase === 'checking'
    ? (right?.inferredType ?? AnyType)
    : (node.inference?.[1] ?? AnyType);

  if (math_op) {
    const result = TypeChecker.checkMathOperation(leftType, rightType, math_op.value);
    // pushWarning is a no-op in inference phase, so this is safe to call unconditionally
    if (!result.valid) {
      const msgs = result.warning ? [result.warning] : (result.warnings ?? []);
      msgs.forEach(w => pushWarning(node, w));
    }
    if (inferencePhase === 'inference') {
      const resultType = result.resultType ?? AnyType;
      node.inference = [resultType];
      node.inferredType = resultType;
      if (parent) pushInference(parent, resultType);
    }
  } else if (boolean_op) {
    // boolean_op covers boolean_operator tokens (||, &&, >=, <=, ==, !=, instanceof)
    // AND the bare < / > tokens (also labelled :boolean_op in the grammar).
    // Logical operators (|| and &&) return one of their operands, not a boolean;
    // comparison operators always produce boolean.
    if (inferencePhase === 'inference') {
      const opValue = boolean_op.value;
      const isLogical = opValue === '||' || opValue === '&&';
      let resultType;
      if (isLogical) {
        const leftBase = getBaseTypeOfLiteral(leftType);
        const rightBase = getBaseTypeOfLiteral(rightType);
        resultType = leftBase === rightBase ? leftBase : createUnionType([leftBase, rightBase]);
      } else {
        resultType = BooleanType;
      }
      node.inference = [resultType];
      node.inferredType = resultType;
      if (parent) pushInference(parent, resultType);
    }
  } else if (nullish_op) {
    if (inferencePhase === 'inference') {
      const resolvedLeft = resolveTypeAlias(leftType, typeAliases) ?? leftType;
      const leftCanBeNullish = resolvedLeft === NullType || resolvedLeft === UndefinedType ||
        (isUnionType(resolvedLeft) && parseUnionType(resolvedLeft).some(t => t === NullType || t === UndefinedType));
      const resultType = leftCanBeNullish
        ? (() => {
            const nonNullishLeft = removeNullish(resolvedLeft);
            return nonNullishLeft === NeverType
              ? rightType
              : createUnionType([nonNullishLeft, rightType].filter(Boolean));
          })()
        : leftType;
      node.inference = [resultType];
      node.inferredType = resultType;
      if (parent) pushInference(parent, resultType);
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
      const { left, obj } = node.named ?? {};

      // Type assertion: expr as SomeType — override the inferred type with the asserted type.
      // In inference phase: stamp asserted type; in checking phase: just visit children
      // (no warning emitted — assertions are an explicit escape hatch).
      if (node.named?.type_cast !== undefined) {
        visitChildren(node);
        const { inferencePhase, pushInference } = getState();
        if (inferencePhase === 'inference') {
          let resultType;
          if (isConstAssertion(node.named.type_cast)) {
            // as const: freeze the expression type to its literal equivalent
            resultType = buildConstType(node.named.exp);
          } else {
            // Regular type assertion: as SomeType
            resultType = parseTypeExpression(node.named.type_cast);
          }
          node.inferredType = resultType;
          node.inference = [resultType];
          if (parent) pushInference(parent, resultType);
        }
        return;
      }

      // Compound-expression string interpolation: a.b'text 'val
      // Grammar: ['exp:left', 'str:str', 'inner_str_expression?:str_exp']
      // Always produces string; still visit children for type-checking.
      if (left !== undefined && node.named?.str !== undefined) {
        visitChildren(node);
        const { pushInference } = getState();
        node.inference = [StringType];
        node.inferredType = StringType;
        if (parent) pushInference(parent, StringType);
        return;
      }

      // Binary operations — five inlined alternatives all have exp:left
      if (left !== undefined) {
        visitChildren(node);
        handleExpBinaryOp(node, parent, getState);
        return;
      }

      // Property/bracket/call access — six inlined alternatives all have exp:obj
      if (obj !== undefined) {
        visitChildren(node);
        handleExpObjAccess(node, parent, getState);
        return;
      }

      const firstChild = node.children?.[0];

      // `!expr` — logical negation always produces boolean, regardless of the
      // operand's static type. Visit children so the operand is still type-checked.
      if (firstChild?.type === 'unary') {
        visitChildren(node);
        node.inference = [BooleanType];
        pushToParent(node, parent);
        return;
      }

      // `typeof expr` — always produces string at runtime, regardless of the
      // operand's static type. Visit children so operand is still type-checked,
      // then replace the inference with StringType.
      //
      // Special case: `typeof x == 'string'` is parsed by the grammar as
      // `typeof(x == 'string')` because `['operand', 'exp']` greedily consumes
      // the rest of the expression. When the inner exp is a boolean comparison
      // (boolean_op), the expression is typed as BooleanType — it evaluates to
      // a boolean check, not a string tag. This matches how the backend emits
      // `typeof x === 'string'` and how detectTypeofCheck() understands it.
      if (firstChild?.type === 'operand' && firstChild.value?.includes('typeof')) {
        visitChildren(node);
        const innerExp = node.children?.[1];
        const isComparisonPattern = !!(innerExp?.named?.boolean_op);
        node.inference = isComparisonPattern ? [BooleanType] : [StringType];
        pushToParent(node, parent);
        return;
      }

      // `await expr` — strip one Promise<T> wrapper to yield T
      if (firstChild?.type === 'await') {
        resolveTypes(node);
        if (node.inference) {
          for (let i = 0; i < node.inference.length; i++) {
            const t = node.inference[i];
            if (t instanceof GenericType &&
                t.baseType instanceof TypeAlias &&
                t.baseType.name === 'Promise' &&
                t.typeArgs.length > 0) {
              node.inference[i] = t.typeArgs[0];
            }
          }
        }
        pushToParent(node, parent);
        return;
      }

      // Unary math operator: `-expr`, `+expr`, `~expr` — always produces number.
      // Operand must itself be numeric, but we infer the result as number regardless.
      if (firstChild?.type === 'math_operator') {
        visitChildren(node);
        const { inferencePhase, pushInference } = getState();
        if (inferencePhase === 'inference') {
          node.inference = [NumberType];
          node.inferredType = NumberType;
          if (parent) pushInference(parent, NumberType);
        }
        return;
      }

      // `delete expr` — always produces boolean at runtime regardless of operand type.
      if (firstChild?.type === 'delete') {
        visitChildren(node);
        node.inference = [BooleanType];
        node.inferredType = BooleanType;
        pushToParent(node, parent);
        return;
      }

      resolveTypes(node);
      pushToParent(node, parent);
    },
    name_exp: (node, parent) => {
      const { lookupVariable } = getState();
      const { name } = node.named;
      const definition = lookupVariable(name.value);
      handleSimpleVariable(name, parent, definition, getState);
    },
    dynamic_import: (node, _parent) => {
      // dynamic import('./path') returns Promise<any>
      // No deeper inference needed; the module shape is unknown at compile time.
      const { pushInference } = getState();
      pushInference(_parent, new GenericType(new TypeAlias('Promise'), [AnyType]));
    },
    new_expression: (node, parent) => {
      const { pushInference, lookupVariable } = getState();
      resolveTypes(node);
      
      // Get the expression being constructed from the properly named exp child
      const expNode = node.named?.exp;
      
      let constructorType = new ObjectType();
      
      // Walk leftmost exp chain to find the name_exp (constructor name).
      // With the flat grammar, `new Store()` parses as:
      //   new_expression → exp(exp(name_exp('Store')), OA(func_call()))
      // so we must descend through nested exp nodes to find name_exp.
      let constructorName = null;
      function findConstructorName(n) {
        if (!n) return;
        if (n.type === 'name_exp') {
          constructorName = n.named?.name?.value ?? null;
          return;
        }
        if (n.type === 'exp') {
          // Look in direct children for name_exp first, then recurse into exp children
          for (const child of n.children ?? []) {
            if (child.type === 'name_exp') {
              constructorName = child.named?.name?.value ?? null;
              return;
            }
          }
          // Recurse into first exp child (leftmost chain)
          for (const child of n.children ?? []) {
            if (child.type === 'exp') {
              findConstructorName(child);
              if (constructorName) return;
            }
          }
        }
      }
      findConstructorName(expNode);
      
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

      const typeGuard = detectTypeofCheck(exp1) || detectEqualityCheck(exp1) || detectTruthinessCheck(exp1) || detectPredicateGuard(exp1);

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
