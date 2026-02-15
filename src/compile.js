const path = require('path');
const { stringifyRequest } = require('loader-utils');
const sourceMap = require('source-map');
const { performance } = require('perf_hooks');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');
const { inference } = require('./inference/index');
const { PATHS, ERROR_MESSAGES } = require('./constants');
const { selectBestFailure } = require('./selectBestFailure');


function compileSource(source, env = 'webpack', filename = false, useSourceMap = false, resolve = false, enableInference = false) {
  const name = require.resolve(path.join(__dirname, PATHS.RUNTIME_MODULE));
  const config = utils.getConfig(filename);
  
  // CLI flag overrides config file
  const shouldRunInference = enableInference || config.inference;
  
  let file;
  let header;
  if (env === 'webpack') {
    file = stringifyRequest(this, `!${name}`);
    // Webpack needs CommonJS
    header = `const blop = require(${file});\n`;
  } else {
    // For non-webpack environments (node, jest), use ESM
    file = JSON.stringify(name);
    header = `import * as blop from ${file};\n`;
  }

  const t1 = performance.now();
  const stream = parser.tokenize(tokensDefinition, source);
  const t2 = performance.now();
  const tree = parser.parse(stream);
  const t3 = performance.now();
  if (process.env.BLOP_DEBUG) {
    console.log(`${filename} -> Tokenizing: ${t2 - t1}, parsing: ${t3 - t2}`);
  }
  if (!tree.success) {
    // Use statistics to select the best failure from the array
    const bestFailure = tree.all_failures 
      ? selectBestFailure(tree.all_failures, tree.primary_failure)
      : tree.primary_failure;
    utils.displayError(stream, tokensDefinition, grammar, bestFailure);
  }

  let result;
  let _sourceMap;
  if (useSourceMap && !filename) {
    throw new Error(ERROR_MESSAGES.SOURCEMAP_WITHOUT_FILENAME());
  }
  if (useSourceMap) {
    const rootSource = new sourceMap.SourceNode(null, null, filename);
    rootSource.add(new sourceMap.SourceNode(1, 1, filename, header));
    result = backend.generateCode(tree, stream, source, filename, rootSource, resolve, env);
    const sourceMapGen = rootSource.toStringWithSourceMap({ file: filename }).map;
    _sourceMap = JSON.parse(sourceMapGen.toString());
  } else {
    result = backend.generateCode(tree, stream, source, filename, null, resolve, env);
  }


  if (!result.success) {
    utils.displayBackendError(stream, result.errors[0]);
  }
  if (config.strictness === 'perfect' && !result.perfect) {
    utils.displayBackendError(stream, result.warnings[0]);
  }
  if (shouldRunInference) {
    const warnings = inference(tree, stream);
    if (warnings.length) {
      utils.displayBackendError(stream, warnings[0]);
    }
  }

  const code = header + result.code;
  return { code, sourceMap: _sourceMap, dependencies: result.dependencies };
}

module.exports = {
  compileSource,
};
