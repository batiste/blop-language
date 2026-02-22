import { performance } from 'perf_hooks';
import { grammar } from './grammar.js';
import { tokensDefinition } from './tokensDefinition.js';
import backend from './backend.js';
import utils from './utils.js';
import parser from './parser.js';
import { inference } from './inference/index.js';
import { selectBestFailure } from './selectBestFailure.js';
import { displayError, displayBackendError } from './errorMessages.js';

/**
 * Compile Blop source code to JavaScript
 * @param {string} source - The Blop source code
 * @param {string} filename - Optional filename for error reporting
 * @param {boolean} enableInference - Enable type inference checking
 * @returns {object} - { code, success, errors, warnings, dependencies }
 */
function compileSource(source, filename = false, enableInference = false) {
  const config = utils.getConfig(filename);
  
  // CLI flag overrides config file
  const shouldRunInference = enableInference || config.inference;

  const t1 = performance.now();
  const stream = parser.tokenize(tokensDefinition, source);
  const t2 = performance.now();
  const tree = parser.parse(stream);
  const t3 = performance.now();
  if (process.env.BLOP_DEBUG) {
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
  const result = backend.generateCode(tree, stream, source, filename, null, false, 'vite');

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
