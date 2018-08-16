// Meta programming: generate an efficient parser from
// a grammar and a token definition
const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const fs = require('fs');
const meta = require('./meta');

fs.writeFileSync("./out.js", meta.generate(grammar, tokensDefinition, false).join("\n"), function(err) {
    if(err) {
      console.log(err);
      return
    }
}); 

const tokenize = require('./tokenizer').tokenize
const out = require('./out')

var code = `
a = {
  'abc': 1,
  'bc': 2
}

(a, b, c) => {
  console.log('blop')
}

((a, b, c) => a + b / 1.039 * 2 + 1)

def blop(a, b) {
  1
}

if (1 + 2) == 2 {
  1
} elseif 1 {
  2 + a
} else {
  throw new Error()
}

bla.blop()()
blop(1, 2)
bla.blop()().hello()
test()

((a, b) => a + b)(1, 2)

`

const stream = tokenize(tokensDefinition, code)
const tree = out.parse(stream, 0)

let output = []
function generateCode(node) {
  if(node.value) {
    output.push(node.value)
  }
  if(node.children) {
    for(var i=0; i<node.children.length; i++) {
      generateCode(node.children[i])
    }
  }
}
console.log(`success: ${tree.success}`)
generateCode(tree)
console.log(output.join(''))
