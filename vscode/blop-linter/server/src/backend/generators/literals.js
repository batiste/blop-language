import { ERROR_MESSAGES } from '../../constants.js';

function createLiteralGenerators(context) {
  const { generateCode, validators } = context;
  const { shouldBeDefined, generateError } = validators;

  return {
    'newline': () => ['\n'],
    'str': (node) => {
      const str = node.value.slice(1, -1);
      const lines = str.split('\n');
      if (lines.length > 1) {
        return [`\`${str}\``];
      }
      // Escape only unescaped single quotes (not already preceded by odd number of backslashes)
      let escaped = '';
      for (let i = 0; i < str.length; i++) {
        if (str[i] === "'") {
          // Count preceding backslashes
          let numBackslashes = 0;
          for (let j = i - 1; j >= 0 && str[j] === '\\'; j--) {
            numBackslashes++;
          }
          // If even number of backslashes (or zero), the quote is unescaped and needs escaping
          if (numBackslashes % 2 === 0) {
            escaped += "\\'";
          } else {
            // Quote is already escaped by preceding backslashes, don't add another escape
            escaped += "'";
          }
        } else {
          escaped += str[i];
        }
      }
      return [`'${escaped}'`];
    },
    'str_expression': (node) => {
      // Handle simplified syntax with name and empty string - just return the name
      if (node.named.name && node.named.str && node.named.str.value === "''" && !node.named.str_exp) {
        shouldBeDefined(node.named.name.value, node.named.name);
        return [node.named.name.value];
      }
      
      const output = ['`'];
      // If there's a leading name (simplified syntax), add it as interpolation first
      if (node.named.name) {
        shouldBeDefined(node.named.name.value, node.named.name);
        output.push('${', node.named.name.value, '}');
      }
      // Then add the string after the name
      if (node.named.str) {
        output.push(node.named.str.value.slice(1, -1));
      }
      // Add the rest of the interpolation
      if (node.named.str_exp) {
        output.push(...generateCode(node.named.str_exp));
      } else {
        output.push('`');
      }
      return output;
    },
    'inner_str_expression': (node) => {
      const output = ['${'];
      // Detect a virtual node embedded in string interpolation — it would be
      // stringified to '[object Object]' at runtime.
      const expChild = node.named.exp.children[0];
      if (expChild && expChild.type === 'virtual_node_exp') {
        const openingToken = expChild.named && expChild.named.opening;
        generateError(openingToken || expChild, ERROR_MESSAGES.VIRTUAL_NODE_IN_STRING_INTERPOLATION());
      }
      output.push(...generateCode(node.named.exp));
      output.push('}');
      
      // If there's a trailing string, add it and continue
      if (node.named.str) {
        output.push(node.named.str.value.slice(1, -1));
        if (node.named.str_exp) {
          output.push(...generateCode(node.named.str_exp));
        } else {
          output.push('`');
        }
      } else {
        // No trailing string - close the template
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
    'null': (node) => ['null'],
    'undefined': (node) => ['undefined'],
    'true': (node) => ['true'],
    'false': (node) => ['false'],
  };
}

export {
  createLiteralGenerators,
};
