
var grammar = {
    'START': [
      ['STATEMENTS*', 'EOS'],
      ['STATEMENT', 'STATEMENTS*', 'EOS']
    ],
    'STATEMENTS': [
      ['newline', 'w?', 'W?', 'STATEMENT', 'wcomment?'],
      ['newline', 'w?', 'W?', 'scomment?']
    ],
    'wcomment': [
      ['w', 'comment'],
      ['w', 'multiline_comment']
    ],
    'scomment': [
      ['comment'],
      ['multiline_comment']
    ],
    'STATEMENT': [
      ['condition'],
      ['assign'], // because as soon as a rule is satisfied
                  // the parser return happily and destroy the stack
                  // the more specific rules need to come first
      ['virtual_node'],
      ['exp'],
      ['object_destructuring'],
      ['for_loop'],
      ['while_loop'],
      ['import_statement'],
      ['return', 'exp']
    ],
    'DOTTED_PATH': [
      ['name', 'func_call'],
      ['name', '[', 'exp', ']'],
      ['name', '.', 'DOTTED_PATH*'],
      ['name']
    ],
    'math': [
        ['(', 'math', ')', 'w', 'operator', 'w', 'exp'],
        ['(', 'math', ')'],
        ['number' , 'w', 'operator', 'w', 'exp'],
        ['number']
    ],
    'assign': [
      ['name:name', 'w', 'explicit_assign:explicit_assign', 'w', 'exp:exp'],
      ['name:name', 'w', '=', 'w', 'exp:exp'],
      ['DOTTED_PATH:path', 'w', '=', 'w', 'exp:exp'],
    ],
    'for_loop': [
      ['for', 'name:value', 'w', 'in', 'exp:exp', 'w', '{', 'STATEMENTS*:stats', '}'],
      ['for', 'name:key', ',', 'w', 'name:value', 'w', 'in', 'exp:exp', 'w', '{', 'STATEMENTS*:stats', '}'],
    ],
    'func_def': [
      ['def', 'name?:name', '(', ')', 'annotation?', 'w', 'func_body:body'],
      ['def', 'name?:name', '(', 'func_def_params:params', ')', 'annotation?', 'w', 'func_body:body'],
      ['(', 'func_def_params:params', ')', 'annotation?', 'w', '=>:fat-arrow', 'w', 'func_body:body'],
      ['(', ')', 'annotation?', 'w', '=>:fat-arrow', 'w', 'func_body:body'],
    ],
    'annotation': [
      ['colon', 'w' ,'name'],
    ],
    'func_def_params': [
      ['name', '=', 'exp', 'annotation?', ',', 'w', 'func_def_params'],
      ['name', '=', 'exp', 'annotation?'],
      ['exp', 'annotation?', ',', 'w', 'func_def_params'],
      ['exp', 'annotation?']
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
      ['{', 'STATEMENTS*:stats', '}']
    ],
    'array_literal': [
      ['[', 'newline?', 'W?', 'array_literal_body', ']'],
      ['[', ']'],
    ],
    'array_literal_body': [
      ['exp', ',', 'w', 'newline?', 'W?', 'array_literal_body'],
      ['exp'],
    ],
    'condition': [
      ['if:type', 'exp:exp', 'w', '{', 'STATEMENTS*:stats', '}', 'conditionelseif:elseif'],
    ],
    'conditionelseif': [
      ['w', 'elseif:type', 'exp:exp', 'w', '{', 'STATEMENTS*:stats', '}', 'conditionelseif:elseif'],
      ['w', 'elseif:type', 'exp:exp', 'w', '{', 'STATEMENTS*:stats', '}'],
      ['w', 'else:type', '{', 'STATEMENTS*:stats', '}'],
      ['w?']
    ],
    'while_loop': [
      ['while', 'exp:exp', 'w', '{', 'STATEMENTS*:stats', '}'],
    ],
    'object_literal': [
      ['{', 'newline?', 'w?', 'W?', 'object_literal_body', '}']
    ],
    'object_literal_body': [
      ['object_literal_key', 'colon', 'w', 'exp', 'w?', 'W?', ',', 'newline?', 'w?', 'W?', 'object_literal_body'],
      ['object_literal_key', 'colon', 'w', 'exp', 'newline?', 'w?', 'W?']
    ],
    'object_destructuring': [
      ['{', 'w', 'destructuring_values', 'w', '}', 'w', '=', 'w', 'exp']
    ],
    'destructuring_values': [
      ['name', ',', 'w', 'destructuring_values'],
      ['name']
    ],
    'import_statement': [
      ['import', 'name:name', 'w', 'from', 'str:file'],
      ['import', '{', 'w', 'destructuring_values:dest_values', 'w', '}', 'w', 'from', 'str:file']
    ],
    'object_literal_key' : [['str'], ['name']],
    'virtual_node': [
      ['<', 'name:opening', 'virtual_node_attributes*:attrs', 'w?', '/>'],
      ['<', 'name:opening', 'virtual_node_attributes*:attrs','>', 'STATEMENTS*:stats', '</', 'name:closing', '>', 
        (node) => node.named.opening.value === node.named.closing.value], 
      ['<', 'name:opening', 'virtual_node_attributes*:attrs','>', 'exp:exp', '</', 'name:closing', '>', 
        (node) => node.named.opening.value === node.named.closing.value], 
    ],
    'virtual_node_exp': [
      ['<', 'name:opening', 'virtual_node_attributes*:attrs', 'w?', '/>'],
      ['<', 'name:opening', 'virtual_node_attributes*:attrs','>', 'STATEMENTS*:stats', '</', 'name:closing', '>', 
        (node) => node.named.opening.value === node.named.closing.value], 
      ['<', 'name:opening', 'virtual_node_attributes*:attrs','>', 'exp:exp', '</', 'name:closing', '>', 
        (node) => node.named.opening.value === node.named.closing.value], 
    ],
    'virtual_node_assign': [
      ['=', 'w', 'exp:exp']
    ],
    'virtual_node_attributes': [
      ['newline', 'W', 'name:name', '=', 'exp:exp'],
      ['w', 'name:name', '=', 'exp:exp']
    ],
    'operation': [
      ['operator', 'w','exp'],
      ['==', 'w','exp'],
      ['=>', 'w','exp'],
      ['<=', 'w','exp'],
      ['!=', 'w','exp'],
      ['>', 'w','exp'],
      ['<', 'w','exp'],
    ],
    'str_expression': [
      ['str:str', 'inner_str_expression:str_exp'],
    ],
    'inner_str_expression': [
      ['exp:exp', 'str:str', 'inner_str_expression:str_exp'],
      ['exp:exp', 'str:str'],
    ],
    'exp': [
      ['func_def'],
      ['DOTTED_PATH', 'w', 'operation'],
      ['DOTTED_PATH'],
      ['math', 'w', 'operation'],
      ['math'],
      ['str_expression', 'w', 'operation'],
      ['str_expression'],
      ['str', 'w', 'operation'],
      ['str'],
      ['(', 'exp', ')', 'func_call'],
      ['(', 'exp', ')', '.', 'DOTTED_PATH'],
      ['(', 'exp', ')'],
      ['object_literal'],
      ['array_literal', '.', 'name', 'func_call'],
      ['array_literal'],
      ['await', 'exp'],
      ['async', 'exp'],
      ['virtual_node_assign'],
      ['virtual_node_exp'],
      ['new', 'exp'],
      ['throw', 'exp'],
      ['delete', 'exp']
    ]
};

module.exports = {
  grammar
}
