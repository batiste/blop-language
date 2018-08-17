let output = [];
let namespaces = [{}]

const currentNameSpace = () => namespaces[namespaces.length - 1]
const addNameSpace = () => namespaces.push({}) && currentNameSpace()
const popNameSpace = () => namespaces.pop()
uid_i = 0;
const uid = () => { 
  uid_i++;
  return `_uid_${uid_i}`
}

function addToNamespace(node) {
  const ns = currentNameSpace()
}

const backend = {
  'def': node => output.push(`function `),
  'EOS': node => '',
  'annotation': node => '',
  'virtual_node': node => {
    const parent = currentNameSpace()['currentVNode']
    const _uid = uid()
    output.push(`const ${_uid} = [];`)
    addNameSpace()['currentVNode'] = _uid
    node.named.stats ? node.named.stats.forEach(stat => {
      generateCode(stat)
    }) : null
    popNameSpace()
    if(parent) {
      output.push(`v.h('${node.named.opening.value}', {}, ${_uid})`)
    }  else {
      output.push(`return v.h('${node.named.opening.value}', {}, ${_uid})`)
    }
  },
  'virtual_node_assign': node => {
    const _uid = currentNameSpace()['currentVNode']
    output.push(`${_uid}.push(`)
    generateCode(node.named.exp)
    output.push(`)`)
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
      generateCode(node.named.stats)
      output.push(`}`)
      return
    }
    output.push(` ${node.named.type.value}(`)
    output.push(generateCode(node.named.exp))
    output.push(`) {`)
    generateCode(node.named.stats)
    output.push(`}`)
    generateCode(node.named.elseif)
  },
  'func_def': node => {
    if(node.named['fat-arrow']) {
      if(node.named.name) {
        output.push(node.named.name.value)
      }
      output.push(`(`)
      node.named.params ? generateCode(node.named.params) : null
      output.push(`) => `)
      generateCode(node.named.body)
    } else {
      output.push(`function `)
      if(node.named.name) {
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
    if(node.named.stats) {
      output.push(` {`)
      node.named.stats.forEach(stat => generateCode(stat))
      output.push(`}`)
    }
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
    namespace = {}
    output = []
    return generateCode(node)
  }
}
