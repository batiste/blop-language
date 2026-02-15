// ============================================================================
// Function Handlers - Type inference for function definitions and calls
// ============================================================================

const { visitChildren } = require('../visitor');
const { getAnnotationType, createUnionType, isTypeCompatible } = require('../typeSystem');
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
    
    named_func_call: (node, parent) => {
      const { lookupVariable, pushInference, pushWarning, typeAliases } = getState();
      visitChildren(node);
      const { name } = node.named;
      const def = lookupVariable(name.value);
      
      if (def && def.params) {
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
    },
    
    func_def: (node, parent) => {
      const { getCurrentScope, pushScope, popScope, pushInference, pushWarning } = getState();
      const parentScope = getCurrentScope();
      const scope = pushScope();
      scope.__currentFctParams = [];
      scope.__returnTypes = [];
      
      visitChildren(node);
      
      // Anonymous functions as expressions should infer as 'function'
      if (parent && !node.named.name) {
        pushInference(parent, 'function');
      }
      
      if (node.named.name) {
        const { annotation } = node.named;
        const declaredType = annotation ? getAnnotationType(annotation) : null;
        
        // Infer return type from actual returns
        let inferredType = 'any';
        if (scope.__returnTypes && scope.__returnTypes.length > 0) {
          // Filter out empty/undefined returns unless they're all undefined
          const explicitReturns = scope.__returnTypes.filter(t => t && t !== 'undefined');
          
          if (explicitReturns.length > 0) {
            // Create union type from all return types
            inferredType = createUnionType(explicitReturns);
          } else if (scope.__returnTypes.every(t => t === 'undefined')) {
            // All returns are undefined (bare return or no return)
            inferredType = 'undefined';
          }
        }
        
        // Use declared type if provided, otherwise use inferred type
        const finalType = declaredType || inferredType;
        
        // Validate inferred type matches declared type if both exist
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
        };
      }
      popScope();
    },
  };
}

module.exports = createFunctionHandlers;
