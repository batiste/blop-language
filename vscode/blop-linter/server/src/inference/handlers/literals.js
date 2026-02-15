// ============================================================================
// Literal Handlers - Type inference for literal values
// ============================================================================

const { visitChildren, resolveTypes } = require('../visitor');

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
      pushInference(parent, 'array');
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
