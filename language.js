var assert = require("assert");
var parser = require("./parser");
var tokenizer = require("./tokenizer");

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
  'str': {func:strDef},
  'w': {func:singleSpace, verbose: 'single white space'},
  'W': {reg: /^[\s]+/, verbose: 'multiple white spaces'}
};

var rules = {
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

var modifiers = {
  'NEW_LINE': function(node, parent) {
    parent.children.push(node.children.pop());
    return node;
  },
};

function modify(node, parent) {
    if(node.rule_name && modifiers[node.rule_name]) {
        modifiers[node.rule_name](node, parent);
    }

    if(node.children) {
        for(var i=0; i<node.children.length; i++) {
            modify(node.children[i], node);
        }
    }
}

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

function replaceInvisibleChars(v) {
  v = v.replace(/\r/g, '⏎\r')
  v = v.replace(/\n/g, '⏎\n')
  v = v.replace(/\t/g, '⇥')
  return v.replace(/ /g, '␣')
}

function streamContext(index, stream) {
  var min = Math.max(0, index-10), i
  var max = Math.min(stream.length, index+10)
  var str = ''
  i = index - 1
  var lines = 0
  while(i >= 0) {
    var v = stream[i].value
    if(v.match(/\n/)) {
      lines++
    }
    str = v + str
    if(lines > 3) {
      break
    }
    i--
  }
  var v = replaceInvisibleChars(stream[index].value);

  str = str + RED + v + NC
  i = index + 1
  var lines = 0
  while(i < stream.length) {
    var v = stream[i].value
    if(v.match(/\n/)) {
      lines++
    }
    str = str + v
    if(lines > 2) {
      break
    }
    i++
  }
  return str
}


function parse(input, debug) {
  var stream = tokenizer.tokenize(tokens, input);
  var tree = parser.parse(rules, stream, debug);

  if(!tree.success) {
    var sub_rules = rules[tree.rule_name][tree.sub_rule_index];
    var rule = ''
    var token = tree.token
    for(i=0; i<sub_rules.length; i++) {
      var sr = sub_rules[i];
      if(tokens[sr] && tokens[sr].verbose) {
        sr = tokens[sr].verbose.replace(/\s/g, '-')
      }
      if(i === tree.sub_rule_token_index) {
        rule += `${RED}${sr}${NC} `
      } else {
        rule += `${YELLOW}${sr}${NC} `
      }
    }
    console.log(tree.rule_item)
    throw new Error(`
  ${RED}Parser error${NC}
  Best match was at rule ${tree.rule_name}[${tree.sub_rule_index}][${tree.sub_rule_token_index}] ${rule}
  token ${YELLOW}${replaceInvisibleChars(token.value)}${NC} doesn't match rule item ${YELLOW}${tree.rule_item.value}${NC}
  Context:
${streamContext(token.index, stream)}
  `)
  }

  return tree
}

function printTree(node, sp) {
    if(node.rule_name) {
        console.log(sp + 'r ' + node.rule_name + '(' + node.sub_rule_index + ')');
    } else {
        console.log(sp + 't ' + node.type + ' ' + node.value);
    }

    if(node.children) {
        for(var i=0; i<node.children.length; i++) {
            printTree(node.children[i], sp + '  ');
        }
    }
}

var output = [];
var namespace = {}

function addToNamespace(name, node) {
  if(namespace[name]) {
    
  }
}

var backend = {
  'def': node => output.push(`function `),
  'EOS': node => '',
  'condition': node => {
    output.push(`${node.named.type.value}(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    generateCode(node.named.stats)
    output.push(`}`)
    generateCode(node.named.elseif)
  },
  'conditionelseif': node => {
    if(!node.named.type) {
      return
    }
    if(node.named.type.type === 'else') {
      output.push(` else {`)
      generateCode(node.named.stats)
      output.push(`}`)
      return
    }
    output.push(` ${node.named.type.value}(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    generateCode(node.named.stats)
    output.push(`}`)
    generateCode(node.named.elseif)
  },
  'func_def': node => {
    if(node.named['fat-arrow']) {
      if(node.named.name) {
        output.push(node.named.name.value)
      }
      output.push(`(`)
      generateCode(node.named.params)
      output.push(`) =>`)
      generateCode(node.named.body)
    } else {
      output.push(`function `)
      if(node.named.name) {
        output.push(node.named.name.value)
      }
      output.push(`(`)
      generateCode(node.named.params)
      output.push(`)`)
      generateCode(node.named.body)
    }
  },
  'func_body': node => {
    if(node.named.exp) {
      output.push(` { return `)
      generateCode(node.named.exp)
      output.push(` }`)
    }
    if(node.named.stats) {
      output.push(` {`)
      generateCode(node.named.stats)
      output.push(`}`)
    }
  },
  '==': node => {
    output.push(`===`)
  }
}

function generateCode(node) {
  if(backend[node.type]) {
    backend[node.type](node)
  } else if(backend[node.rule_name]) {
    backend[node.rule_name](node)
  } else {
    if(node.value) {
      output.push(node.value)
    }
    if(node.children) {
      for(var i=0; i<node.children.length; i++) {
        generateCode(node.children[i])
      }
    }
  }
}

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
var a = []
for(var i=0; i<1; i++) {
  a.push(code)
}

var tree = parse(a.join(''));

// printTree(tree, '')
generateCode(tree)
console.log(output.join(''))
