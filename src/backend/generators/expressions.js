const { OPERATORS } = require('../../constants');

function createExpressionGenerators(context) {
  const { generateCode, validators } = context;
  const { shouldBeDefined } = validators;

  return {
    'exp': (node) => {
      const output = [];
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          output.push(...generateCode(node.children[i]));
        }
      }
      return output;
    },
    'name_exp': (node) => {
      const output = [];
      shouldBeDefined(node.named.name.value, node);
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'named_func_call': (node) => {
      const output = [];
      shouldBeDefined(node.named.name.value, node);
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'boolean_operator': (node) => {
      if (node.value === OPERATORS.LOOSE_EQUALITY) {
        return [OPERATORS.STRICT_EQUALITY];
      }
      if (node.value === OPERATORS.LOOSE_INEQUALITY) {
        return [OPERATORS.STRICT_INEQUALITY];
      }
      return [node.value];
    },
    'short_if_expression': (node) => {
      const output = [];
      output.push(...generateCode(node.named.exp1));
      output.push(' ? ');
      output.push(...generateCode(node.named.exp2));
      output.push(' : ');
      if (node.named.exp3) {
        output.push(...generateCode(node.named.exp3));
      } else {
        output.push('undefined');
      }
      return output;
    },
    'exp_statement': (node) => {
      const output = [];
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      output.push(';');
      return output;
    },
  };
}

module.exports = {
  createExpressionGenerators,
};
