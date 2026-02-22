// ============================================================================
// Function Handlers - Type inference for function definitions and calls
// ============================================================================

import { visitChildren } from '../visitor.js';
import { 
  getAnnotationType, 
  isTypeCompatible,
  parseGenericParams,
  resolveTypeAlias,
  inferGenericArguments,
  substituteType,
} from '../typeSystem.js';
import { AnyType, UndefinedType, FunctionType, AnyFunctionType, createUnion, ObjectType } from '../Type.js';
import TypeChecker from '../typeChecker.js';

/**
 * Pre-scan a class_func_def node's signature without visiting its body.
 * Collects param types from annotations and the declared return type.
 * Used by class_def to build the class instance ObjectType before method
 * bodies are traversed, so `this.method()` can be typed correctly.
 */
function prescanMethodSignature(methodNode, { stampTypeAnnotation }) {
  const params = [];
  const paramNames = [];

  // Recursively collect func_def_params nodes, stopping at nested func_defs
  function collectParams(node) {
    if (!node) return;
    if (node.type === 'func_def') return; // don't cross into nested lambdas
    if (node.type === 'func_def_params') {
      let paramType = AnyType;
      if (node.named?.annotation) {
        stampTypeAnnotation(node.named.annotation);
        const resolved = getAnnotationType(node.named.annotation);
        if (resolved) paramType = resolved;
      }
      params.push(paramType);
      paramNames.push(node.named?.name?.value ?? '_');
      // still recurse for chained params in children
    }
    if (node.children) {
      for (const child of node.children) collectParams(child);
    }
  }

  if (methodNode.named?.params) collectParams(methodNode.named.params);

  // Generic parameters declared on this method
  const genericParams = methodNode.named?.generic_params
    ? parseGenericParams(methodNode.named.generic_params)
    : [];

  // Return type from annotation if present, otherwise AnyType placeholder
  let returnType = AnyType;
  if (methodNode.named?.annotation) {
    stampTypeAnnotation(methodNode.named.annotation);
    const resolved = getAnnotationType(methodNode.named.annotation);
    if (resolved) returnType = resolved;
  }

  return new FunctionType(params, returnType, genericParams, paramNames);
}

/**
 * Parse generic params from a node and register them in the given scope as
 * valid type placeholders. Returns the parsed param name array.
 */
function registerGenericParams(scope, genericParamsNode) {
  if (!genericParamsNode) return [];
  const genericParams = parseGenericParams(genericParamsNode);
  if (genericParams.length > 0) {
    scope.__genericParams = genericParams;
    for (const param of genericParams) {
      scope[param] = { type: param, isGenericParam: true };
    }
  }
  return genericParams;
}

/**
 * Read the declared return type annotation (if any), stamp it for hover
 * support, and store it on the scope for return-statement validation.
 * Returns the resolved type or null.
 */
function setupDeclaredReturnType(scope, annotation, stampTypeAnnotation) {
  if (!annotation) return null;
  stampTypeAnnotation(annotation);
  const declaredType = getAnnotationType(annotation);
  if (declaredType) scope.__declaredReturnType = declaredType;
  return declaredType ?? null;
}

/**
 * Derive the effective return type from the types collected by return
 * statements during body traversal. Mirrors the union-building logic used
 * in both func_def and class_func_def.
 */
function collectReturnType(returnTypes) {
  if (!returnTypes?.length) return UndefinedType;
  const explicitReturns = returnTypes.filter(t => t && t !== UndefinedType);
  if (!explicitReturns.length) return UndefinedType;
  const union = createUnion(explicitReturns);
  return returnTypes.some(t => t === UndefinedType)
    ? createUnion([union, UndefinedType])
    : union;
}

/**
 * Pure structural check: does every code path through `stats` end with an
 * unconditional return, throw, or implicit VNode return?
 * Operates on arrays of SCOPED_STATEMENTS nodes (the `named.stats` arrays
 * produced by func_body, condition, and else_if grammar rules).
 */
function alwaysReturns(stats) {
  for (const scopedStatements of stats ?? []) {
    const stmt = scopedStatements?.children?.find(c => c.type === 'SCOPED_STATEMENT');
    if (!stmt) continue;
    const first = stmt.children?.[0];
    if (!first) continue;
    if (first.type === 'return' || first.type === 'throw') return true;
    if (first.type === 'virtual_node' || first.type === 'virtual_node_exp') return true;
    if (first.type === 'condition' && conditionAlwaysReturns(first)) return true;
  }
  return false;
}

