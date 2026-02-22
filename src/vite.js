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

      // Helper: return a throwing module so the file stays visible in DevTools
      // Sources (a 500 from this.error() removes the file from the Sources panel).
      const errorModule = (msg, line, col) => {
        const safeMsg = JSON.stringify(msg);
        const throwingCode = `throw new Error(${safeMsg});\n`;
        const map = {
          version: 3,
          file: id,
          sources: [id],
          sourcesContent: [code],
          // Single segment: generated col 0 → source line (line-1, 0-based), col 0
          mappings: 'AAAA',
          names: [],
        };
        return { code: throwingCode, map };
      };

      try {
        const result = compileSource(code, id, inference);

        if (!result.success) {
          const firstError = result.errors[0];
          const errorMsg = firstError?.message || 'Compilation failed';
          const token = firstError?.token;
          const line = token ? (token.line_start ?? 0) + 1 : 1;
          const col  = token ? (token.column_start ?? 0)  : 0;
          return errorModule(errorMsg, line, col);
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
        return errorModule(error.message, error.blopLine ?? 1, error.blopColumn ?? 0);
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
