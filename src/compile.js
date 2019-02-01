const path = require('path');
const { stringifyRequest } = require('loader-utils');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');

const config = utils.getConfig();

function compileFile(source, env = 'webpack', filename = false) {
  const name = require.resolve(path.join(__dirname, './runtime.js'));
  let file;
  if (env === 'webpack') {
    file = stringifyRequest(this, `!${name}`);
  } else {
    file = stringifyRequest(this, name);
  }
  const header = `const blop = require(${file});\n\n`;

  const stream = parser.tokenize(tokensDefinition, source);
  const tree = parser.parse(stream, 0);
  if (!tree.success) {
    utils.displayError(source, stream, tokensDefinition, grammar, tree);
  }
  const result = backend.generateCode(tree, stream, source, filename);
  if (!result.success) {
    throw result.errors[0];
  }
  if (config.strictness === 'perfect' && !result.perfect) {
    throw result.warnings[0];
  }
  const code = header + result.code;
  return code;
}

module.exports = {
  compileFile,
};
