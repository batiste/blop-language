// ============================================================================
// Statement Handlers - Type inference for statements (coordinator module)
// ============================================================================

import { resolveTypes, pushToParent, visitChildren, visit, stampInferencePhaseOnly } from '../visitor.js';
import { parseTypeExpression, parseGenericParams, parseGenericConstraints, resolveTypeAlias, isTypeCompatible, getPropertyType, getAnnotationType, ArrayType, ObjectType, getBaseTypeOfLiteral, createUnionType } from '../typeSystem.js';
import { UndefinedType, StringType, NumberType, LiteralType, UnionType } from '../Type.js';
import { detectTypeofCheck, detectEqualityCheck, detectTruthinessCheck, detectPredicateGuard, applyIfBranchGuard, applyElseBranchGuard, applyPostIfGuard, detectImpossibleComparison } from '../typeGuards.js';
import TypeChecker from '../typeChecker.js';
import { AnyType, AnyFunctionType, FunctionType } from '../Type.js';

// Import extracted handler creators
import { createImportHandler } from './imports.js';
import { createLoopHandlers } from './loops.js';
import { createControlFlowHandlers } from './controlFlow.js';

// Import shared utilities
import { extractDestructuringBindings, collectPropertyPathFromExp, widenLiteralTypes, getReturnTypeCount } from './shared.js';


