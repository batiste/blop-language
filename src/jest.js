const { compileSource } = require('./compile');
/**
 * Custom Jest transformer for BLOP files
 *
 * To make this work with Jest you need to update your Jest configuration with this:
 *   "transform": {
 *     "^.+\\.blop$": "src/jest.js",
 *   }
*/

module.exports = {
  process(source, filename) {
    const result = compileSource(source, 'jest', filename, true);

    const { sourceMap } = result;
    sourceMap.sourcesContent = [source];
    sourceMap.file = filename;
    sourceMap.sources = [filename];

    // const map = Buffer.from(JSON.stringify(sourceMap)).toString('base64');
    // const prefix = '//# sourceMappingURL=data:application/json;charset=utf8;base64,';
    // const inlineSourceMap = prefix + map;
    // const inlineSource = result.code + inlineSourceMap;

    return {
      code: result.code,
      map: sourceMap,
    };
  },
};
