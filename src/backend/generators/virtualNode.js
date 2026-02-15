const { SCOPE_TYPES, SCOPE_DEPTH, ERROR_MESSAGES, PATTERNS } = require('../../constants');

function createVirtualNodeGenerators(context) {
  const { generateCode, validators, scopes, uid } = context;
  const { generateError, shouldBeDefined } = validators;

  const currentScopeVN = () => scopes.type(SCOPE_TYPES.VIRTUAL_NODE);
  const addScopeVN = () => scopes.add(SCOPE_TYPES.VIRTUAL_NODE);
  const popScopeVN = () => scopes.pop(SCOPE_TYPES.VIRTUAL_NODE);
  const currentScopeFCT = () => scopes.type(SCOPE_TYPES.FUNCTION);
  const currentScopeCDT = () => scopes.type(SCOPE_TYPES.CONDITIONAL);
  const currentScopeLOOP = () => scopes.type(SCOPE_TYPES.LOOP);

  function registerVirtualNode(node) {
    const currentFctNS = currentScopeFCT();
    const currentCdtNS = currentScopeCDT();
    const currentLoopNS = currentScopeLOOP();
    const parent = currentScopeVN().__currentVNode;
    const { opening, closing } = node.named;
    if (node.type === 'virtual_node_exp') {
      return;
    }
    if (closing) {
      opening.len = closing.start - opening.start + closing.len;
    }
    if (scopes.filter(SCOPE_TYPES.FUNCTION).length <= SCOPE_DEPTH.MIN_FUNCTION_DEPTH) {
      generateError(opening, ERROR_MESSAGES.VIRTUAL_NODE_OUTSIDE_FUNCTION());
    }

    const loopFctParent = scopes.parentFrom(SCOPE_TYPES.FUNCTION, currentLoopNS);
    if (!parent && loopFctParent && loopFctParent === currentFctNS) {
      generateError(opening, ERROR_MESSAGES.ROOT_VIRTUAL_NODE_IN_LOOP(), true);
    }

    if (!parent) {
      if (currentFctNS.__returnVirtualNode) {
        generateError(opening, ERROR_MESSAGES.ROOT_VIRTUAL_NODE_ALREADY_DEFINED());
      } else if (scopes.filter(SCOPE_TYPES.CONDITIONAL).length > SCOPE_DEPTH.MIN_CONDITIONAL_DEPTH) {
        let isRedefined = false;
        scopes.filter(SCOPE_TYPES.CONDITIONAL).reverse().forEach((scope) => {
          if (scope.__returnVirtualNode) {
            isRedefined = true;
          }
        });
        if (isRedefined) {
          generateError(opening, ERROR_MESSAGES.ROOT_VIRTUAL_NODE_IN_BRANCH());
        } else {
          currentCdtNS.__returnVirtualNode = { node, hoist: false, used: true };
        }
      } else {
        currentFctNS.__returnVirtualNode = { node, hoist: false, used: true };
      }
    }
  }

  return {
    'virtual_node': (node) => {
      const output = []; let
        renderGuard = null;

      registerVirtualNode(node);

      const parent = currentScopeVN().__currentVNode;
      const _uid = uid();
      output.push(`const ${_uid}c = []; const ${_uid}a = {};`);
      addScopeVN().__currentVNode = _uid;
      node.named.attrs ? node.named.attrs.forEach(
        attr => output.push(...generateCode(attr)),
      ) : null;

      // optimization with snabbdom to not render children
      if (node.named.attrs) {
        node.named.attrs.forEach((attr) => {
          if (attr.named.name.value === 'needRender') {
            output.push('if (');
            renderGuard = attr.named.exp ? generateCode(attr.named.exp) : [attr.named.name.value];
            output.push(renderGuard);
            output.push(' !== false) {');
          }
        });
      }
      node.named.stats ? node.named.stats.forEach(
        stat => output.push(...generateCode(stat)),
      ) : null;
      if (node.named.exp) {
        const a_uid = uid();
        output.push(` const ${a_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; Array.isArray(${a_uid}) ? ${_uid}c.push(...${a_uid}) : ${_uid}c.push(${a_uid});`);
      }
      if (renderGuard) {
        output.push('}');
      }
      popScopeVN();
      const start = node.named.opening.value;
      if (PATTERNS.UPPERCASE_START.test(start)) {
        shouldBeDefined(start, node.named.opening);
        output.push(` const ${_uid} = blop.c(${start}, ${_uid}a, ${_uid}c, '${_uid}');`);
      } else {
        output.push(` const ${_uid} = blop.h('${start}', ${_uid}a, ${_uid}c);`);
      }
      if (parent && node.type !== 'virtual_node_exp') {
        output.push(` ${parent}c.push(${_uid});`);
      } else {
        output.push(` return ${_uid};`);
      }
      return output;
    },
    'virtual_node_exp': (node) => {
      const output = [];
      output.push('(() => {');
      output.push(...virtualNode(node));
      output.push('})()');
      return output;
    },
    'virtual_node_assign': (node) => {
      const output = [];
      const parent = currentScopeVN().__currentVNode;
      const scope = scopes.type(SCOPE_TYPES.FUNCTION);
      const a_uid = uid();
      // Register for hoisting at function level so variable is declared
      scope.names[a_uid] = { node, token: node, hoist: true };
      output.push(`${a_uid} = `);
      output.push(...generateCode(node.named.exp));
      if (!parent) {
        generateError(node, ERROR_MESSAGES.VIRTUAL_NODE_ASSIGNMENT_OUTSIDE());
      }
      output.push(`; Array.isArray(${a_uid}) ? ${parent}c.push(...${a_uid}) : ${parent}c.push(${a_uid}); `);
      return output;
    },
    'virtual_node_attributes': (node) => {
      const output = [];
      const _uid = currentScopeVN().__currentVNode;
      output.push(` ${_uid}a['${node.named.name.value}'] = `);
      if (node.named.exp) {
        output.push(...generateCode(node.named.exp));
      } else {
        shouldBeDefined(node.named.name.value, node.named.name);
        output.push(node.named.name.value);
      }
      output.push(';');
      return output;
    },
  };

  function virtualNode(node) {
    const handlers = createVirtualNodeGenerators(context);
    return handlers['virtual_node'](node);
  }
}

module.exports = {
  createVirtualNodeGenerators,
};
