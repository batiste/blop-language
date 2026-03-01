/**
 * Vite plugin for blop language
 * 
 * Usage in vite.config.js:
 * import { blopPlugin } from 'blop-language/vite'
 * 
 * export default {
 *   plugins: [blopPlugin()]
 * }
 */

import path from 'path';
import { compileSource } from './compile.js';
import { loadConfig } from './utils.js';
import { RUNTIME_NAMESPACE } from './constants.js';
import { isStdlibImport, resolveStdlibPath } from './stdlib.js';

const RUNTIME_IMPORT = 'blop-language/runtime';

function blopPlugin(options = {}) {
  let fileConfig = {};

  return {
    name: 'vite-plugin-blop',

    // Resolve 'blop/X' stdlib imports to the absolute path of the .blop source
    // file so the transform hook can compile them like any other .blop file.
    resolveId(id) {
      if (isStdlibImport(id)) {
        return resolveStdlibPath(id);
      }
      return null;
    },

    async configResolved(viteConfig) {
      // Load blop.config.js once from the project root.
      // Plugin options passed to blopPlugin() override file config.
      const root = viteConfig.root || process.cwd();
      const loaded = await loadConfig(path.join(root, '_placeholder.blop'));
      fileConfig = { ...loaded, ...options };
    },

    // Handle .blop files
    async transform(code, id) {
      if (!id.endsWith('.blop')) {
        return null;
      }

      // Inference defaults to true in the Vite/dev context
      const enableInference = fileConfig.inference ?? true;

      let result;
      try {
        result = compileSource(code, id, enableInference, fileConfig);
      } catch (error) {
        this.error({ message: error.message, loc: { file: id, line: error.blopLine ?? 1, column: error.blopColumn ?? 0 } });
      }

      if (!result.success) {
        const firstError = result.errors[0];
        const errorMsg = firstError?.message || 'Compilation failed';
        const token = firstError?.token;
        const line = token ? (token.line_start ?? 0) + 1 : 1;
        const col  = token ? (token.column_start ?? 0)  : 0;
        this.error({ message: errorMsg, loc: { file: id, line, column: col } });
      }

      // Add runtime import at the top
      const finalCode = `import * as ${RUNTIME_NAMESPACE} from '${RUNTIME_IMPORT}';\n${result.code}`;

      // Shift source map by 1 line to account for the prepended import.
      // In VLQ source maps each ';' represents a new line, so a leading ';'
      // inserts a blank generated line 1 and pushes all existing mappings
      // (which use relative offsets) to lines 2+ without changing any values.
      const map = result.map
        ? { ...result.map, mappings: `;${result.map.mappings}` }
        : null;

      return { code: finalCode, map };
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
