const utils = require('./utils');

let namespacesVN;
let namespacesFCT;
let backend;
let stream; let
  input;

const currentNameSpaceVN = () => namespacesVN[namespacesVN.length - 1];
const addNameSpaceVN = () => namespacesVN.push({}) && currentNameSpaceVN();
const popNameSpaceVN = () => namespacesVN.pop();

const currentNameSpaceFCT = () => namespacesFCT[namespacesFCT.length - 1];
const addNameSpaceFCT = () => namespacesFCT.push({}) && currentNameSpaceFCT();
const popNameSpaceFCT = () => namespacesFCT.pop();

function checkRedefinition(name, node, explicit) {
  if (explicit) return;
  const current = currentNameSpaceFCT();
  namespacesFCT.slice().reverse().forEach((ns) => {
    const upperScopeNode = ns[name];
    if (upperScopeNode && ns !== current) {
      const { token } = upperScopeNode;
      const redefinedBy = stream[node.stream_index];
      const sourceContext = utils.streamContext(input, token, token, stream);
      const redefineContext = utils.streamContext(input, redefinedBy, redefinedBy, stream);
      const error = new Error(`Redefinition of ${name} from upper scope. Use explicit := or rename ${name}
      ${sourceContext}

      Redefined by
      ${redefineContext}
      `);
      error.token = redefinedBy;
      throw error;
    }
  });
}

function generateCode(node) {
  const output = [];
  if (backend[node.type]) {
    output.push(...backend[node.type](node));
  } else if (backend[node.rule_name]) {
    output.push(...backend[node.rule_name](node));
  } else {
    if (node.value) {
      output.push(node.value);
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
    }
  }
  return output;
}

let uid_i = 0;
const uid = () => {
  uid_i++;
  return `__${uid_i}`;
};

