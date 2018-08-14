function START_0(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = STATEMENTS(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'EOS') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "START", subRule: 0, success: i === stream.length}
}

function START(stream, index) {
  return START_0(stream, index);
}
function STATEMENTS_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'newline') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  const _rule_0 = STATEMENT(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  const _rule_1 = STATEMENTS(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENTS", subRule: 0, success: i === stream.length}
}

function STATEMENTS_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'newline') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  const _rule_0 = STATEMENT(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENTS", subRule: 1, success: i === stream.length}
}

function STATEMENTS_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'newline') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  const _rule_0 = STATEMENTS(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENTS", subRule: 2, success: i === stream.length}
}

function STATEMENTS_3(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'newline') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  return {children, stream_index: index, last_index: i, name: "STATEMENTS", subRule: 3, success: i === stream.length}
}

function STATEMENTS(stream, index) {
  return STATEMENTS_0(stream, index) || STATEMENTS_1(stream, index) || STATEMENTS_2(stream, index) || STATEMENTS_3(stream, index);
}
function STATEMENT_0(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = condition(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENT", subRule: 0, success: i === stream.length}
}

function STATEMENT_1(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = assign(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENT", subRule: 1, success: i === stream.length}
}

function STATEMENT_2(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENT", subRule: 2, success: i === stream.length}
}

function STATEMENT_3(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'return') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "STATEMENT", subRule: 3, success: i === stream.length}
}

function STATEMENT(stream, index) {
  return STATEMENT_0(stream, index) || STATEMENT_1(stream, index) || STATEMENT_2(stream, index) || STATEMENT_3(stream, index);
}
function DOTTED_PATH_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'name') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_call(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "DOTTED_PATH", subRule: 0, success: i === stream.length}
}

function DOTTED_PATH_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'name') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '.') return;
  children.push(stream[i]); i++;
  const _rule_0 = DOTTED_PATH(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "DOTTED_PATH", subRule: 1, success: i === stream.length}
}

function DOTTED_PATH_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'name') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "DOTTED_PATH", subRule: 2, success: i === stream.length}
}

function DOTTED_PATH(stream, index) {
  return DOTTED_PATH_0(stream, index) || DOTTED_PATH_1(stream, index) || DOTTED_PATH_2(stream, index);
}
function math_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = math(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'operator') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = math(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "math", subRule: 0, success: i === stream.length}
}

function math_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = math(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "math", subRule: 1, success: i === stream.length}
}

function math_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'number') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'operator') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = math(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "math", subRule: 2, success: i === stream.length}
}

function math_3(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'number') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "math", subRule: 3, success: i === stream.length}
}

function math(stream, index) {
  return math_0(stream, index) || math_1(stream, index) || math_2(stream, index) || math_3(stream, index);
}
function assign_0(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = DOTTED_PATH(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '=') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = exp(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "assign", subRule: 0, success: i === stream.length}
}

function assign(stream, index) {
  return assign_0(stream, index);
}
function func_def_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'def') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'name') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_body(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "func_def", subRule: 0, success: i === stream.length}
}

function func_def_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'def') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'name') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_def_params(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_body(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_def", subRule: 1, success: i === stream.length}
}

function func_def_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_def_params(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '=>') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_body(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_def", subRule: 2, success: i === stream.length}
}

function func_def(stream, index) {
  return func_def_0(stream, index) || func_def_1(stream, index) || func_def_2(stream, index);
}
function func_def_params_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'name') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '=') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ',') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_def_params(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_def_params", subRule: 0, success: i === stream.length}
}

function func_def_params_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'name') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '=') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_def_params", subRule: 1, success: i === stream.length}
}

function func_def_params_2(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ',') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_def_params(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_def_params", subRule: 2, success: i === stream.length}
}

function func_def_params_3(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_def_params", subRule: 3, success: i === stream.length}
}

function func_def_params(stream, index) {
  return func_def_params_0(stream, index) || func_def_params_1(stream, index) || func_def_params_2(stream, index) || func_def_params_3(stream, index);
}
function func_call_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '.') return;
  children.push(stream[i]); i++;
  const _rule_0 = DOTTED_PATH(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call", subRule: 0, success: i === stream.length}
}

function func_call_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_call_params(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '.') return;
  children.push(stream[i]); i++;
  const _rule_1 = DOTTED_PATH(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call", subRule: 1, success: i === stream.length}
}

function func_call_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_call(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call", subRule: 2, success: i === stream.length}
}

function func_call_3(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_call_params(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_call(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call", subRule: 3, success: i === stream.length}
}

function func_call_4(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "func_call", subRule: 4, success: i === stream.length}
}

function func_call_5(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = func_call_params(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "func_call", subRule: 5, success: i === stream.length}
}

function func_call(stream, index) {
  return func_call_0(stream, index) || func_call_1(stream, index) || func_call_2(stream, index) || func_call_3(stream, index) || func_call_4(stream, index) || func_call_5(stream, index);
}
function func_call_params_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'name') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '=') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call_params", subRule: 0, success: i === stream.length}
}

function func_call_params_1(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ',') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_call_params(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call_params", subRule: 1, success: i === stream.length}
}

function func_call_params_2(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_call_params", subRule: 2, success: i === stream.length}
}

function func_call_params(stream, index) {
  return func_call_params_0(stream, index) || func_call_params_1(stream, index) || func_call_params_2(stream, index);
}
function func_body_0(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "func_body", subRule: 0, success: i === stream.length}
}

function func_body_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '{') return;
  children.push(stream[i]); i++;
  const _rule_0 = STATEMENTS(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== '}') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "func_body", subRule: 1, success: i === stream.length}
}

