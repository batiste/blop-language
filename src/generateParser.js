// Meta programming: generate an efficient parser from
// a grammar and a token definition
const fs = require('fs');
const { performance, PerformanceObserver } = require('perf_hooks');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const meta = require('./metaParserGenerator');
const utils = require('./utils');

const obs = new PerformanceObserver((items) => {
  const measurement = items.getEntries()[0];
  console.log('\x1b[32m%s\x1b[0m ', `${measurement.name}: ${parseInt(measurement.duration, 10)}ms`);
});
obs.observe({ entryTypes: ['measure'] });

performance.mark('A');

fs.writeFileSync('./src/parser.js', meta.generate(grammar, tokensDefinition, false).join('\n'), (err) => {
  if (err) {
    console.log(err);
  }
});

performance.mark('B');
performance.measure('Writting parser code', 'A', 'B');

const { code } = require('./codeExample');

const lines = code.split(/\r\n|\r|\n/).length;
console.log(`Testing parser: parsing ${lines} lines of generated blop code.`);

const out = require('./parser');

performance.mark('C');

const stream = out.tokenize(tokensDefinition, code);

performance.mark('D');
performance.measure('Tokenization', 'C', 'D');


performance.mark('E');
const tree = out.parse(stream, 0);

if (!tree.success) {
  utils.displayError(code, stream, tokensDefinition, grammar, tree);
}
performance.mark('K');
performance.measure('Parsing', 'E', 'K');

performance.mark('F');
backend.generateCode(tree).join('');
performance.mark('G');
performance.measure('Code generation', 'F', 'G');

performance.measure('Total', 'A', 'G');
