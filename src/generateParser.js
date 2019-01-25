// Meta programming: generate an efficient parser from
// a grammar and a token definition
const fs = require('fs');
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const meta = require('./metaParserGenerator');

const GREEN = '\x1b[32m';
const NC = '\x1B[0m';


const obs = new PerformanceObserver((items) => {
  const measurement = items.getEntries()[0];
  console.log(`${GREEN}[blop]${NC} ${measurement.name}: ${parseInt(measurement.duration, 10)}ms`);
});
obs.observe({ entryTypes: ['measure'] });

performance.mark('A');

fs.writeFileSync(path.resolve(__dirname, './parser.js'),
  meta.generate(grammar, tokensDefinition, false).join('\n'), (err) => {
    if (err) {
      console.log(err);
    }
  });

performance.mark('B');
performance.measure('Writting parser code', 'A', 'B');
