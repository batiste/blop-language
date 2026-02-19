// ============================================================================
// Type Guards - Pattern detection and type narrowing
// ============================================================================

import { narrowType, excludeType, parseUnionType, isUnionType, resolveTypeAlias, getPropertyType, stringToType } from './typeSystem.js';
import { LiteralType, StringType, NumberType } from './Type.js';

/**
 * Detect typeof checks in expressions
 * Returns { variable, checkType } if detected, null otherwise
 * @param {Object} expNode - Expression node to analyze
 * @returns {Object|null} Type guard info or null
 */
function detectTypeofCheck(expNode) {
  if (!expNode) {
    return null;
  }
  
  // Look for pattern: typeof variable == 'type'
  // Collect all relevant nodes first
  let hasTypeof = false;
  let typeofVar = null;
  let comparisonType = null;
  let hasComparison = false;
  
  // Walk the entire expression tree and collect pieces
  const checkNode = (node) => {
    if (!node) return;
    
    // Check for typeof operand
    if (node.type === 'operand' && node.value && node.value.includes('typeof')) {
      hasTypeof = true;
    }
    
    // Check for variable name
    if (node.type === 'name' && hasTypeof && !typeofVar) {
      typeofVar = node.value;
    }
    
    // Check for comparison type (string literal)
    if (node.type === 'str' && hasTypeof) {
      // Extract string value (remove quotes) and convert to Type object
      const strValue = node.value.slice(1, -1);
      comparisonType = stringToType(strValue);
    }
    
    // Check for comparison operator
    if (node.type === 'boolean_operator' && (node.value === '==' || node.value === '!=')) {
      hasComparison = true;
    }
    
    // Recurse into children
    if (node.children) {
      node.children.forEach(checkNode);
    }
  };
  
  checkNode(expNode);
  
  if (hasTypeof && typeofVar && comparisonType && hasComparison) {
    return { variable: typeofVar, checkType: comparisonType };
  }
  
  return null;
}

/**
 * Apply a type transformation (narrow or exclude) to a variable in scope
 * @param {Function} typeOp - narrowType or excludeType
 * @param {Object} scope - Scope to update
 * @param {string} variable - Variable name
 * @param {*} effectType - Type operand for the operation
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 */
function applyTypeEffect(typeOp, scope, variable, effectType, lookupVariable) {
  const def = lookupVariable(variable);
  if (def && def.type) {
    scope[variable] = { ...def, type: typeOp(def.type, effectType), narrowed: true };
  }
}

/** Apply type narrowing to a scope (for if-true branch) */
function applyNarrowing(scope, variable, narrowedType, lookupVariable) {
  applyTypeEffect(narrowType, scope, variable, narrowedType, lookupVariable);
}

/** Apply type exclusion to a scope (for else branch) */
function applyExclusion(scope, variable, excludedType, lookupVariable) {
  applyTypeEffect(excludeType, scope, variable, excludedType, lookupVariable);
}

/**
 * Detect impossible literal comparisons in expressions
 * Returns warning message if comparison is impossible, null otherwise
 * @param {Object} expNode - Expression node to analyze
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 * @param {Object} typeAliases - Type aliases map
 * @returns {Object|null} { variable, comparedValue, varType } if impossible, null otherwise
 */
function detectImpossibleComparison(expNode, lookupVariable, typeAliases) {
  if (!expNode) {
    return null;
  }
  
  // Look for pattern: variable == "literal" OR object.property == "literal"
  // where literal is not in variable's/property's type union
  let names = [];
  let literalValue = null;
  let hasEqualityCheck = false;
  
  const checkNode = (node) => {
    if (!node) return;
    
    // Collect all variable names (for property access detection)
    if (node.type === 'name') {
      names.push(node.value);
    }
    
    // Check for string literal
    if (node.type === 'str' && !literalValue) {
      literalValue = node.value; // Keep quotes for now
    }
    
    // Check for number literal
    if (node.type === 'number' && !literalValue) {
      literalValue = node.value;
    }
    
    // Check for equality operator
    if (node.type === 'boolean_operator' && (node.value === '==' || node.value === '===')) {
      hasEqualityCheck = true;
    }
    
    // Recurse into children
    if (node.children) {
      node.children.forEach(checkNode);
    }
    
    // Check named properties
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object') {
          checkNode(child);
        }
      });
    }
  };
  
  checkNode(expNode);
  
  if (hasEqualityCheck && names.length > 0 && literalValue) {
    // Deduplicate names while preserving order
    const uniqueNames = [];
    const seen = new Set();
    for (const name of names) {
      if (!seen.has(name)) {
        seen.add(name);
        uniqueNames.push(name);
      }
    }
    
    let varType = null;
    let displayName = null;
    
    if (uniqueNames.length === 1) {
      // Simple variable comparison: variable == "literal"
      const varName = uniqueNames[0];
      const varDef = lookupVariable(varName);
      if (varDef && varDef.type) {
        varType = varDef.type;
        displayName = varName;
      }
    } else if (uniqueNames.length === 2) {
      // Property access: object.property == "literal"
      const [objectName, propertyName] = uniqueNames;
      const objectDef = lookupVariable(objectName);
      
      if (objectDef && objectDef.type) {
        // Use getPropertyType to resolve the property type
        varType = getPropertyType(objectDef.type, propertyName, typeAliases);
        displayName = `${objectName}.${propertyName}`;
      }
    }
    
    if (varType) {
      // Resolve type alias (in case the property type is also an alias)
      const resolvedType = resolveTypeAlias(varType, typeAliases);
      
      // Check if it's a union of string literals
      if (isUnionType(resolvedType)) {
        const unionTypes = parseUnionType(resolvedType);
        
        // Check if all union members are string/number literals (LiteralType objects)
        const allLiterals = unionTypes.every(t => {
          return t instanceof LiteralType && 
                 (t.baseType === StringType || t.baseType === NumberType);
        });
        
        if (allLiterals) {
          // Check if the compared value is in the union
          // literalValue still has quotes for string literals, e.g. `"hello"`
          const isInUnion = unionTypes.some(t => {
            if (t instanceof LiteralType && t.baseType === StringType) {
              return `"${t.value}"` === literalValue;
            }
            if (t instanceof LiteralType && t.baseType === NumberType) {
              return String(t.value) === literalValue;
            }
            return false;
          });
          
          if (!isInUnion) {
            return {
              variable: displayName,
              comparedValue: literalValue,
              varType: resolvedType,
              possibleValues: unionTypes
            };
          }
        }
      }
    }
  }
  
  return null;
}

export {
  detectTypeofCheck,
  applyNarrowing,
  applyExclusion,
  detectImpossibleComparison,
};
