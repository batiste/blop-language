// ============================================================================
// Type Guards - Pattern detection and type narrowing
// ============================================================================

import { narrowType, excludeType } from './typeSystem.js';

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

export {
  detectTypeofCheck,
  applyNarrowing,
  applyExclusion,
};
