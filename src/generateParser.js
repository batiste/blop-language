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
  console.log('\x1b[32m%s\x1b[0m ', `${measurement.name}: ${parseInt(measurement.duration)}ms`);
  // performance.clearMarks();
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

const code = require('./codeExample').code
lines = code.split(/\r\n|\r|\n/).length;
console.log(`Testing parser: parsing ${lines} lines of generated blop code.`)

const out = require('./parser')

performance.mark('C');

let stream = out.tokenize(tokensDefinition, code)

performance.mark('D');
performance.measure('Tokenization', 'C', 'D')


performance.mark('E');
let tree = out.parse(stream, 0)

if(!tree.success) {
  utils.displayError(code, stream, tokensDefinition, grammar, tree)
}
performance.mark('K');
performance.measure('Parsing', 'E', 'K');

performance.mark('F');
let output = backend.generateCode(tree).join('');
performance.mark('G');
performance.measure('Code generation', 'F', 'G');

performance.measure('Total', 'A', 'G')