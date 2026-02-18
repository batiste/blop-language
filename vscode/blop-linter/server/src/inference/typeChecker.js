// ============================================================================
// Type Checker - Validates type operations and assignments
// ============================================================================

import { 
  isTypeCompatible, 
  resolveTypeAlias,
  parseObjectTypeString,
  checkObjectStructuralCompatibility,
  getBaseTypeOfLiteral,
  isNumberLiteral,
  isStringLiteral 
} from './typeSystem.js';
import { AnyType, PrimitiveType } from './Type.js';

const TypeChecker = {
  /**
   * Check if a math operation is valid for the given types
   */
  checkMathOperation(leftType, rightType, operator) {
    // Get base types for literals
    const leftBase = getBaseTypeOfLiteral(leftType);
    const rightBase = getBaseTypeOfLiteral(rightType);
    
    if (operator === '+') {
      if (leftBase === 'string' && rightBase === 'string') {
        return { valid: false, resultType: 'string', warning: 'Use template strings instead of \'++\' for string concatenation' };
      }
      if ((leftBase === 'string' && rightBase === 'number') || (leftBase === 'number' && rightBase === 'string')) {
        return { valid: true, resultType: 'string' };
      }
      if ((leftBase === 'number' || leftType === 'any') && (rightBase === 'number' || rightType === 'any')) {
        return { valid: true, resultType: 'number' };
      }
      return { valid: false, resultType: 'any', warning: `Cannot apply '+' operator to ${leftType} and ${rightType}` };
    } else {
      // Other math operators require numbers
      const warnings = [];
      if (leftBase !== 'number' && leftType !== 'any') {
        warnings.push(`Math operator '${operator}' not allowed on ${leftType}`);
      }
      if (rightBase !== 'number' && rightType !== 'any') {
        warnings.push(`Math operator '${operator}' not allowed on ${rightType}`);
      }
      return { valid: warnings.length === 0, resultType: 'number', warnings };
    }
  },

  /**
   * Check if an assignment is valid
   */
  checkAssignment(valueType, annotationType, typeAliases) {
    if (annotationType && valueType !== 'any') {
      if (!isTypeCompatible(valueType, annotationType, typeAliases)) {
        // Check if this is an object type mismatch - provide detailed errors
        const _resolvedValueType = resolveTypeAlias(valueType, typeAliases);
        const _resolvedTargetType = resolveTypeAlias(annotationType, typeAliases);
        const resolvedValueType = typeof _resolvedValueType === 'string' ? _resolvedValueType : _resolvedValueType.toString();
        const resolvedTargetType = typeof _resolvedTargetType === 'string' ? _resolvedTargetType : _resolvedTargetType.toString();
        
        if (resolvedValueType.startsWith('{') && resolvedTargetType.startsWith('{')) {
          const valueStructure = parseObjectTypeString(resolvedValueType);
          const targetStructure = parseObjectTypeString(resolvedTargetType);
          
          if (valueStructure && targetStructure) {
            const result = checkObjectStructuralCompatibility(valueStructure, targetStructure, typeAliases);
            if (!result.compatible && result.errors.length > 0) {
              const detailedError = `Cannot assign ${valueType} to ${annotationType}: ${result.errors.join(', ')}`;
              return { valid: false, warning: detailedError };
            }
          }
        }
        
        return { valid: false, warning: `Cannot assign ${valueType} to ${annotationType}` };
      }
    }
    return { valid: true };
  },

  /**
   * Check if a variable reassignment matches its declared type
   */
  checkVariableReassignment(valueType, variable, lookupVariable, typeAliases) {
    const def = lookupVariable(variable);
    if (def && !isTypeCompatible(valueType, def.type, typeAliases)) {
      return { valid: false, warning: `Cannot assign ${valueType} to ${def.type}` };
    }
    return { valid: true, definition: def };
  },

  /**
   * Check function call arguments against signature
   */
  checkFunctionCall(args, expectedParams, functionName, typeAliases) {
    const warnings = [];
    for (let i = 0; i < expectedParams.length; i++) {
      const arg = args[i];
      const expected = expectedParams[i];
      if (arg && expected && !isTypeCompatible(arg, expected, typeAliases)) {
        warnings.push(`function ${functionName} expected ${expected} for param ${i + 1} but got ${arg}`);
      }
    }
    return { valid: warnings.length === 0, warnings };
  },

  /**
   * Check if function return types match declaration
   */
  checkReturnTypes(returnTypes, declaredType, functionName, typeAliases) {
    // AnyType object or 'any' string both mean "no constraint"
    const isAny = !declaredType || 
                  declaredType === 'any' || 
                  declaredType === AnyType ||
                  (declaredType instanceof PrimitiveType && declaredType.name === 'any') ||
                  (typeof declaredType === 'object' && declaredType.toString() === 'any');
    if (isAny) {
      return { valid: true };
    }
    
    const explicitReturns = returnTypes.filter(t => t !== 'undefined' && t);
    if (explicitReturns.length === 0) {
      return { valid: true };
    }

    for (const returnType of explicitReturns) {
      if (!isTypeCompatible(returnType, declaredType, typeAliases)) {
        return { 
          valid: false, 
          warning: `Function '${functionName}' returns ${returnType} but declared as ${declaredType}` 
        };
      }
    }
    return { valid: true };
  },
};

export default TypeChecker;
