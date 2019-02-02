
let warnings;
let stream;

function pushInference(node, inference) {
  if (!node.inference) {
    node.inference = [];
  }
  node.inference.push(inference);
}

const namespace = {};

const backend = {
  'math': (node, parent) => {
    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i], node);
    }
    for (let i = 0; i < node.inference.length; i++) {
      if (node.inference[i] !== 'number') {
        pushWarning(node, `Cannot do a math operation with ${node.inference[i]}`);
      }
    }
    pushInference(parent, 'number');
  },
  'number': (node, parent) => {
    pushInference(parent, 'number');
  },
  'name': (node, parent) => {
    // todo integrate boolean in the language
    if(node.value === 'true' || node.value === 'false') {
      pushInference(parent, 'boolean');
      return;
    }
    if (namespace[node.value]) {
      pushInference(parent, namespace[node.value].type);
    }
  },
  'func_def_params': (node, parent) => {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], node);
      }
    }
    if(node.named.annotation) {
      namespace[node.named.name.value] = {
        type: node.named.annotation.named.name.value
      }
    }
  },
  'operation': (node, parent) => {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], node);
      }
    }
    if(!node.inference) {
      return;
    }
    if (node.named.math_op && node.inference) {
      if (node.inference[0] !== 'number') {
        pushWarning(node, `Math operation ${node.named.math_op.value} with ${node.inference[0]}`);
      }
      if(parent.inference && parent.inference[0] !== 'number') {
        pushWarning(node, `Math operation ${node.named.math_op.value} with ${parent.inference[0]}`);
      }
      pushInference(parent, 'number');
    } else {
      pushInference(parent, 'boolean');
    }
  },
  'str': (node, parent) => {
    pushInference(parent, 'string');
  },
  'func_call': (node, parent) => {

  },
  'func_def': (node, parent) => {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], node);
      }
    }
    if(node.named.named && node.named.annotation) {
      namespace[node.named.name.value] = {
        type: node.named.annotation.named.name.value
      }
    }
  },
  'assign': (node, parent) => {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], node);
      }
    }
    let name;
    if (node.named.name && node.inference) {
      name = node.named.name.value;
      namespace[name] = { type: node.inference[0] };
    } else {
      // name = node.named.path.children[0].value;
    }
  },
};

function visit(node, parent) {
  if (backend[node.type]) {
    backend[node.type](node, parent);
  } else if (backend[node.rule_name]) {
    backend[node.rule_name](node, parent);
  } else {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], node);
      }
    }
    if (node.inference && parent) {
      pushInference(parent, node.inference[0]);
    }
  }
}

function pushWarning(node, message) {
  const error = new Error(message);
  const token = stream[node.stream_index];
  error.token = token;
  warnings.push(error);
}

function inference(node, _stream) {
  warnings = [];
  stream = _stream;
  visit(node);
  return warnings;
}

module.exports = {
  check: visit,
  inference
};
