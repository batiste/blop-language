// ============================================================================
// Type Checker - Validates type operations and assignments
// ============================================================================

const { isTypeCompatible } = require('./typeSystem');

const TypeChecker = {
  /**
   * Check if a math operation is valid for the given types
   */
  checkMathOperation(leftType, rightType, operator) {
    if (operator === '+') {
      if (leftType === 'string' && rightType === 'string') {
        return { valid: false, resultType: 'string', warning: 'Use template strings instead of \'++\' for string concatenation' };
      }
      if ((leftType === 'string' && rightType === 'number') || (leftType === 'number' && rightType === 'string')) {
        return { valid: true, resultType: 'string' };
      }
      if ((leftType === 'number' || leftType === 'any') && (rightType === 'number' || rightType === 'any')) {
        return { valid: true, resultType: 'number' };
      }
      return { valid: false, resultType: 'any', warning: `Cannot apply '+' operator to ${rightType} and ${leftType}` };
    } else {
      // Other math operators require numbers
      const warnings = [];
      if (leftType !== 'number' && leftType !== 'any') {
        warnings.push(`Math operator '${operator}' not allowed on ${leftType}`);
      }
      if (rightType !== 'number' && rightType !== 'any') {
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
    if (!declaredType || declaredType === 'any') {
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

module.exports = TypeChecker;
