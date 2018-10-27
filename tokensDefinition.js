
function strDef(input) {
  var first, i, ch;
  first = input.charAt(0);
  if(first === '"' || first === "'" || first === "`") {
    i = 1;
    while(input.charAt(i)) {
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

var tokensDefinition = {
  'number': {reg: /^[0-9]+(\.[0-9]*)?/},
  'comment': {reg: /^\/\/[^\n]*/, verbose: 'comment'},
  'multiline_comment': {reg: /^\/\*+[^*]*\*+(?:[^\/*][^*]*\*+)*\//, verbose: 'comment'},
  'operator': {reg: /^(\+|\-|\*|\|\|?|\&\&?)/},
  'def': {str: 'def '},
  'new': {str: 'new '},
  'delete': {str: 'delete '},
  'if': {str: 'if '},
  'while': {str: 'while '},
  'else': {str: 'else '},
  'for': {str: 'for '},
  'in': {str: 'in '},
  'await': {str: 'await '},
  'async': {str: 'async '},
  'elseif': {str: 'elseif '},
  'return': {str: 'return ', verbose:'return'},
  'throw': {str: 'throw ', verbose:'throw'},
  'import': {str: 'import '},
  'from': {str: 'from '},
  'name': {reg: /^[\w]+/},
  ',': {str: ','},
  '.': {str: '.'},
  '(': {str: '('},
  ')': {str: ')'},
  '{': {str: '{'},
  '}': {str: '}'},
  '</': {str: '</'},
  '/>': {str: '/>'},
  '[': {str: '['},
  ']': {str: ']'},
  '=>': {str: '=>'},
  '<=': {str: '<='},
  '==': {str: '=='},
  '!=': {str: '!='},
  '>': {str: '>'},
  '<': {str: '<'},
  'explicit_assign': {str: ':=', verbose: 'explicit assign'},
  '=': {str: '='},
  'colon': {str: ':'},
  'newline': {str: '\n'},
  'str': {func:strDef, verbose: 'string'},
  'w': {func:singleSpace, verbose: 'single white space'},
  'W': {reg: /^[\s]+/, verbose: 'multiple white spaces'}
};

module.exports = {
  tokensDefinition
}
