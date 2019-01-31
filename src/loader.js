const path = require('path');
const { getOptions } = require('loader-utils');
const { stringifyRequest } = require('loader-utils');
const validateOptions = require('schema-utils');
const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');

const schema = {
  type: 'object',
};

module.exports = function loader(source, env = 'webpack', filename = false) {
  const options = getOptions(this) || { debug: false };
  validateOptions(schema, options, 'Blop Loader');
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
  const code = header + backend.generateCode(tree, stream, source, filename).join('');
  if (options.debug) {
    console.log(code);
  }
  return code;
};
