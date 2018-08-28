let namespacesVN;
let namespacesFCT;

const currentNameSpaceVN = () => namespacesVN[namespacesVN.length - 1]
const addNameSpaceVN = () => namespacesVN.push({}) && currentNameSpaceVN()
const popNameSpaceVN = () => namespacesVN.pop()

const currentNameSpaceFCT = () => namespacesFCT[namespacesFCT.length - 1]
const addNameSpaceFCT = () => namespacesFCT.push({}) && currentNameSpaceFCT()
const popNameSpaceFCT = () => namespacesFCT.pop()

uid_i = 0;
const uid = () => {
  uid_i++;
  return `__${uid_i}`
}

const backend = {
  'def': node => [`function `],
  'str': node => ['`' + node.value.slice(1, -1) + '`'],
  'EOS': node => [],
  'annotation': node => [],
  'assign': node => {
    let output = [];
    if(node.named.name) {
      const ns = currentNameSpaceFCT()
      if(!ns[node.named.name.value] && !node.named.explicit_assign) {
        // output.push('let ')
        ns[node.named.name.value] = node.named.name
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
    output.push(`const ${_uid}_c = []; const ${_uid}_a = {};`)
    addNameSpaceVN()['currentVNode'] = _uid
    node.named.attrs ? node.named.attrs.forEach(attr => output.push(...generateCode(attr))) : null
    node.named.stats ? node.named.stats.forEach(stat => output.push(...generateCode(stat))) : null
    if(node.named.exp) {
      output.push(`${_uid}_c.push(`)
      output.push(...generateCode(node.named.exp))
      output.push(`);\n `)
    }
    popNameSpaceVN()
    let start = node.named.opening.value
    if(!/^[A-Z]/.test(node.named.opening.value)) {
      start = `'${node.named.opening.value}'`
    }
    output.push(`const ${_uid} = m(${start}, ${_uid}_a, ${_uid}_c); `)
    if(parent) {
      output.push(`${parent}_c.push(${_uid}); `)
    } else {
      output.push(`return ${_uid}; `)
    }
    return output;
  },
  'virtual_node_exp': node => {
    let output = [];
    const parent = currentNameSpaceVN()['currentVNode']
    const _uid = uid()
    output.push('(() => {')
    output.push(`const ${_uid}_c = []; const ${_uid}_a = {};`)
    addNameSpaceVN()['currentVNode'] = _uid
    node.named.attrs ? node.named.attrs.forEach(attr => output.push(...generateCode(attr))) : null
    node.named.stats ? node.named.stats.forEach(stat => output.push(...generateCode(stat))) : null
    if(node.named.exp) {
      output.push(`${_uid}_c.push(`)
      generateCode(node.named.exp)
      output.push(`);\n `)
    }
    popNameSpaceVN()
    let start = node.named.opening.value
    if(!/^[A-Z]/.test(node.named.opening.value)) {
      start = `'${node.named.opening.value}'`
    }
    output.push(`const ${_uid} = m(${start}, ${_uid}_a, ${_uid}_c); `)
    if(parent) {
      output.push(`${parent}_c.push(${_uid}); `)
    } else {
      output.push(`return ${_uid}; `)
    }
    output.push(`})()`)
    return output;
  },
  'virtual_node_assign': node => {
    let output = [];
    const _uid = currentNameSpaceVN()['currentVNode']
    const cn = currentNameSpaceFCT()
    const a_uid = uid()
    cn[a_uid] = 'hoist'
    output.push(`let ${a_uid} = `)
    output.push(...generateCode(node.named.exp))
    output.push(`; Array.isArray(${a_uid}) ? ${a_uid}.forEach(_i => ${_uid}_c.push(_i)) : ${_uid}_c.push(${a_uid}); `)
    return output;
  },
  'virtual_node_attributes': node => {
    let output = [];
    const _uid = currentNameSpaceVN()['currentVNode']
    output.push(` ${_uid}_a['${node.named.name.value}'] = `)
    output.push(...generateCode(node.named.exp))
    output.push("; ")
    return output;
  },
  'for_loop': node => {
    let output = [];
    const value = node.named.value.value
    output.push(`Object.keys(`)
    output.push(...generateCode(node.named.exp))
    output.push(`).forEach(${value} => {`)
    node.named.stats ? node.named.stats.forEach(stat => generateCode(stat)) : null
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
        ns[node.named.name.value] = node.named.name
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
        ns[node.named.name.value] = node.named.name
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
    const cn = addNameSpaceFCT()
    if(node.named.stats) {
      output.push(` {`)
      node.named.stats.forEach(stat => output.push(...generateCode(stat)))
      output.push(`}`)
    }
    popNameSpaceFCT()
    return output;
  },
  '==': node => [`===`]
}

function generateCode(node) {
  let output = []
  if(backend[node.type]) {
    a = backend[node.type](node)
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
    namespacesVN = [{}]
    namespacesFCT = [{}]
    const output = generateCode(node)
    const ns = currentNameSpaceFCT()
    output.push(`module.exports = {`)
    Object.keys(ns).forEach(key => {
      output.push(` ${key},`)
    })
    output.push(`}`)
    return output
  }
}
