// Meta programming: generate an efficient parser from
// a grammar and a token definition
const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
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

// Load token statistics if available
let options = {};
const statsPath = path.join(__dirname, 'tokenStatistics.json');
if (fs.existsSync(statsPath)) {
  const statistics = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  options.tokenStatistics = statistics.positionProbabilities;
  console.log(`${GREEN}[blop]${NC} Loaded token statistics for enhanced error messages`);
}

generateParser(grammar, tokensDefinition, './src/parser.js', options);

performance.mark('B');
performance.measure('Writting parser code', 'A', 'B');
