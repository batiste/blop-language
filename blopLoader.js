const getOptions = require('loader-utils').getOptions;
const validateOptions = require('schema-utils');
const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const backend = require("./backend")
const fs = require('fs');
const meta = require('./metaSync');
const utils = require('./utils');
const parser = require('./parser');

const schema = {
  type: 'object',
};

module.exports = function(source) {
  const options = getOptions(this);

  validateOptions(schema, options, 'Blop Loader');
  
  let stream = parser.tokenize(tokensDefinition, source)
  let tree = parser.parse(stream, 0)
  if(!tree.success) {
    utils.displayError(source, stream, tokensDefinition, grammar, tree)
  }
  return backend.generateCode(tree).join('')
}
