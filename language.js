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
  'operator': {reg: /^\+|\-/},
  'name': {reg: /^\w+/},
  '.': {str: '.'},      
  '(': {str: '('},
  ')': {str: ')'},
  'str': {func:strDef}
};

var rules = {
    'START': [['exp']],
    'DOTTED_PATH': [['name', '.', 'name'], ['name']],
    'math': [
        ['(', 'math', ')', 'operator', 'math'], 
        ['(', 'math', ')'],
        ['number' , 'operator', 'math'],
        ['number']
    ],
    'exp': [
      ['DOTTED_PATH', 'operator', 'exp'],
      ['DOTTED_PATH'],
      ['math', 'operator', 'exp'],
      ['str', 'operator', 'exp'],
      ['math'],
      ['str']
    ]
};

function parse(input) {
  var stream = tokenizer.tokenize(tokens, input);
  return  parser.parse(rules, stream, true);
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

var start = parse('hello.boum+1');

printTree(start, ' ');

