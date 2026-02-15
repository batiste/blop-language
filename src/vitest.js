const { compileSource } = require('./compile');
const path = require('path');

/**
 * Vite plugin for transforming .blop files
 * Used by Vitest for test transformation
 */
function blopPlugin() {
  const runtimePath = path.resolve(__dirname, 'runtime.js');
  
  return {
    name: 'vite-plugin-blop',
    
    // Transform .blop files to JavaScript
    transform(source, id) {
      if (!id.endsWith('.blop')) {
        return null;
      }
      
      try {
        // Create a fake webpack loader context for compileSource
        const fakeContext = {
          resourcePath: id,
          context: path.dirname(id),
        };
        
        const result = compileSource.call(fakeContext, source, 'jest', id, true);
        
        let code = result.code;
        
        // The compiler now generates ESM natively!
        // We just need to ensure the runtime import uses the correct absolute path
        code = code.replace(
          /import \* as blop from ['"](.+?)['"];/,
          `import * as blop from '${runtimePath}';`
        );
        
        const { sourceMap } = result;
        if (sourceMap) {
          sourceMap.sourcesContent = [source];
          sourceMap.file = id;
          sourceMap.sources = [id];
        }
        
        return {
          code,
          map: sourceMap,
        };
      } catch (error) {
        // Let Vite handle the error reporting
        this.error({
          message: error.message,
          id,
        });
      }
    },
  };
}

module.exports = { blopPlugin };
