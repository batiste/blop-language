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

var tokens = {
  'number': {reg: /^[0-9]+(\.[0-9]*)?/},
  'operator': {reg: /^[\+|\-]/},
  'def': {str: 'def '},
  'name': {reg: /^\w+/},
  '.': {str: '.'},      
  '(': {str: '('},
  ')': {str: ')'},
  '=': {str: '='},
  'newline': {str: '\n'},
  'str': {func:strDef}
};

var rules = {
    'START': [['NEW_LINE']],
    'NEW_LINE': [
      ['STATEMENT', 'newline', 'NEW_LINE'],
      ['STATEMENT', 'EOS'],
      ['EOS']
    ],
    'STATEMENT': [
      ['assign'], // because as soon as a rule is satisfied 
                  // the parser return happily and destroy the stack
                  // the more specific rules need to come first
      ['exp'],
    ],
    'DOTTED_PATH': [['name', '.', 'name'], ['name']],
    'math': [
        ['(', 'math', ')', 'operator', 'math'], 
        ['(', 'math', ')'],
        ['number' , 'operator', 'math'],
        ['number']
    ],
    'assign': [
      ['DOTTED_PATH', '=', 'exp'],
    ],
    'func_def': [
      ['def', 'name', '(', ')', 'func_body'],
      ['def', '(', ')', 'func_body'],
    ],
    'func_body': [
      ['exp'],
    ],
    'exp': [
      ['func_def'],
      ['DOTTED_PATH', 'operator', 'exp'],
      ['DOTTED_PATH'],
      ['math', 'operator', 'exp'],
      ['str', 'operator', 'exp'],
      ['math'],
      ['str'],
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


function parse(input) {
  var stream = tokenizer.tokenize(tokens, input);
  return parser.parse(rules, stream, modifiers, true);
}

function printTree(node, sp) {
    if(node.rule_name) {
        console.log(sp + 'r ' + node.rule_name);
    } else {
        console.log(sp + 't ' + node.type + ' ' + node.value);
    }

    if(node.children) {
        for(var i=0; i<node.children.length; i++) {
            printTree(node.children[i], sp + '  ');
        }
    }
}

var start = parse('def test()1+1');
modify(start, null);

printTree(start, ' ');

