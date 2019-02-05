
let warnings;
let stream;

function pushInference(node, inference) {
  if (!node.inference) {
    node.inference = [];
  }
  node.inference.push(inference);
}

function checkStatment(node) {
  visitChildren(node);
  if (node.inference) {
    const types = node.inference;
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      // if(!t) {
      //   throw new Error(`types ${types.length} ${i} ${node.inference}`)
      // }
      if (t && t.type === 'math_operator' && types[i - 1] && types[i - 2]) {
        const t1 = types[i - 1];
        const t2 = types[i - 2];
        console.log(node.inference);
        if (t1 !== 'number' && t1 !== 'any') {
          pushWarning(t, `Math operator not allowed on ${t1}`);
        }
        if (t2 !== 'number' && t2 !== 'any') {
          pushWarning(t, `Math operator not allowed on ${t2}`);
        }
        types[i - 2] = 'number';
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
        const t1 = types[i - 1];
        const t2 = types[i - 2];
        if (annotation && t1) {
          if (annotation.named.name.value !== t1 && t1 !== 'any') {
            pushWarning(t, `Cannot assign ${t1} to ${annotation.named.name.value}`);
          }
        }
        if (t1 && t.named.name) {
          namespace[t.named.name.value] = {
            type: t1,
            t,
          };
        }
        // it has to be a name (check grammar)
        if (t.named.name && !t.named.explicit_assign && t1 && t2) {
          if (types[i - 1] !== t2 && t2 !== 'any') {
            pushWarning(t, `Cannot assign ${t1} to ${t2}`);
          }
        }
      }
      if (t && t.type === 'object_access' && types[i - 1]) {
        types[i - 1] = 'any';
        types.splice(i, 1);
        i = i - 1;
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
    checkStatment(node);
  },
  'object_literal': (node, parent) => {
    checkStatment(node);
    pushInference(parent, 'object');
  },
  'new': (node, parent) => {
    checkStatment(node);
    pushInference(parent, 'object');
  },
  'virtual_node': (node, parent) => {
    checkStatment(node);
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
    pushToParent(node, parent);
    if (node.named.access) {
      pushInference(parent, node.named.access);
    }
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
