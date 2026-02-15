// ============================================================================
// Statement Handlers - Type inference for statements
// ============================================================================

const { resolveTypes, pushToParent, visitChildren, visit } = require('../visitor');
const { getAnnotationType, parseTypeExpression } = require('../typeSystem');
const { detectTypeofCheck, applyNarrowing, applyExclusion } = require('../typeGuards');

function createStatementHandlers(getState) {
  return {
    GLOBAL_STATEMENT: resolveTypes,
    SCOPED_STATEMENTS: resolveTypes,
    
    SCOPED_STATEMENT: (node, parent) => {
      const { getFunctionScope } = getState();
      
      // Check if this is a return statement by looking at the first child
      if (node.children && node.children[0] && node.children[0].type === 'return') {
        const functionScope = getFunctionScope();
        if (functionScope && functionScope.__returnTypes) {
          // Visit children to get type inference on expressions
          visitChildren(node);
          
          // Find the exp child and get its type
          let returnType = 'undefined';
          for (const child of node.children) {
            if (child.type === 'exp') {
              if (child.inference && child.inference.length > 0) {
                returnType = child.inference[0];
              }
              break;
            }
          }
          
          functionScope.__returnTypes.push(returnType);
          pushToParent(node, parent);
          return;
        }
      }
      
      // Not a return statement, handle normally
      resolveTypes(node);
      pushToParent(node, parent);
    },
    
    type_alias: (node, parent) => {
      const { typeAliases } = getState();
      
      // Extract the alias name and its type
      const aliasName = node.named.name.value;
      const aliasType = parseTypeExpression(node.named.type);
      
      // Store the type alias
      typeAliases[aliasName] = aliasType;
      
      // Type aliases don't produce values, so don't push to parent
    },
    
    assign: (node, parent) => {
      const { pushInference } = getState();
      
      if (node.named.name) {
        visit(node.named.exp, node);
        pushToParent(node, parent);
        pushInference(parent, node);
      }
    },
    
    condition: (node, parent) => {
      const { pushScope, popScope, lookupVariable } = getState();
      
      // Check if this is a typeof check that enables type narrowing
      const typeGuard = detectTypeofCheck(node.named.exp);
      
      if (typeGuard) {
        // Process expression first
        visit(node.named.exp, node);
        
        // Create a new scope for the if branch with narrowed type
        const ifScope = pushScope();
        applyNarrowing(ifScope, typeGuard.variable, typeGuard.checkType, lookupVariable);
        
        // Visit if branch statements
        if (node.named.stats) {
          node.named.stats.forEach(stat => visit(stat, node));
        }
        popScope();
        
        // Handle else/elseif branches
        if (node.named.elseif) {
          const elseifNode = node.named.elseif;
          
          // Check if it's an else branch (no exp) or elseif
          if (elseifNode.named && elseifNode.named.exp) {
            // It's an elseif - process normally
            visit(elseifNode, node);
          } else {
            // It's an else branch - narrow to excluded types
            const elseScope = pushScope();
            applyExclusion(elseScope, typeGuard.variable, typeGuard.checkType, lookupVariable);
            
            if (elseifNode.named && elseifNode.named.stats) {
              elseifNode.named.stats.forEach(stat => visit(stat, node));
            }
            popScope();
          }
        }
      } else {
        // No type narrowing, process normally
        visitChildren(node);
      }
      
      pushToParent(node, parent);
    },
  };
}

module.exports = createStatementHandlers;
