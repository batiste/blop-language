import { SCOPE_TYPES } from '../../constants.js';

function createConditionalGenerators(context) {
  const { generateCode, validators, scopes } = context;
  const { popScopeBlock } = validators;

  const addScopeCDT = () => scopes.add(SCOPE_TYPES.CONDITIONAL);
  const popScopeCDT = () => popScopeBlock(SCOPE_TYPES.CONDITIONAL);

  return {
    'condition': (node) => {
      const output = [];
      addScopeCDT();
      output.push(`${node.named.type.value}(`);
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      popScopeCDT();
      output.push(...generateCode(node.named.elseif));
      return output;
    },
    'else_if': (node) => {
      const output = [];
      if (!node.named.type) {
        return output;
      }
      if (node.named.type.type === 'else') {
        output.push(' else {');
        addScopeCDT();
        node.named.stats.forEach((stat) => {
          output.push(...generateCode(stat));
        });
        output.push('}');
        popScopeCDT();
        return output;
      }
      output.push(' else if (');
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      addScopeCDT();
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      popScopeCDT();
      output.push(...generateCode(node.named.elseif));
      return output;
    },
  };
}

export {
  createConditionalGenerators,
};