function func_body(stream, index) {
  return func_body_0(stream, index) || func_body_1(stream, index);
}
function condition_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'if') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '{') return;
  children.push(stream[i]); i++;
  const _rule_1 = STATEMENTS(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  if(stream[i].type !== '}') return;
  children.push(stream[i]); i++;
  const _rule_2 = conditionelseif(stream, i);
  if(!_rule_2) return;
  children.push(_rule_2);
  i = _rule_2.last_index;
  return {children, stream_index: index, last_index: i, name: "condition", subRule: 0, success: i === stream.length}
}

function condition(stream, index) {
  return condition_0(stream, index);
}
function conditionelseif_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'elseif') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '{') return;
  children.push(stream[i]); i++;
  const _rule_1 = STATEMENTS(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  if(stream[i].type !== '}') return;
  children.push(stream[i]); i++;
  const _rule_2 = conditionelseif(stream, i);
  if(!_rule_2) return;
  children.push(_rule_2);
  i = _rule_2.last_index;
  return {children, stream_index: index, last_index: i, name: "conditionelseif", subRule: 0, success: i === stream.length}
}

function conditionelseif_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'elseif') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '{') return;
  children.push(stream[i]); i++;
  const _rule_1 = STATEMENTS(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  if(stream[i].type !== '}') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "conditionelseif", subRule: 1, success: i === stream.length}
}

function conditionelseif_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'else') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '{') return;
  children.push(stream[i]); i++;
  const _rule_0 = STATEMENTS(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== '}') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "conditionelseif", subRule: 2, success: i === stream.length}
}

function conditionelseif_3(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  return {children, stream_index: index, last_index: i, name: "conditionelseif", subRule: 3, success: i === stream.length}
}

function conditionelseif(stream, index) {
  return conditionelseif_0(stream, index) || conditionelseif_1(stream, index) || conditionelseif_2(stream, index) || conditionelseif_3(stream, index);
}
function object_literal_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '{') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'newline') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  const _rule_0 = object_literal_body(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== '}') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "object_literal", subRule: 0, success: i === stream.length}
}

function object_literal(stream, index) {
  return object_literal_0(stream, index);
}
function object_literal_body_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'str') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'colon') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type !== ',') return;
  children.push(stream[i]); i++;
  if(stream[i].type == 'newline') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  const _rule_1 = object_literal_body(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "object_literal_body", subRule: 0, success: i === stream.length}
}

function object_literal_body_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'str') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'colon') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type == 'newline') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'w') {
    children.push(stream[i]); i++;
  }
  if(stream[i].type == 'W') {
    children.push(stream[i]); i++;
  }
  return {children, stream_index: index, last_index: i, name: "object_literal_body", subRule: 1, success: i === stream.length}
}

function object_literal_body(stream, index) {
  return object_literal_body_0(stream, index) || object_literal_body_1(stream, index);
}
function operation_0(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'operator') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "operation", subRule: 0, success: i === stream.length}
}

function operation_1(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '==') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "operation", subRule: 1, success: i === stream.length}
}

function operation_2(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '=>') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "operation", subRule: 2, success: i === stream.length}
}

function operation_3(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '<=') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "operation", subRule: 3, success: i === stream.length}
}

function operation_4(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '>') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "operation", subRule: 4, success: i === stream.length}
}

function operation_5(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '<') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "operation", subRule: 5, success: i === stream.length}
}

function operation(stream, index) {
  return operation_0(stream, index) || operation_1(stream, index) || operation_2(stream, index) || operation_3(stream, index) || operation_4(stream, index) || operation_5(stream, index);
}
function exp_0(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = func_def(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 0, success: i === stream.length}
}

function exp_1(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = DOTTED_PATH(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = operation(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 1, success: i === stream.length}
}

function exp_2(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = DOTTED_PATH(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 2, success: i === stream.length}
}

function exp_3(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = math(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_1 = operation(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 3, success: i === stream.length}
}

function exp_4(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = math(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 4, success: i === stream.length}
}

function exp_5(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'str') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== 'w') return;
  children.push(stream[i]); i++;
  const _rule_0 = operation(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 5, success: i === stream.length}
}

function exp_6(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'str') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 6, success: i === stream.length}
}

function exp_7(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  const _rule_1 = func_call(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 7, success: i === stream.length}
}

function exp_8(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  if(stream[i].type !== '.') return;
  children.push(stream[i]); i++;
  const _rule_1 = DOTTED_PATH(stream, i);
  if(!_rule_1) return;
  children.push(_rule_1);
  i = _rule_1.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 8, success: i === stream.length}
}

function exp_9(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== '(') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== ')') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 9, success: i === stream.length}
}

function exp_10(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = object_literal(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 10, success: i === stream.length}
}

function exp_11(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'new') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 11, success: i === stream.length}
}

function exp_12(stream, index) {
  let i = index;
  let children = [];
  if(stream[i].type !== 'throw') return;
  children.push(stream[i]); i++;
  const _rule_0 = exp(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  return {children, stream_index: index, last_index: i, name: "exp", subRule: 12, success: i === stream.length}
}

function exp(stream, index) {
  return exp_0(stream, index) || exp_1(stream, index) || exp_2(stream, index) || exp_3(stream, index) || exp_4(stream, index) || exp_5(stream, index) || exp_6(stream, index) || exp_7(stream, index) || exp_8(stream, index) || exp_9(stream, index) || exp_10(stream, index) || exp_11(stream, index) || exp_12(stream, index);
}
module.exports = {parse: START}