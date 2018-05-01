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
  'operator': {reg: /^[\+|\-]/},
  'def': {str: 'def '},
  'new': {str: 'new '},
  'if': {str: 'if '},
  'else': {str: 'else '},
  'elseif': {str: 'elseif '},
  'return': {str: 'return ', verbose:'return'},
  'throw': {str: 'throw ', verbose:'throw'},
  'name': {reg: /^\w+/},
  ',': {str: ','},
  '.': {str: '.'},
  '(': {str: '('},
  ')': {str: ')'},
  '{': {str: '{'},
  '}': {str: '}'},
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
      ['name', '.', 'func_call'],
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
      ['def', 'name?', '(', ')', 'func_body'],
      ['def', 'name?', '(', 'func_def_params', ')', 'func_body'],
    ],
    'func_def_params': [
      ['name', '=', 'exp', ',', 'w', 'func_def_params'],
      ['name', '=', 'exp'],
      ['exp', ',', 'w', 'func_def_params'],
      ['exp']
    ],
    'func_call': [
      ['name', '(', ')'],
      ['name', '(', 'func_call_params', ')'],
    ],
    'func_call_params': [
      ['name', '=', 'exp'],
      ['exp', ',', 'w', 'func_call_params'],
      ['exp']
    ],
    'func_body': [
      ['w', 'exp'],
      ['w', '{', 'STATEMENTS', '}']
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
    'exp': [
      ['func_def'],
      ['func_call'],
      ['DOTTED_PATH', 'w', 'operator', 'w', 'exp'],
      ['DOTTED_PATH'],
      ['math', 'w', 'operator', 'w', 'exp'],
      ['str', 'w', 'operator', 'w', 'exp'],
      ['math'],
      ['str'],
      ['(', 'exp', ')'],
      ['new', 'exp'],
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
    throw new Error(`
  ${RED}Parser error${NC}
  Best match was at rule ${tree.rule_name}[${tree.sub_rule_index}][${tree.sub_rule_token_index}] ${rule}
  token ${YELLOW}${replaceInvisibleChars(token.value)}${NC} doesn't match rule item ${YELLOW}${tree.rule_item}${NC}
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

var nodeStack = [];
var output = [];

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
    if(!node.named) {
      return
    }
    output.push(` ${node.named.type.value}(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    generateCode(node.named.stats)
    output.push(`}`)
    generateCode(node.named.elseif)
  },
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
if 1 {
  1
} elseif 1 {
  2
}
`
var a = []
for(var i=0; i<1; i++) {
  a.push(code)
}

var tree = parse(a.join(''));

// printTree(tree, '')
generateCode(tree)
console.log(output.join(''))
