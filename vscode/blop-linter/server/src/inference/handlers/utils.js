// ============================================================================
// Handler Utilities - Shared helpers for inference handlers
// ============================================================================

import { parseTypeExpression } from '../typeSystem.js';

/**
 * Extract explicit type arguments from type_arguments node
 * @param {Object} typeArgsNode - The type_arguments AST node
 * @returns {Type[]|null} Array of resolved types, or null if none
 */
export function extractExplicitTypeArguments(typeArgsNode) {
  if (!typeArgsNode) return null;

  const args = [];

  function collectArgs(node) {
    if (!node) return;

    if (node.named && node.named.arg) {
      const typeArg = parseTypeExpression(node.named.arg);
      if (typeArg) {
        args.push(typeArg);
      }
    }

    if (node.named && node.named.rest) {
      collectArgs(node.named.rest);
    }
  }

  if (typeArgsNode.named && typeArgsNode.named.args) {
    collectArgs(typeArgsNode.named.args);
  }

  return args.length > 0 ? args : null;
}

/**
 * Count the number of arguments in a func_call node
 * @param {Object} funcCallNode - The func_call AST node
 * @returns {number}
 */
export function countFuncCallArgs(funcCallNode) {
  let paramsNode = funcCallNode?.children?.find(c => c.type === 'func_call_params');
  if (!paramsNode) return 0;
  let count = 0;
  while (paramsNode) {
    count++;
    paramsNode = paramsNode.children?.find(c => c.type === 'func_call_params');
  }
  return count;
}
