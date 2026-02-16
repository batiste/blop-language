import { OPERATORS, SCOPE_TYPES } from '../../constants.js';

function createExpressionGenerators(context) {
  const { generateCode, validators, scopes, uid } = context;
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
    'nullish': () => ['??'],
    'optional_chain': () => ['?.'],
    'pipe': () => ['|'],
    'ampersand': () => ['&'],
    'object_access': (node) => {
      const output = [];
      // Handle optional chaining
      if (node.named.optional) {
        output.push('?.');
        if (node.named.name) {
          output.push(node.named.name.value);
        } else if (node.children.some(c => c.type === 'exp')) {
          // Optional chaining with bracket notation ?.[exp]
          output.push('[');
          const expChild = node.children.find(c => c.type === 'exp');
          if (expChild) {
            output.push(...generateCode(expChild));
          }
          output.push(']');
        }
        // Continue with recursive object_access if it exists
        const recursiveAccess = node.children.find(c => c.type === 'object_access');
        if (recursiveAccess) {
          output.push(...generateCode(recursiveAccess));
        }
      } else {
        // Regular access - use default traversal
        // Skip type_arguments node (only for static type checking)
        for (let i = 0; i < node.children.length; i++) {
          if (node.children[i].type !== 'type_arguments') {
            output.push(...generateCode(node.children[i]));
          }
        }
      }
      return output;
    },
    'type_expression': (node) => {
      const output = [];
      // Type annotations are comments in the generated code
      output.push(...generateCode(node.children[0])); // type_primary
      if (node.named.union) {
        output.push(' | ');
        output.push(...generateCode(node.named.union));
      } else if (node.named.intersection) {
        output.push(' & ');
        output.push(...generateCode(node.named.intersection));
      }
      return output;
    },
    'type_primary': (node) => {
      const output = [];
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
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
      
      // Check if we're inside a virtual node and if the expression is a string
      const currentVNodeScope = scopes.type(SCOPE_TYPES.VIRTUAL_NODE);
      const parent = currentVNodeScope ? currentVNodeScope.__currentVNode : null;
      
      // Find if this is a string literal or string interpolation
      let isString = false;
      if (node.children.length > 0) {
        const expNode = node.children.find(c => c.type === 'exp');
        if (expNode && expNode.children.length > 0) {
          const firstChild = expNode.children[0];
          if (firstChild.type === 'str' || firstChild.type === 'str_expression') {
            isString = true;
          }
        }
      }
      
      // If inside a virtual node and it's a string, auto-add it to children
      if (parent && isString) {
        const scope = scopes.type(SCOPE_TYPES.FUNCTION);
        const a_uid = uid();
        // Register for hoisting at function level so variable is declared
        scope.names[a_uid] = { node, token: node, hoist: true };
        output.push(`${a_uid} = `);
        for (let i = 0; i < node.children.length; i++) {
          output.push(...generateCode(node.children[i]));
        }
        output.push(`; Array.isArray(${a_uid}) ? ${parent}c.push(...${a_uid}) : ${parent}c.push(${a_uid}); `);
      } else {
        // Normal expression statement
        for (let i = 0; i < node.children.length; i++) {
          output.push(...generateCode(node.children[i]));
        }
        output.push(';');
      }
      
      return output;
    },
  };
}

export {
  createExpressionGenerators,
};
