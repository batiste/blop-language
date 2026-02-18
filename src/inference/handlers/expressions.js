// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

import { visitChildren, resolveTypes, pushToParent } from '../visitor.js';
import { inferGenericArguments, substituteType, parseTypeExpression, getPropertyType, resolveTypeAlias } from '../typeSystem.js';
import { ObjectType, ArrayType, PrimitiveType, AnyType } from '../Type.js';
import TypeChecker from '../typeChecker.js';
import { getBuiltinObjectType, isBuiltinObjectType } from '../builtinTypes.js';

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
      const typeStr = parseTypeExpression(node.named.arg);
      if (typeStr) {
        args.push(typeStr);
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
 * Extract property name nodes from an access chain
 * Returns array of {name: string, node: astNode} for each step in the chain
 */
function extractPropertyNodesFromAccess(accessNode) {
  const properties = [];
  
  function traverse(node) {
    if (!node || !node.children) return;
    
    for (const child of node.children) {
      if (child.type === 'name') {
        properties.push({ name: child.value, node: child });
      } else if (child.type === 'object_access') {
        traverse(child);
      }
    }
  }
  
  traverse(accessNode);
  return properties;
}

function createExpressionHandlers(getState) {
  return {
    math: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushInference(parent, 'number');
    },
    name_exp: (node, parent) => {
      const { lookupVariable, pushInference, pushWarning, typeAliases } = getState();
      const { name, access, op } = node.named;
      
      if (access) {
        // Check if this is a function call: access contains object_access with func_call
        const hasFuncCall = access.children?.some(child => 
          child.type === 'object_access' && 
          child.children?.some(c => c.type === 'func_call')
        );
        
        if (hasFuncCall) {
          // This is a function call - get the function definition
          visitChildren(access);
          
          const def = lookupVariable(name.value);

          // Built-in object method call (e.g. Math.cos, Object.keys, Array.isArray)
          if (!def && isBuiltinObjectType(name.value)) {
            const objectAccess = access.children?.find(child => child.type === 'object_access');
            const methodName = objectAccess?.children?.find(child => child.type === 'name')?.value;
            if (methodName) {
              const builtinType = getBuiltinObjectType(name.value);
              const rawReturn = builtinType?.[methodName];
              // TODO(step3): remove .toString() once pushInference accepts Type objects
              const returnType = rawReturn != null ? rawReturn.toString() : 'any';
              pushInference(parent, returnType);
              return;
            }
          }

          if (def && def.params) {
            // Extract argument types from the func_call node
            const objectAccess = access.children?.find(child => child.type === 'object_access');
            const funcCall = objectAccess?.children?.find(child => child.type === 'func_call');
            const argTypes = funcCall?.inference || [];
            
            // Check for explicit type arguments
            const typeArgsNode = objectAccess?.children?.find(child => child.type === 'type_arguments');
            const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
            
            // Handle generic functions
            if (def.genericParams && def.genericParams.length > 0) {
              const paramTypes = def.params || [];
              let substitutions = {};
              let errors = [];
              
              if (explicitTypeArgs) {
                // Use explicit type arguments
                if (explicitTypeArgs.length !== def.genericParams.length) {
                  pushWarning(name, `Expected ${def.genericParams.length} type arguments but got ${explicitTypeArgs.length}`);
                }
                
                // Build substitutions from explicit type args
                for (let i = 0; i < Math.min(def.genericParams.length, explicitTypeArgs.length); i++) {
                  substitutions[def.genericParams[i]] = explicitTypeArgs[i];
                }
              } else {
                // Infer type arguments from call site
                const result = inferGenericArguments(
                  def.genericParams,
                  paramTypes,
                  argTypes,
                  typeAliases
                );
                substitutions = result.substitutions;
                errors = result.errors;
                
                // Report type parameter inference errors
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
              let returnType = def.type ?? AnyType;
              returnType = substituteType(returnType, substitutions);
              // TODO(step3): when inference stack accepts Type objects, remove .toString()
              pushInference(parent, typeof returnType === 'string' ? returnType : returnType.toString());
              return;
            } else {
              // Non-generic function - validate parameters
              if (argTypes.length > 0) {
                const result = TypeChecker.checkFunctionCall(argTypes, def.params, name.value, typeAliases);
                if (!result.valid) {
                  result.warnings.forEach(warning => pushWarning(name, warning));
                }
              }
              // TODO(step3): when inference stack accepts Type objects, remove .toString()
              const retType = def.type ?? 'any';
              pushInference(parent, typeof retType === 'string' ? retType : retType.toString());
              return;
            }
          }
        }
        
        // Not a function call - check built-in object property access (e.g. Math.PI, Number.MAX_VALUE)
        if (isBuiltinObjectType(name.value)) {
          const objectAccess = access.children?.find(child => child.type === 'object_access');
          const propName = objectAccess?.children?.find(child => child.type === 'name')?.value;
          if (propName) {
            const builtinType = getBuiltinObjectType(name.value);
            const rawProp = builtinType?.[propName];
            // TODO(step3): remove .toString() once pushInference accepts Type objects
            const propType = rawProp != null ? rawProp.toString() : 'any';
            pushInference(parent, propType);
            return;
          }
        }

        // Not a function call - validate property access for object types only
        const def = lookupVariable(name.value);
        // def.type may be a Type object (annotated) or a string (inferred)
        const defTypeIsAny = !def?.type || def.type === 'any' || def.type === AnyType ||
                              (def.type instanceof PrimitiveType && def.type.name === 'any');
        if (def && def.type && !defTypeIsAny) {
          // Check if this is optional chaining
          const hasOptionalChain = access && access.children &&
            access.children.some(child => 
              child.type === 'object_access' && child.children &&
              child.children.some(c => c.type === 'optional_chain')
            );
          
          // Skip validation for optional chaining
          if (hasOptionalChain) {
            visitChildren(access);
            pushInference(parent, 'any');
            return;
          }
          
          // Resolve type alias to see if it's an object type (result may be Type or string)
          const resolvedType = resolveTypeAlias(def.type, typeAliases);
          // Normalize helpers so we can handle both Type objects and legacy strings
          const resolvedStr = typeof resolvedType === 'string' ? resolvedType : resolvedType.toString();
          
          // Skip validation for empty object type {} as it's often used when type inference fails
          if (resolvedStr === '{}') {
            visitChildren(access);
            pushInference(parent, 'any');
            return;
          }
          
          // Validate property access for object types and primitive scalar types.
          // Array types are intentionally excluded here: subscript element types
          // are not tracked at this stage, so we fall through to 'any' for arrays.
          const isPrimitiveType = (resolvedType instanceof PrimitiveType && 
                                   (resolvedStr === 'string' || resolvedStr === 'number' || resolvedStr === 'boolean')) ||
                                  (typeof resolvedType === 'string' && 
                                   (resolvedStr === 'string' || resolvedStr === 'number' || resolvedStr === 'boolean'));
          const isObjectType = (resolvedType instanceof ObjectType) ||
                               (typeof resolvedType === 'string' && resolvedStr.startsWith('{') && !resolvedStr.endsWith('[]'));
          if (isPrimitiveType || isObjectType) {
            // Extract property name nodes and their names
            const properties = extractPropertyNodesFromAccess(access);
            
            if (properties.length > 0) {
              // Stamp the object name with its resolved type for hover
              name.inferredType = resolvedStr;
              
              // For nested property chains, validate and annotate properties
              let currentType = def.type;
              let validatedPath = [];
              let invalidProperty = null;
              
              for (let i = 0; i < properties.length; i++) {
                const { name: propName, node: propNode } = properties[i];
                const resolvedCurrent = resolveTypeAlias(currentType, typeAliases);
                const resolvedCurrentStr = typeof resolvedCurrent === 'string' ? resolvedCurrent : resolvedCurrent.toString();
                
                // Skip empty objects
                if (resolvedCurrentStr === '{}') {
                  break;
                }
                
                // Can only continue validating on object types or scalar primitives.
                // Arrays are not followed (subscript element types are not tracked).
                const isCurrentPrimitive = (resolvedCurrent instanceof PrimitiveType &&
                                            (resolvedCurrentStr === 'string' || resolvedCurrentStr === 'number' || resolvedCurrentStr === 'boolean')) ||
                                           (typeof resolvedCurrent === 'string' &&
                                            (resolvedCurrentStr === 'string' || resolvedCurrentStr === 'number' || resolvedCurrentStr === 'boolean'));
                const isCurrentObject = (resolvedCurrent instanceof ObjectType) ||
                                        (typeof resolvedCurrent === 'string' && resolvedCurrentStr.startsWith('{') && !resolvedCurrentStr.endsWith('[]'));
                if (!isCurrentPrimitive && !isCurrentObject) {
                  // Reached an array, unknown, or other type – stop validation
                  break;
                }
                
                const nextType = getPropertyType(currentType, propName, typeAliases);
                if (nextType === null) {
                  // Property doesn't exist
                  invalidProperty = propName;
                  validatedPath.push(propName);
                  break;
                }
                
                // Annotate property name node with its resolved type
                pushInference(propNode, typeof nextType === 'string' ? nextType : nextType.toString());
                // Stamp property node with its resolved type for hover support
                const nextResolved = resolveTypeAlias(nextType, typeAliases);
                propNode.inferredType = typeof nextResolved === 'string' ? nextResolved : nextResolved.toString();
                
                validatedPath.push(propName);
                currentType = nextType;
              }
              
              if (invalidProperty) {
                // Found an invalid property - show error
                const fullPropertyPath = validatedPath.join('.');
                pushWarning(
                  access,
                  `Property '${fullPropertyPath}' does not exist on type ${def.type}`
                );
                visitChildren(access);
                pushInference(parent, 'any');
                return;
              }
              
              // Successfully validated property chain - push the final type
              // TODO(step3): when inference stack accepts Type objects, remove .toString()
              const finalType = typeof currentType === 'string' ? currentType : currentType.toString();
              pushInference(parent, finalType);
              return;
            }
          }
        }
        
        // Unknown variable or couldn't validate (non-object type, built-in type, etc.)
        visitChildren(access);
        pushInference(parent, 'any');
        return;
      }
      
      const def = lookupVariable(name.value);
      
      // Check if it's a variable definition
      if (def) {
        if (def.source === 'func_def') {
          pushInference(parent, 'function');
          // Stamp the name node with the function's inferred type for hover
          const { inferencePhase } = getState();
          if (inferencePhase === 'inference' && name.inferredType === undefined) {
            const defTypeStr = typeof def.type === 'string' ? def.type : def.type?.toString();
            name.inferredType = defTypeStr || 'function';
          }
        } else {
          // TODO(step3): when inference stack accepts Type objects, remove .toString()
          const defTypeStr = typeof def.type === 'string' ? def.type : def.type?.toString();
          pushInference(parent, defTypeStr);
          // Stamp the name node with its resolved type for hover
          const { inferencePhase, typeAliases } = getState();
          if (inferencePhase === 'inference' && name.inferredType === undefined) {
            const resolved = resolveTypeAlias(def.type, typeAliases);
            name.inferredType = typeof resolved === 'string' ? resolved : resolved.toString();
          }
        }
      } else {
        // Unknown identifier - could be undefined or from outer scope
        pushInference(parent, 'any');
      }
      
      if (op) {
        const nodeHandlers = require('../index').getHandlers();
        nodeHandlers.operation(op, node);
        pushToParent(node, parent);
      }
    },
    operation: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushToParent(node, parent);
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
      if (node.named.access) {
        pushInference(parent, node.named.access);
      }
    },
    new: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      pushInference(parent, 'object');
    },
  };
}

export default createExpressionHandlers;
