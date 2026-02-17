// ============================================================================
// Statement Handlers - Type inference for statements
// ============================================================================

import fs from 'fs';
import path from 'path';
import { resolveTypes, pushToParent, visitChildren, visit } from '../visitor.js';
import { getAnnotationType, parseTypeExpression, parseGenericParams } from '../typeSystem.js';
import { detectTypeofCheck, applyNarrowing, applyExclusion } from '../typeGuards.js';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import backend from '../../backend.js';

/**
 * Extract import names from destructuring_values node
 * @param {Object} node - destructuring_values AST node  
 * @returns {Array<string>} Array of imported names
 */
function extractImportNames(node) {
  const names = [];
  
  function traverse(n) {
    if (!n) return;
    
    if (n.type === 'destructuring_values') {
      if (n.named.name) {
        names.push(n.named.name.value);
      }
      if (n.named.more) {
        traverse(n.named.more);
      }
    }
  }
  
  traverse(node);
  return names;
}

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

    import_statement: (node) => {
      const { typeAliases, currentFilename } = getState();
      
      // If we don't have a filename context, we can't resolve imports
      if (!currentFilename) {
        return;
      }
      
      // Extract the file being imported
      const fileNode = node.named.file || node.named.module;
      if (!fileNode) {
        return;
      }
      
      const importPath = fileNode.value.slice(1, -1); // Remove quotes
      
      // Only process .blop file imports (skip node_modules, etc.)
      if (!importPath.startsWith('.')) {
        return;
      }
      
      try {
        // Resolve the import path relative to current file
        const resolvedPath = path.resolve(path.dirname(currentFilename), importPath);
        
        // Check if it's a .blop file
        if (!resolvedPath.endsWith('.blop')) {
          return;
        }
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
          return;
        }
        
        // Load and parse the imported file to extract its type definitions
        const importedSource = fs.readFileSync(resolvedPath, 'utf8');
        
        const tokenStream = parser.tokenize(tokensDefinition, importedSource);
        const tree = parser.parse(tokenStream);
        
        if (tree.success) {
          // Generate backend to extract type definitions
          const result = backend.generateCode(tree, tokenStream, importedSource, resolvedPath);
          
          if (result.typeAliases) {
            // Check what's being imported
            if (node.named.dest_values) {
              // import { User, Post } from './types.blop'
              // Only import specific types
              const importNames = extractImportNames(node.named.dest_values);
              importNames.forEach(name => {
                if (result.typeAliases[name] && result.typeAliases[name].typeNode) {
                  // Parse the type definition for use in inference
                  const typeString = parseTypeExpression(result.typeAliases[name].typeNode);
                  typeAliases[name] = typeString;
                }
              });
            } else if (node.named.name && !node.named.module) {
              // import User from './types.blop'
              const name = node.named.name.value;
              if (result.typeAliases[name] && result.typeAliases[name].typeNode) {
                const typeString = parseTypeExpression(result.typeAliases[name].typeNode);
                typeAliases[name] = typeString;
              }
            } else {
              // import './types.blop' - import all types
              // or import './types.blop' as types - can't use types directly
              // For now, skip these cases
            }
          }
        }
      } catch (error) {
        // Silently ignore errors in import resolution for inference
        // The backend will report actual import errors
      }
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
    
    for_loop: (node, parent) => {
      const { pushScope, popScope, pushWarning } = getState();
      const scope = pushScope();
      
      // Get variable names
      const key = (node.named.key && node.named.key.value) || null;
      const value = node.named.value ? node.named.value.value : null;
      
      // Check for :array annotation
      const objAnnotationType = node.named.objectannotation 
        ? getAnnotationType(node.named.objectannotation) 
        : null;
      const isArray = objAnnotationType === 'array';
      
      // Key type: number with :array, string without (Object.keys returns strings)
      const keyType = isArray ? 'number' : 'string';
      
      // Add variables to scope with their types
      if (key) {
        scope[key] = { type: keyType, node: node.named.key };
      }
      
      // Visit the expression being iterated
      if (node.named.exp) {
        visit(node.named.exp, node);
        
        // Check if we're iterating an array without :array annotation
        const expType = node.named.exp.inference?.[0];
        if (expType && key && !isArray) {
          // Check if expression type looks like an array
          const isArrayType = expType.endsWith('[]') || 
                             expType === 'array' || 
                             expType.startsWith('Array<');
          
          if (isArrayType) {
            pushWarning(
              node.named.exp,
              `Iterating array without ':array' annotation - variable '${key}' will be string ("0", "1", ...) instead of number. Add ': array' after the expression to fix this.`
            );
          }
        }
      }
      
      // Infer value type if possible
      if (value && node.named.exp && node.named.exp.inference) {
        const expType = node.named.exp.inference[0];
        let valueType = 'any';
        
        // Try to infer element type from array type
        if (expType) {
          if (expType.endsWith('[]')) {
            // Extract element type: string[] -> string
            valueType = expType.slice(0, -2);
          } else if (expType.startsWith('Array<') && expType.endsWith('>')) {
            // Extract element type: Array<number> -> number
            valueType = expType.slice(6, -1);
          }
        }
        
        scope[value] = { type: valueType, node: node.named.value };
      }
      
      // Visit loop body statements
      if (node.named.stats) {
        node.named.stats.forEach(stat => visit(stat, node));
      }
      
      popScope();
      pushToParent(node, parent);
    },
  };
}

export default createStatementHandlers;
