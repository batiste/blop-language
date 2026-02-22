import { SCOPE_TYPES } from '../../constants.js';

function createLoopGenerators(context) {
  const { generateCode, validators, scopes, uid } = context;
  const { checkRedefinition, popScopeBlock } = validators;

  const addScopeLOOP = () => scopes.add(SCOPE_TYPES.LOOP);
  const popScopeLOOP = () => popScopeBlock(SCOPE_TYPES.LOOP);

  return {
    'for_loop': (node) => {
      const scope = addScopeLOOP();
      const output = [];
      const key = (node.named.key && node.named.key.value) || `_i${uid()}`;
      const { value } = node.named.value;
      checkRedefinition(key, node.named.key);
      checkRedefinition(node.named.value.value, node.named.value);
      scope.names[key] = {
        node: node.named.key, hoist: false, export: false, token: node.named.key,
      };
      scope.names[value] = {
        node: node.named.value,
        export: false, hoist: false, token: node.named.value,
      };
      
      const f_uid = uid();
      output.push(`let ${f_uid} = `);
      output.push(...generateCode(node.named.exp));

      // an proper array is expected
      if (node.named.of) {
        // use for ... of for arrays to preserve correct this binding and handle sparse arrays
        output.push(`; let ${key}=0; for(; ${key} < ${f_uid}.length; ${key}++) { let ${value} = ${f_uid}[${key}];`);
        // output.push(`; for(let ${key} of ${f_uid}) { let ${value} = ${f_uid}[${key}];`);
      } else {
        // const k_uid = uid();
        // const i_uid = uid();
        // output.push(`; let ${k_uid} = Object.keys(${f_uid}); let ${key}; `);
        // output.push(`for(let ${i_uid}=0; ${i_uid} < ${k_uid}.length; ${i_uid}++) { ${key} = ${k_uid}[${i_uid}]; let ${value} = ${f_uid}[${key}];`);
        // use for ... in for objects to preserve non-enumerable properties and correct this binding
        output.push(`; for(let ${key} in ${f_uid}) { let ${value} = ${f_uid}[${key}];`);
      }
      node.named.stats ? node.named.stats.forEach(
        stat => output.push(...generateCode(stat)),
      ) : null;
      output.push('};');
      popScopeLOOP();
      return output;
    },
    'while_loop': (node) => {
      addScopeLOOP();
      const output = [];
      output.push('while(');
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      popScopeLOOP();
      return output;
    },
  };
}

export {
  createLoopGenerators,
};
