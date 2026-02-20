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
import { AnyType, UndefinedType, FunctionType, AnyFunctionType, createUnion } from '../Type.js';
import TypeChecker from '../typeChecker.js';

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
      const { getCurrentScope, pushScope, popScope, pushInference, pushWarning, stampTypeAnnotation, symbolTable } = getState();
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
      if (annotation) {
        stampTypeAnnotation(annotation);
        const earlyDeclaredType = getAnnotationType(annotation);
        if (earlyDeclaredType) {
          scope.__declaredReturnType = earlyDeclaredType;
        }
      }
      
      visitChildren(node);
      
      // Stamp the return type annotation for hover support (idempotent)
      if (annotation) {
        stampTypeAnnotation(annotation);
      }
      
      const declaredType = annotation ? getAnnotationType(annotation) : null;
      
      // Infer return type from actual returns (Type objects from inference stack)
      let inferredType = UndefinedType; // Default to undefined for empty function bodies
      if (scope.__returnTypes && scope.__returnTypes.length > 0) {
        // Filter out empty/undefined returns unless they're all undefined
        const explicitReturns = scope.__returnTypes.filter(t => t && t !== UndefinedType);
        
        if (explicitReturns.length > 0) {
          // Create union type from all return types
          inferredType = createUnion(explicitReturns);
          
          // If there were also undefined returns, add undefined to the union
          const hasUndefined = scope.__returnTypes.some(t => t === UndefinedType);
          if (hasUndefined) {
            inferredType = createUnion([inferredType, UndefinedType]);
          }
        } else {
          // All returns are undefined (bare return or no return)
          inferredType = UndefinedType;
        }
      }
      
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
  };
}

export default createFunctionHandlers;
