var tokens = {
  'number': {reg: /^[0-9]+(\.[0-9]*)?/},
  'operator': {reg: /^[\+|\-|\*|\/]/},
  'def': {str: 'def '},
  'new': {str: 'new '},
  'if': {str: 'if '},
  'else': {str: 'else '},
  'elseif': {str: 'elseif '},
  'return': {str: 'return ', verbose:'return'},
  'throw': {str: 'throw ', verbose:'throw'},
  'colon': {str: ':'},
  'name': {reg: /^\w+/},
  ',': {str: ','},
  '.': {str: '.'},
  '(': {str: '('},
  ')': {str: ')'},
  '{': {str: '{'},
  '}': {str: '}'},
  '=>': {str: '=>'},
  '<=': {str: '<='},
  '==': {str: '=='},
  '=': {str: '='},
  'newline': {str: '\n'},
  'w': {str: ' ', verbose: 'single white space'},
};

const grammar = {'math': [
    ['(', 'math', ')', 'w?', 'operator', 'w', 'math'],
    ['(', 'math', ')'],
    ['number' , 'w', 'operator', 'w', 'math'],
    ['number']
]}

function generateSubRule(name, index, subRule) {
  const output = [];
  output.push(`function ${name}_${index}(stream, index) {`)
  let i = 0;
  output.push(`  let i = index;`)
  output.push(`  let children = [];`)
  subRule.forEach(rule => {
    // terminal rule
    if(tokens[rule]) {
      output.push(`  if(stream[i] !== '${rule}') return;`)
      output.push(`  children.push(stream[i]); i++;`)
    // calling another rule
    } else {
      output.push(`  const _rule_${i} = ${rule}(stream, i);`)
      output.push(`  if(!_rule_${i}) return;`)
      output.push(`  children.push(_rule_${i});`)
      output.push(`  i = _rule_${i}.lastItem.index + 1;`)
      i++;
    }
  })
  output.push(`  return {children, stream_index: index}`)
  output.push(`}`)
  output.push(``)
  return output;
}

function generate() {
  output = []
  Object.keys(grammar).forEach(key => {
    let i = 0;
    let metaSub = []
    grammar[key].forEach(subRule => {
      output = output.concat(generateSubRule(key, i, subRule))
      metaSub.push(`${key}_${i}()`)
      i++;
    })
    output.push(`function ${key}(stream, index) {`)
    output.push(`  return ${metaSub.join(' || ')};`)
    output.push(`}`)
  })
  return output
}

console.log(generate().join("\n"))
