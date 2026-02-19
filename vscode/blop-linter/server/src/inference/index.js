// ============================================================================
// Type Inference Module - Public API
// ============================================================================

import { visit, initVisitor, getVisitorState, setHandlers, stampInferredTypes } from './visitor.js';
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
 * Run type inference on an AST and return any type warnings.
 *
 * Three-phase architecture:
 *
 * Phase 1 — Binding (runBindingPhase)
 *   Traverses the AST once to collect all top-level definitions (functions,
 *   type aliases, annotated locals).  Populates a SymbolTable used as the
 *   initial scope for both later phases.  No type analysis is performed here.
 *
 * Phase 2 — Type Inference (inferencePhase = 'inference')
 *   Walks the AST a second time to propagate structured Type objects through
 *   expressions.  All types in this phase are proper Type instances (never
 *   plain strings).  Warnings are suppressed so that incomplete information
 *   mid-traversal does not produce false positives.
 *
 * Phase 2.5 — Hover Stamping (stampInferredTypes)
 *   After inference is complete, copies inferred types onto AST node fields so
 *   that the language server can provide hover information without re-running
 *   inference.
 *
 * Phase 3 — Type Checking (inferencePhase = 'checking')
 *   Re-walks the AST with the same handlers.  Now that all types are resolved,
 *   assignment checks, function-call validation, property-access validation,
 *   and return-type checks are performed, and warnings are collected.
 *
 * @param {Object} node - Root AST node
 * @param {Array} _stream - Token stream for error reporting
 * @param {String} filename - Optional filename for import resolution
 * @returns {Array} Array of type warning errors
 */
function inference(node, _stream, filename) {
  // Phase 1: Binding - collect all definitions without type checking
  const symbolTable = runBindingPhase(node);
  
  const typeAliases = symbolTable.getAllSymbols().typeAliases;
  
  // Create and set handlers
  const nodeHandlers = createNodeHandlers();
  setHandlers(nodeHandlers);
  
  // Phase 2: Type Inference - compute types for expressions (no warnings)
  const inferenceWarnings = [];
  const inferenceScopes = [symbolTable.getAllSymbols()];
  initVisitor(inferenceWarnings, _stream, inferenceScopes, typeAliases, filename, 'inference', symbolTable);
  visit(node);

  // Phase 2.5: Stamp inferred types for hover support
  stampInferredTypes(node);

  // Phase 3: Type Checking - validate types and report warnings
  const checkingWarnings = [];
  const checkingScopes = [symbolTable.getAllSymbols()];
  initVisitor(checkingWarnings, _stream, checkingScopes, typeAliases, filename, 'checking', symbolTable);
  visit(node);

  return checkingWarnings;
}

function getHandlers() {
  return createNodeHandlers();
}

export {
  visit as check,
  inference,
  getHandlers,
};
