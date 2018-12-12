const { preprocessGrammar, checkGrammarAndTokens } = require('./utils');

function generateTokenizer(tokenDef) {
  const output = [];
  const keys = Object.keys(tokenDef);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if ((/:|\?/g).test(key)) {
      throw new Error('Reserved word in token name');
    }
  }

  output.push('function _tokenize(tokenDef, input, stream) {');
  output.push('  let match;');
  let key;
  for (let i = 0; i < keys.length; i++) {
    key = keys[i];
    const token = tokenDef[key];
    if (token.str) {
      if (token.str.indexOf("'") > -1 || token.str.indexOf('\n') > -1) {
        output.push(`  if (input.startsWith(\`${token.str}\`)) {`);
        output.push(`    return [\`${token.str}\`, '${key}'];`);
      } else {
        output.push(`  if (input.startsWith('${token.str}')) {`);
        output.push(`    return ['${token.str}', '${key}'];`);
      }
      output.push('  }');
    } else if (token.reg) {
      output.push(`  match = input.match(tokenDef.${key}.reg);`);
      output.push('  if (match !== null) {');
      output.push(`    return [match[0], '${key}'];`);
      output.push('  }');
    } else if (token.func) {
      output.push(`  match = tokenDef.${key}.func(input, stream);`);
      output.push('  if (match !== undefined) {');
      output.push(`    return [match, '${key}'];`);
      output.push('  }');
    } else {
      throw new Error(`Tokenizer error: Invalid token ${key} without a reg, str or func property`);
    }
  }
  output.push(`  return [null, '${key}'];`);
  output.push('}');

  output.push('function tokenize(tokenDef, input) {');
  output.push(`  const stream = [];
  let lastToken;
  let key;
  let candidate = null;
  const len = input.length;
  let char = 0;
  let index = 0;
  while (char < len) {
    [candidate, key] = _tokenize(tokenDef, input, stream);
    if (candidate !== null) {
      lastToken = {
        type: key,
        value: candidate,
        start: char,
        stream_index: index,
        len: candidate.length,
      };
      stream.push(lastToken);
      index++;
      char += candidate.length;
      input = input.substr(candidate.length);
    } else {
      if (stream.length === 0) {
        throw new Error('Tokenizer error: total match failure');
      }
      if (lastToken) {
        lastToken.pointer += lastToken.value.length;
      }
      let msg = \`Tokenizer error, no matching token found for \${input.slice(0, 26)}\`;
      if (lastToken) {
        msg += \`Before token of type \${lastToken.type}: \${lastToken.value}\`;
      }
      const error = new Error(msg);
      error.token = lastToken;
      throw error;
    }
  }
  stream.push({
    type: 'EOS', value: '<End Of Stream>', char, index,
  });
  return stream;
}
`);
  return output;
}

function generateSubRule(name, index, subRule, tokensDef, debug) {
  const output = [];
  output.push(`function ${name}_${index}(stream, index) {`);
  let i = 0;
  output.push('  let i = index;');
  output.push('  const children = [];');
  output.push('  const named = {};');
  output.push(`  const node = {
    children, stream_index: index, name: '${name}',
    subRule: ${index}, type: '${name}', named,
  };`);
  subRule.forEach((rule) => {
    // terminal rule
    if (tokensDef[rule.value] || rule.value === 'EOS') {
      debug ? output.push('  console.log(i, stream[i])') : null;
      if (rule.repeatable) {
        output.push(`  while(stream[i].type === '${rule.value}') {`);
        if (rule.alias) {
          output.push(`    named['${rule.alias}'] ? null : named['${rule.alias}'] = []`);
          output.push(`    named['${rule.alias}'].push(stream[i])`);
        }
        output.push('    children.push(stream[i]); i++;');
        output.push('  }');
      } else if (rule.optional) {
        output.push(`  if (stream[i].type === '${rule.value}') {`);
        rule.alias ? output.push(`    named['${rule.alias}'] = stream[i];`) : null;
        output.push('    children.push(stream[i]); i++;');
        output.push('  }');
      } else {
        output.push(`  if (stream[i].type !== '${rule.value}') {`);
        output.push('    if (i > best_failure_index) {');
        output.push(`      best_failure = {
        rule_name: '${name}', sub_rule_index: ${index},
        sub_rule_stream_index: i - index, sub_rule_token_index: ${i},
        stream_index: i, token: stream[i], first_token: stream[index], success: false,
      };`);
        output.push('      best_failure_index = i;');
        output.push('    }');
        output.push('    return;');
        output.push('  }');
        rule.alias ? output.push(`  named['${rule.alias}'] = stream[i];`) : null;
        output.push('  children.push(stream[i]); i++;');
      }
      i++;
    // calling another rule in the grammar
    } else {
      if (rule.function) {
        output.push(`  if (!(${rule.value})(node)) { return; }`);
      } else if (rule.repeatable) {
        output.push(`  let _rule_${i} = ${rule.value}(stream, i);`); // doing the call
        output.push(`  while (_rule_${i}) {`);
        if (rule.alias) {
          output.push(`    named['${rule.alias}'] ? null : named['${rule.alias}'] = [];`);
          output.push(`    named['${rule.alias}'].push(_rule_${i});`);
        }
        output.push(`    children.push(_rule_${i});`);
        output.push(`    i = _rule_${i}.last_index;`);
        output.push(`    _rule_${i} = ${rule.value}(stream, i);`);
        output.push('  }');
      } else if (!rule.optional) {
        output.push(`  const _rule_${i} = ${rule.value}(stream, i);`); // doing the call
        output.push(`  if (!_rule_${i}) return;`);
        rule.alias ? output.push(`  named['${rule.alias}'] = _rule_${i};`) : null;
        output.push(`  children.push(_rule_${i});`);
        output.push(`  i = _rule_${i}.last_index;`);
      } else {
        output.push(`  const _rule_${i} = ${rule.value}(stream, i);`); // doing the call
        output.push(`  if (_rule_${i}) {`);
        output.push(`    children.push(_rule_${i});`);
        rule.alias ? output.push(`    named['${rule.alias}'] = _rule_${i};`) : null;
        output.push(`    i = _rule_${i}.last_index;`);
        output.push('  }');
      }
      i++;
    }
  });
  output.push('  node.success = i === stream.length; node.last_index = i;');
  output.push('  return node;');
  output.push('}');
  output.push('');
  return output;
}

function generate(grammar, tokensDef, debug) {
  let output = [];
  checkGrammarAndTokens(grammar, tokensDef);
  const newGrammar = preprocessGrammar(grammar);
  const entries = Object.keys(newGrammar);
  output.push('// This code is automatically generated by the meta parser, do not modify');
  output.push('let best_failure;');
  output.push('let best_failure_index = 0;');
  entries.forEach((key) => {
    let i = 0;
    const metaSub = [];
    newGrammar[key].forEach((subRule) => {
      output = output.concat(generateSubRule(key, i, subRule, tokensDef, debug));
      metaSub.push(`${key}_${i}`);
      i++;
    });
    output.push(`function ${key}(stream, index) {`);
    const st = metaSub.map(sub => `${sub}(stream, index)`).join('\n    || ');
    output.push(`  return ${st};`);
    output.push('}');
  });
  output = output.concat(generateTokenizer(tokensDef));
  output.push(`module.exports = {
  parse: (stream) => {
    best_failure = null;
    best_failure_index = 0;
    const result = START(stream, 0);
    if (!result) {
      return best_failure;
    }
    return result;
  },
  tokenize,
};
`);
  return output;
}


module.exports = {
  generate,
  generateTokenizer,
};
