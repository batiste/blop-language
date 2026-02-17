// ============================================================================
// Type Inference Module - Public API
// ============================================================================

import { visit, initVisitor, getVisitorState, setHandlers } from './visitor.js';
import createLiteralHandlers from './handlers/literals.js';
import createExpressionHandlers from './handlers/expressions.js';
import createFunctionHandlers from './handlers/functions.js';
import createStatementHandlers from './handlers/statements.js';
import { runBindingPhase } from './symbolTable.js';

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
 * 
 * Three-phase architecture:
 * 
 * Phase 1: Binding (runBindingPhase)
 * - Traverses AST once to collect all definitions (functions, type aliases)
 * - Populates symbol table without any type analysis
 * 
 * Phase 2: Type Inference (visit with inference handlers)
 * - Computes types for all expressions
 * - Records inferred types on AST nodes
 * - Handlers currently include validation (to be separated in future)
 * 
 * Phase 3: Type Checking (future refactoring)
 * - Would validate inferred types against declarations
 * - Would report all type errors and warnings
 * - Currently integrated with Phase 2 - to be separated later
 * 
 * @param {Object} node - Root AST node
 * @param {Array} _stream - Token stream for error reporting
 * @param {String} filename - Optional filename for import resolution
 * @returns {Array} Array of type warning errors
 */
function inference(node, _stream, filename) {
  // Phase 1: Binding - collect all definitions without type checking
  const symbolTable = runBindingPhase(node);
  
  // Phase 2: Type Inference - compute types for expressions
  const warnings = [];
  const functionScopes = [symbolTable.getAllSymbols()];
  const typeAliases = symbolTable.getAllSymbols().typeAliases;
  
  // Initialize visitor state with pre-collected symbols
  initVisitor(warnings, _stream, functionScopes, typeAliases, filename);
  
  // Create and set handlers
  const nodeHandlers = createNodeHandlers();
  setHandlers(nodeHandlers);
  
  // Visit the AST for type inference and checking
  // (Note: Phase 3 checking is currently integrated - future refactoring will separate)
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
