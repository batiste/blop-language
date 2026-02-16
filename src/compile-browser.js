/**
 * Browser-friendly compile function
 * This is a simplified version that works in the browser without Node.js dependencies
 */

import { grammar } from './grammar.js';
import { tokensDefinition } from './tokensDefinition.js';
import backend from './backend.js';
import parser from './parser.js';
import { inference } from './inference/index.js';
import { selectBestFailure } from './selectBestFailure.js';

/**
 * Compile Blop source code to JavaScript in the browser
 * @param {string} source - The Blop source code
 * @param {object} options - Compilation options
 * @param {boolean} options.inference - Enable type inference checking (default: false)
 * @param {string} options.filename - Optional filename for error reporting
 * @returns {object} - { code, success, errors, warnings, dependencies }
 */
function compile(source, options = {}) {
  const {
    inference: enableInference = false,
    filename = 'source.blop'
  } = options;

  try {
    // Tokenize
    const stream = parser.tokenize(tokensDefinition, source);
    
    // Parse
    const tree = parser.parse(stream);
    
    if (!tree.success) {
      // Select the best failure from the array
      const bestFailure = tree.all_failures 
        ? selectBestFailure(tree.all_failures, tree.primary_failure)
        : tree.primary_failure;
      
      return {
        code: '',
        success: false,
        errors: [{
          message: formatParseError(stream, bestFailure),
          line: bestFailure.position?.line,
          column: bestFailure.position?.column
        }],
        warnings: [],
        dependencies: []
      };
    }

    // Generate code - always use ESM format
    const result = backend.generateCode(tree, stream, source, filename, null, false, 'vite');

    if (!result.success) {
      return {
        code: '',
        success: false,
        errors: result.errors || [],
        warnings: result.warnings || [],
        dependencies: result.dependencies || []
      };
    }

    // Run type inference if enabled
    let inferenceWarnings = [];
    if (enableInference) {
      inferenceWarnings = inference(tree, stream);
    }

    return { 
      code: result.code,
      success: true,
      errors: [],
      warnings: [...(result.warnings || []), ...inferenceWarnings],
      dependencies: result.dependencies || []
    };
  } catch (error) {
    return {
      code: '',
      success: false,
      errors: [{
        message: error.message,
        stack: error.stack
      }],
      warnings: [],
      dependencies: []
    };
  }
}

/**
 * Format a parse error for display (simplified for browser)
 */
function formatParseError(stream, failure) {
  if (!failure) return 'Parse error';
  
  const pos = failure.position || {};
  const line = pos.line || 0;
  const column = pos.column || 0;
  
  let message = `Parse error at line ${line}, column ${column}`;
  
  if (failure.expected) {
    message += `\nExpected: ${failure.expected}`;
  }
  
  if (failure.found) {
    message += `\nFound: ${failure.found}`;
  }
  
  return message;
}

export {
  compile,
};
