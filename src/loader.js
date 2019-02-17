const loaderUtils = require('loader-utils');
const validateOptions = require('schema-utils');
const { compileSource } = require('./compile');

const schema = {
  type: 'object',
};

module.exports = function loader(source) {
  const options = loaderUtils.getOptions(this) || { debug: false };
  validateOptions(schema, options, 'Blop Loader');
  const { code, sourceMap } = compileSource(source, 'webpack', this.resourcePath);
  if (options.debug) {
    console.log(code);
  }
  if(this.sourceMap) {
    //
    // var jsRequest = loaderUtils.getCurrentRequest(this);
    // console.log('--->', coffeeRequest, jsRequest)
  }
  var current = loaderUtils.getRemainingRequest(this);
  var sourceFilename = loaderUtils.getRemainingRequest(this);
  const map = JSON.parse(sourceMap);
  map.sourcesContent = [source];
  map.file = current;
  map.sources = [sourceFilename];

  this.callback(null, code, map);
  return;
};
