const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');
const meta = require('./metaParserGenerator');
const loader = require('./loader');
const jest = require('./jest');

module.exports = {
  grammar,
  tokensDefinition,
  backend,
  utils,
  parser,
  meta,
  loader,
  jest,
};
