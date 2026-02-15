// ============================================================================
// Literal Handlers - Type inference for literal values
// ============================================================================

const { visitChildren, resolveTypes } = require('../visitor');

function createLiteralHandlers(getState) {
  return {
    number: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'number');
    },
    str: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'string');
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
      pushInference(parent, 'boolean');
    },
    false: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, 'boolean');
    },
    array_literal: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushInference(parent, 'array');
    },
    object_literal: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      pushInference(parent, 'object');
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
