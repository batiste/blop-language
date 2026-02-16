const { grammar } = require('./grammar');
const { tokensDefinition } = require('./tokensDefinition');
const backend = require('./backend');
const utils = require('./utils');
const parser = require('./parser');
const loader = require('./loader');
const vite = require('./vite');
const vitest = require('./vitest');

module.exports = {
  grammar,
  tokensDefinition,
  backend,
  utils,
  parser,
  loader,
  vite,
  vitest,
};
