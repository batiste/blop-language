import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { Printer } from './printer.js';

/**
 * @typedef {Object} FormatOptions
 * @property {number} [indentSize=2]   - Spaces per indent level (default: 2)
 * @property {string} [indentChar=' '] - Indent character (default: space)
 * @property {number} [maxLineLength=80] - Max line length before breaking
 */

/**
 * Format a Blop source string.
 * @param {string} source
 * @param {FormatOptions} [options]
 * @returns {string}
 */
export function format(source, options = {}) {
  const stream = parser.tokenize(tokensDefinition, source);
  const ast = parser.parse(stream);

  if (!ast.success) {
    throw new Error(`blop formatter: failed to parse source – ${ast.primary_failure?.type ?? 'unknown error'}`);
  }

  const printer = new Printer(options);
  return printer.print(ast);
}
