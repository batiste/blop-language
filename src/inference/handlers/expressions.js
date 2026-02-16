// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

import { visitChildren, resolveTypes, pushToParent } from '../visitor.js';
import { inferGenericArguments, substituteType, parseTypeExpression } from '../typeSystem.js';
import TypeChecker from '../typeChecker.js';

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
              let returnType = def.type || 'any';
              returnType = substituteType(returnType, substitutions);
              pushInference(parent, returnType);
              return;
            } else {
              // Non-generic function - validate parameters
              if (argTypes.length > 0) {
                const result = TypeChecker.checkFunctionCall(argTypes, def.params, name.value, typeAliases);
                if (!result.valid) {
                  result.warnings.forEach(warning => pushWarning(name, warning));
                }
              }
              pushInference(parent, def.type || 'any');
              return;
            }
          }
        }
        
        // Not a function call or unknown function
        visitChildren(access);
        pushInference(parent, 'any');
        return;
      }
      
      const def = lookupVariable(name.value);
      
      // Check if it's a variable definition
      if (def) {
        if (def.source === 'func_def') {
          pushInference(parent, 'function');
        } else {
          pushInference(parent, def.type);
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
