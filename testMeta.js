// Meta programming: generate an efficient parser from
// a grammar and a token definition

function strDef(input) {
  var first, i, ch;
  first = input.charAt(0);
  if(first === '"' || first === "'") {
    i = 1;
    while(input.charAt(i)){
      ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === first) {
        return input.slice(0, i + 1);
      }
      i++;
    }
  }
}

function singleSpace(input) {
  if(input[0] === ' ' && input[1] !== ' ') {
    return ' ';
  }
}

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
  '>': {str: '>'},
  '<': {str: '<'},
  '=': {str: '='},
  'newline': {str: '\n'},
  'str': {func:strDef},
  'w': {func:singleSpace, verbose: 'single white space'},
  'W': {reg: /^[\s]+/, verbose: 'multiple white spaces'}
};


var grammar = {
    'START': [['STATEMENTS', 'EOS']],
    'STATEMENTS': [
      ['newline', 'w?', 'W?', 'STATEMENT', 'STATEMENTS'], // this recursion handle empty new lines
      ['newline', 'w?', 'W?', 'STATEMENT'],
      ['newline', 'w?', 'W?', 'STATEMENTS'],
      ['newline', 'w?', 'W?']
    ],
    'STATEMENT': [
      ['condition'],
      ['assign'], // because as soon as a rule is satisfied
                  // the parser return happily and destroy the stack
                  // the more specific rules need to come first
      ['exp'],
      ['return', 'exp'],
    ],
    'DOTTED_PATH': [
      ['name', 'func_call'],
      ['name', '.', 'DOTTED_PATH'],
      ['name']
    ],
    'math': [
        ['(', 'math', ')', 'w', 'operator', 'w', 'math'],
        ['(', 'math', ')'],
        ['number' , 'w', 'operator', 'w', 'math'],
        ['number']
    ],
    'assign': [
      ['DOTTED_PATH', 'w', '=', 'w', 'exp'],
    ],
    'func_def': [
      ['def', 'name?:name', '(', ')', 'func_body:body', 'w',],
      ['def', 'name?:name', '(', 'func_def_params:params', ')', 'w', 'func_body:body'],
      ['(', 'func_def_params:params', ')', 'w', '=>:fat-arrow', 'w', 'func_body:body'],
    ],
    'func_def_params': [
      ['name', '=', 'exp', ',', 'w', 'func_def_params'],
      ['name', '=', 'exp'],
      ['exp', ',', 'w', 'func_def_params'],
      ['exp']
    ],
    'func_call': [
      ['(', ')', '.', 'DOTTED_PATH'],
      ['(', 'func_call_params', ')', '.', 'DOTTED_PATH'],
      ['(', ')', 'func_call'],
      ['(', 'func_call_params', ')', 'func_call'],
      ['(', ')'],
      ['(', 'func_call_params', ')'],
    ],
    'func_call_params': [
      ['name', '=', 'exp'],
      ['exp', ',', 'w', 'func_call_params'],
      ['exp']
    ],
    'func_body': [
      ['exp:exp'],
      ['{', 'STATEMENTS:stats', '}']
    ],
    'condition': [
      ['if:type', 'exp:exp', 'w', '{', 'STATEMENTS:stats', '}', 'conditionelseif:elseif'],
    ],
    'conditionelseif': [
      ['w', 'elseif:type', 'exp:exp', 'w', '{', 'STATEMENTS:stats', '}', 'conditionelseif:elseif'],
      ['w', 'elseif:type', 'exp:exp', 'w', '{', 'STATEMENTS:stats', '}'],
      ['w', 'else:type', '{', 'STATEMENTS:stats', '}'],
      ['w?']
    ],
    'object_literal': [
      ['{', 'newline?', 'w?', 'W?', 'object_literal_body', '}']
    ],
    'object_literal_body': [
      ['str', 'colon', 'w', 'exp', 'w?', 'W?', ',', 'newline?', 'w?', 'W?', 'object_literal_body'],
      ['str', 'colon', 'w', 'exp', 'newline?', 'w?', 'W?']
    ],
    'operation': [
      ['operator', 'w','exp'],
      ['==', 'w','exp'],
      ['=>', 'w','exp'],
      ['<=', 'w','exp'],
      ['>', 'w','exp'],
      ['<', 'w','exp']
    ],
    'exp': [
      ['func_def'],
      ['DOTTED_PATH', 'w', 'operation'],
      ['DOTTED_PATH'],
      ['math', 'w', 'operation'],
      ['math'],
      ['str', 'w', 'operation'],
      ['str'],
      ['(', 'exp', ')', 'func_call'],
      ['(', 'exp', ')', '.', 'DOTTED_PATH'],
      ['(', 'exp', ')'],
      ['object_literal'],
      ['new', 'exp'],
      ['throw', 'exp']
    ]
};

const fs = require('fs');
const meta = require('./meta');

fs.writeFileSync("./out.js", meta.generate(grammar, tokensDef, false).join("\n"), function(err) {
    if(err) {
      console.log(err);
      return
    }
}); 

const tokenize = require('./tokenizer').tokenize
const out = require('./out')

var code = `

a = {
  'abc': 1,
  'bc': 2
}

(a, b, c) => {
  console.log('blop')
}

((a, b, c) => a + b / 1.039 * 2 + 1)

def blop(a, b) {
  1
}

if (1 + 2) == 2 {
  1
} elseif 1 {
  2 + a
} else {
  throw new Error()
}

bla.blop()()
blop(1, 2)
bla.blop()().hello()
test()

((a, b) => a + b)(1, 2)

`

const stream = tokenize(tokensDef, code)
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
