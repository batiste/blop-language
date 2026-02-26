import { OPERATORS, SCOPE_TYPES, ERROR_MESSAGES } from '../../constants.js';

function createExpressionGenerators(context) {
  const { generateCode, validators, scopes, uid } = context;
  const { shouldBeDefined, generateError } = validators;

  return {
    'exp': (node) => {
      const output = [];
      // Type assertion: expr as SomeType — emit just the expression, discard the type.
      if (node.named?.type_cast) {
        return generateCode(node.named.exp);
      }
      // Compound-expression string interpolation: a.b'text 'val
      // Grammar: ['exp:left', 'str:str', 'inner_str_expression?:str_exp']
      if (node.named?.left !== undefined && node.named?.str !== undefined) {
        // A VNode on the left would stringify to '[object Object]' at runtime.
        // Mirror the AST-level check used in inner_str_expression.
        const leftFirstChild = node.named.left.children?.[0];
        if (leftFirstChild && leftFirstChild.type === 'virtual_node_exp') {
          generateError(leftFirstChild, ERROR_MESSAGES.VIRTUAL_NODE_IN_STRING_INTERPOLATION());
        }
        const out = ['`${'];
        out.push(...generateCode(node.named.left));
        out.push('}');
        out.push(node.named.str.value.slice(1, -1));
        if (node.named.str_exp) {
          out.push(...generateCode(node.named.str_exp));
        } else {
          out.push('`');
        }
        return out;
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          // Skip type_arguments — they are static type hints only, not emitted to JS
          if (node.children[i].type !== 'type_arguments') {
            output.push(...generateCode(node.children[i]));
          }
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
          // Compound-exp string interpolation: a.b'text'
          if (expNode.named?.left !== undefined && expNode.named?.str !== undefined) {
            isString = true;
          }
        }
      }
      
      // If inside a virtual node and it's a string, auto-add it to children
      if (parent && isString) {
        output.push(`${parent}c.push(`);
        for (let i = 0; i < node.children.length; i++) {
          output.push(...generateCode(node.children[i]));
        }
        output.push(`); `);
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
