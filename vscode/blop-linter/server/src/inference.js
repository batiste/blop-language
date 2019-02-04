
let warnings;
let stream;

function pushInference(node, inference) {
  if (!node.inference) {
    node.inference = [];
  }
  node.inference.push(inference);
}

function checkStatment(node, parent) {
  visitChildren(node);
  if (node.inference) {
    const types = node.inference;
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      // if(!t) {
      //   throw new Error(`types ${types.length} ${i} ${node.inference}`)
      // }
      if (t && t.type === 'math_operator') {
        if (types[i - 1] && types[i - 1] !== 'number') {
          pushWarning(t, `Math operator not allowed on ${types[i - 1]}`);
        }
        if (types[i - 2] && types[i - 2] !== 'number') {
          pushWarning(t, `Math operator not allowed on ${types[i - 2]}`);
        }
        types.splice(i - 1, 2);
        i = i - 2;
      }
      if (t && t.type === 'boolean_operator') {
        types[i - 2] = 'boolean';
        types.splice(i - 1, 2);
        i = i - 2;
      }
      if (t && t.type === 'assign') {
        const { annotation } = t.named;
        if (annotation && types[i - 1] && annotation.named.name.value !== types[i - 1]) {
          pushWarning(t, `Cannot assign ${types[i - 1]} to ${annotation.named.name.value}`);
        }
        if (types[i - 1] && t.named.name) {
          namespace[t.named.name.value] = {
            type: types[i - 1],
            t,
          };
        }
        // it has to be a name (check grammar)
        if (t.named.name && !t.named.explicit_assign && types[i - 1] && types[i - 2]) {
          if (types[i - 1] !== types[i - 2]) {
            pushWarning(t, `Cannot assign ${types[i - 1]} to ${types[i - 2]}`);
          }
        }
      }
    }
  }
}

function pushToParent(node, parent) {
  if (!node.inference || !parent) {
    return;
  }
  for (let i = 0; i < node.inference.length; i++) {
    pushInference(parent, node.inference[i]);
  }
}

function visitChildren(node) {
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i], node);
    }
  }
}

const namespace = {};

const backend = {
  'math': (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'number');
  },
  'number': (node, parent) => {
    pushInference(parent, 'number');
  },
  'name': (node, parent) => {
    // todo integrate boolean in the language
    if (node.value === 'true' || node.value === 'false') {
      pushInference(parent, 'boolean');
      return;
    }
    if (namespace[node.value]) {
      pushInference(parent, namespace[node.value].type);
    }
  },
  'func_def_params': (node, parent) => {
    visitChildren(node);
    if (node.named.annotation) {
      namespace[node.named.name.value] = {
        type: node.named.annotation.named.name.value,
      };
    }
  },
  'operation': (node, parent) => {
    visitChildren(node);
    pushToParent(node, parent);
    if (node.named.math_op) {
      pushInference(parent, node.named.math_op);
    }
    if (node.named.boolean_op) {
      pushInference(parent, node.named.boolean_op);
    }
  },
  'str': (node, parent) => {
    pushInference(parent, 'string');
  },
  'func_call': (node, parent) => {
    visitChildren(node);
  },
  'object_literal': (node, parent) => {
    pushInference(parent, 'object');
  },
  'new': (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'object');
  },
  'virtual_node': (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'VNode');
  },
  'virtual_node_exp': (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'VNode');
  },
  'array_literal': (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'array');
  },
  'access_or_operation': (node, parent) => {
    visitChildren(node);
  },
  'named_func_call': (node, parent) => {
    visitChildren(node);
    const { name } = node.named;
    if (name && namespace[name.value]) {
      pushInference(parent, namespace[name.value].type);
    }
  },
  'func_def': (node, parent) => {
    visitChildren(node);
    if (node.named.name && node.named.annotation) {
      namespace[node.named.name.value] = {
        type: node.named.annotation.named.name.value,
        node,
      };
    }
  },
  'GLOBAL_STATEMENT': checkStatment,
  'SCOPED_STATEMENTS': checkStatment,
  'assign': (node, parent) => {
    visitChildren(node);
    pushToParent(node, parent);
    pushInference(parent, node);
    // annotation operation?
  },
};

function visit(node, parent) {
  if (backend[node.type]) {
    backend[node.type](node, parent);
  } else if (backend[node.rule_name]) {
    backend[node.rule_name](node, parent);
  } else {
    visitChildren(node);
    pushToParent(node, parent);
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
  inference,
};
