// Meta programming: generate an efficient parser from
// a grammar and a token definition
const { performance, PerformanceObserver } = require('perf_hooks');
// eslint-disable-next-line import/no-extraneous-dependencies
const { generateParser } = require('meta-parser-generator');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');


const GREEN = '\x1b[32m';
const NC = '\x1B[0m';


const obs = new PerformanceObserver((items) => {
  const measurement = items.getEntries()[0];
  // eslint-disable-next-line no-console
  console.log(`${GREEN}[blop]${NC} ${measurement.name}: ${parseInt(measurement.duration, 10)}ms`);
});
obs.observe({ entryTypes: ['measure'] });

performance.mark('A');

generateParser(grammar, tokensDefinition, './src/parser.js');

performance.mark('B');
performance.measure('Writting parser code', 'A', 'B');
