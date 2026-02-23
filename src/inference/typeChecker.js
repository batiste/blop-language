// ============================================================================
// Type Checker - Validates type operations and assignments
// ============================================================================

import { 
  isTypeCompatible, 
  resolveTypeAlias,
  checkObjectStructuralCompatibility,
  getBaseTypeOfLiteral,
} from './typeSystem.js';
import { AnyType, PrimitiveType, ObjectType, LiteralType, StringType, NumberType, UndefinedType } from './Type.js';

const TypeChecker = {
  /**
   * Check if a math operation is valid for the given types
   */
  checkMathOperation(leftType, rightType, operator) {
    // Get base types for literals
    const leftBase = getBaseTypeOfLiteral(leftType);
    const rightBase = getBaseTypeOfLiteral(rightType);
    const isStringBase = (t) => t instanceof PrimitiveType && t.name === 'string';
    const isNumberBase = (t) => t instanceof PrimitiveType && t.name === 'number';
    const isBooleanBase = (t) => t instanceof PrimitiveType && t.name === 'boolean';
    const isAnyType   = (t) => t === AnyType || (t instanceof PrimitiveType && t.name === 'any');
    
    if (operator === '+') {
      if (isStringBase(leftBase) && isStringBase(rightBase)) {
        // String concatenation is valid but style suggestion to use templates
        return { valid: true, resultType: StringType, warning: 'Use template strings instead of \'++\' for string concatenation' };
      }
      // Strict concatenation: no mixing of strings and numbers
      if (isStringBase(leftBase) || isStringBase(rightBase)) {
        return { valid: false, resultType: AnyType, warning: `Cannot apply '+' operator to ${leftType} and ${rightType}. String concatenation requires both operands to be strings.` };
      }
      if ((isNumberBase(leftBase) || isBooleanBase(leftBase) || isAnyType(leftType)) && (isNumberBase(rightBase) || isBooleanBase(rightBase) || isAnyType(rightType))) {
        return { valid: true, resultType: NumberType };
      }
      return { valid: false, resultType: AnyType, warning: `Cannot apply '+' operator to ${leftType} and ${rightType}` };
    } else {
      // Other math operators require numbers
      const warnings = [];
      if (!isNumberBase(leftBase) && !isAnyType(leftType)) {
        warnings.push(`Math operator '${operator}' not allowed on ${leftType}`);
      }
      if (!isNumberBase(rightBase) && !isAnyType(rightType)) {
        warnings.push(`Math operator '${operator}' not allowed on ${rightType}`);
      }
      return { valid: warnings.length === 0, resultType: NumberType, warnings };
    }
  },

  /**
   * Check if an assignment is valid
   */
  checkAssignment(valueType, annotationType, typeAliases) {
    if (!annotationType || valueType === AnyType) return { valid: true };

    const resolvedValue  = resolveTypeAlias(valueType, typeAliases);
    const resolvedTarget = resolveTypeAlias(annotationType, typeAliases);

    // Structural compatibility check for objects (covers both incompatibility and excess properties)
    if (resolvedValue instanceof ObjectType && resolvedTarget instanceof ObjectType) {
      const result = checkObjectStructuralCompatibility(resolvedValue, resolvedTarget, typeAliases);
      if (!result.compatible && result.errors.length > 0) {
        return { valid: false, warning: `Cannot assign ${valueType} to ${annotationType}: ${result.errors.join(', ')}` };
      }
    }

    if (!isTypeCompatible(valueType, annotationType, typeAliases)) {
      return { valid: false, warning: `Cannot assign ${valueType} to ${annotationType}` };
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
   * Check function call argument types against the declared parameter types.
   * Arity is NOT checked here — it is validated separately at call sites using
   * AST‑based argument counting (see handleFunctionCall in expressions.js).
   */
  checkFunctionCall(args, expectedParams, functionName, typeAliases) {
    const warnings = [];
    for (let i = 0; i < expectedParams.length; i++) {
      const arg = args[i];
      const exp = expectedParams[i];
      if (arg && exp && !isTypeCompatible(arg, exp, typeAliases)) {
        warnings.push(`function ${functionName} expected ${exp} for param ${i + 1} but got ${arg}`);
      }
    }
    return { valid: warnings.length === 0, warnings };
  },

  /**
   * Check if function return types match declaration
   */
  checkReturnTypes(returnTypes, declaredType, functionName, typeAliases) {
    const isAny = !declaredType || 
                  declaredType === AnyType ||
                  (declaredType instanceof PrimitiveType && declaredType.name === 'any');
    if (isAny) {
      return { valid: true };
    }
    
    const explicitReturns = returnTypes.filter(t => t !== UndefinedType && t);
    if (explicitReturns.length === 0) {
      return { valid: true };
    }

    for (const returnType of explicitReturns) {
      if (!isTypeCompatible(returnType, declaredType, typeAliases)) {
        const displayType = getBaseTypeOfLiteral(returnType);
        return { 
          valid: false, 
          warning: `Function '${functionName}' returns ${displayType} but declared as ${declaredType}` 
        };
      }
    }
    return { valid: true };
  },
};

export default TypeChecker;
