const path = require('path');
const { stringifyRequest } = require('loader-utils');
const sourceMap = require('source-map');
const { performance } = require('perf_hooks');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');
const { inference } = require('./inference');
const { PATHS, ERROR_MESSAGES } = require('./constants');
const { selectBestFailure } = require('./selectBestFailure');


function compileSource(source, env = 'webpack', filename = false, useSourceMap = false, resolve = false) {
  const name = require.resolve(path.join(__dirname, PATHS.RUNTIME_MODULE));
  const config = utils.getConfig(filename);
  let file;
  if (env === 'webpack') {
    file = stringifyRequest(this, `!${name}`);
  } else {
    file = stringifyRequest(this, name);
  }
  const header = `const blop = require(${file});\n`;

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
    const bestFailure = tree.best_failure_array 
      ? selectBestFailure(tree.best_failure_array, tree.best_failure || tree)
      : (tree.best_failure || tree);
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
    result = backend.generateCode(tree, stream, source, filename, rootSource, resolve);
    const sourceMapGen = rootSource.toStringWithSourceMap({ file: filename }).map;
    _sourceMap = JSON.parse(sourceMapGen.toString());
  } else {
    result = backend.generateCode(tree, stream, source, filename, null, resolve);
  }


  if (!result.success) {
    utils.displayBackendError(stream, result.errors[0]);
  }
  if (config.strictness === 'perfect' && !result.perfect) {
    utils.displayBackendError(stream, result.warnings[0]);
  }
  if (config.inference) {
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
