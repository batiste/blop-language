import { SCOPE_TYPES, SCOPE_DEPTH, ERROR_MESSAGES } from '../../constants.js';

function createFunctionGenerators(context) {
  const { generateCode, validators, scopes } = context;
  const { checkRedefinition, popScopeBlock, registerName, shouldBeDefined, generateError } = validators;

  const currentScopeFCT = () => scopes.type(SCOPE_TYPES.FUNCTION);
  const addScopeFCT = () => scopes.add(SCOPE_TYPES.FUNCTION);
  const popScopeFCT = () => popScopeBlock(SCOPE_TYPES.FUNCTION);

  return {
    'func_def': (node) => {
      const output = [];
      const parentScope = currentScopeFCT();
      const scope = addScopeFCT();
      if (node.named['async']) {
        output.push('async ');
      }
      scope._currentFunction = { node, hoist: false };

      function namedFct() {
        checkRedefinition(node.named.name.value, node.named.name);
        parentScope.names[node.named.name.value] = {
          node,
          hoist: false,
          token: node.named.name,
          used: true,
        };
        output.push(...generateCode(node.named.name));
      }

      if (node.named['fat-arrow']) {
        if (node.named.name) {
          namedFct();
        }
        output.push('(');
        if (node.named.params) {
          output.push(...generateCode(node.named.params));
        }
        output.push(') =>');
        output.push(...generateCode(node.named.body));
      } else {
        if (!node.named.name) {
          output.push('(');
        }
        output.push('function ');
        if (node.named.name) {
          namedFct();
        }
        output.push('(');
        if (node.named.params) {
          output.push(...generateCode(node.named.params));
        }
        output.push(')');
        output.push(...generateCode(node.named.body));
        if (!node.named.name) {
          output.push(')');
        }
      }
      popScopeFCT();
      return output;
    },
    'class_def': (node) => {
      const output = [];
      const scope = scopes.currentBlock();
      checkRedefinition(node.named.name.value, node.named.name);
      scope.names[node.named.name.value] = { node, hoist: false, token: node.named.name };
      output.push('class ');
      output.push(node.named.name.value);
      if (node.named.extends) {
        const name = node.named.extends.value;
        shouldBeDefined(name, node.named.extends);
        output.push(` extends ${name}`);
      }
      output.push(' {');
      if (node.named.stats) {
        node.named.stats.forEach(stat => output.push(...generateCode(stat)));
      }
      output.push(' }');
      return output;
    },
    'class_func_def': (node) => {
      const output = [];
      const scope = addScopeFCT();
      scope.names[node.named.name.value] = {
        node, hoist: false, token: node.named.name, used: true,
      };
      scope._currentFunction = { node, hoist: false };
      if (node.named['async']) {
        output.push('async ');
      }
      output.push(`${node.named.name.value}`);
      output.push('(');
      if (node.named.params) {
        output.push(...generateCode(node.named.params));
      }
      output.push(')');
      output.push(...generateCode(node.named.body));
      output.push('\n');
      popScopeFCT();
      return output;
    },
    'func_def_params': (node) => {
      const scope = scopes.currentBlock();
      registerName(node.named.name.value, node.named.name);
      scope.names[node.named.name.value] = {
        node,
        hoist: false,
        token: node.named.name,
        annotation: node.named.annotation,
      };
      const output = [];
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'func_body': (node) => {
      const output = [];
      output.push(...funcBodyFat(node));
      return output;
    },
    'func_body_fat': funcBodyFat,
    'return': (node) => {
      if (scopes.filter(SCOPE_TYPES.FUNCTION).length <= SCOPE_DEPTH.MIN_FUNCTION_DEPTH) {
        generateError(node, ERROR_MESSAGES.RETURN_OUTSIDE_FUNCTION());
      }
      return ['return '];
    },
    'await': (node) => {
      const scope = currentScopeFCT();
      if (!scope._currentFunction) {
        generateError(node, ERROR_MESSAGES.AWAIT_OUTSIDE_FUNCTION());
      } else if (scope._currentFunction.node.named.async === undefined) {
        generateError(node, ERROR_MESSAGES.AWAIT_OUTSIDE_ASYNC());
      }
      return ['await '];
    },
    'try_catch': (node) => {
      const output = [];
      output.push(...generateCode(node.named.try));
      node.named.statstry.forEach(stat => output.push(...generateCode(stat)));
      output.push(...generateCode(node.named.catch));
      const scope = scopes.currentBlock();
      scope.names[node.named.name.value] = {
        node: node.named.name,
        hoist: false,
        token: node.named.name,
      };
      output.push(...generateCode(node.named.name));
      output.push(') {');
      node.named.statscatch.forEach(stat => output.push(...generateCode(stat)));
      output.push('}');
      return output;
    },
    'try': () => ['try {'],
    'catch': () => ['} catch('],
  };

  function funcBodyFat(node) {
    const scope = scopes.currentBlock();
    let output = [];
    if (node.named.exp) {
      output = generateCode(node.named.exp);
    } else {
      output.push(' {');
      const body = [];
      // states can be empty
      if (node.named.stats) {
        node.named.stats.forEach(stat => body.push(...generateCode(stat)));
        // hoisting
        const keys = Object.keys(scope.names).filter(key => scope.names[key].hoist !== false);
        if (keys.length > 0) {
          output.push(`let ${keys.join(', ')};`);
        }
        output.push(...body);
      }
      output.push('}');
    }
    return output;
  }
}

export {
  createFunctionGenerators,
};
