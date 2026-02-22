

const grammar = {
  'START': [
    ['GLOBAL_STATEMENT', 'GLOBAL_STATEMENTS*', 'EOS'],
    ['GLOBAL_STATEMENTS*', 'EOS'],
    ['scomment', 'GLOBAL_STATEMENTS*', 'EOS'],
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
    ['assign_op'],
    ['virtual_node'],
    ['class_def'],
    ['try_catch'],
    ['for_loop'],
    ['while_loop'],
    ['import_statement'],
    ['type_alias'],
    ['exp_statement'],
    ['throw', 'exp'],
  ],
  'exp_statement': [
    ['exp'],
  ],
  'SCOPED_STATEMENT': [
    ['condition'],
    ['assign'],
    ['assign_op'],
    ['virtual_node'],
    ['class_def'],
    ['try_catch'],
    ['for_loop'],
    ['while_loop'],
    ['return', 'exp?'],
    ['throw', 'exp'],
    ['exp_statement'],
    ['break'],
    ['continue'],
  ],
  'assign': [
    ['name:name', 'annotation?:annotation', 'w', 'explicit_assign:explicit_assign', 'w', 'exp:exp'],
    ['name:name', 'annotation?:annotation', 'w', '=', 'w', 'exp:exp'],
    ['object_destructuring:destructuring', 'w', '=', 'w', 'exp:exp'],
    ['name:path', 'object_access:access', 'w', '=', 'w', 'exp:exp'],
  ],
  'assign_op': [
    ['name:name', 'annotation?:annotation', 'w', 'assign_operator', 'w', 'exp:exp'],
    ['name:name', 'object_access:access', 'w', 'assign_operator', 'w', 'exp:exp'],
  ],
  'for_loop': [
    ['for', 'name:value', 'w', 'in:in', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['for', 'name:value', 'w', 'of:of', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    // ['for', 'name:value', 'w', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['for', 'name:key', 'annotation?:keyannotation', ',', 'w', 'name:value', 'w', 'in', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
    ['for', 'name:key', 'annotation?:keyannotation', ',', 'w', 'name:value', 'w', 'of:of', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}'],
  ],
  'func_def': [
    ['async?:async', 'def', 'name?:name', 'generic_params?:generic_params', '(', ')', 'annotation?:annotation', 'w', 'func_body:body'],
    ['async?:async', 'def', 'name?:name', 'generic_params?:generic_params', '(', 'func_def_params:params', ')', 'annotation?:annotation', 'w', 'func_body:body'],
    ['async?:async', '(', 'func_def_params:params', ')', 'annotation?:annotation', 'w', '=>:fat-arrow', 'w', 'func_body_fat:body'],
    ['async?:async', '(', ')', 'annotation?:annotation', 'w', '=>:fat-arrow', 'w', 'func_body_fat:body'],
  ],
  'generic_params': [
    ['<', 'generic_param_list:params', '>'],
  ],
  'generic_param_list': [
    ['name:param', ',', 'w', 'generic_param_list:rest'],
    ['name:param'],
  ],
  'type_arguments': [
    ['<', 'type_argument_list:args', '>'],
  ],
  'type_argument_list': [
    ['type_expression:arg', ',', 'w', 'type_argument_list:rest'],
    ['type_expression:arg'],
  ],
  'annotation': [
    ['colon', 'w', 'type_expression:type'],
  ],
  'type_expression': [
    ['type_primary', 'w', 'pipe', 'w', 'type_expression:union'],
    ['type_primary', 'w', 'ampersand', 'w', 'type_expression:intersection'],
    ['type_primary'],
  ],
  'type_primary': [
    ['(', 'func_type_params:params', ')', 'w', '=>', 'w', 'type_expression:return'],
    ['(', ')', 'w', '=>', 'w', 'type_expression:return'],
    ['object_type', 'array_suffix?'],
    ['str:literal', 'array_suffix?'],
    ['number:literal', 'array_suffix?'],
    ['type_name:name', '<', 'type_arg_list:type_args', '>', 'array_suffix?'],
    ['type_name:name', '<', 'type_arg_list:type_args', '>'],
    ['type_name:name', 'array_suffix?'],
  ],
  'func_type_params': [
    ['name:name', 'colon', 'w', 'type_expression:type', ',', 'w', 'func_type_params:rest'],
    ['name:name', 'colon', 'w', 'type_expression:type'],
  ],
  'array_suffix': [
    ['[', ']', 'array_suffix?'],
  ],
  'type_arg_list': [
    ['type_expression:arg', ',', 'w', 'type_arg_list:rest'],
    ['type_expression:arg'],
  ],
  'object_type': [
    ['{', 'wcomment', 'newline', 'w?', 'W?', 'object_type_properties:properties', 'single_space_or_newline', '}'],
    ['{', 'single_space_or_newline', 'object_type_properties:properties', 'single_space_or_newline', '}'],
    ['{', '}'],
  ],
  'object_type_properties': [
    ['object_type_property', ',', 'wcomment?', 'single_space_or_newline', 'object_type_properties'],
    ['object_type_property', 'wcomment?'],
  ],
  'object_type_property': [
    ['name:key', 'w?', 'question:optional', 'colon', 'w?', 'type_expression:valueType'],
    ['name:key', 'w?', 'colon', 'w?', 'type_expression:valueType'],
  ],
  'type_name': [
    ['name'],
    ['null'],
    ['undefined'],
    ['true'],
    ['false'],
  ],
  'func_def_params': [
    ['object_destructuring:destructuring', 'annotation?:annotation', ',', 'w', 'func_def_params'],
    ['object_destructuring:destructuring', 'annotation?:annotation'],
    ['name:name', 'annotation?:annotation', '=', 'exp', ',', 'w', 'func_def_params'],
    ['name:name', 'annotation?:annotation', '=', 'exp'],
    ['name:name', 'annotation?:annotation', ',', 'w', 'func_def_params'],
    ['name:name', 'annotation?:annotation'],
  ],
  'func_call': [
    ['(', 'newline_and_space?', 'func_call_params', ')'],
    ['(', ')'],
  ],
  'func_call_params': [
    ['name', '=', 'exp'],
    ['exp', ',', 'single_space_or_newline', 'func_call_params'],
    ['exp'],
  ],
  'func_body_fat': [
    ['{', 'wcomment?', 'SCOPED_STATEMENTS*:stats', '}'],
    ['exp:exp'],
  ],
  'func_body': [
    ['{', 'wcomment?', 'SCOPED_STATEMENTS*:stats', '}'],
  ],
  'class_def': [
    ['clazz', 'name:name', 'w', 'extends', 'name:extends', 'w', '{', 'CLASS_STATEMENT*:stats', '}'],
    ['clazz', 'name:name', 'w', '{', 'CLASS_STATEMENT*:stats', '}'],
  ],
  'class_func_def': [
    ['async?:async', 'def', 'name?:name', 'generic_params?:generic_params', '(', ')', 'annotation?:annotation', 'w', 'func_body:body'],
    ['async?:async', 'def', 'name?:name', 'generic_params?:generic_params', '(', 'func_def_params:params', ')', 'annotation?:annotation', 'w', 'func_body:body'],
  ],
  'class_member_def': [
    ['name:name', 'annotation:annotation'],
  ],
  'CLASS_STATEMENT': [
    ['newline', 'w?', 'W?', 'class_func_def', 'wcomment?'],
    ['newline', 'w?', 'W?', 'class_member_def', 'wcomment?'],
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
    ['if:type', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}', 'else_if?:elseif'],
  ],
  'else_if': [
    ['w', 'elseif:type', 'exp:exp', 'w', '{', 'SCOPED_STATEMENTS*:stats', '}', 'else_if:elseif'],
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
    ['spread:spread', 'exp:spread_exp', ',', 'single_space_or_newline', 'object_literal_body'],
    ['spread:spread', 'exp:spread_exp'],
    ['object_literal_key', 'colon', 'w', 'exp', ',', 'single_space_or_newline', 'object_literal_body'],
    ['object_literal_key:key', ',', 'single_space_or_newline', 'object_literal_body'],
    ['object_literal_key', 'colon', 'w', 'exp'],
    ['object_literal_key:key'],
  ],
  'object_destructuring': [
    ['{', 'w', 'destructuring_values:values', 'single_space_or_newline', '}'],
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
  'type_alias': [
    ['type', 'name:name', 'generic_params?:generic_params', 'w', '=', 'w', 'type_expression:type'],
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
    ['single_space_or_newline', 'attribute_name:name', '=', 'exp:exp'],
    ['single_space_or_newline', 'attribute_name:name'],
    ['single_space_or_newline', 'name:name', '=', 'exp:exp'],
    ['single_space_or_newline', 'name:name'],
  ],
  'str_expression': [
    ['str:str', 'inner_str_expression:str_exp'],
    ['name:name', 'str:str', 'inner_str_expression?:str_exp'],
  ],
  'inner_str_expression': [
    ['exp:exp', 'str:str', 'inner_str_expression:str_exp'],
    ['exp:exp', 'str:str'],
    ['exp:exp'],
  ],
  'try_catch': [
    ['try:try', '{', 'SCOPED_STATEMENTS*:statstry', '}',
      'w', 'catch:catch', 'name:name', 'w', '{', 'SCOPED_STATEMENTS*:statscatch', '}'],
  ],
  'object_access': [
    ['optional_chain:optional', 'name:name', 'object_access?'],
    ['.', 'name', 'object_access?'],
    ['optional_chain:optional', '[', 'exp', ']', 'object_access?'],
    ['type_arguments:type_args', 'func_call', 'object_access?'],
    ['func_call', 'object_access?'],
    ['[', 'exp', ']', 'object_access?'],
  ],
  'operation': [
    ['nullish:nullish_op', 'w', 'exp'],
    ['math_operator:math_op', 'w', 'exp'],
    ['boolean_operator:boolean_op', 'w', 'exp'],
    ['<:boolean_op', 'w', 'exp'],
    ['>:boolean_op', 'w', 'exp'],
  ],
  'access_or_operation': [
    ['object_access:access', 'w', 'operation:op'],
    ['object_access:access'],
    ['w', 'operation:op'],
  ],
  // used in backend
  'name_exp': [
    ['name:name', 'access_or_operation:access'],
    ['name:name'],
  ],
  // 'optional_chaining': [
  //   ['name:name', '.', 'optional_chaining'],
  //   ['name:name', 'question', 'object_access'],
  // ],
  'short_if_expression': [
    ['if:type', 'exp:exp1', 'w', '=>', 'w', 'exp:exp2', 'w', 'else:else', 'exp:exp3'],
    ['if:type', 'exp:exp1', 'w', '=>', 'w', 'exp:exp2'],
  ],
  'new_expression': [
    ['new', 'exp:exp'],
  ],
  'exp': [
    // ['optional_chaining'],
    ['str_expression'],
    ['name_exp'],
    ['exp', 'access_or_operation'],
    ['func_def'],
    ['number'],
    ['null'],
    ['undefined'],
    ['true'],
    ['false'],
    ['str'],
    ['regexp'],
    ['(', 'exp', ')'],
    ['operand', 'exp'],
    ['unary', 'exp'],
    ['object_literal'],
    ['array_literal'],
    ['await', 'exp'],
    ['virtual_node_assign'],
    ['virtual_node_exp'],
    ['new_expression'],
    ['delete', 'exp'],
    ['spread', 'exp'],
    ['short_if_expression'],
  ],
};

export {
  grammar,
};
