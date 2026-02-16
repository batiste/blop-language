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

        return {
          code: finalCode,
          map: null,
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

export {
  blopPlugin,
};
