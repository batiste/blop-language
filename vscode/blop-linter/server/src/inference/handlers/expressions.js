// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

const { visitChildren, resolveTypes, pushToParent } = require('../visitor');

function createExpressionHandlers(getState) {
  return {
    math: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushInference(parent, 'number');
    },
    name_exp: (node, parent) => {
      const { lookupVariable, pushInference } = getState();
      const { name, access, op } = node.named;
      
      if (access) {
        visitChildren(access);
        pushInference(parent, 'any');
        return;
      }
      
      const def = lookupVariable(name.value);
      
      // Check if it's a variable definition
      if (def) {
        if (def.source === 'func_def') {
          pushInference(parent, 'function');
        } else {
          pushInference(parent, def.type);
        }
      } else {
        // Unknown identifier - could be undefined or from outer scope
        pushInference(parent, 'any');
      }
      
      if (op) {
        const nodeHandlers = require('../index').getHandlers();
        nodeHandlers.operation(op, node);
        pushToParent(node, parent);
      }
    },
    operation: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushToParent(node, parent);
      if (node.named.math_op) {
        pushInference(parent, node.named.math_op);
      }
      if (node.named.boolean_op) {
        pushInference(parent, node.named.boolean_op);
      }
    },
    access_or_operation: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushToParent(node, parent);
      if (node.named.access) {
        pushInference(parent, node.named.access);
      }
    },
    new: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      pushInference(parent, 'object');
    },
  };
}

module.exports = createExpressionHandlers;