function createStatementHandlers(getState) {
  // Import handlers from other modules and combine with local handlers
  const importHandlers = createImportHandler(getState);
  const loopHandlers = createLoopHandlers(getState);
  const controlFlowHandlers = createControlFlowHandlers(getState);

  return {
    GLOBAL_STATEMENT: resolveTypes,
    SCOPED_STATEMENTS: resolveTypes,
    
    SCOPED_STATEMENT: (node, parent) => {
      const { getFunctionScope, pushWarning, typeAliases, inferencePhase } = getState();
      
      // Check if this is a return statement by looking at the first child
      if (node.children && node.children[0] && node.children[0].type === 'return') {
        const functionScope = getFunctionScope();
        if (functionScope && functionScope.__returnTypes) {
          // Visit children to get type inference on expressions
          visitChildren(node);
          
          // Find the exp child and get its type
          let returnType = UndefinedType;
          let returnExpNode = null;
          for (const child of node.children) {
            if (child.type === 'exp') {
              returnExpNode = child;
              if (child.inference && child.inference.length > 0) {
                // Take the last inference value, which is the final result after all operations
                returnType = child.inference[child.inference.length - 1];
              }
              break;
            }
          }

          // Validate each return expression against the declared return type.
          // Doing this per-statement avoids the problem where any-typed returns
          // contaminate the end-of-function union check.
          if (inferencePhase === 'checking' && returnExpNode) {
            const declaredReturnType = functionScope.__declaredReturnType;
            if (declaredReturnType && returnType !== AnyType) {
              if (!isTypeCompatible(returnType, declaredReturnType, typeAliases)) {
                const displayType = getBaseTypeOfLiteral(returnType);
                // Use the original annotation type for the message (predicate functions store
                // BooleanType in __declaredReturnType for checking, but the annotation itself
                // is the predicate — e.g. "x is string").
                const displayDeclared = functionScope.__annotationReturnType ?? declaredReturnType;
                pushWarning(
                  returnExpNode,
                  `returns ${displayType} but declared as ${displayDeclared}`
                );
              }
            }
          }
          
          functionScope.__returnTypes.push(returnType);
          pushToParent(node, parent);
          return;
        }
      }
      
      // Not a return statement, handle normally
      resolveTypes(node);
      pushToParent(node, parent);
    },
    
    type_alias: (node, parent) => {
      const { typeAliases } = getState();
      
      // Extract the alias name and its type
      const aliasName = node.named.name.value;
      const aliasType = parseTypeExpression(node.named.type);
      
      // Parse generic parameters and constraints if present
      const genericParams = node.named.generic_params 
        ? parseGenericParams(node.named.generic_params)
        : [];
      const genericConstraints = node.named.generic_params
        ? parseGenericConstraints(node.named.generic_params)
        : null;
      
      // Store the type alias
      if (genericParams.length > 0) {
        // Store as generic type alias with parameters
        typeAliases[aliasName] = {
          type: aliasType,
          genericParams,
          genericConstraints: genericConstraints?.size > 0 ? genericConstraints : null,
        };
      } else {
        // Store as regular type alias (maintain backward compatibility)
        typeAliases[aliasName] = aliasType;
      }
      
      // Type aliases don't produce values, so don't push to parent
    },

    ...importHandlers,
    
    assign: (node, parent) => {
      const { pushInference, lookupVariable, typeAliases, pushWarning, stampTypeAnnotation, getCurrentScope } = getState();
      
      if (node.named.destructuring) {
        // Handle destructuring assignment: { total, text } = attributes
        // Optional annotation: { a, b }: MyType = expr
        if (node.named.annotation) {
          stampTypeAnnotation(node.named.annotation);
        }
        visit(node.named.exp, node);
        const expNode = node.named.exp;
        // The type may be on expNode.inference (when visited via resolveTypes) OR
        // on node.inference (when the exp is a name_exp visited directly as a child,
        // which pushes its result to the parent statement node).
        const expValueType = expNode?.inference?.[0] || node.inference?.[0];
        // Annotation overrides the inferred RHS type for property lookup purposes
        const annotationType = node.named.annotation ? getAnnotationType(node.named.annotation) : null;
        const valueType = annotationType || expValueType;
        
        const destNode = node.named.destructuring.named.values;
        const bindings = extractDestructuringBindings(destNode);

        // Stamp any inline annotations for hover support (independent of rhs type)
        for (const { annotationNode } of bindings) {
          if (annotationNode) stampTypeAnnotation(annotationNode);
        }

        if (valueType && valueType !== AnyType) {
          const resolvedValueType = resolveTypeAlias(valueType, typeAliases);
          
          // Extract destructured variable names and stamp them with property types
          if (resolvedValueType instanceof ObjectType) {
            for (const {propertyPath, propertyName, varName, node: varNode, annotationNode} of bindings) {
              if (annotationNode) {
                // Inline type annotation overrides the inferred property type
                const annotationType = getAnnotationType(annotationNode);
                if (annotationType) {
                  varNode.inferredType = annotationType;
                  // Update the live scope so subsequent lookups of this variable
                  // (e.g. as the rhs of another destructuring) use the declared type.
                  getCurrentScope()[varName] = { type: annotationType };
                }
              } else {
                // Walk propertyPath using raw property map to preserve optional markers.
                // getPropertyType() strips nullish/undefined which would drop optional?.
                let leafType = null;
                let currentObjType = resolvedValueType;

                for (const propName of propertyPath) {
                  const resolved = resolveTypeAlias(currentObjType, typeAliases);
                  if (resolved instanceof ObjectType) {
                    const prop = resolved.properties.get(propName);
                    if (prop) {
                      leafType = prop.type;
                      if (prop.optional && leafType) {
                        leafType = new UnionType([leafType, UndefinedType]);
                      }
                      currentObjType = prop.type;
                    } else {
                      leafType = null;
                      break;
                    }
                  } else {
                    leafType = null;
                    break;
                  }
                }

                if (leafType !== null) {
                  // Widen literal types to their abstract base types
                  const widenedType = widenLiteralTypes(leafType);
                  varNode.inferredType = widenedType;
                } else {
                  pushWarning(
                    destNode,
                    `Property '${propertyName}' does not exist on type ${valueType}`
                  );
                }
              }
            }
          }
        } else {
          // rhs type is unknown — still stamp any inline annotations
          for (const { varName, node, annotationNode } of bindings) {
            if (annotationNode) {
              const annotationType = getAnnotationType(annotationNode);
              if (annotationType) {
                node.inferredType = annotationType;
                getCurrentScope()[varName] = { type: annotationType };
              }
            }
          }
        }
        
        pushToParent(node, parent);
        pushInference(parent, node);
      } else if (node.named.name || node.named.path) {
        if (node.named.annotation) {
          // Stamp the type annotation for hover support
          stampTypeAnnotation(node.named.annotation);
        }
        
        visit(node.named.exp, node);
        
        // Check if this is a property assignment via exp:path (e.g., u.name = 1 or u.b.c = x)
        if (node.named.path && !node.named.name) {
          // Visit the LHS exp so __objectType/__propertyName get stamped by handlePropertyAccess
          visit(node.named.path, node);

          // After inlining object_access into exp, the LHS path exp itself carries
          // __objectType and __propertyName directly (stamped by handlePropertyAccess).
          const pathExpNode = node.named.path;

          if (pathExpNode && pathExpNode.__objectType !== undefined) {
            const objectType = pathExpNode.__objectType;

            // Readonly guard: values declared with 'as const' or 'readonly' cannot be mutated.
            if (objectType.readonly) {
              pushWarning(node, `Cannot assign to a readonly value`);
            } else if (pathExpNode.__propertyName) {
              const propertyName = pathExpNode.__propertyName;

              // Per-property readonly guard (from `readonly` modifier in type annotation)
              const resolvedObjTypeForReadonly = resolveTypeAlias(objectType, typeAliases);
              const propEntry = resolvedObjTypeForReadonly?.properties?.get(propertyName);
              if (propEntry?.readonly) {
                pushWarning(node, `Cannot assign to readonly property '${propertyName}'`);
              }

              const valueType = node.named.exp?.inference?.[0];

              if (valueType && valueType !== AnyType) {
                // For class instances, skip validation for non-declared (constructor-assigned) props
                const resolvedObjType = resolveTypeAlias(objectType, typeAliases);
                const shouldSkipValidation =
                  resolvedObjType?.isClassInstance &&
                  !resolvedObjType.properties.has(propertyName);

                if (!shouldSkipValidation) {
                  const expectedType = getPropertyType(objectType, propertyName, typeAliases);
                  // Collect full property path string for error messages (e.g. "user.userType")
                  const fullPath = collectPropertyPathFromExp(pathExpNode);

                  if (expectedType === null) {
                    pushWarning(node, `Property '${fullPath}' does not exist on type ${objectType}`);
                  } else {
                    const resolvedExpectedType = resolveTypeAlias(expectedType, typeAliases);
                    if (!isTypeCompatible(valueType, resolvedExpectedType, typeAliases)) {
                      pushWarning(node, `Cannot assign ${valueType} to property '${fullPath}' of type ${expectedType}`);
                    }
                  }
                }
              }
            }
          }
        } else if (node.named.name && !node.named.path) {
          // Simple variable assignment: stamp the variable name  
          // At definition site, prefer declared annotation type over inferred type
          if (node.named.annotation && node.named.name.inferredType === undefined) {
            const annotationType = getAnnotationType(node.named.annotation);
            if (annotationType) {
              node.named.name.inferredType = annotationType;
            }
          } else {
            // No annotation, use inferred type from the expression
            const expNode = node.named.exp;
            const valueType = expNode && expNode.inference && expNode.inference[0];
            
            if (valueType && valueType !== AnyType && node.named.name.inferredType === undefined) {
              node.named.name.inferredType = resolveTypeAlias(valueType, typeAliases);
            }
          }
        }
        
        pushToParent(node, parent);
        pushInference(parent, node);
      }
    },
    
    ...controlFlowHandlers,
    ...loopHandlers,

    try_catch: (node, parent) => {
      const { pushScope, popScope } = getState();

      // Visit try body in an isolated scope so variables declared inside
      // do not leak into the surrounding scope.
      pushScope();
      if (node.named.statstry) {
        node.named.statstry.forEach(stat => visit(stat, node));
      }
      popScope();

      // Visit catch body in an isolated scope.  The catch variable (e.g. `err`
      // in `catch err { ... }`) is bound here as AnyType because the runtime
      // exception value has no static type information.
      const catchScope = pushScope();
      const catchVarName = node.named.name?.value;
      if (catchVarName) {
        catchScope[catchVarName] = { type: AnyType, node: node.named.name };
      }
      if (node.named.statscatch) {
        node.named.statscatch.forEach(stat => visit(stat, node));
      }
      popScope();

      pushToParent(node, parent);
    },
  };
}

export default createStatementHandlers;
