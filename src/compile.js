const path = require('path');
const { stringifyRequest } = require('loader-utils');
const sourceMap = require('source-map');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');
const { inference } = require('./inference');

const config = utils.getConfig();

function compileSource(source, env = 'webpack', filename = false, useSourceMap = false, resolve = false) {
  const name = require.resolve(path.join(__dirname, './runtime.js'));
  let file;
  if (env === 'webpack') {
    file = stringifyRequest(this, `!${name}`);
  } else {
    file = stringifyRequest(this, name);
  }
  const header = `const blop = require(${file});\n`;

  const stream = parser.tokenize(tokensDefinition, source);
  const tree = parser.parse(stream);
  if (!tree.success) {
    utils.displayError(source, stream, tokensDefinition, grammar, tree);
  }

  let result;
  let _sourceMap;
  if (useSourceMap && !filename) {
    throw new Error('Cannot generate a source map with a filename');
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
    throw result.errors[0];
  }
  if (config.strictness === 'perfect' && !result.perfect) {
    throw result.warnings[0];
  }
  if (config.inference) {
    const warnings = inference(tree, stream);
    if (warnings.length) {
      throw warnings[0];
    }
  }

  const code = header + result.code;
  return { code, sourceMap: _sourceMap };
}

module.exports = {
  compileSource,
};
