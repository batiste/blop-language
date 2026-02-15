// ============================================================================
// Function Handlers - Type inference for function definitions and calls
// ============================================================================

const { visitChildren } = require('../visitor');
const { 
  getAnnotationType, 
  createUnionType, 
  isTypeCompatible,
  parseGenericParams,
  inferGenericArguments,
  substituteType,
} = require('../typeSystem');
const TypeChecker = require('../typeChecker');

function createFunctionHandlers(getState) {
  return {
    func_def_params: (node) => {
      const { getCurrentScope } = getState();
      const scope = getCurrentScope();
      
      if (!scope.__currentFctParams) {
        scope.__currentFctParams = [];
      }
      
      if (node.named.annotation) {
        const annotation = getAnnotationType(node.named.annotation);
        if (annotation) {
          scope[node.named.name.value] = {
            type: annotation,
          };
          scope.__currentFctParams.push(annotation);
        } else {
          scope.__currentFctParams.push('any');
        }
      } else {
        scope.__currentFctParams.push('any');
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
          const returnType = node.named.exp.inference[0] || 'undefined';
          functionScope.__returnTypes.push(returnType);
        }
      } else {
        // Regular block body
        visitChildren(node);
      }
    },
    
    named_func_call: (node, parent) => {
      const { lookupVariable, pushInference, pushWarning, typeAliases } = getState();
      visitChildren(node);
      const { name } = node.named;
      const def = lookupVariable(name.value);
      
      if (def && def.params) {
        // Check if this is a generic function
        if (def.genericParams && def.genericParams.length > 0) {
          // Infer generic type arguments from call site
          const argTypes = node.inference || [];
          const paramTypes = def.params || [];
          
          const substitutions = inferGenericArguments(
            def.genericParams,
            paramTypes,
            argTypes
          );
          
          // Substitute type parameters in return type
          let returnType = def.type;
          if (returnType) {
            returnType = substituteType(returnType, substitutions);
            pushInference(parent, returnType);
          }
          
          // Also check parameter types with substituted generics
          if (argTypes.length > 0) {
            const substitutedParams = paramTypes.map(p => substituteType(p, substitutions));
            const result = TypeChecker.checkFunctionCall(argTypes, substitutedParams, name.value, typeAliases);
            if (!result.valid) {
              result.warnings.forEach(warning => pushWarning(name, warning));
            }
          }
        } else {
          // Non-generic function - existing behavior
          if (node.inference) {
            const result = TypeChecker.checkFunctionCall(node.inference, def.params, name.value, typeAliases);
            if (!result.valid) {
              result.warnings.forEach(warning => pushWarning(name, warning));
            }
          }
          if (def.type) {
            pushInference(parent, def.type);
          }
        }
      }
    },
    
    func_def: (node, parent) => {
      const { getCurrentScope, pushScope, popScope, pushInference, pushWarning } = getState();
      const parentScope = getCurrentScope();
      const scope = pushScope();
      scope.__currentFctParams = [];
      scope.__returnTypes = [];
      
      // Parse generic parameters if present
      const genericParams = node.named.generic_params 
        ? parseGenericParams(node.named.generic_params)
        : [];
      
      // Store generic params in scope so they're recognized as valid types
      if (genericParams.length > 0) {
        scope.__genericParams = genericParams;
        // Mark each generic parameter as a valid type in this scope
        for (const param of genericParams) {
          scope[param] = {
            type: param,
            isGenericParam: true,
          };
        }
      }
      
      visitChildren(node);
      
      const { annotation } = node.named;
      const declaredType = annotation ? getAnnotationType(annotation) : null;
      
      // Infer return type from actual returns
      let inferredType = 'undefined'; // Default to undefined for empty function bodies
      if (scope.__returnTypes && scope.__returnTypes.length > 0) {
        // Filter out empty/undefined returns unless they're all undefined
        const explicitReturns = scope.__returnTypes.filter(t => t && t !== 'undefined');
        
        if (explicitReturns.length > 0) {
          // Create union type from all return types
          inferredType = createUnionType(explicitReturns);
          
          // If there were also undefined returns, add undefined to the union
          const hasUndefined = scope.__returnTypes.some(t => t === 'undefined');
          if (hasUndefined) {
            inferredType = createUnionType([inferredType, 'undefined']);
          }
        } else {
          // All returns are undefined (bare return or no return)
          inferredType = 'undefined';
        }
      }
      
      // Anonymous functions as expressions should infer as 'function'
      if (parent && !node.named.name) {
        pushInference(parent, 'function');
        
        // Validate anonymous function return types if they have type annotations
        if (declaredType && inferredType !== 'any') {
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
        // Use declared type if provided, otherwise use inferred type
        const finalType = declaredType || inferredType;
        
        // Validate named function return types
        if (declaredType && inferredType !== 'any') {
          const { typeAliases } = getState();
          if (!isTypeCompatible(inferredType, declaredType, typeAliases)) {
            pushWarning(
              node.named.name,
              `Function '${node.named.name.value}' returns ${inferredType} but declared as ${declaredType}`
            );
          }
        }
        
        parentScope[node.named.name.value] = {
          source: 'func_def',
          type: finalType,
          inferredReturnType: inferredType,
          declaredReturnType: declaredType,
          node,
          params: scope.__currentFctParams,
          genericParams: genericParams.length > 0 ? genericParams : undefined,
        };
      }
      popScope();
    },
  };
}

module.exports = createFunctionHandlers;
