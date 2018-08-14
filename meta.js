
function preprocessGrammar(rules) {
  return Object.keys(rules).reduce((accu, key) => {
    accu[key] = rules[key].map(
      subRule => subRule.map(subRuleItem => {
        const values = subRuleItem.split(':')
        let optional = false;
        if(values[0].endsWith('?')) {
          values[0] = values[0].substring(0, values[0].length - 1);
          optional = true
        }
        return {
          value: values[0],
          alias: values[1],
          optional
        }
      })
    )
    return accu
  }, {})
}

function generateSubRule(name, index, subRule, tokensDef, debug) {
  const output = [];
  output.push(`function ${name}_${index}(stream, index) {`)
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
        output.push(`  if(stream[i].type !== '${rule.value}') return;`)
        output.push(`  children.push(stream[i]); i++;`)
      }
    // calling another rule in the grammar
    } else {
      output.push(`  const _rule_${i} = ${rule.value}(stream, i);`) // doing the call
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
  entries.forEach(key => {
    let i = 0;
    let metaSub = []
    grammar[key].forEach(subRule => {
      output = output.concat(generateSubRule(key, i, subRule, tokensDef, debug))
      metaSub.push(`${key}_${i}(stream, index)`)
      i++;
    })
    output.push(`function ${key}(stream, index) {`)
    output.push(`  return ${metaSub.join(' || ')};`)
    output.push(`}`)
  })
  output.push(`module.exports = {parse: START}`)
  return output
}

module.exports = {
  generate
}
