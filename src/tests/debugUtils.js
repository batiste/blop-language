/**
 * AST Debugging Utilities for Type Inference Investigation
 * 
 * Provides reusable functions for exploring and debugging the AST structure.
 * Useful for investigating type inference issues and understanding AST traversal.
 */

/**
 * Find all nodes of a specific type in the AST
 * @param {Object} node - Root node to search from
 * @param {string} type - Node type to find
 * @param {Array} results - Accumulator for results
 * @returns {Array} Array of matching nodes
 */
export function findNodes(node, type, results = []) {
  if (node.type === type) {
    results.push(node);
  }
  if (node.children) {
    node.children.forEach(child => findNodes(child, type, results));
  }
  if (node.named) {
    Object.values(node.named).forEach(child => {
      if (child && typeof child === 'object' && child.type) {
        findNodes(child, type, results);
      }
    });
  }
  return results;
}

/**
 * Pretty print an AST node with indentation
 * @param {Object} node - Node to print
 * @param {number} depth - Current indentation depth
 * @param {number} maxDepth - Maximum depth to traverse (default 6)
 */
export function printNode(node, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return;
  
  const indent = '  '.repeat(depth);
  console.log(`${indent}${node.type}${node.value ? ` = ${JSON.stringify(node.value)}` : ''}`);
  
  if (node.named) {
    const namedKeys = Object.keys(node.named);
    if (namedKeys.length > 0) {
      console.log(`${indent}  NAMED:`);
      namedKeys.forEach(key => {
        const val = node.named[key];
        if (val && typeof val === 'object' && val.type) {
          console.log(`${indent}    ${key}:`);
          printNode(val, depth + 3, maxDepth);
        } else {
          console.log(`${indent}    ${key}: ${val}`);
        }
      });
    }
  }
  
  if (node.children && node.children.length > 0) {
    node.children.forEach((child, i) => {
      printNode(child, depth + 1, maxDepth);
    });
  }
}

/**
 * Analyze operation nodes to understand binary operation structure
 * @param {Object} node - Root node to search from
 * @returns {void}
 */
export function analyzeOperations(node) {
  const opNodes = findNodes(node, 'operation');
  console.log('Found operation nodes:', opNodes.length);
  
  opNodes.forEach((op, i) => {
    console.log(`\nOperation[${i}]:`);
    console.log('  type:', op.type);
    console.log('  named keys:', Object.keys(op.named || {}));
    
    if (op.named) {
      Object.entries(op.named).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          console.log(`    ${key}:`, {
            type: val.type,
            value: val.value,
          });
        } else {
          console.log(`    ${key}:`, val);
        }
      });
    }
    
    console.log('  children:', op.children?.map(c => c.type));
  });
}

/**
 * Analyze expression and access_or_operation structure
 * @param {Object} node - Root node to search from
 * @returns {void}
 */
export function analyzeExpressions(node) {
  const accessOrOps = findNodes(node, 'access_or_operation');
  console.log('Found access_or_operation nodes:', accessOrOps.length);
  
  accessOrOps.forEach((op, i) => {
    console.log(`\nAccess[${i}]:`);
    console.log('  children:', op.children?.map(c => c.type));
    
    if (op.children) {
      op.children.forEach((child, j) => {
        console.log(`    child[${j}]:`, child.type);
        if (child.type === 'operation') {
          console.log('      operation.named:', Object.keys(child.named || {}));
          console.log('      operation.children:', child.children?.map(c => c.type));
        }
      });
    }
  });
}

/**
 * Find and analyze return statements
 * @param {Object} node - Root node to search from
 * @returns {void}
 */
export function analyzeReturns(node) {
  function findReturns(n, results = []) {
    if (n.children && n.children[0]?.type === 'return') {
      results.push(n);
    }
    if (n.children) {
      n.children.forEach(child => findReturns(child, results));
    }
    if (n.named) {
      Object.values(n.named).forEach(child => {
        if (child && typeof child === 'object' && child.type) {
          findReturns(child, results);
        }
      });
    }
    return results;
  }

  const returns = findReturns(node);
  console.log('Found return statements:', returns.length);
  
  returns.forEach((ret, i) => {
    console.log(`\nReturn[${i}]:`);
    ret.children.forEach((child, j) => {
      console.log(`  child[${j}]:`, child.type);
      if (child.type === 'exp') {
        console.log('    exp.children:', child.children?.map(c => c.type));
        if (child.children && child.children.length > 1) {
          child.children.forEach((grandchild, k) => {
            console.log(`      [${k}]:`, grandchild.type);
          });
        }
      }
    });
  });
}

/**
 * Get detailed inference information for a node
 * @param {Object} node - Node to inspect
 * @returns {Object} Inference details
 */
export function getInferenceInfo(node) {
  return {
    type: node.type,
    value: node.value,
    hasInference: !!node.inference,
    inferenceLength: node.inference?.length || 0,
    inferenceTypes: node.inference?.map(t => t?.toString?.() || String(t)) || [],
    inferredType: node.inferredType?.toString?.() || null,
  };
}

/**
 * Recursively print inference information for a subtree
 * @param {Object} node - Root node
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum depth to traverse
 */
export function printInferenceTree(node, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return;
  
  const indent = '  '.repeat(depth);
  const info = getInferenceInfo(node);
  
  console.log(`${indent}${info.type}${info.value ? ` (${info.value})` : ''}`);
  if (info.hasInference) {
    console.log(`${indent}  inference[${info.inferenceLength}]:`, info.inferenceTypes.slice(0, 2).join(', '));
  }
  if (info.inferredType) {
    console.log(`${indent}  inferredType: ${info.inferredType}`);
  }
  
  if (node.children) {
    node.children.forEach(child => printInferenceTree(child, depth + 1, maxDepth));
  }
  if (node.named && depth < maxDepth) {
    Object.values(node.named).forEach(child => {
      if (child && typeof child === 'object' && child.type) {
        printInferenceTree(child, depth + 1, maxDepth);
      }
    });
  }
}
