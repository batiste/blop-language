// ============================================================================
// Type Inference Module - Public API
// ============================================================================

import { visit, initVisitor, getVisitorState, setHandlers } from './visitor.js';
import createLiteralHandlers from './handlers/literals.js';
import createExpressionHandlers from './handlers/expressions.js';
import createFunctionHandlers from './handlers/functions.js';
import createStatementHandlers from './handlers/statements.js';

// Combine all handlers
function createNodeHandlers() {
  const getState = () => getVisitorState();
  
  return {
    ...createLiteralHandlers(getState),
    ...createExpressionHandlers(getState),
    ...createFunctionHandlers(getState),
    ...createStatementHandlers(getState),
  };
}

/**
 * Run type inference on an AST and return any type warnings
 * @param {Object} node - Root AST node
 * @param {Array} _stream - Token stream for error reporting
 * @returns {Array} Array of type warning errors
 */
function inference(node, _stream) {
  const warnings = [];
  const functionScopes = [{}];
  const typeAliases = {}; // Reset type aliases for each file
  
  // Initialize visitor state
  initVisitor(warnings, _stream, functionScopes, typeAliases);
  
  // Create and set handlers
  const nodeHandlers = createNodeHandlers();
  setHandlers(nodeHandlers);
  
  // Visit the AST
  visit(node);
  
  return warnings;
}

function getHandlers() {
  return createNodeHandlers();
}

export {
  visit as check,
  inference,
  getHandlers,
};
