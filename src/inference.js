
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
    console.log(node.children);
    for (let i = 0; i < node.inference.length; i++) {
      if (node.inference[i] !== 'number') {
        throw new Error(`Cannot do a math operation with ${node.inference[i]}`);
      }
    }
    pushInference(parent, 'number');
  },
  'number': (node, parent) => {
    pushInference(parent, 'number');
  },
  'name': (node, parent) => {
    if (namespace[node.value]) {
      pushInference(parent, namespace[node.value].type);
      console.log(namespace[node.value], parent);
    }
  },
  'str': (node, parent) => {
    pushInference(parent, 'string');
  },
  'assign': (node, parent) => {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], node);
      }
    }
    let name;
    if (node.named.name) {
      name = node.named.name.value;
    } else {
      name = node.named.path.children[0].value;
    }
    if (node.inference) {
      namespace[name] = { type: node.inference[0] };
    }
  },
};

function visit(node, parent) {
  if (backend[node.type]) {
    backend[node.type](node, parent);
  } else if (backend[node.rule_name]) {
    backend[node.rule_name](node, parent);
  } else {
    if (node.value) {
      // nothing for now
    }
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

module.exports = {
  check: visit,
};
