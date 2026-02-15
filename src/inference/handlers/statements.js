// ============================================================================
// Statement Handlers - Type inference for statements
// ============================================================================

const { resolveTypes, pushToParent, visitChildren, visit } = require('../visitor');
const { getAnnotationType, parseTypeExpression, parseGenericParams } = require('../typeSystem');
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
      
      // Parse generic parameters if present
      const genericParams = node.named.generic_params 
        ? parseGenericParams(node.named.generic_params)
        : [];
      
      // Store the type alias
      if (genericParams.length > 0) {
        // Store as generic type alias with parameters
        typeAliases[aliasName] = {
          type: aliasType,
          genericParams,
        };
      } else {
        // Store as regular type alias (maintain backward compatibility)
        typeAliases[aliasName] = aliasType;
      }
      
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
      const { pushScope, popScope, lookupVariable, getFunctionScope } = getState();
      
      const functionScope = getFunctionScope();
      
      // Check if this is a typeof check that enables type narrowing
      const typeGuard = detectTypeofCheck(node.named.exp);
      
      if (typeGuard) {
        // Process expression first
        visit(node.named.exp, node);
        
        const functionScope = getFunctionScope();
        const returnsBeforeIf = functionScope?.__returnTypes?.length || 0;
        
        // Create a new scope for the if branch with narrowed type
        const ifScope = pushScope();
        applyNarrowing(ifScope, typeGuard.variable, typeGuard.checkType, lookupVariable);
        
        // Visit if branch statements
        if (node.named.stats) {
          node.named.stats.forEach(stat => visit(stat, node));
        }
        popScope();
        
        const returnsAfterIf = functionScope?.__returnTypes?.length || 0;
        
        // Handle else/elseif branches - only process simple else (no exp), not elseif chains
        const elseNode = node.named.elseif;
        if (elseNode && !elseNode.named?.exp && elseNode.named?.stats && elseNode.named.stats.length > 0) {
          // This is a simple else branch (not elseif)
          const returnsBeforeElse = functionScope?.__returnTypes?.length || 0;
          const elseScope = pushScope();
          applyExclusion(elseScope, typeGuard.variable, typeGuard.checkType, lookupVariable);
          
          if (elseNode.named && elseNode.named.stats) {
            elseNode.named.stats.forEach(stat => visit(stat, node));
          }
          popScope();
          
          const returnsAfterElse = functionScope?.__returnTypes?.length || 0;
          
          // If we have simple if/else but not all branches return, add undefined
          const ifBranchReturns = returnsAfterIf > returnsBeforeIf;
          const elseBranchReturns = returnsAfterElse > returnsBeforeElse;
          
          if (functionScope && (!ifBranchReturns || !elseBranchReturns)) {
            if (!functionScope.__returnTypes.includes('undefined')) {
              functionScope.__returnTypes.push('undefined');
            }
          }
        } else if (elseNode) {
          // This is an elseif or empty else, just visit normally without return tracking
          visit(elseNode, node);
        }
      } else {
        // No type narrowing, but still track returns for if/else
        const functionScope = getFunctionScope();
        const returnsBeforeIf = functionScope?.__returnTypes?.length || 0;
        
        // Visit condition expression
        if (node.named.exp) {
          visit(node.named.exp, node);
        }
        
        // Visit if branch
        if (node.named.stats) {
          node.named.stats.forEach(stat => visit(stat, node));
        }
        
        const returnsAfterIf = functionScope?.__returnTypes?.length || 0;
        const ifBranchReturns = returnsAfterIf > returnsBeforeIf;
        
        // Visit else branch only if it's a simple else (no exp) with content
        const elseNode = node.named.elseif;
        if (elseNode && !elseNode.named?.exp && elseNode.named?.stats && elseNode.named.stats.length > 0) {
          // This is a simple else branch (not elseif)
          const returnsBeforeElse = functionScope?.__returnTypes?.length || 0;
          visit(elseNode, node);
          const returnsAfterElse = functionScope?.__returnTypes?.length || 0;
          const elseBranchReturns = returnsAfterElse > returnsBeforeElse;
          
          // If we have simple if/else but not all branches return, add undefined
          if (functionScope && (!ifBranchReturns || !elseBranchReturns)) {
            if (!functionScope.__returnTypes.includes('undefined')) {
              functionScope.__returnTypes.push('undefined');
            }
          }
        } else if (elseNode) {
          // This is an elseif or empty else, just visit normally
          visit(elseNode, node);
        }
      }
      
      pushToParent(node, parent);
    },
  };
}

module.exports = createStatementHandlers;
