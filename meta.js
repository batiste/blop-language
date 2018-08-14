
function generateSubRule(name, index, subRule, tokensDef, debug) {
  const output = [];
  output.push(`function ${name}_${index}(stream, index) {`)
  let i = 0;
  output.push(`  let i = index;`)
  output.push(`  let children = [];`)
  subRule.forEach(rule => {
    // terminal rule
    if(tokensDef[rule] || rule === 'EOS') {
      debug ? output.push(`  console.log(i, stream[i])`) : null
      output.push(`  if(stream[i].type !== '${rule}') return;`)
      output.push(`  children.push(stream[i]); i++;`)
    // calling another rule in the grammar
    } else {
      output.push(`  const _rule_${i} = ${rule}(stream, i);`) // doing the call
      output.push(`  if(!_rule_${i}) return;`)
      output.push(`  children.push(_rule_${i});`)
      output.push(`  i = _rule_${i}.last_index;`)
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
  output.push(`module.exports = {parse: start}`)
  return output
}

module.exports = {
  generate
}
