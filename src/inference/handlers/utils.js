// ============================================================================
// Handler Utilities - Shared helpers for inference handlers
// ============================================================================

/**
 * Extract property name nodes from an access chain.
 * Returns an array of {name: string, node: astNode} for each step in the chain.
 * @param {Object} accessNode - The access AST node to traverse
 * @returns {{name: string, node: Object}[]}
 */
export function extractPropertyNodesFromAccess(accessNode) {
  const properties = [];

  function traverse(node) {
    if (!node || !node.children) return;

    for (const child of node.children) {
      if (child.type === 'name') {
        properties.push({ name: child.value, node: child });
      } else if (child.type === 'object_access') {
        traverse(child);
      }
    }
  }

  traverse(accessNode);
  return properties;
}
