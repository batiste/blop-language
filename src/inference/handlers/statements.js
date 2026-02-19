// ============================================================================
// Statement Handlers - Type inference for statements
// ============================================================================

import fs from 'fs';
import path from 'path';
import { resolveTypes, pushToParent, visitChildren, visit } from '../visitor.js';
import { parseTypeExpression, parseGenericParams, resolveTypeAlias, isTypeCompatible, getPropertyType, ArrayType, ObjectType } from '../typeSystem.js';
import { UndefinedType, StringType, NumberType, LiteralType, UnionType } from '../Type.js';
import { detectTypeofCheck, applyNarrowing, applyExclusion, detectImpossibleComparison } from '../typeGuards.js';
import { extractPropertyNodesFromAccess } from './utils.js';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import backend from '../../backend.js';
import { AnyType, AnyFunctionType } from '../Type.js';

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

/**
 * Widen literal types to their abstract base types
 * For LiteralType, returns baseType; for UnionType, widens each member
 */
function widenLiteralTypes(type) {
  if (type instanceof LiteralType) {
    return type.baseType;
  } else if (type instanceof UnionType) {
    const widenedTypes = type.types.map(t => widenLiteralTypes(t));
    // Avoid creating nested unions by flattening
    const flattened = [];
    for (const t of widenedTypes) {
      if (t instanceof UnionType) {
        flattened.push(...t.types);
      } else {
        flattened.push(t);
      }
    }
    return new UnionType(flattened);
  }
  return type;
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
          let returnType = UndefinedType;
          for (const child of node.children) {
            if (child.type === 'exp') {
              if (child.inference && child.inference.length > 0) {
                // Take the last inference value, which is the final result after all operations
                returnType = child.inference[child.inference.length - 1];
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
                  const aliasType = parseTypeExpression(result.typeAliases[name].typeNode);
                  typeAliases[name] = aliasType;
                }
              });
            } else if (node.named.name && !node.named.module) {
              // import User from './types.blop'
              const name = node.named.name.value;
              if (result.typeAliases[name] && result.typeAliases[name].typeNode) {
                const aliasType = parseTypeExpression(result.typeAliases[name].typeNode);
                typeAliases[name] = aliasType;
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
      const { pushInference, lookupVariable, typeAliases, pushWarning, stampTypeAnnotation } = getState();
      
      if (node.named.destructuring) {
        // Handle destructuring assignment: { total, text } = attributes
        visit(node.named.exp, node);
        const expNode = node.named.exp;
        const valueType = expNode && expNode.inference && expNode.inference[0];
        
        if (valueType && valueType !== AnyType) {
          const resolvedValueType = resolveTypeAlias(valueType, typeAliases);
          
          // Extract destructured variable names and stamp them with property types
          if (resolvedValueType instanceof ObjectType) {
            const destNode = node.named.destructuring.named.values;
            
            // Extract all destructured names with their corresponding properties
            // Returns array of {propertyName, varName, node}
            function extractBindings(n) {
              const bindings = [];
              
              if (n.type === 'destructuring_values') {
                // Destructuring value with possible rename or simple name
                if (n.named.name && n.named.rename) {
                  // Renamed: x as xPos
                  bindings.push({
                    propertyName: n.named.name.value,
                    varName: n.named.rename.value,
                    node: n.named.rename
                  });
                } else if (n.named.name) {
                  // Simple name in destructuring_values
                  bindings.push({
                    propertyName: n.named.name.value,
                    varName: n.named.name.value,
                    node: n.named.name
                  });
                }
                // Recurse for nested destructuring through 'more' property or children
                if (n.named.more) {
                  bindings.push(...extractBindings(n.named.more));
                } else if (n.children) {
                  // Find nested destructuring_values in children
                  for (const child of n.children) {
                    if (child.type === 'destructuring_values') {
                      bindings.push(...extractBindings(child));
                    }
                  }
                }
              } else if (n.children) {
                // For other container nodes, recurse through children
                for (const child of n.children) {
                  if (child.type === 'destructuring_values') {
                    bindings.push(...extractBindings(child));
                  }
                }
              }
              
              return bindings;
            }
            
            const bindings = extractBindings(destNode);
            
            for (const {propertyName, varName, node} of bindings) {
              // For destructuring, get the raw property type WITHOUT removing undefined
              // (which getPropertyType does for regular property access)
              let propertyType = null;
              
              if (resolvedValueType instanceof ObjectType) {
                const prop = resolvedValueType.properties.get(propertyName);
                if (prop) {
                  propertyType = prop.type;
                  // For optional properties, include undefined in the union
                  if (prop.optional && propertyType) {
                    propertyType = new UnionType([propertyType, UndefinedType]);
                  }
                }
              } else {
                // Fall back to getPropertyType for other types
                propertyType = getPropertyType(valueType, propertyName, typeAliases);
              }
              
              if (propertyType !== null) {
                // Widen literal types to their abstract base types
                const widenedType = widenLiteralTypes(propertyType);
                node.inferredType = widenedType;
              } else {
                pushWarning(
                  destNode,
                  `Property '${propertyName}' does not exist on type ${valueType}`
                );
              }
            }
          }
        }
        
        pushToParent(node, parent);
        pushInference(parent, node);
      } else if (node.named.name || node.named.path) {
        if (node.named.annotation) {
          // Stamp the type annotation for hover support
          stampTypeAnnotation(node.named.annotation);
        }
        
        visit(node.named.exp, node);
        
        // Check if this is a property assignment (e.g., u.name = 1 or u.user.name = "x")
        if (node.named.path && node.named.access) {
          // Property assignment - extract the full property chain
          const objectName = node.named.path.value;
          const accessNode = node.named.access;
          
          // Extract all property names from the access chain (handles nested like user.userType)
          const propertyNodes = extractPropertyNodesFromAccess(accessNode);
          const propertyChain = propertyNodes.map(prop => prop.name);
          
          if (objectName && propertyChain.length > 0) {
            // Get the type of the value being assigned
            const expNode = node.named.exp;
            const valueType = expNode && expNode.inference && expNode.inference[0];
            
            if (valueType && valueType !== AnyType) {
              // Look up the object's type
              const objectDef = lookupVariable(objectName);
              if (objectDef && objectDef.type) {
                // Stamp property name nodes with their resolved types for hover support
                let currentType = objectDef.type;
                for (const prop of propertyNodes) {
                  const nextType = getPropertyType(currentType, prop.name, typeAliases);
                  if (!nextType) {
                    break;
                  }
                  prop.node.inferredType = resolveTypeAlias(nextType, typeAliases);
                  currentType = nextType;
                }

                // Use getPropertyType to validate and get the final property type
                const expectedType = getPropertyType(objectDef.type, propertyChain, typeAliases);
                
                if (expectedType === null) {
                  // Property doesn't exist
                  const fullPropertyPath = propertyChain.join('.');
                  pushWarning(
                    node,
                    `Property '${fullPropertyPath}' does not exist on type ${objectDef.type}`
                  );
                } else {
                  // Property exists, check type compatibility
                  const resolvedExpectedType = resolveTypeAlias(expectedType, typeAliases);
                  
                  if (!isTypeCompatible(valueType, resolvedExpectedType, typeAliases)) {
                    const fullPropertyPath = propertyChain.join('.');
                    pushWarning(
                      node,
                      `Cannot assign ${valueType} to property '${fullPropertyPath}' of type ${expectedType}`
                    );
                  }
                }
              }
            }
          }
        }
        
        pushToParent(node, parent);
        pushInference(parent, node);
      }
    },
    
    condition: (node, parent) => {
      const { pushScope, popScope, lookupVariable, getFunctionScope, pushWarning, typeAliases } = getState();
      const functionScope = getFunctionScope();
      
      // Check for impossible comparisons
      const impossibleComparison = detectImpossibleComparison(node.named.exp, lookupVariable, typeAliases);
      if (impossibleComparison) {
        const { variable, comparedValue, possibleValues } = impossibleComparison;
        pushWarning(
          node.named.exp,
          `This condition will always be false: '${variable}' has type ${possibleValues.join(' | ')} and can never equal ${comparedValue}`
        );
      }
      
      const typeGuard = detectTypeofCheck(node.named.exp);
      const returnsBeforeIf = functionScope?.__returnTypes?.length || 0;
      
      // Visit condition expression
      if (node.named.exp) {
        visit(node.named.exp, node);
      }
      
      // Visit if branch (with type-narrowing scope when a type guard is present)
      if (typeGuard) {
        const ifScope = pushScope();
        applyNarrowing(ifScope, typeGuard.variable, typeGuard.checkType, lookupVariable);
        node.named.stats?.forEach(stat => visit(stat, node));
        popScope();
      } else {
        node.named.stats?.forEach(stat => visit(stat, node));
      }
      
      const returnsAfterIf = functionScope?.__returnTypes?.length || 0;
      
      // Handle else/elseif branch
      const elseNode = node.named.elseif;
      const isSimpleElse = elseNode && !elseNode.named?.exp && elseNode.named?.stats?.length > 0;
      
      if (isSimpleElse) {
        const returnsBeforeElse = functionScope?.__returnTypes?.length || 0;
        
        if (typeGuard) {
          const elseScope = pushScope();
          applyExclusion(elseScope, typeGuard.variable, typeGuard.checkType, lookupVariable);
          elseNode.named.stats.forEach(stat => visit(stat, node));
          popScope();
        } else {
          visit(elseNode, node);
        }
        
        const returnsAfterElse = functionScope?.__returnTypes?.length || 0;
        
        // If not all branches return, the if/else may complete without returning
        const ifBranchReturns = returnsAfterIf > returnsBeforeIf;
        const elseBranchReturns = returnsAfterElse > returnsBeforeElse;
        if (functionScope && (!ifBranchReturns || !elseBranchReturns)) {
          if (!functionScope.__returnTypes.includes(UndefinedType)) {
            functionScope.__returnTypes.push(UndefinedType);
          }
        }
      } else if (elseNode) {
        // Chained elseif or empty else — visit without return tracking
        visit(elseNode, node);
      }
      
      pushToParent(node, parent);
    },
    
    for_loop: (node, parent) => {
      const { pushScope, popScope, pushWarning, typeAliases } = getState();
      const scope = pushScope();
      
      // Get variable names
      const key = (node.named.key && node.named.key.value) || null;
      const value = node.named.value ? node.named.value.value : null;
      
      // Check for 'of' keyword (array iteration mode)
      const isArray = !!(node.named.of)
      
      // Key type: number with :array, string without (Object.keys returns strings)
      const keyType = isArray ? NumberType : StringType;
      
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
          const resolvedExpType = resolveTypeAlias(expType, typeAliases);
          const isArrayType = resolvedExpType instanceof ArrayType;
          
          if (isArrayType) {
            pushWarning(
              node.named.exp,
              `Iterating array without 'of' keyword - variable '${key}' will be string ("0", "1", ...) instead of number. Add 'of' after the expression to fix this.`
            );
          }
        }
      }
      
      // Infer value type if possible
      if (value && node.named.exp && node.named.exp.inference) {
        const expType = node.named.exp.inference[0];
        let valueType = AnyType;
        
        const resolvedExpType = resolveTypeAlias(expType, typeAliases);
        if (resolvedExpType instanceof ArrayType) {
          valueType = resolvedExpType.elementType;
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
