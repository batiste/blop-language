let namespacesVN;
let namespacesFCT;

const currentNameSpaceVN = () => namespacesVN[namespacesVN.length - 1]
const addNameSpaceVN = () => namespacesVN.push({}) && currentNameSpaceVN()
const popNameSpaceVN = () => namespacesVN.pop()

const currentNameSpaceFCT = () => namespacesFCT[namespacesFCT.length - 1]
const addNameSpaceFCT = () => namespacesFCT.push({}) && currentNameSpaceFCT()
const popNameSpaceFCT = () => namespacesFCT.pop()

uid_i = 0;
const uid = (hint) => {
  uid_i++;
  return `__${uid_i}`
}

const backend = {
  'def': node => [`function `],
  'str': node => ['`' + node.value.slice(1, -1) + '`'],
  'EOS': node => [],
  'START': node => {
    let final = [];
    let module = [];
    node.children.forEach(stats => module.push(...generateCode(stats)))
    const ns = currentNameSpaceFCT()
    let keys = Object.keys(ns).filter(key => ns[key].hoist !== false)
    if (keys.length > 0) {
      final.push(`let ${keys.join(', ')};`)
    }
    final.push(...module)
    final.push(`module.exports = {`)
    Object.keys(ns).forEach(key => {
      final.push(` ${key},`)
    })
    final.push(`}`)
    return final;
  },
  'annotation': node => [],
  'assign': node => {
    let output = [];
    if(node.named.name) {
      const ns = currentNameSpaceFCT()
      if(!ns[node.named.name.value] && !node.named.explicit_assign) {
        ns[node.named.name.value] = node
      }
      output.push(...generateCode(node.named.name))
    } else {
      output.push(...generateCode(node.named.path))
    }
    output.push(' = ')
    output.push(...generateCode(node.named.exp))
    output.push(';')
    return output
  },
  'virtual_node': node => {
    let output = [];
    const parent = currentNameSpaceVN()['currentVNode']
    const _uid = uid()
    output.push(`const ${_uid}c = []; const ${_uid}a = {};`)
    addNameSpaceVN()['currentVNode'] = _uid
    node.named.attrs ? node.named.attrs.forEach(attr => output.push(...generateCode(attr))) : null
    node.named.stats ? node.named.stats.forEach(stat => output.push(...generateCode(stat))) : null
    if(node.named.exp) {
      output.push(`${_uid}c.push(`)
      output.push(...generateCode(node.named.exp))
      output.push(`);\n `)
    }
    popNameSpaceVN()
    let start = node.named.opening.value
    if(!/^[A-Z]/.test(node.named.opening.value)) {
      start = `'${node.named.opening.value}'`
    }
    output.push(`const ${_uid} = m(${start}, ${_uid}a, ${_uid}c); `)
    if(parent && node.type !== 'virtual_node_exp') {
      output.push(`${parent}c.push(${_uid}); `)
    } else {
      output.push(`return ${_uid}; `)
    }
    return output;
  },
  'virtual_node_exp': node => {
    let output = [];
    output.push('(() => {')
    output.push(...backend['virtual_node'](node))
    output.push(`})()`)
    return output;
  },
  'virtual_node_assign': node => {
    let output = [];
    const _uid = currentNameSpaceVN()['currentVNode']
    const cn = currentNameSpaceFCT()
    const a_uid = uid()
    cn[a_uid] = node
    output.push(`${a_uid} = `)
    output.push(...generateCode(node.named.exp))
    output.push(`; Array.isArray(${a_uid}) ? ${_uid}c.push(...${a_uid}) : ${_uid}c.push(${a_uid}); `)
    return output;
  },
  'virtual_node_attributes': node => {
    let output = [];
    const _uid = currentNameSpaceVN()['currentVNode']
    output.push(` ${_uid}a['${node.named.name.value}'] = `)
    output.push(...generateCode(node.named.exp))
    output.push("; ")
    return output;
  },
  'for_loop': node => {
    let output = [];
    const key = (node.named.key && node.named.key.value) || '__index';
    const value = node.named.value.value
    const f_uid = uid()
    output.push(`Object.entries(`) // can use Object.entries
    output.push(...generateCode(node.named.exp))
    output.push(`).forEach(${f_uid} => {let [${key}, ${value}] = ${f_uid};  `)
    node.named.stats ? node.named.stats.forEach(stat => output.push(...generateCode(stat))) : null
    output.push('});')
    return output;
  },
  'condition': node => {
    let output = [];
    output.push(`${node.named.type.value}(`)
    output.push(...generateCode(node.named.exp))
    output.push(`) {`)
    node.named.stats.forEach(stat => {
      output.push(...generateCode(stat))
    })
    output.push(`}`)
    output.push(...generateCode(node.named.elseif))
    return output;
  },
  'conditionelseif': node => {
    let output = [];
    if(!node.named.type) {
      return output;
    }
    if(node.named.type.type === 'else') {
      output.push(` else {`)
      node.named.stats.forEach(stat => {
        output.push(...generateCode(stat))
      })
      output.push(`}`)
      return output;
    }
    output.push(` ${node.named.type.value}(`)
    output.push(...generateCode(node.named.exp))
    output.push(`) {`)
    node.named.stats.forEach(stat => {
      output.push(...generateCode(stat))
    })
    output.push(`}`)
    output.push(...generateCode(node.named.elseif))
    return output;
  },
  'while_loop': node => {
    let output = [];
    output.push(`while(`)
    output.push(...generateCode(node.named.exp))
    output.push(`) {`)
    node.named.stats.forEach(stat => {
      output.push(...generateCode(stat))
    })
    output.push(`}`)
    return output
  },
  'func_def': node => {
    let output = [];
    const ns = currentNameSpaceFCT()
    if(node.named['fat-arrow']) {
      if(node.named.name) {
        node.hoist = false;
        ns[node.named.name.value] = node
        output.push(node.named.name.value)
      }
      output.push(`(`)
      if(node.named.params) {
        output.push(...generateCode(node.named.params))
      }
      output.push(`) => `)
      output.push(...generateCode(node.named.body))
    } else {
      output.push(`function `)
      if(node.named.name) {
        node.hoist = false;
        ns[node.named.name.value] = node
        output.push(node.named.name.value)
      }
      output.push(`(`)
      if(node.named.params) { 
        output.push(...generateCode(node.named.params))
      }
      output.push(`)`)
      output.push(...generateCode(node.named.body))
    }
    return output;
  },
  'func_body': node => {
    let output = []
    if(node.named.exp) {
      output = generateCode(node.named.exp)
    }
    const ns = addNameSpaceFCT()
    if(node.named.stats) {
      output.push(` {`)
      let body = []
      node.named.stats.forEach(stat => body.push(...generateCode(stat)))
      // hoisting
      let keys = Object.keys(ns).filter(key => ns[key].hoist !== false)
      if (keys.length > 0) {
        output.push(`let ${keys.join(', ')};`)
      }
      output.push(...body)
      output.push(`}`)
    }
    popNameSpaceFCT()
    return output;
  },
  '==': node => [`===`],
  '!=': node => [`!==`]
}

function generateCode(node) {
  let output = []
  if(backend[node.type]) {
    output.push(...backend[node.type](node))
  } else if(backend[node.rule_name]) {
    output.push(...backend[node.rule_name](node))
  } else {
    if(node.value) {
      output.push(node.value)
    }
    if(node.children) {
      for(var i=0; i<node.children.length; i++) {
        output.push(...generateCode(node.children[i]))
      }
    }
  }
  return output;
}

module.exports = {
  generateCode: (node) => { 
    uid_i = 0;
    namespacesVN = [{}]
    namespacesFCT = [{}]
    const output = generateCode(node)
    return output
  }
}