function conditionAlwaysReturns(condNode) {
  const elseNode = condNode.named?.elseif;
  if (!elseNode) return false;
  if (!alwaysReturns(condNode.named?.stats)) return false;
  return elseIfAlwaysReturns(elseNode);
}

function elseIfAlwaysReturns(elseIfNode) {
  if (!elseIfNode.named?.exp) {
    // Terminal else branch — must return on all its own paths
    return alwaysReturns(elseIfNode.named?.stats ?? []);
  }
  // Chained elseif — this branch AND the remaining chain must both always return
  if (!alwaysReturns(elseIfNode.named?.stats)) return false;
  if (!elseIfNode.named?.elseif) return false; // no terminal else, can fall through
  return elseIfAlwaysReturns(elseIfNode.named.elseif);
}

/**
 * Find the first dead (unreachable) statement in a stats array.
 * A statement is dead if it follows a statement that always terminates
 * (return, throw, VNode, or a condition with exhaustive return branches).
 * Returns the inner statement node of the first dead statement, or null.
 */
function findDeadCodeStart(stats) {
  const statsArr = stats ?? [];

  // Build an index of the real (non-blank) statement nodes for easy lookup.
  // Each entry is { index, first } where first is the inner SCOPED_STATEMENT child.
  const realStatements = [];
  for (let i = 0; i < statsArr.length; i++) {
    const stmt = statsArr[i]?.children?.find(c => c.type === 'SCOPED_STATEMENT');
    if (!stmt) continue;
    const first = stmt.children?.[0];
    if (!first) continue;
    realStatements.push({ first });
  }

  for (let i = 0; i < realStatements.length - 1; i++) {
    const { first } = realStatements[i];
    const terminates =
      first.type === 'return' ||
      first.type === 'throw' ||
      first.type === 'virtual_node' ||
      first.type === 'virtual_node_exp' ||
      (first.type === 'condition' && conditionAlwaysReturns(first));

    if (terminates) {
      // The next real statement is dead code — return it for warning positioning
      return realStatements[i + 1].first;
    }
  }
  return null;
}

