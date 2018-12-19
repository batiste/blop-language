
const grammar = {
  'START': [
    ['GLOBAL_STATEMENT', 'GLOBAL_STATEMENTS*', 'EOS'],
    ['GLOBAL_STATEMENTS*', 'EOS'],
  ],
  'GLOBAL_STATEMENTS': [
    ['newline', 'GLOBAL_STATEMENT', 'wcomment?'],
    ['newline', 'scomment?'],
  ],
  'SCOPED_STATEMENTS': [
    ['newline', 'w?', 'W?', 'SCOPED_STATEMENT', 'wcomment?'],
    ['newline', 'w?', 'W?', 'scomment?'],
  ],
  'wcomment': [
    ['w', 'comment'],
    ['w', 'multiline_comment'],
  ],
  'scomment': [
    ['comment'],
    ['multiline_comment'],
  ],
  'GLOBAL_STATEMENT': [
    ['condition'],
    ['assign'],
    ['class_def'],
    ['object_destructuring'],
    ['try_catch'],
    ['for_loop'],
    ['while_loop'],
    ['import_statement'],
    ['exp_statement'],
  ],
  'exp_statement': [
    ['exp'],
  ],
  'SCOPED_STATEMENT': [
    ['condition'],
    ['assign'],
    ['virtual_node'],
    ['object_destructuring'],
    ['try_catch'],
    ['for_loop'],
    ['while_loop'],
    ['return', 'exp_statement?'],
    ['exp_statement'],
  ],
  'DOTTED_PATH': [
    ['name', '.', 'DOTTED_PATH*'],
    ['name', 'func_call'],
    ['name', '[', 'exp', ']'],
    ['name'],
  ],
  'math': [
    ['(', 'math', ')', 'w', 'operator', 'w', 'exp'],
    ['(', 'math', ')'],
    ['number', 'w', 'operator', 'w', 'exp'],
    ['number'],
  ],
  'assign': [
    ['name:name', 'w', 'explicit_assign:explicit_assign', 'w', 'exp:exp'],
    ['name:name', 'w', '=', 'w', 'exp:exp'],
    ['DOTTED_PATH:path', 'w', '=', 'w', 'exp:exp'],
  ],
  'for_loop': [
    ['for', 'name:value', 'w', 'in', 'exp:exp', 'annotation?:objectannotation', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['for', 'name:key', 'annotation?:keyannotation', ',', 'w', 'name:value', 'w', 'in', 'exp:exp', 'annotation?:objectannotation', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
  ],
  'func_def': [
    ['def', 'name?:name', '(', ')', 'annotation?:annotation', 'w', 'func_body:body'],
    ['def', 'name?:name', '(', 'func_def_params:params', ')', 'annotation?:annotation', 'w', 'func_body:body'],
    ['(', 'func_def_params:params', ')', 'annotation?:annotation', 'w', '=>:fat-arrow', 'w', 'func_body:body'],
    ['(', ')', 'annotation?:annotation', 'w', '=>:fat-arrow', 'w', 'func_body:body'],
  ],
  'annotation': [
    ['colon', 'w', 'name:name'],
  ],
  'func_def_params': [
    ['name:name', '=', 'exp', 'annotation?:annotation', ',', 'w', 'func_def_params'],
    ['name:name', '=', 'exp', 'annotation?:annotation'],
    ['name:name', 'annotation?:annotation', ',', 'w', 'func_def_params'],
    ['name:name', 'annotation?:annotation'],
  ],
  'func_call': [
    ['(', ')', '.', 'DOTTED_PATH'],
    ['(', 'newline_and_space?', 'func_call_params', ')', '.', 'DOTTED_PATH'],
    ['(', ')', 'func_call'],
    ['(', 'newline_and_space?', 'func_call_params', ')', 'func_call'],
    ['(', ')'],
    ['(', 'newline_and_space?', 'func_call_params', ')'],
  ],
  'func_call_params': [
    ['name', '=', 'exp'],
    ['exp', ',', 'single_space_or_newline', 'func_call_params'],
    ['exp'],
  ],
  'func_body': [
    ['{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['exp:exp'],
  ],
  'class_def': [
    ['clazz', 'name:name', 'w', 'extends', 'name:extends', 'w', '{', 'CLASS_STATEMENT*:stats', '}'],
    ['clazz', 'name:name', 'w', '{', 'CLASS_STATEMENT*:stats', '}'],
  ],
  'class_func_def': [
    ['def', 'name?:name', '(', ')', 'annotation?', 'w', 'func_body:body'],
    ['def', 'name?:name', '(', 'func_def_params:params', ')', 'annotation?', 'w', 'func_body:body'],
  ],
  'CLASS_STATEMENT': [
    ['newline', 'w?', 'W?', 'class_func_def', 'wcomment?'],
    ['newline', 'w?', 'W?', 'scomment?'],
  ],
  'array_literal': [
    ['[', 'newline?', 'W?', 'array_literal_body', 'newline?', 'W?', ']'],
    ['[', ']'],
  ],
  'array_literal_body': [
    ['exp', ',', 'single_space_or_newline', 'array_literal_body'],
    ['exp'],
  ],
  'condition': [
    ['if:type', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}', 'conditionelseif:elseif'],
  ],
  'conditionelseif': [
    ['w', 'elseif:type', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}', 'conditionelseif:elseif'],
    ['w', 'elseif:type', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['w', 'else:type', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['w?'],
  ],
  'while_loop': [
    ['while', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
  ],
  'object_literal': [
    ['{', 'single_space_or_newline', 'object_literal_body', 'single_space_or_newline', '}'],
    ['{', '}'],
  ],
  'single_space_or_newline': [
    ['w'],
    ['newline', 'w?', 'W?'],
  ],
  'newline_and_space': [['newline', 'w?', 'W?']],
  'object_literal_body': [
    ['object_literal_key', 'colon', 'w', 'exp', ',', 'single_space_or_newline', 'object_literal_body'],
    ['object_literal_key:key', ',', 'single_space_or_newline', 'object_literal_body'],
    ['object_literal_key', 'colon', 'w', 'exp'],
    ['object_literal_key:key'],
  ],
  'object_destructuring': [
    ['{', 'w', 'destructuring_values', 'single_space_or_newline', '}', 'w', '=', 'w', 'exp'],
  ],
  'destructuring_values': [
    ['name:name', ',', 'single_space_or_newline', 'destructuring_values:more'],
    ['name:name', 'w', 'as', 'name:rename', ',', 'single_space_or_newline', 'destructuring_values:more'],
    ['name:name', 'w', 'as', 'name:rename'],
    ['name:name'],
  ],
  'import_statement': [
    ['import', 'name:name', 'w', 'from', 'str:file'],
    ['import', '{', 'w', 'destructuring_values:dest_values', 'w', '}', 'w', 'from', 'str:file'],
    ['import', 'str:module', 'w', 'as', 'name:name'],
    ['import', 'str:file'],
  ],
  'object_literal_key': [['str'], ['name']],
  'virtual_node': [
    ['<', 'name:opening', 'virtual_node_attributes*:attrs', 'w?', '/>'],
    ['<', 'name:opening', 'virtual_node_attributes*:attrs', '>', 'SCOPED_STATEMENTS*:stats', '</', 'name:closing', '>',
      node => node.named.opening.value === node.named.closing.value],
    ['<', 'name:opening', 'virtual_node_attributes*:attrs', '>', 'exp:exp', '</', 'name:closing', '>',
      node => node.named.opening.value === node.named.closing.value],
  ],
  'virtual_node_exp': [
    ['<', 'name:opening', 'virtual_node_attributes*:attrs', 'w?', '/>'],
    ['<', 'name:opening', 'virtual_node_attributes*:attrs', '>', 'SCOPED_STATEMENTS*:stats', '</', 'name:closing', '>',
      node => node.named.opening.value === node.named.closing.value],
    ['<', 'name:opening', 'virtual_node_attributes*:attrs', '>', 'exp:exp', '</', 'name:closing', '>',
      node => node.named.opening.value === node.named.closing.value],
  ],
  'virtual_node_assign': [
    ['=', 'w', 'exp:exp'],
  ],
  'virtual_node_attributes': [
    ['newline', 'W', 'name:name', '=', 'exp:exp'],
    ['w', 'name:name', '=', 'exp:exp'],
    ['newline', 'W', 'name:name'],
    ['w', 'name:name'],
  ],
  'operation': [
    ['operator', 'w', 'exp'],
    ['==', 'w', 'exp'],
    ['>=', 'w', 'exp'],
    ['<=', 'w', 'exp'],
    ['!=', 'w', 'exp'],
    ['>', 'w', 'exp'],
    ['<', 'w', 'exp'],
  ],
  'str_expression': [
    ['str:str', 'inner_str_expression:str_exp'],
  ],
  'inner_str_expression': [
    ['exp:exp', 'str:str', 'inner_str_expression:str_exp'],
    ['exp:exp', 'str:str'],
  ],
  'try_catch': [
    ['try', '{', 'SCOPED_STATEMENTS*:statstry', '}',
      'w', 'catch', 'name:name', 'w', '{', 'SCOPED_STATEMENTS*:statscatch', '}'],
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
    ['regexp'],
    ['(', 'exp', ')', 'func_call'],
    ['(', 'exp', ')', '.', 'DOTTED_PATH'],
    ['(', 'exp', ')'],
    ['operand', 'exp'],
    ['unary', 'exp'],
    ['object_literal'],
    ['array_literal', '.', 'name', 'func_call'],
    ['array_literal'],
    ['await', 'exp'],
    ['async', 'exp'],
    ['virtual_node_assign'],
    ['virtual_node_exp'],
    ['new', 'exp'],
    ['throw', 'exp'],
    ['delete', 'exp'],
  ],
};

module.exports = {
  grammar,
};
