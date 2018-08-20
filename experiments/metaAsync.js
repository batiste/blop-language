const preprocessGrammar = require('./utils').preprocessGrammar

function generateSubRule(name, index, subRule, tokensDef, debug) {
  const output = [];
  output.push(`async function ${name}_${index}(stream, index) {`)
  let i = 0;
  output.push(`  let i = index;`)
  output.push(`  let children = [];`)
  subRule.forEach(rule => {
    // terminal rule
    if(tokensDef[rule.value] || rule.value === 'EOS') {
      debug ? output.push(`  console.log(i, stream[i])`) : null
      if(rule.optional) {
        output.push(`  if(stream[i].type == '${rule.value}') {`)
        output.push(`    children.push(stream[i]); i++;`)
        output.push(`  }`)
      } else {
        output.push(`  if(stream[i].type !== '${rule.value}') {`)
        output.push(`    if(i > best_failure_index) {`)
        output.push(`      best_failure = {rule_name: '${name}', sub_rule_index: ${i}, sub_rule_token_index: i - index, stream_index: i, token: stream[i], success: false}`)
        output.push(`      best_failure_index = i`)
        output.push(`     }`)
        output.push(`     return;`)
        output.push(`  }`)
        output.push(`  children.push(stream[i]); i++;`)
      }
    // calling another rule in the grammar
    } else {
      output.push(`  const _rule_${i} = await ${rule.value}(stream, i);`) // doing the call
      if(!rule.optional) {
        output.push(`  if(!_rule_${i}) return;`)
        output.push(`  children.push(_rule_${i});`)
        output.push(`  i = _rule_${i}.last_index;`)
      } else {
        output.push(`  if(_rule_${i}) {`)
        output.push(`    children.push(_rule_${i});`)
        output.push(`    i = _rule_${i}.last_index;`)
        output.push(`  }`)
      }
      i++;
    }
  })
  output.push(`  return {children, stream_index: index, last_index: i, name: "${name}", subRule: ${index}, success: i === stream.length}`)
  output.push(`}`)
  output.push(``)
  return output;
}

function generate(grammar, tokensDef, debug) {
  let output = []
  grammar = preprocessGrammar(grammar)
  const entries = Object.keys(grammar)
  output.push(`let best_failure;`)
  output.push(`let best_failure_index = 0;`)
  entries.forEach(key => {
    let i = 0;
    let metaSub = []
    grammar[key].forEach(subRule => {
      output = output.concat(generateSubRule(key, i, subRule, tokensDef, debug))
      metaSub.push(`${key}_${i}`)
      i++;
    })
    output.push(`async function ${key}(stream, index) {`)
    const st = metaSub.map(sub => `await ${sub}(stream, index)`).join(' || ')
    output.push(`  return ${st}`)
    output.push(`}`)
  })
  output = output.concat(generateTokenizer(tokensDef))
  output.push(`module.exports = {
    parse: async (stream) => {
      const result = await START(stream, 0)
      if(!result) {
        return best_failure;
      }
      return result;
    },
    tokenize
}`)
  return output
}

function generateTokenizer(tokenDef) {
  let output = []
  const keys = Object.keys(tokenDef);
  for(i=0; i<keys.length; i++) {
     key = keys[i];
     if((/\:|\?/g).test(key)) {
       throw new Error('Reserved word in token name')
     }
   }
  
  output.push('function _tokenize(tokenDef, input, stream) {')
  for(i=0; i<keys.length; i++) {
    key = keys[i];
    token = tokenDef[key];
    if(token.str) {
      output.push(`  if(input.indexOf(\`${token.str}\`) === 0) {`)
      output.push(`   return [\`${token.str}\`, \`${key}\`];`)
      output.push(`  }`)
    } else if(token.reg) {
      output.push(`  match = input.match(tokenDef.${key}.reg);`)
      output.push(`  if(match !== null) {`)
      output.push(`   return [match[0], \`${key}\`];`)
      output.push(`  }`)
    } else if(token.func) {
      output.push(`  match = tokenDef.${key}.func(input, stream);`)
      output.push(`  if(match !== undefined) {`)
      output.push(`   return [match, \`${key}\`];`)
      output.push(`  }`)
    } else {
      throw new Error("Tokenizer error: Invalid token " + key + " without a reg, str or func property");
    }
  }
  output.push(`  return null`)
  output.push('}')
  
  output.push('function tokenize(tokenDef, input) {')
  output.push(`  let stream = [], lastToken, i, key, candidate=null, match, token`);
  output.push(`  let len = input.length;`)
  output.push(`  let char = 0`);
  output.push(`  let index = 0`);
  output.push(`  while(char < len) {`)
  output.push(`    [candidate, key] = _tokenize(tokenDef, input, stream);`)
  var rest = `if(candidate !== null) {
    lastToken = {type:key, value:candidate, start:char, index:index, len:candidate.length};
    stream.push(lastToken);
    index++;
    char += candidate.length;
    input = input.substr(candidate.length);
  } else {
    if(stream.length === 0) {
      throw new Error("Tokenizer error: total match failure");
    }
    if(lastToken) {
      lastToken.pointer += lastToken.value.length;
    }
    var msg = "Tokenizer error, no matching token found";
    if(lastToken) {
      msg += "Before token of type " + lastToken.type + ": " + lastToken.value;
    }
    throw new Error(msg);
  }
}
stream.push({type:'EOS', value:'<End Of Stream>', char:char, index: index});
return stream
};
`
  output.push(rest)
  return output
}

module.exports = {
  generate,
  generateTokenizer
}
