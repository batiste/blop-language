// ============================================================================
// Function Handlers - Type inference for function definitions and calls
// ============================================================================

import { visitChildren, pushToParent } from '../visitor.js';
import { 
  getAnnotationType, 
  createUnionType, 
  isTypeCompatible,
  parseGenericParams,
  resolveTypeAlias,
  inferGenericArguments,
  substituteType,
} from '../typeSystem.js';
import { AnyType } from '../Type.js';
import TypeChecker from '../typeChecker.js';

function createFunctionHandlers(getState) {
  return {
    func_def_params: (node) => {
      const { getCurrentScope, inferencePhase, stampTypeAnnotation, typeAliases } = getState();
      const scope = getCurrentScope();
      
      if (!scope.__currentFctParams) {
        scope.__currentFctParams = [];
      }
      
      if (node.named.annotation) {
        // Stamp the type annotation for hover support
        stampTypeAnnotation(node.named.annotation);
        
        const annotation = getAnnotationType(node.named.annotation);
        if (annotation) {
          scope[node.named.name.value] = {
            type: annotation,
          };
          scope.__currentFctParams.push(annotation);
          if (inferencePhase === 'inference' && node.named.name) {
            node.named.name.inferredType = resolveTypeAlias(annotation, typeAliases).toString();
          }
        } else {
          scope.__currentFctParams.push(AnyType);
          if (inferencePhase === 'inference' && node.named.name) {
            node.named.name.inferredType = 'any';
          }
        }
      } else {
        scope.__currentFctParams.push(AnyType);
        if (inferencePhase === 'inference' && node.named.name) {
          node.named.name.inferredType = 'any';
        }
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
          // Arguments are in the func_call child node's inference
          const funcCallNode = node.children?.find(child => child.type === 'func_call');
          const argTypes = funcCallNode?.inference || node.inference || [];
          const paramTypes = def.params || [];
          
          const { substitutions, errors } = inferGenericArguments(
            def.genericParams,
            paramTypes,
            argTypes,
            typeAliases
          );
          
          // Report type parameter inference errors
          if (errors.length > 0) {
            errors.forEach(error => pushWarning(name, error));
          }
          
          // Substitute type parameters in return type
          let returnType = def.type;
          if (returnType) {
            returnType = substituteType(returnType, substitutions);
            // TODO(step3): when inference stack accepts Type objects, remove .toString()
            pushInference(parent, typeof returnType === 'string' ? returnType : returnType.toString());
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
            // TODO(step3): when inference stack accepts Type objects, remove .toString()
            pushInference(parent, typeof def.type === 'string' ? def.type : def.type.toString());
          }
        }
      }
    },
    
    func_def: (node, parent) => {
      const { getCurrentScope, pushScope, popScope, pushInference, pushWarning, stampTypeAnnotation } = getState();
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
      
      // Stamp the return type annotation for hover support
      if (annotation) {
        stampTypeAnnotation(annotation);
      }
      
      // declaredType is now a Type object (or null); inferredType remains a string
      // from the inference stack (that migration is a later step).
      const declaredType = annotation ? getAnnotationType(annotation) : null;
      
      // Infer return type from actual returns (strings from inference stack)
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
              `Function returns ${inferredType} but declared as ${declaredType.toString()}`
            );
          }
        }
      }
      
      if (node.named.name) {
        // Use declared Type if provided, otherwise fall back to inferred string
        // (TODO step3: inferred return types will also become Type objects)
        const finalType = declaredType ?? inferredType;
        
        // Validate named function return types
        if (declaredType && inferredType !== 'any') {
          const { typeAliases } = getState();
          if (!isTypeCompatible(inferredType, declaredType, typeAliases)) {
            pushWarning(
              node.named.name,
              `Function '${node.named.name.value}' returns ${inferredType} but declared as ${declaredType.toString()}`
            );
          }
        }
        
        // Stamp the function name with its type for hover
        const { inferencePhase } = getState();
        if (inferencePhase === 'inference' && node.named.name.inferredType === undefined) {
          // inferredType on the hover node should be a display string
          node.named.name.inferredType = declaredType ? declaredType.toString() : inferredType;
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

export default createFunctionHandlers;
