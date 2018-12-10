
function strDef(input) {
  let i; let ch;
  const first = input.charAt(0);
  if (first === '"' || first === "'" || first === '`') {
    i = 1;
    while (input.charAt(i)) {
      ch = input.charAt(i);
      if (ch === '\\') {
        i++;
      } else if (ch === first) {
        return input.slice(0, i + 1);
      }
      i++;
    }
  }
}

function regExpDef(input) {
  if (input.charAt(0) === '/') {
    let i = 1;
    while (input.charAt(i)) {
      const ch = input.charAt(i);
      if (ch === '\n') {
        return;
      }
      if (ch === '\\') {
        i++;
      } else if (ch === '/') {
        i++;
        // modifiers
        while (input.charAt(i) && 'igm'.indexOf(input.charAt(i)) !== -1) {
          i++;
        }
        return input.slice(0, i);
      }
      i++;
    }
  }
}

function singleSpace(input) {
  if (input[0] === ' ' && input[1] !== ' ') {
    return ' ';
  }
}

function returnDef(input) {
  if (input.startsWith('return')) {
    if(input[6] === ' ') {
      return 'return ';
    }
    if(input[6] === '\n') {
      return 'return'
    }
  }
}

const tokensDefinition = {
  'number': { reg: /^[0-9]+(\.[0-9]*)?/ },
  'comment': { reg: /^\/\/[^\n]*/, verbose: 'comment' },
  'multiline_comment': { reg: /^\/\*+[^*]*\*+(?:[^/*][^*]*\*+)*\//, verbose: 'comment' },
  'as': { str: 'as ' },
  'clazz': { str: 'class ' },
  'try': { str: 'try ' },
  'catch': { str: 'catch ' },
  'def': { str: 'def ' },
  'new': { str: 'new ' },
  'delete': { str: 'delete ' },
  'if': { str: 'if ' },
  'while': { str: 'while ' },
  'else': { str: 'else ' },
  'for': { str: 'for ' },
  'in': { str: 'in ' },
  'await': { str: 'await ' },
  'async': { str: 'async ' },
  'extends': { str: 'extends ' },
  'elseif': { str: 'elseif ' },
  'return': { func: returnDef, verbose: 'return' },
  'throw': { str: 'throw ', verbose: 'throw' },
  'import': { str: 'import ' },
  'from': { str: 'from ' },
  'operand': { reg: /^(typeof |instanceof )/ },
  'name': { reg: /^[\w]+/ },
  ',': { str: ',' },
  '.': { str: '.' },
  '(': { str: '(' },
  ')': { str: ')' },
  '{': { str: '{' },
  '}': { str: '}' },
  '</': { str: '</' },
  '/>': { str: '/>' },
  '[': { str: '[' },
  ']': { str: ']' },
  '>=': { str: '>=' },
  '=>': { str: '=>' },
  '<=': { str: '<=' },
  '==': { str: '==' },
  '!=': { str: '!=' },
  '>': { str: '>' },
  '<': { str: '<' },
  'regexp': { func: regExpDef }, // problematic with a / b / c
  'operator': { reg: /^(\+|\/|-|\*|\|\|?|&&?)/ },
  'unary': { str: '!' },
  'explicit_assign': { str: ':=', verbose: 'explicit assign' },
  '=': { str: '=' },
  'colon': { str: ':' },
  'newline': { str: '\n' },
  'str': { func: strDef, verbose: 'string' },
  'w': { func: singleSpace, verbose: 'single white space' },
  'W': { reg: /^[\s]+/, verbose: 'multiple white spaces' },
};

module.exports = {
  tokensDefinition,
};
