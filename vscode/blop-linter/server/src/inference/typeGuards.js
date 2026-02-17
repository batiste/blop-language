// ============================================================================
// Type Guards - Pattern detection and type narrowing
// ============================================================================

import { narrowType, excludeType, parseUnionType, isUnionType, resolveTypeAlias, parseObjectTypeString } from './typeSystem.js';

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
      // Extract string value (remove quotes)
      const strValue = node.value.slice(1, -1);
      comparisonType = strValue;
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
 * Apply type narrowing to a scope
 * @param {Object} scope - Scope to apply narrowing to
 * @param {string} variable - Variable name to narrow
 * @param {string} narrowedType - Type to narrow to
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 */
function applyNarrowing(scope, variable, narrowedType, lookupVariable) {
  const def = lookupVariable(variable);
  if (def && def.type) {
    const newType = narrowType(def.type, narrowedType);
    // Create a narrowed version in the current scope
    scope[variable] = {
      ...def,
      type: newType,
      narrowed: true,
    };
  }
}

/**
 * Apply type exclusion to a scope (for else branches)
 * @param {Object} scope - Scope to apply exclusion to
 * @param {string} variable - Variable name
 * @param {string} excludedType - Type to exclude
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 */
function applyExclusion(scope, variable, excludedType, lookupVariable) {
  const def = lookupVariable(variable);
  if (def && def.type) {
    const newType = excludeType(def.type, excludedType);
    scope[variable] = {
      ...def,
      type: newType,
      narrowed: true,
    };
  }
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
        // Resolve the object's type alias
        const resolvedObjectType = resolveTypeAlias(objectDef.type, typeAliases);
        
        // Parse the object type to get property types
        const properties = parseObjectTypeString(resolvedObjectType);
        
        if (properties && properties[propertyName]) {
          varType = properties[propertyName].type;
          displayName = `${objectName}.${propertyName}`;
        }
      }
    }
    
    if (varType) {
      // Resolve type alias (in case the property type is also an alias)
      const resolvedType = resolveTypeAlias(varType, typeAliases);
      
      // Check if it's a union of string literals
      if (isUnionType(resolvedType)) {
        const unionTypes = parseUnionType(resolvedType);
        
        // Check if all union members are string literals (quoted values)
        const allLiterals = unionTypes.every(t => 
          (t.startsWith('"') && t.endsWith('"')) || 
          (t.startsWith("'") && t.endsWith("'")) ||
          /^\d+$/.test(t) // number literal
        );
        
        if (allLiterals) {
          // Check if the compared value is in the union
          const isInUnion = unionTypes.some(t => t === literalValue);
          
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
