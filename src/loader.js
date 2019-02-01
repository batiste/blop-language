const { getOptions } = require('loader-utils');
const validateOptions = require('schema-utils');
const { compileFile } = require('./compile');

const schema = {
  type: 'object',
};

module.exports = function loader(source) {
  const options = getOptions(this) || { debug: false };
  validateOptions(schema, options, 'Blop Loader');
  const code = compileFile(source, 'webpack', this.resourcePath);
  if (options.debug) {
    console.log(code);
  }
  return code;
};
