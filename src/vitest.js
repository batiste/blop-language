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
        
        // Convert all CommonJS require() to ESM imports for Vite/Vitest compatibility
        
        // 1. Convert runtime import
        code = code.replace(
          /^const blop = require\((.*?)\);?\n/,
          `import * as blop from '${runtimePath}';\n`
        );
        
        // 2. Convert destructured imports:  let { x, y } = require('...');
        //    to: import { x, y } from '...';
        code = code.replace(
          /let\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"](.*?)['"]\);?/g,
          "import { $1 } from '$2';"
        );
        
        // 3. Convert default imports: import 'module' as name
        //    Already handled as: let name = require('module');
        code = code.replace(
          /let\s+(\w+)\s*=\s*require\(['"](.*?)['"]\);?/g,
          "import * as $1 from '$2';"
        );
        
        // 4. Side-effect imports: require('module');
        code = code.replace(
          /require\(['"](.*?)['"]\);?/g,
          "import '$1';"
        );
        
        // 5. Fix undeclared variables in strict mode (ESM)
        // The compiler sometimes doesn't declare variables before first assignment in loops.
        // This adds 'let' declarations where needed for strict mode compatibility.
        
        // First, find variables declared at module level (outside functions)
        const moduleLevelVars = new Set();
        const moduleLevelPattern = /(?:^|[;\n])\s*(?:let|const|var)\s+([^=;]+?)(?=[=;])/gm;
        let moduleMatch;
        while ((moduleMatch = moduleLevelPattern.exec(code)) !== null) {
          moduleMatch[1].split(',').forEach(v => {
            const varName = v.trim().split(/[\s:{[]/)[0];
            if (varName) moduleLevelVars.add(varName);
          });
        }
        
        code = code.replace(
          /function\s+(\w+)\(([^)]*)\)\s*\{([\s\S]*?)(\n\})/g,
          (match, funcName, params, body, closing) => {
            // Find variables that are assigned but not declared
            const declaredVars = new Set();
            const assignedVars = new Set();
            
            // Extract parameter names
            params.split(',').forEach(p => {
              const paramName = p.trim().split(/[\s:]/)[0];
              if (paramName) declaredVars.add(paramName);
            });
            
            // Find all let/const/var declarations
            const declPattern = /\b(?:let|const|var)\s+([^=;]+)/g;
            let declMatch;
            while ((declMatch = declPattern.exec(body)) !== null) {
              declMatch[1].split(',').forEach(v => {
                const varName = v.trim().split(/[\s:{[]/)[0];
                if (varName) declaredVars.add(varName);
              });
            }
            
            // Find all assignments (excluding object properties)
            // Look for: varname = value (at start of line or after semicolon/newline)
            const assignPattern = /(?:^|[;\n]\s*)(\w+)\s*=\s*[^=]/gm;
            let assignMatch;
            while ((assignMatch = assignPattern.exec(body)) !== null) {
              const varName = assignMatch[1];
              // Skip known globals but include compiler-generated vars like __19
              if (!['module', 'exports', 'require', 'test', 'expect', 'describe', 'it', 'beforeEach', 'afterEach'].includes(varName)) {
                assignedVars.add(varName);
              }
            }
            
            // Find variables that need declaration (but skip module-level vars)
            const needsDecl = Array.from(assignedVars).filter(v => !declaredVars.has(v) && !moduleLevelVars.has(v));
            
            if (needsDecl.length > 0) {
              const declarations = `let ${needsDecl.join(', ')};`;
              return `function ${funcName}(${params}) {${declarations}${body}${closing}`;
            }
            
            return match;
          }
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
