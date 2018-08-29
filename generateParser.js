// Meta programming: generate an efficient parser from
// a grammar and a token definition
const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const backend = require("./backend")
const fs = require('fs');
// const meta = require('./meta');
const meta = require('./metaSync');
const utils = require('./utils');

const { performance } = require('perf_hooks');

performance.mark('A');

fs.writeFileSync("./parser.js", meta.generate(grammar, tokensDefinition, false).join("\n"), function(err) {
    if(err) {
      console.log(err);
      return
    }
});

performance.mark('B');
performance.measure('Writting parser code', 'A', 'B')

const tokenize = require('./tokenizer').tokenize
const out = require('./parser')
const code = require('./codeExample').code

performance.mark('C');

// const stream = tokenize(tokensDefinition, code)
let stream = out.tokenize(tokensDefinition, code)

performance.mark('D');
performance.measure('Tokenization', 'C', 'D')

let tree = out.parse(stream, 0)

if(!tree.success) {
  utils.displayError(code, stream, tokensDefinition, grammar, tree)
}

performance.mark('E');
performance.measure('Parsing', 'D', 'E')

let output = backend.generateCode(tree).join('')

performance.mark('F');
performance.measure('Code generation', 'E', 'F')

const measurements = performance.getEntriesByType('measure');
measurements.forEach(measurement => {
  console.log('\x1b[32m%s\x1b[0m', measurement.name + ' ' + measurement.duration);
})