backend = {
  'def': () => ['function '],
  'str': node => [`\`${node.value.slice(1, -1)}\``],
  'str_expression': (node) => {
    const output = ['`', node.named.str.value.slice(1, -1)];
    output.push(...generateCode(node.named.str_exp));
    return output;
  },
  'inner_str_expression': (node) => {
    const output = ['${'];
    output.push(...generateCode(node.named.exp));
    output.push('}');
    output.push(node.named.str.value.slice(1, -1));
    if (node.named.str_exp) {
      output.push(...generateCode(node.named.str_exp));
    } else {
      output.push('`');
    }
    return output;
  },
  'EOS': () => [],
  'START': (node) => {
    const final = [];
    const module = [];
    node.children.forEach(stats => module.push(...generateCode(stats)));
    const ns = currentNameSpaceFCT();
    const keys = Object.keys(ns).filter(key => ns[key].hoist !== false);

    if (keys.length > 0) {
      final.push(`let ${keys.join(', ')};\n`);
    }

    final.push(module.join(''));
    final.push('module.exports = {');
    Object.keys(ns).forEach((key) => {
      final.push(` ${key},`);
    });
    final.push('}');
    return final;
  },
  'annotation': () => [],
  'assign': (node) => {
    const output = [];
    if (node.named.name) {
      const ns = currentNameSpaceFCT();
      if (!ns[node.named.name.value] && !node.named.explicit_assign) {
        checkRedefinition(node.named.name.value, node, node.named.explicit_assign);
        ns[node.named.name.value] = { node, token: node.named.name };
      }
      output.push(...generateCode(node.named.name));
    } else {
      output.push(...generateCode(node.named.path));
    }
    output.push(' = ');
    output.push(...generateCode(node.named.exp));
    output.push(';');
    return output;
  },
  'exp_statement': (node) => {
    const output = [];
    for (let i = 0; i < node.children.length; i++) {
      output.push(...generateCode(node.children[i]));
    }
    output.push(';');
    return output;
  },
  'object_destructuring': (node) => {
    const output = [];
    output.push('let ');
    for (let i = 0; i < node.children.length; i++) {
      output.push(...generateCode(node.children[i]));
    }
    return output;
  },
  'destructuring_values': (node) => {
    const output = []; let
      name;
    const ns = currentNameSpaceFCT();
    if (node.named.rename) {
      name = node.named.rename.value;
      output.push(`${node.named.name.value}: ${name}`);
    } else {
      name = node.named.name.value;
      output.push(name);
    }
    ns[name] = { node, token: node.named.name, hoist: false };
    if (node.named.more) {
      output.push(', ');
      output.push(...generateCode(node.named.more));
    }
    return output;
  },
  'as': () => [':'],
  'object_literal': (node) => {
    const output = [];
    output.push('(');
    for (let i = 0; i < node.children.length; i++) {
      output.push(...generateCode(node.children[i]));
    }
    output.push(')');
    return output;
  },
  'import_statement': (node) => {
    const output = []; let
      module;
    if (node.named.file) {
      if (node.named.file.value.slice(1, -1) === 'blop') {
        module = 'blop';
      } else {
        module = `require(${node.named.file.value})`;
      }
    }
    if (node.named.module) {
      const name = node.named.name.value;
      output.push(`let ${name} = require(${node.named.module.value});`);
    } else if (node.named.name) {
      const name = node.named.name.value;
      output.push(`let ${name} = ${module}.${name};`);
    } else if (node.named.dest_values) {
      output.push('let { ');
      output.push(...generateCode(node.named.dest_values));
      output.push(` } = ${module};`);
    } else {
      output.push(`require(${node.named.file.value})`);
    }
    return output;
  },
  'virtual_node': (node) => {
    const output = []; let
      renderGuard = null;

    const parent = currentNameSpaceVN().currentVNode;
    const _uid = uid();
    output.push(`const ${_uid}c = []; const ${_uid}a = {};`);
    addNameSpaceVN().currentVNode = _uid;
    node.named.attrs ? node.named.attrs.forEach(attr => output.push(...generateCode(attr))) : null;

    // optimization with snabbdom to not render children
    if (node.named.attrs) {
      node.named.attrs.forEach((attr) => {
        if (attr.named.name.value === 'needRender') {
          output.push('if (');
          renderGuard = attr.named.exp ? generateCode(attr.named.exp) : [attr.named.name.value];
          output.push(renderGuard);
          output.push(' !== false) {');
        }
      });
    }
    node.named.stats ? node.named.stats.forEach(stat => output.push(...generateCode(stat))) : null;
    if (node.named.exp) {
      const a_uid = uid();
      output.push(`const ${a_uid} = `);
      output.push(...generateCode(node.named.exp));
      output.push(`; Array.isArray(${a_uid}) ? ${_uid}c.push(...${a_uid}) : ${_uid}c.push(${a_uid});\n `);
    }
    if (renderGuard) {
      output.push('}');
    }
    popNameSpaceVN();
    const start = node.named.opening.value;
    if (/^[A-Z]/.test(node.named.opening.value)) {
      output.push(`const ${_uid} = blop.c(${start}, ${_uid}a, ${_uid}c);`);
    } else {
      output.push(`const ${_uid} = blop.h('${start}', ${_uid}a, ${_uid}c);`);
    }
    if (parent && node.type !== 'virtual_node_exp') {
      output.push(`${parent}c.push(${_uid}); `);
    } else {
      output.push(`return ${_uid}; `);
    }
    return output;
  },
  'virtual_node_exp': (node) => {
    const output = [];
    output.push('(() => {');
    output.push(...backend.virtual_node(node));
    output.push('})()');
    return output;
  },
  'virtual_node_assign': (node) => {
    const output = [];
    const _uid = currentNameSpaceVN().currentVNode;
    const cn = currentNameSpaceFCT();
    const a_uid = uid();
    cn[a_uid] = node;
    output.push(`${a_uid} = `);
    output.push(...generateCode(node.named.exp));
    output.push(`; Array.isArray(${a_uid}) ? ${_uid}c.push(...${a_uid}) : ${_uid}c.push(${a_uid}); `);
    return output;
  },
  'virtual_node_attributes': (node) => {
    const output = [];
    const _uid = currentNameSpaceVN().currentVNode;
    output.push(` ${_uid}a['${node.named.name.value}'] = `);
    if (node.named.exp) {
      output.push(...generateCode(node.named.exp));
    } else {
      output.push(node.named.name.value);
    }
    output.push('; ');
    return output;
  },
  'for_loop': (node) => {
    const output = [];
    const key = (node.named.key && node.named.key.value) || '__index';
    const { value } = node.named.value;
    const isArray = (node.named.keyannotation
      && node.named.keyannotation.children[2].value === 'int')
      || (node.named.objectannotation
        && node.named.objectannotation.children[2].value === 'array');
    // an proper array is expected
    if (isArray) {
      output.push(...generateCode(node.named.exp));
      output.push(`.forEach((${value}, ${key}) => { `);
      node.named.stats ? node.named.stats.forEach(
        stat => output.push(...generateCode(stat)),
      ) : null;
      output.push('});');
    // any other objects
    } else {
      const f_uid = uid();
      output.push('Object.entries(');
      output.push(...generateCode(node.named.exp));
      output.push(`).forEach(${f_uid} => {let [${key}, ${value}] = ${f_uid}; `);
      node.named.stats ? node.named.stats.forEach(
        stat => output.push(...generateCode(stat)),
      ) : null;
      output.push('});');
    }
    return output;
  },
  'condition': (node) => {
    const output = [];
    output.push(`${node.named.type.value}(`);
    output.push(...generateCode(node.named.exp));
    output.push(') {');
    node.named.stats.forEach((stat) => {
      output.push(...generateCode(stat));
    });
    output.push('}');
    output.push(...generateCode(node.named.elseif));
    return output;
  },
  'conditionelseif': (node) => {
    const output = [];
    if (!node.named.type) {
      return output;
    }
    if (node.named.type.type === 'else') {
      output.push(' else {');
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      return output;
    }
    output.push(' else if (');
    output.push(...generateCode(node.named.exp));
    output.push(') {');
    node.named.stats.forEach((stat) => {
      output.push(...generateCode(stat));
    });
    output.push('}');
    output.push(...generateCode(node.named.elseif));
    return output;
  },
  'while_loop': (node) => {
    const output = [];
    output.push('while(');
    output.push(...generateCode(node.named.exp));
    output.push(') {');
    node.named.stats.forEach((stat) => {
      output.push(...generateCode(stat));
    });
    output.push('}');
    return output;
  },
  'func_def': (node) => {
    const output = [];
    const parentns = currentNameSpaceFCT();
    addNameSpaceFCT();
    if (node.named['fat-arrow']) {
      if (node.named.name) {
        parentns[node.named.name.value] = { node, hoist: false, token: node.named.name };
        output.push(node.named.name.value);
      }
      output.push('(');
      if (node.named.params) {
        output.push(...generateCode(node.named.params));
      }
      output.push(') => ');
      output.push(...generateCode(node.named.body));
    } else {
      if (!node.named.name) {
        output.push('(');
      }
      output.push('function ');
      if (node.named.name) {
        parentns[node.named.name.value] = { node, hoist: false, token: node.named.name };
        output.push(node.named.name.value);
      }
      output.push('(');
      if (node.named.params) {
        output.push(...generateCode(node.named.params));
      }
      output.push(')');
      output.push(...generateCode(node.named.body));
      if (!node.named.name) {
        output.push(')');
      }
    }
    popNameSpaceFCT();
    return output;
  },
  'class_def': (node) => {
    const output = [];
    const ns = currentNameSpaceFCT();
    ns[node.named.name.value] = { node, hoist: false, token: node.named.name };
    output.push('class ');
    output.push(node.named.name.value);
    if (node.named.extends) {
      output.push(` extends ${node.named.extends.value}`);
    }
    output.push(' {');
    if (node.named.stats) {
      node.named.stats.forEach(stat => output.push(...generateCode(stat)));
    }
    output.push(' }');
    return output;
  },
  'class_func_def': (node) => {
    const output = [];
    const ns = addNameSpaceFCT();
    ns[node.named.name.value] = { node, hoist: false, token: node.named.name };
    output.push(node.named.name.value);
    output.push('(');
    if (node.named.params) {
      output.push(...generateCode(node.named.params));
    }
    output.push(')');
    output.push(...generateCode(node.named.body));
    popNameSpaceFCT();
    return output;
  },
  'func_def_params': (node) => {
    const ns = currentNameSpaceFCT();
    ns[node.named.name.value] = { node, hoist: false, token: node.named.name };
    const output = [];
    for (let i = 0; i < node.children.length; i++) {
      output.push(...generateCode(node.children[i]));
    }
    return output;
  },
  'func_body': (node) => {
    const ns = currentNameSpaceFCT();
    let output = [];
    if (node.named.exp) {
      output = generateCode(node.named.exp);
    } else {
      output.push(' {');
      const body = [];
      // states can be empty
      if (node.named.stats) {
        node.named.stats.forEach(stat => body.push(...generateCode(stat)));
        // hoisting
        const keys = Object.keys(ns).filter(key => ns[key].hoist !== false);
        if (keys.length > 0) {
          output.push(`let ${keys.join(', ')};`);
        }
        output.push(...body);
      }
      output.push('}');
    }
    return output;
  },
  'try_catch': (node) => {
    const output = ['try {'];
    node.named.statstry.forEach(stat => output.push(...generateCode(stat)));
    output.push('} catch(');
    output.push(...generateCode(node.named.name));
    output.push(') {');
    node.named.statscatch.forEach(stat => output.push(...generateCode(stat)));
    output.push('}');
    return output;
  },
  'comment': node => node.value.replace('#', '//'),
  '==': () => ['==='],
  '!=': () => ['!=='],
};


module.exports = {
  generateCode: (node, _stream, _input) => {
    uid_i = 0;
    stream = _stream;
    input = _input;
    namespacesVN = [{}];
    namespacesFCT = [{}];
    const output = generateCode(node);
    return output;
  },
};
