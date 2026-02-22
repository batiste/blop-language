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

import { compileSource } from './compile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function blopPlugin(options = {}) {
  const { debug = false, inference = true } = options;
  const runtimePath = path.resolve(__dirname, 'runtime.js');

  return {
    name: 'vite-plugin-blop',
    
    // Handle .blop files
    transform(code, id) {
      if (!id.endsWith('.blop')) {
        return null;
      }

      try {
        const result = compileSource(code, id, inference);

        if (!result.success) {
          const errorMsg = result.errors.length > 0 
            ? result.errors[0].message || 'Compilation failed'
            : 'Compilation failed';
          this.error(errorMsg);
          return null;
        }

        // Add runtime import at the top
        const finalCode = `import * as blop from '${runtimePath}';\n${result.code}`;

        // Shift source map by 1 line to account for the prepended import.
        // In VLQ source maps each ';' represents a new line, so a leading ';'
        // inserts a blank generated line 1 and pushes all existing mappings
        // (which use relative offsets) to lines 2+ without changing any values.
        const map = result.map
          ? { ...result.map, mappings: `;${result.map.mappings}` }
          : null;

        return { code: finalCode, map };
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

export {
  blopPlugin,
};
