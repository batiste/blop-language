const loaderUtils = require('loader-utils');
const validateOptions = require('schema-utils');
const { compileSource } = require('./compile');

const schema = {
  type: 'object',
};

module.exports = function loader(source) {
  const options = loaderUtils.getOptions(this) || { debug: false };
  validateOptions(schema, options, 'Blop Loader');
  const { code, sourceMap } = compileSource(source, 'webpack', this.resourcePath, options.sourceMap);
  if (options.debug) {
    console.log(code);
  }

  if (options.sourceMap) {
    const current = loaderUtils.getRemainingRequest(this);
    const sourceFilename = loaderUtils.getRemainingRequest(this);
    sourceMap.sourcesContent = [source];
    sourceMap.file = current;
    sourceMap.sources = [sourceFilename];
    this.callback(null, code, sourceMap);
  } else {
    this.callback(null, code);
  }
};
