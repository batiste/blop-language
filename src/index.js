const grammar = require('./grammar').grammar
const tokensDefinition = require('./tokensDefinition').tokensDefinition
const backend = require('./backend')
const utils = require('./utils');
const parser = require('./parser');
const meta = require('./metaParserGenerator');
const loader = require('./loader');

module.exports = {
  grammar,
  tokensDefinition,
  backend,
  utils,
  parser,
  meta,
  loader
}