function createFunctionHandlers(getState) {
  return {
    func_def_params: (node) => {
      const { getCurrentScope, inferencePhase, stampTypeAnnotation, typeAliases } = getState();
      const scope = getCurrentScope();
      
      if (!scope.__currentFctParams) {
        scope.__currentFctParams = [];
      }
      if (!scope.__currentFctParamNames) {
        scope.__currentFctParamNames = [];
      }
      
      let paramType = AnyType;
      const { annotation } = node.named;
      if (annotation) {
        stampTypeAnnotation(annotation);
        const resolved = getAnnotationType(annotation);
        if (resolved) {
          scope[node.named.name.value] = { type: resolved };
          paramType = resolved;
        }
      }

      scope.__currentFctParams.push(paramType);
      scope.__currentFctParamNames.push(node.named.name.value);
      if (inferencePhase === 'inference' && node.named.name) {
        node.named.name.inferredType = resolveTypeAlias(paramType, typeAliases);
      }
      visitChildren(node);
    },
    
    func_body_fat: (node, parent) => {
      const { getFunctionScope } = getState();
      
      // Check if this is an expression body (implicit return)
      // func_body_fat can be either `{ stats }` or just `exp`
      if (node.named.exp) {
        // This is an implicit return: visit the expression to get its type
        visitChildren(node);
        
        // Get the type of the expression and add it as an implicit return
        const functionScope = getFunctionScope();
        if (functionScope && functionScope.__returnTypes && node.named.exp.inference) {
          const returnType = node.named.exp.inference[0] ?? UndefinedType;
          functionScope.__returnTypes.push(returnType);
        }
      } else {
        // Regular block body
        visitChildren(node);
      }
    },
    
    func_def: (node, parent) => {
      const { getCurrentScope, pushScope, popScope, pushInference, pushWarning, stampTypeAnnotation, symbolTable } = getState();
      const parentScope = getCurrentScope();
      const scope = pushScope();
      scope.__currentFctParams = [];
      scope.__returnTypes = [];
      
      // Parse generic parameters if present
      const genericParams = registerGenericParams(scope, node.named.generic_params);

      // Pre-populate scope with type-annotated locals from binding phase
      const functionName = node.named?.name?.value;
      if (functionName && symbolTable) {
        const preLocals = symbolTable.functionLocals.get(functionName);
        if (preLocals) {
          Object.assign(scope, preLocals);
        }
      }

      // Pre-parse declared return type so SCOPED_STATEMENT can validate each
      // return expression individually during the checking phase.
      const { annotation } = node.named;
      setupDeclaredReturnType(scope, annotation, stampTypeAnnotation);
      
      visitChildren(node);

      // If not every code path returns, the function can fall through with implicit undefined.
      // alwaysReturns is a pure AST check — no type information needed.
      const bodyNode = node.named.body;
      const isExpressionBody = bodyNode?.type === 'func_body_fat' && bodyNode.named?.exp;
      if (!isExpressionBody && !alwaysReturns(bodyNode?.named?.stats)) {
        const explicitReturns = scope.__returnTypes.filter(t => t && t !== UndefinedType);
        if (explicitReturns.length > 0 && !scope.__returnTypes.includes(UndefinedType)) {
          scope.__returnTypes.push(UndefinedType);
        }
      }

      // Dead code detection: warn about statements that follow a terminating one.
      if (!isExpressionBody) {
        const deadNode = findDeadCodeStart(bodyNode?.named?.stats);
        if (deadNode) {
          pushWarning(deadNode, 'Dead code: this statement is unreachable');
        }
      }
      
      // Stamp the return type annotation for hover support (idempotent)
      if (annotation) {
        stampTypeAnnotation(annotation);
      }
      
      const declaredType = annotation ? getAnnotationType(annotation) : null;
      
      // Infer return type from actual returns (Type objects from inference stack)
      const inferredType = collectReturnType(scope.__returnTypes);
      
      // Anonymous functions as expressions should infer as a function type with proper signature
      if (parent && !node.named.name) {
        const finalType = declaredType ?? inferredType;
        const functionType = new FunctionType(scope.__currentFctParams, finalType, genericParams, scope.__currentFctParamNames);
        pushInference(parent, functionType);
        
        // Validate anonymous function return types if they have type annotations
        if (declaredType && inferredType !== AnyType) {
          const { typeAliases } = getState();
          if (!isTypeCompatible(inferredType, declaredType, typeAliases)) {
            // For anonymous functions, use the parent token for error reporting
            const errorToken = parent.children?.find(c => c.type === 'name') || parent;
            pushWarning(
              errorToken,
              `Function returns ${inferredType} but declared as ${declaredType}`
            );
          }
        }
      }
      
      if (node.named.name) {
        // Use declared Type if provided, otherwise fall back to inferred Type
        const finalType = declaredType ?? inferredType;
        
        // Validate named function return types
        if (declaredType && inferredType !== AnyType) {
          const { typeAliases } = getState();
          if (!isTypeCompatible(inferredType, declaredType, typeAliases)) {
            pushWarning(
              node.named.name,
              `Function '${node.named.name.value}' returns ${inferredType} but declared as ${declaredType}`
            );
          }
        }
        
        // Stamp the function name with its full function type for hover support
        const { inferencePhase } = getState();
        if (inferencePhase === 'inference' && node.named.name.inferredType === undefined) {
          // Create a FunctionType with the actual params and return type
          const functionType = new FunctionType(scope.__currentFctParams, finalType, genericParams, scope.__currentFctParamNames);
          node.named.name.inferredType = functionType;
        }
        
        parentScope[node.named.name.value] = {
          source: 'func_def',
          type: finalType,
          inferredReturnType: inferredType,
          declaredReturnType: declaredType,
          node,
          params: scope.__currentFctParams,
          paramNames: scope.__currentFctParamNames,
          genericParams: genericParams.length > 0 ? genericParams : undefined,
        };
      }
      popScope();
    },

    // -------------------------------------------------------------------------
    // Class definition: pre-scan all methods to build the instance ObjectType,
    // then visit children so method bodies are inferred with `this` typed.
    // -------------------------------------------------------------------------
    class_def: (node) => {
      const { getCurrentScope, pushScope, popScope, stampTypeAnnotation, inferencePhase } = getState();
      const parentScope = getCurrentScope();

      // Build the class instance type from method signatures and member declarations
      const members = new Map();
      for (const stat of node.named?.stats ?? []) {
        // stat is CLASS_STATEMENT, which can contain class_func_def or class_member_def
        const methodNode = stat.children?.find(c => c.type === 'class_func_def') ?? (stat.type === 'class_func_def' ? stat : null);
        if (methodNode) {
          const methodName = methodNode.named?.name?.value;
          if (!methodName) continue;
          const sig = prescanMethodSignature(methodNode, { stampTypeAnnotation });
          members.set(methodName, { type: sig, optional: false });
        }

        // Process class member declarations (e.g., routes: Route[])
        const memberNode = stat.children?.find(c => c.type === 'class_member_def') ?? (stat.type === 'class_member_def' ? stat : null);
        if (memberNode) {
          const memberName = memberNode.named?.name?.value;
          const annotation = memberNode.named?.annotation;
          if (!memberName || !annotation) continue;
          
          stampTypeAnnotation(annotation);
          const memberType = getAnnotationType(annotation);
          if (memberType) {
            members.set(memberName, { type: memberType, optional: false });
          }
        }
      }
      const className = node.named?.name?.value ?? null;
      const classType = new ObjectType(members, className);
      // Class types now track both method signatures and declared member types.
      // Constructor-assigned properties (this.x = ...) are still not tracked,
      // so mark as open to suppress false "property does not exist" warnings.
      classType.isClassInstance = true;

      // Register the class name in the enclosing scope
      if (node.named?.name) {
        parentScope[node.named.name.value] = {
          source: 'class_def',
          type: classType,
          node,
        };
        if (inferencePhase === 'inference' && node.named.name.inferredType === undefined) {
          node.named.name.inferredType = classType;
        }
      }

      // Push a scope for the class body so __currentClassType is scoped
      const scope = pushScope();
      scope.__currentClassType = classType;
      visitChildren(node);
      popScope();
    },

    // -------------------------------------------------------------------------
    // Class method: mirrors func_def but injects `this` typed as the class
    // instance ObjectType so `this.method()` / `this.prop` resolve correctly.
    // -------------------------------------------------------------------------
    class_func_def: (node) => {
      const { getCurrentScope, pushScope, popScope, pushWarning, stampTypeAnnotation, inferencePhase } = getState();

      // The class scope (pushed by class_def) holds __currentClassType
      const classType = getCurrentScope().__currentClassType;

      const scope = pushScope();
      scope.__currentFctParams = [];
      scope.__currentFctParamNames = [];
      scope.__returnTypes = [];
      scope.__isClassMethod = true;

      // Parse and register generic parameters if present
      const genericParams = registerGenericParams(scope, node.named.generic_params);

      // Inject `this` so method bodies can type-check this.prop / this.method()
      if (classType) {
        scope['this'] = { type: classType, source: 'class_this' };
      }

      // Pre-parse declared return type for return-statement validation
      const { annotation } = node.named;
      setupDeclaredReturnType(scope, annotation, stampTypeAnnotation);

      visitChildren(node);

      // Dead code detection: warn about statements that follow a terminating one.
      const classBodyNode = node.named.body;
      const classIsExpressionBody = classBodyNode?.type === 'func_body_fat' && classBodyNode.named?.exp;
      if (!classIsExpressionBody) {
        const deadNode = findDeadCodeStart(classBodyNode?.named?.stats);
        if (deadNode) {
          pushWarning(deadNode, 'Dead code: this statement is unreachable');
        }
      }

      if (annotation) stampTypeAnnotation(annotation);
      const declaredType = annotation ? getAnnotationType(annotation) : null;

      // Infer return type from collected return expressions
      const inferredType = collectReturnType(scope.__returnTypes);

      // Validate declared vs inferred return type (mirrors func_def)
      if (declaredType && inferredType !== AnyType) {
        const { typeAliases } = getState();
        if (!isTypeCompatible(inferredType, declaredType, typeAliases)) {
          pushWarning(
            node.named.name,
            `Method '${node.named.name?.value}' returns ${inferredType} but declared as ${declaredType}`
          );
        }
      }

      // Stamp hover type on the method name node
      if (inferencePhase === 'inference' && node.named.name?.inferredType === undefined) {
        node.named.name.inferredType = new FunctionType(
          scope.__currentFctParams,
          declaredType ?? inferredType,
          genericParams,
          scope.__currentFctParamNames
        );
      }

      popScope();
    },

    // -------------------------------------------------------------------------
    // Class member: stamp type annotation for hover support
    // -------------------------------------------------------------------------
    class_member_def: (node) => {
      const { stampTypeAnnotation, inferencePhase } = getState();
      const annotation = node.named?.annotation;
      if (!annotation) return;
      
      stampTypeAnnotation(annotation);
      const memberType = getAnnotationType(annotation);
      if (memberType && inferencePhase === 'inference' && node.named.name?.inferredType === undefined) {
        node.named.name.inferredType = memberType;
      }
    },
  };
}

export default createFunctionHandlers;
