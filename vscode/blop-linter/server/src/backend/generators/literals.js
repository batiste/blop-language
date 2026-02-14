function createLiteralGenerators(context) {
  const { generateCode, validators } = context;
  const { shouldBeDefined } = validators;

  return {
    'newline': () => ['\n'],
    'str': (node) => {
      const str = node.value.slice(1, -1);
      const lines = str.split('\n');
      if (lines.length > 1) {
        return [`\`${str}\``];
      }
      return [`'${str}'`];
    },
    'str_expression': (node) => {
      const output = ['`', node.named.str.value.slice(1, -1)];
      output.push(...generateCode(node.named.str_exp));
      return output;
    },
    'inner_str_expression': (node) => {
      const output = ['${'];
      output.push(...generateCode(node.named.exp));
      output.push('}');
      output.push(node.named.str.value.slice(1, -1));
      if (node.named.str_exp) {
        output.push(...generateCode(node.named.str_exp));
      } else {
        output.push('`');
      }
      return output;
    },
    'object_literal': (node) => {
      const output = [];
      output.push('(');
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      output.push(')');
      return output;
    },
    'object_literal_body': (node) => {
      const output = [];
      // Handle spread syntax in objects
      if (node.named.spread) {
        output.push('...');
        output.push(...generateCode(node.named.spread_exp));
        // Process remaining children but skip the spread and spread_exp tokens
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.type !== 'spread' && child !== node.named.spread_exp) {
            output.push(...generateCode(child));
          }
        }
        return output;
      }
      if (node.named.key) {
        const name = node.named.key.children[0].value;
        shouldBeDefined(name, node.named.key.children[0]);
      }
      // Process all children for non-spread cases
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'object_literal_key': (node) => {
      const child = node.children[0];
      if (child.type === 'str') {
        return [`'${child.value.slice(1, -1)}'`];
      }
      return [child.value];
    },
  };
}

module.exports = {
  createLiteralGenerators,
};
