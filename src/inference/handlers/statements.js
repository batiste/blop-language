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
      const { pushScope, popScope, lookupVariable, getFunctionScope } = getState();
      
      const functionScope = getFunctionScope();
      const debug = functionScope && JSON.stringify(functionScope).includes('acceptsNull');
      
      // Check if this is a typeof check that enables type narrowing
      const typeGuard = detectTypeofCheck(node.named.exp);
      
      if (debug) {
        console.log('[DEBUG acceptsNull condition] typeGuard:', typeGuard ? 'YES' : 'NO', 'has elseif:', !!node.named.elseif);
      }
      
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
        
        // Handle else/elseif branches
        if (node.named.elseif) {
          const elseifNode = node.named.elseif;
          const returnsBeforeElse = functionScope?.__returnTypes?.length || 0;
          
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
          
          const returnsAfterElse = functionScope?.__returnTypes?.length || 0;
          
          // If we have if/else but not all branches added returns, some path falls through
          const ifBranchReturns = returnsAfterIf > returnsBeforeIf;
          const elseBranchReturns = returnsAfterElse > returnsBeforeElse;
          
          if (functionScope && (!ifBranchReturns || !elseBranchReturns)) {
            if (!functionScope.__returnTypes.includes('undefined')) {
              functionScope.__returnTypes.push('undefined');
            }
          }
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
        
        // Visit else branch if it exists
        if (node.named.elseif) {
          const returnsBeforeElse = functionScope?.__returnTypes?.length || 0;
          
          // Debug for acceptsNull
          const debug = functionScope && JSON.stringify(functionScope).includes('acceptsNull');
          if (debug) {
            console.log('[DEBUG acceptsNull] Has else, returnsBeforeElse:', returnsBeforeElse, 'ifBranchReturns:', ifBranchReturns);
            console.log('[DEBUG acceptsNull] elseif type:', node.named.elseif.type);
            console.log('[DEBUG acceptsNull] elseif has exp?', !!node.named.elseif.named?.exp);
            console.log('[DEBUG acceptsNull] elseif has stats?', !!node.named.elseif.named?.stats);
          }
          
          visit(node.named.elseif, node);
          const returnsAfterElse = functionScope?.__returnTypes?.length || 0;
          const elseBranchReturns = returnsAfterElse > returnsBeforeElse;
          
          if (debug) {
            console.log('[DEBUG acceptsNull] returnsAfterElse:', returnsAfterElse, 'elseBranchReturns:', elseBranchReturns);
            console.log('[DEBUG acceptsNull] Will add undefined?', !ifBranchReturns || !elseBranchReturns);
          }
          
          // If we have if/else but not all branches return, add undefined
          if (functionScope && (!ifBranchReturns || !elseBranchReturns)) {
            if (!functionScope.__returnTypes.includes('undefined')) {
              if (debug) console.log('[DEBUG acceptsNull] Adding undefined!');
              functionScope.__returnTypes.push('undefined');
            }
          }
        }
      }
      
      pushToParent(node, parent);
    },
  };
}

module.exports = createStatementHandlers;
