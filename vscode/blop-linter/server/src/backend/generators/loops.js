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

      //generate a different type of loop using annotation
      // Extract type from annotation structure (handles both old and new format)
      const getAnnotationType = (annotation) => {
        if (!annotation) return null;
        // New format: annotation.named.type.children[0] (type_primary) has named.name
        if (annotation.named && annotation.named.type) {
          const typeExp = annotation.named.type;
          if (typeExp.children && typeExp.children[0]) {
            const typePrimary = typeExp.children[0];
            if (typePrimary.named && typePrimary.named.name) {
              // type_name node - get first child (the actual token)
              const typeName = typePrimary.named.name;
              if (typeName.children && typeName.children[0]) {
                return typeName.children[0].value;
              }
              return typeName.value;
            }
          }
        }
        // Old format fallback: annotation.children[2] is the name token
        if (annotation.children && annotation.children[2]) {
          return annotation.children[2].value;
        }
        return null;
      };
      
      const keyAnnotationType = getAnnotationType(node.named.keyannotation);
      const objAnnotationType = getAnnotationType(node.named.objectannotation);
      const isArray = (keyAnnotationType === 'int') || (objAnnotationType === 'array');
      
      // an proper array is expected
      if (isArray) {
        const f_uid = uid();
        output.push(`let ${f_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; let ${key}=0; for(; ${key} < ${f_uid}.length; ${key}++) { let ${value} = ${f_uid}[${key}];`);
        node.named.stats ? node.named.stats.forEach(
          stat => output.push(...generateCode(stat)),
        ) : null;
        output.push('};');
      // any other objects
      } else {
        const f_uid = uid();
        const k_uid = uid();
        const i_uid = uid();
        output.push(`let ${f_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; let ${k_uid} = Object.keys(${f_uid}); let ${key}; `);
        output.push(`for(let ${i_uid}=0; ${i_uid} < ${k_uid}.length; ${i_uid}++) { ${key} = ${k_uid}[${i_uid}]; let ${value} = ${f_uid}[${key}];`);
        node.named.stats ? node.named.stats.forEach(
          stat => output.push(...generateCode(stat)),
        ) : null;
        output.push('};');
      }
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
