const getOptions = require('loader-utils').getOptions;
const stringifyRequest = require('loader-utils').stringifyRequest;
const validateOptions = require('schema-utils');
const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const backend = require("./backend")
const utils = require('./utils');
const parser = require('./parser');
const path = require('path');

const schema = {
  type: 'object',
};

module.exports = function(source) {
  const options = getOptions(this);
  validateOptions(schema, options, 'Blop Loader');
  const name = require.resolve(path.join(__dirname, "./runtime.js"))
  const file = stringifyRequest(this, "!" + name)
  const header = `const blop = require(${file});\n\n`;
  
  let stream = parser.tokenize(tokensDefinition, source)
  let tree = parser.parse(stream, 0)
  if(!tree.success) {
    utils.displayError(source, stream, tokensDefinition, grammar, tree)
  }
  const code = header + backend.generateCode(tree, stream, source).join('')
  if(options.debug) {
    console.log(code)
  }
  return code
}