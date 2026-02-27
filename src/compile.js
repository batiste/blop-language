import { performance } from 'perf_hooks';
import { grammar } from './grammar.js';
import { tokensDefinition } from './tokensDefinition.js';
import backend from './backend.js';
import parser from './parser.js';
import { inference } from './inference/index.js';
import { selectBestFailure } from './selectBestFailure.js';
import { displayError, displayBackendError } from './errorMessages.js';

/**
 * Compile Blop source code to JavaScript.
 *
 * @param {string} source - The Blop source code
 * @param {string} [filename] - Filename for error reporting and source maps
 * @param {boolean} [enableInference] - Enable type inference (overrides config.inference)
 * @param {object} [config] - Pre-loaded project config (from blop.config.js)
 * @param {boolean}  [config.inference]   - Run type inference
 * @param {string}   [config.strictness]  - 'perfect' | 'warn' | 'off'
 * @param {boolean}  [config.debug]       - Log tokenise/parse timing
 * @returns {object} - { code, map, success, errors, warnings, dependencies }
 */
function compileSource(source, filename = false, enableInference = false, config = {}) {
  // CLI / caller flag takes priority; fall back to config file setting
  const shouldRunInference = enableInference || !!config.inference;

  const t1 = performance.now();
  const stream = parser.tokenize(tokensDefinition, source);
  const t2 = performance.now();
  const tree = parser.parse(stream);
  const t3 = performance.now();
  if (process.env.BLOP_DEBUG || config.debug) {
    console.log(`${filename || 'source'} -> Tokenizing: ${t2 - t1}ms, parsing: ${t3 - t2}ms`);
  }
  
  if (!tree.success) {
    // Use statistics to select the best failure from the array
    const bestFailure = tree.all_failures 
      ? selectBestFailure(tree.all_failures, tree.primary_failure)
      : tree.primary_failure;
    displayError(stream, tokensDefinition, grammar, bestFailure);
  }

  // Generate code - always use ESM format
  // resolve=true enables import key validation (including type-only import stripping).
  // resolveImport already guards against missing filenames, so this is safe.
  const result = backend.generateCode(tree, stream, source, filename, null, true, 'vite', config);

  if (!result.success) {
    displayBackendError(stream, result.errors[0]);
  }
  if (config.strictness === 'perfect' && !result.perfect) {
    displayBackendError(stream, result.warnings[0]);
  }
  if (shouldRunInference) {
    const warnings = inference(tree, stream, filename);
    if (warnings.length) {
      // Treat type inference warnings as compilation errors
      return {
        code: result.code,
        map: result.map,
        success: false,
        errors: warnings,
        warnings: result.warnings || [],
        dependencies: result.dependencies || []
      };
    }
  }

  return { 
    code: result.code,
    map: result.map,
    success: result.success,
    errors: result.errors || [],
    warnings: result.warnings || [],
    dependencies: result.dependencies || []
  };
}

export {
  compileSource,
};
