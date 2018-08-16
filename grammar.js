
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

module.exports = {
  grammar
}
