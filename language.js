const assert = require("assert");
const parser = require("./parser");
const tokenizer = require("./tokenizer");
const backend = require("./backend")
const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const utils = require('./utils'); 
const { performance } = require('perf_hooks');

function parse(input, debug) {
  performance.mark('A');
  var stream = tokenizer.tokenize(tokensDefinition, input);
  performance.mark('B');
  var tree = parser.parse(grammar, stream, debug);
  performance.mark('C');
  if(!tree.success) {
    utils.displayError(input, stream, tokensDefinition, grammar, tree)
  }
  return tree
}

const code = require('./codeExample').code

var tree = parse(code);

performance.measure('Tokenization', 'A', 'B')
performance.measure('Parsing', 'B', 'C')

let output = backend.generateCode(tree)

performance.mark('D');
performance.measure('Code generation', 'C', 'D')

console.log(output.join(''))

const measurements = performance.getEntriesByType('measure');
measurements.forEach(measurement => {
  // I'm going to make the logs colour-coded, in this case I'm using Green
  console.log('\x1b[32m%s\x1b[0m', measurement.name + ' ' + measurement.duration);
})
