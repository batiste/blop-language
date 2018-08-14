// Meta programming: generate an efficient parser from
// a grammar and a token definition

var tokensDef = {
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

const grammar = {
  'start': [['math', 'EOS']],
  'math': [
    ['(', 'math', ')', 'w', 'operator', 'w', 'math'],
    ['(', 'math', ')'],
    ['number' , 'w', 'operator', 'w', 'math'],
    ['number']
  ]
}

const fs = require('fs');
const meta = require('./meta');

fs.writeFileSync("./out.js", meta.generate(grammar, tokensDef).join("\n"), function(err) {
    if(err) {
      console.log(err);
      return
    }
}); 

const tokenize = require('./tokenizer').tokenize
const out = require('./out')

const stream = tokenize(tokensDef, '2.33 + (34.99 + (76343 + 12312321 + 21321.232))')
const tree = out.parse(stream, 0)

let output = []
function generateCode(node) {
  if(node.value) {
    output.push(node.value)
  }
  if(node.children) {
    for(var i=0; i<node.children.length; i++) {
      generateCode(node.children[i])
    }
  }
}
console.log(`success: ${tree.success}`)
generateCode(tree)
console.log(output.join(''))
