// Meta programming: generate an efficient parser from
// a grammar and a token definition
const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const backend = require("./backend")
const fs = require('fs');
const meta = require('./metaParserGenerator');
const utils = require('./utils');

const { performance, PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((items) => {
  const measurement = items.getEntries()[0]
  console.log('\x1b[32m%s\x1b[0m', measurement.name + ' ' + measurement.duration);
  performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });

performance.mark('A');

fs.writeFileSync("./src/parser.js", meta.generate(grammar, tokensDefinition, false).join("\n"), function(err) {
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
