import { compileSource } from './compile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        const result = compileSource(source, id, true);
        
        if (!result.success) {
          const errorMsg = result.errors.length > 0 
            ? result.errors[0].message || 'Compilation failed'
            : 'Compilation failed';
          throw new Error(errorMsg);
        }
        
        let code = result.code;
        
        // Add runtime import at the top
        code = `import * as blop from '${runtimePath}';\n${code}`;
        
        return {
          code,
          map: null,
        };
      } catch (error) {
        throw error;
      }
    },
  };
}

export { blopPlugin };
