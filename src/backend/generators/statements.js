const { SCOPE_TYPES, SCOPE_DEPTH, ERROR_MESSAGES } = require('../../constants');

function createStatementGenerators(context) {
  const { generateCode, validators, scopes } = context;
  const { checkRedefinition, shouldBeDefined, generateError } = validators;

  const currentScopeVN = () => scopes.type(SCOPE_TYPES.VIRTUAL_NODE);

  return {
    'EOS': () => [],
    'annotation': () => [],
    'type_alias': () => [], // Type aliases are compile-time only, no runtime code
    'def': () => ['function '],
    'SCOPED_STATEMENT': (node) => {
      const output = [];
      const scope = scopes.currentBlock();
      const alreadyVnode = !!scope.__returnVirtualNode;
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      const parent = currentScopeVN().__currentVNode;
      // small improvement but this doesn't account for normal returns
      // or conditions
      if (!parent && scope.__returnVirtualNode && alreadyVnode) {
        generateError(node, ERROR_MESSAGES.UNREACHABLE_CODE_AFTER_VIRTUAL_NODE(), true);
      }
      return output;
    },
    'assign': (node) => {
      const output = [];
      const scope = scopes.currentBlock();
      if (node.named.name) {
        if (!node.named.explicit_assign) {
          checkRedefinition(node.named.name.value, node, node.named.explicit_assign);
          scope.names[node.named.name.value] = { node, token: node.named.name };
        }
        output.push(...generateCode(node.named.name));
      } else if (node.named.path) {
        const name = node.named.path.value;
        shouldBeDefined(name, node.named.path);
        output.push(...generateCode(node.named.path));
        output.push(...generateCode(node.named.access));
      } else {
        output.push(...generateCode(node.named.destructuring));
      }
      output.push(' = ');
      output.push(...generateCode(node.named.exp));
      output.push(';');
      return output;
    },
    'assign_op': (node) => {
      const output = [];
      shouldBeDefined(node.named.name.value, node.named.name);
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'break': (node) => {
      if (scopes.filter(SCOPE_TYPES.LOOP).length <= SCOPE_DEPTH.MIN_LOOP_DEPTH) {
        generateError(node, ERROR_MESSAGES.BREAK_OUTSIDE_LOOP());
      }
      return ['break'];
    },
    'continue': (node) => {
      if (scopes.filter(SCOPE_TYPES.LOOP).length <= SCOPE_DEPTH.MIN_LOOP_DEPTH) {
        generateError(node, ERROR_MESSAGES.CONTINUE_OUTSIDE_LOOP());
      }
      return ['continue'];
    },
  };
}

module.exports = {
  createStatementGenerators,
};
