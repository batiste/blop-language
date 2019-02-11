
let warnings;
let stream;
let namespacesFCT;

const currentNameSpaceFCT = () => namespacesFCT[namespacesFCT.length - 1];
const addNameSpaceFCT = () => namespacesFCT.push({}) && currentNameSpaceFCT();
const popNameSpaceFCT = () => namespacesFCT.pop();

function getNSDef(name) {
  const ns = namespacesFCT.slice().reverse();
  for (let i = 0; i < ns.length; i++) {
    const upperScopeNode = ns[i][name];
    if (upperScopeNode) {
      return upperScopeNode;
    }
  }
}

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
        const { annotation, name } = t.named;
        const t1 = types[i - 1];
        // const t2 = types[i - 2];
        if (annotation && t1 && t1 !== 'any') {
          if (annotation.named.name.value !== t1 && t1 !== 'any') {
            pushWarning(t, `Cannot assign ${t1} to ${annotation.named.name.value}`);
          }
        }
        if (t1 && name && t1 !== 'any') {
          const def = getNSDef(name.value);
          if (def && def.type !== t1) {
            pushWarning(t, `Cannot assign ${t1} to ${def.type}`);
          } else {
            const ns = currentNameSpaceFCT();
            ns[name.value] = {
              type: t1,
              node: t,
            };
          }
        }
        // it has to be a name (check grammar)
        // if (t.named.name && !t.named.explicit_assign && t1 && t2) {
        //   if (types[i - 1] !== t2 && t2 !== 'any') {
        //     pushWarning(t, `Cannot assign ${t1} to ${t2}`);
        //   }
        // }
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

const backend = {
  'math': (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'number');
  },
  'number': (node, parent) => {
    pushInference(parent, 'number');
  },
  'name_exp': (node, parent) => {
    const { name, access, op } = node.named;
    if (access) {
      visitChildren(access);
      pushInference(parent, 'any');
      return;
    }
    // todo integrate boolean in the language
    const def = getNSDef(name.value);
    if (name.value === 'true' || name.value === 'false') {
      pushInference(parent, 'boolean');
    } else if (def) {
      if (def.source === 'func_def') {
        pushInference(parent, 'function');
      } else {
        pushInference(parent, def.type);
      }
    } else {
      pushInference(parent, 'any');
    }
    if (op) {
      backend['operation'](op, node);
      pushToParent(node, parent);
    }
  },
  'func_def_params': (node) => {
    if (node.named.annotation) {
      const ns = currentNameSpaceFCT();
      ns[node.named.name.value] = {
        type: node.named.annotation.named.name.value,
      };
    }
    visitChildren(node);
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
  'func_call': (node) => {
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
    const def = getNSDef(name.value);
    if (name && def) {
      pushInference(parent, def.type);
    }
  },
  'func_def': (node) => {
    const parentns = currentNameSpaceFCT();
    addNameSpaceFCT();
    if (node.named.name && node.named.annotation) {
      parentns[node.named.name.value] = {
        source: 'func_def',
        type: node.named.annotation.named.name.value,
        node,
      };
    }
    visitChildren(node);
    popNameSpaceFCT();
  },
  'GLOBAL_STATEMENT': checkStatment,
  'SCOPED_STATEMENTS': checkStatment,
  'assign': (node, parent) => {
    if (node.named.name) {
      // visit(node.named.name, node);
      visit(node.named.exp, node);
      pushToParent(node, parent);
      pushInference(parent, node);
    }
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
  namespacesFCT = [{}];
  stream = _stream;
  visit(node);
  return warnings;
}

module.exports = {
  check: visit,
  inference,
};
