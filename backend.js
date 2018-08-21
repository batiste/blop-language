let output;
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
  return `_uid_${uid_i}`
}

const backend = {
  'def': node => output.push(`function `),
  'str': node => {
    output.push('`' + node.value.slice(1, -1) + '`')
  },
  'EOS': node => '',
  'annotation': node => '',
  'assign': node => {
    if(node.named.name) {
      const ns = currentNameSpaceFCT()
      if(!ns[node.named.name.value] && !node.named.explicit_assign) {
        output.push('let ')
        ns[node.named.name.value] = node.named.name
      }
      output.push(generateCode(node.named.name))
    } else {
      output.push(generateCode(node.named.path))
    }
    output.push(' = ')
    output.push(generateCode(node.named.exp))
    output.push(';')
  },
  'virtual_node': node => {
    const parent = currentNameSpaceVN()['currentVNode']
    const _uid = uid()
    output.push(`const ${_uid}_c = []; const ${_uid}_a = {};`)
    addNameSpaceVN()['currentVNode'] = _uid
    node.named.attrs ? node.named.attrs.forEach(attr => generateCode(attr)) : null
    node.named.stats ? node.named.stats.forEach(stat => generateCode(stat)) : null
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
    output.push(``)
  },
  'virtual_node_assign': node => {
    const _uid = currentNameSpaceVN()['currentVNode']
    const a_uid = uid()
    output.push(`let ${a_uid} = `)
    generateCode(node.named.exp)
    output.push(`; Array.isArray(${a_uid}) ? ${a_uid}.forEach(_i => ${_uid}_c.push(_i)) : ${_uid}_c.push(${a_uid}); `)
  },
  'virtual_node_attributes': node => {
    const _uid = currentNameSpaceVN()['currentVNode']
    output.push(` ${_uid}_a['${node.named.name.value}'] = `)
    generateCode(node.named.exp)
    output.push("; ")
  },
  'for_loop': node => {
    const value = node.named.value.value
    output.push(`Object.keys(`)
    generateCode(node.named.exp)
    output.push(`).forEach(${value} => {`)
    node.named.stats ? node.named.stats.forEach(stat => generateCode(stat)) : null
    output.push('});')
  },
  'condition': node => {
    output.push(`${node.named.type.value}(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    node.named.stats.forEach(stat => generateCode(stat))
    output.push(`}`)
    generateCode(node.named.elseif)
  },
  'conditionelseif': node => {
    if(!node.named.type) {
      return
    }
    if(node.named.type.type === 'else') {
      output.push(` else {`)
      node.named.stats.forEach(stat => generateCode(stat))
      output.push(`}`)
      return
    }
    output.push(` ${node.named.type.value}(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    node.named.stats.forEach(stat => generateCode(stat))
    output.push(`}`)
    generateCode(node.named.elseif)
  },
  'while_loop': node => {
    output.push(`while(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    node.named.stats.forEach(stat => generateCode(stat))
    output.push(`}`)
  },
  'func_def': node => {
    const ns = currentNameSpaceFCT()
    if(node.named['fat-arrow']) {
      if(node.named.name) {
        ns[node.named.name.value] = node.named.name
        output.push(node.named.name.value)
      }
      output.push(`(`)
      node.named.params ? generateCode(node.named.params) : null
      output.push(`) => `)
      generateCode(node.named.body)
    } else {
      output.push(`function `)
      if(node.named.name) {
        ns[node.named.name.value] = node.named.name
        output.push(node.named.name.value)
      }
      output.push(`(`)
      node.named.params ? generateCode(node.named.params) : null
      output.push(`)`)
      generateCode(node.named.body)
    }
  },
  'func_body': node => {
    if(node.named.exp) {
      generateCode(node.named.exp)
    }
    addNameSpaceFCT()
    if(node.named.stats) {
      output.push(` {`)
      node.named.stats.forEach(stat => generateCode(stat))
      output.push(`}`)
    }
    popNameSpaceFCT()
  },
  '==': node => {
    output.push(`===`)
  }
}

function generateCode(node) {
  if(backend[node.type]) {
    backend[node.type](node)
  } else if(backend[node.rule_name]) {
    backend[node.rule_name](node)
  } else {
    if(node.value) {
      output.push(node.value)
    }
    if(node.children) {
      for(var i=0; i<node.children.length; i++) {
        generateCode(node.children[i])
      }
    }
  }
  return output
}

module.exports = {
  generateCode: (node) => { 
    output = []
    output = [];
    namespacesVN = [{}]
    namespacesFCT = [{}]
    generateCode(node)
    const ns = currentNameSpaceFCT()
    output.push(`module.exports = {`)
    Object.keys(ns).forEach(key => {
      output.push(` ${key},`)
    })
    output.push(`}`)
    return output
  }
}
