/**
 * Vite plugin for blop language
 * 
 * Usage in vite.config.js:
 * import { blopPlugin } from 'blop-language/src/vite'
 * 
 * export default {
 *   plugins: [blopPlugin()]
 * }
 */

const { compileSource } = require('./compile');

function blopPlugin(options = {}) {
  const { debug = false, inference = true } = options;

  return {
    name: 'vite-plugin-blop',
    
    // Handle .blop files
    transform(code, id) {
      if (!id.endsWith('.blop')) {
        return null;
      }

      try {
        const result = compileSource.call(
          { resourcePath: id },
          code,
          'webpack', // Use webpack mode for consistency
          id,
          false, // No source maps in dev (Vite handles this)
          false  // No resolve
        );

        return {
          code: result.code,
          map: null, // Let Vite handle source maps
        };
      } catch (error) {
        this.error(error.message);
        return null;
      }
    },

    // Hot module replacement support
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.blop')) {
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
      }
    },
  };
}

module.exports = {
  blopPlugin,
};
