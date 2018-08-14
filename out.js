function start_0(stream, index) {
  let i = index;
  let children = [];
  const _rule_0 = math(stream, i);
  if(!_rule_0) return;
  children.push(_rule_0);
  i = _rule_0.last_index;
  if(stream[i].type !== 'EOS') return;
  children.push(stream[i]); i++;
  return {children, stream_index: index, last_index: i, name: "start", subRule: 0, success: i === stream.length}
}

function start(stream, index) {
  return start_0(stream, index);
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
module.exports = {parse: start}