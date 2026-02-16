// Meta programming: generate an efficient parser from
// a grammar and a token definition
import { performance, PerformanceObserver } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { generateParser } from 'meta-parser-generator';
import { grammar } from './grammar.js';
import { tokensDefinition } from './tokensDefinition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


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
let options = {
  esm: true, // Generate ESM exports
};
const statsPath = path.join(__dirname, 'tokenStatistics.json');
if (fs.existsSync(statsPath)) {
  const statistics = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  options.tokenStatistics = statistics.positionProbabilities;
  console.log(`${GREEN}[blop]${NC} Loaded token statistics for enhanced error messages`);
}

generateParser(grammar, tokensDefinition, './src/parser.js', options);

performance.mark('B');
performance.measure('Writting parser code', 'A', 'B');

// Quick fix, convert the generated parser to ESM format by replacing module.exports with export default

// Post-process the generated parser to convert CommonJS to ESM
const parserPath = path.join(__dirname, 'parser.js');
let parserContent = fs.readFileSync(parserPath, 'utf8');

// Replace module.exports with ESM export
// Find the module.exports block and convert it to ESM
parserContent = parserContent.replace(
  /module\.exports = \{\s*parse: \(stream\) => \{([^]*?)\},\s*tokenize,\s*\};/,
  (match, parseBody) => {
    return `const parse = (stream) => {${parseBody}};\n\nexport default {\n  parse,\n  tokenize,\n};`;
  }
);

fs.writeFileSync(parserPath, parserContent);
console.log(`${GREEN}[blop]${NC} Converted parser to ESM format`);
