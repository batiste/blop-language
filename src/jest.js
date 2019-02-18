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
    return compileSource(source, 'jest', filename);
  },
};
