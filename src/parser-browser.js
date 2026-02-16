/**
 * Browser-friendly parser exports
 * Re-exports parser functionality for use in browser examples
 */

import parser from './parser.js';
import { tokensDefinition } from './tokensDefinition.js';

/**
 * Tokenize source code
 * @param {string} source - The source code to tokenize
 * @returns {Array} - Array of tokens
 */
function tokenize(source) {
  return parser.tokenize(tokensDefinition, source);
}

/**
 * Parse tokens into AST
 * @param {Array} tokens - The token stream
 * @returns {object} - Parse tree result
 */
function parse(tokens) {
  return parser.parse(tokens);
}

/**
 * Tokenize and parse in one step
 * @param {string} source - The source code
 * @returns {object} - { tree, tokens }
 */
function parseSource(source) {
  const tokens = tokenize(source);
  const tree = parse(tokens);
  return { tree, tokens };
}

export {
  tokenize,
  parse,
  parseSource
};
