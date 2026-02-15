// ============================================================================
// Literal Handlers - Type inference for literal values
// ============================================================================

const { visitChildren, resolveTypes } = require('../visitor');
const { getBaseTypeOfLiteral } = require('../typeSystem');

/**
 * Infer the element type of an array literal from its AST node
 * @param {Object} node - The array_literal AST node
 * @returns {string|null} Array element type or null
 */
function inferArrayElementType(node) {
  if (!node || !node.children) {
    return null;
  }
  
  // Find the array_literal_body node
  const bodyNode = node.children.find(c => c.type === 'array_literal_body');
  if (!bodyNode) {
    // Empty array - can't infer element type
    return null;
  }
  
  const elementTypes = [];
  
  // Recursively collect element types from array_literal_body
  function collectElementTypes(current) {
    if (!current || !current.children) return;
    
    for (const child of current.children) {
      if (child.type === 'exp' && child.inference && child.inference.length > 0) {
        elementTypes.push(child.inference[0]);
      } else if (child.type === 'array_literal_body') {
        // Recursive body (for comma-separated elements)
        collectElementTypes(child);
      }
    }
  }
  
  collectElementTypes(bodyNode);
  
  if (elementTypes.length === 0) {
    return null;
  }
  
  // Unify all element types to a common base type
  // If all elements are literals of the same base type (e.g., 1, 2, 3 -> number)
  // or all the same type, return that type
  
  const baseTypes = elementTypes.map(t => getBaseTypeOfLiteral(t));
  const uniqueBaseTypes = [...new Set(baseTypes)];
  
  if (uniqueBaseTypes.length === 1) {
    // All elements have the same base type
    return uniqueBaseTypes[0];
  }
  
  // Mixed types - could create a union type, but for now return null to fall back to 'array'
  // Future: could return something like (number | string)[]
  return null;
}

/**
 * Infer the structure of an object literal from its AST node
 * @param {Object} node - The object_literal AST node
 * @returns {string|null} Object type string like "{name: string, id: number}" or null
 */
function inferObjectLiteralStructure(node) {
  if (!node || !node.children) {
    return null;
  }
  
  // Find the object_literal_body node
  const bodyNode = node.children.find(c => c.type === 'object_literal_body');
  if (!bodyNode) {
    // Empty object
    return '{}';
  }
  
  const properties = [];
  
  // Recursively collect properties from object_literal_body
  function collectProperties(current) {
    if (!current || !current.children) return;
    
    // Look for key-value pairs
    let key = null;
    let exp = null;
    
    for (const child of current.children) {
      if (child.type === 'object_literal_key') {
        key = child.value || (child.children && child.children[0] && child.children[0].value);
      } else if (child.named && child.named.key) {
        // Shorthand property
        key = child.named.key.value;
      } else if (child.type === 'exp' || (child.named && child.named.exp)) {
        exp = child;
      } else if (child.type === 'object_literal_body') {
        // Recursive body
        collectProperties(child);
      }
    }
    
    if (key) {
      // Determine the type of the value
      let valueType = 'any';
      
      if (exp && exp.inference && exp.inference.length > 0) {
        valueType = exp.inference[0];
      } else if (!exp) {
        // Shorthand property - we don't have enough info, use 'any'
        valueType = 'any';
      }
      
      properties.push(`${key}: ${valueType}`);
    }
  }
  
  collectProperties(bodyNode);
  
  if (properties.length === 0) {
    return '{}';
  }
  
  return `{${properties.join(', ')}}`;
}

function createLiteralHandlers(getState) {
  return {
    number: (node, parent) => {
      const { pushInference } = getState();
      // Infer literal types for numbers
      pushInference(parent, node.value);
    },
    str: (node, parent) => {
      const { pushInference } = getState();
      // Strip quotes from node.value and infer as literal type
      // node.value includes quotes like 'hello' or "hello", so we strip them
      const rawValue = node.value.slice(1, -1);
      pushInference(parent, `"${rawValue}"`);
    },
    null: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'null');
    },
    undefined: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'undefined');
    },
    true: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'true');
    },
    false: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'false');
    },
    array_literal: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      
      // Try to infer the element type
      const elementType = inferArrayElementType(node);
      if (elementType) {
        pushInference(parent, `${elementType}[]`);
      } else {
        pushInference(parent, 'array');
      }
    },
    object_literal: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      
      // Try to infer the structure of the object literal
      const structure = inferObjectLiteralStructure(node);
      if (structure) {
        pushInference(parent, structure);
      } else {
        pushInference(parent, 'object');
      }
    },
    virtual_node: (node, parent) => {
      const { pushInference, getFunctionScope } = getState();
      resolveTypes(node);
      pushInference(parent, 'VNode');
      
      // VNodes create implicit returns in Blop
      const functionScope = getFunctionScope();
      if (functionScope && functionScope.__returnTypes) {
        functionScope.__returnTypes.push('VNode');
      }
    },
    virtual_node_exp: (node, parent) => {
      const { pushInference, getFunctionScope } = getState();
      visitChildren(node);
      pushInference(parent, 'VNode');
      
      // VNodes create implicit returns in Blop
      const functionScope = getFunctionScope();
      if (functionScope && functionScope.__returnTypes) {
        functionScope.__returnTypes.push('VNode');
      }
    },
  };
}

module.exports = createLiteralHandlers;
