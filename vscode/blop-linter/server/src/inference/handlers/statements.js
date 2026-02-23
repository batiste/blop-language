// ============================================================================
// Statement Handlers - Type inference for statements
// ============================================================================

import fs from 'fs';
import path from 'path';
import { resolveTypes, pushToParent, visitChildren, visit } from '../visitor.js';
import { parseTypeExpression, parseGenericParams, resolveTypeAlias, isTypeCompatible, getPropertyType, getAnnotationType, ArrayType, ObjectType, getBaseTypeOfLiteral } from '../typeSystem.js';
import { UndefinedType, StringType, NumberType, LiteralType, UnionType } from '../Type.js';
import { detectTypeofCheck, detectEqualityCheck, detectTruthinessCheck, applyIfBranchGuard, applyElseBranchGuard, applyPostIfGuard, detectImpossibleComparison } from '../typeGuards.js';
import { extractPropertyNodesFromAccess } from './utils.js';
import TypeChecker from '../typeChecker.js';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import backend from '../../backend.js';
import { AnyType, AnyFunctionType, FunctionType } from '../Type.js';
import { runBindingPhase } from '../symbolTable.js';

/**
 * Extract import name nodes from destructuring_values node
 * @param {Object} node - destructuring_values AST node
 * @returns {Array<{name: string, node: Object}>} Array of {name, node} pairs
 */
function extractImportNameNodes(node) {
  const entries = [];

  function traverse(n) {
    if (!n) return;

    if (n.type === 'destructuring_values') {
      if (n.named.name) {
        entries.push({ name: n.named.name.value, node: n.named.name });
      }
      if (n.named.more) {
        traverse(n.named.more);
      }
    }
  }

  traverse(node);
  return entries;
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

/**
 * Extract destructuring bindings recursively from destructuring_values node
 * Returns array of {propertyName, varName, node}
 */
function extractDestructuringBindings(node) {
  const bindings = [];
  
  if (node.type === 'destructuring_values') {
    // Destructuring value with possible rename or simple name
    if (node.named.name && node.named.rename) {
      // Renamed: x as xPos
      bindings.push({
        propertyName: node.named.name.value,
        varName: node.named.rename.value,
        node: node.named.rename
      });
    } else if (node.named.name) {
      // Simple name in destructuring_values
      bindings.push({
        propertyName: node.named.name.value,
        varName: node.named.name.value,
        node: node.named.name
      });
    }
    // Recurse for nested destructuring through 'more' property or children
    if (node.named.more) {
      bindings.push(...extractDestructuringBindings(node.named.more));
    } else if (node.children) {
      // Find nested destructuring_values in children
      for (const child of node.children) {
        if (child.type === 'destructuring_values') {
          bindings.push(...extractDestructuringBindings(child));
        }
      }
    }
  } else if (node.children) {
    // For other container nodes, recurse through children
    for (const child of node.children) {
      if (child.type === 'destructuring_values') {
        bindings.push(...extractDestructuringBindings(child));
      }
    }
  }
  
  return bindings;
}

/**
 * Get the current return type count for a function scope
 */
function getReturnTypeCount(functionScope) {
  return functionScope?.__returnTypes?.length || 0;
}

function createStatementHandlers(getState) {
  return {
    GLOBAL_STATEMENT: resolveTypes,
    SCOPED_STATEMENTS: resolveTypes,
    
    SCOPED_STATEMENT: (node, parent) => {
      const { getFunctionScope, pushWarning, typeAliases, inferencePhase } = getState();
      
      // Check if this is a return statement by looking at the first child
      if (node.children && node.children[0] && node.children[0].type === 'return') {
        const functionScope = getFunctionScope();
        if (functionScope && functionScope.__returnTypes) {
          // Visit children to get type inference on expressions
          visitChildren(node);
          
          // Find the exp child and get its type
          let returnType = UndefinedType;
          let returnExpNode = null;
          for (const child of node.children) {
            if (child.type === 'exp') {
              returnExpNode = child;
              if (child.inference && child.inference.length > 0) {
                // Take the last inference value, which is the final result after all operations
                returnType = child.inference[child.inference.length - 1];
              }
              break;
            }
          }

          // Validate each return expression against the declared return type.
          // Doing this per-statement avoids the problem where any-typed returns
          // contaminate the end-of-function union check.
          // Only check when the exp resolves to a single type: multi-item arrays
          // indicate unresolved inline string interpolation whose final type can't
          // be reliably inferred from the last element alone.
          if (inferencePhase === 'checking' && returnExpNode) {
            const declaredReturnType = functionScope.__declaredReturnType;
            const singleType = returnExpNode.inference?.length === 1 ? returnType : null;
            if (declaredReturnType && singleType && singleType !== AnyType) {
              if (!isTypeCompatible(singleType, declaredReturnType, typeAliases)) {
                const displayType = getBaseTypeOfLiteral(singleType);
                pushWarning(
                  returnExpNode,
                  `returns ${displayType} but declared as ${declaredReturnType}`
                );
              }
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
          
          // Run binding phase on imported tree to get function definitions
          const importedSymbolTable = runBindingPhase(tree);
          const importedSymbols = importedSymbolTable.getAllSymbols();
          const importedFunctions = importedSymbols.functions;
          const importedClasses = importedSymbolTable.getClasses();

          if (result.typeAliases) {
            // Check what's being imported
            if (node.named.dest_values) {
              // import { User, Post } from './types.blop'
              // Only import specific types
              const importNameNodes = extractImportNameNodes(node.named.dest_values);
              const { getCurrentScope, inferencePhase } = getState();
              const scope = getCurrentScope();
              importNameNodes.forEach(({ name, node: nameNode }) => {
                if (result.typeAliases[name] && result.typeAliases[name].typeNode) {
                  // Parse the type definition for use in inference
                  const aliasType = parseTypeExpression(result.typeAliases[name].typeNode);
                  typeAliases[name] = aliasType;
                  if (inferencePhase === 'inference' && nameNode.inferredType === undefined) {
                    nameNode.inferredType = aliasType;
                  }
                } else if (importedFunctions[name]) {
                  // Register imported function in current scope for hover + lookupVariable
                  const def = importedFunctions[name];
                  scope[name] = def;
                  if (inferencePhase === 'inference' && nameNode.inferredType === undefined) {
                    nameNode.inferredType = def.params
                      ? new FunctionType(def.params, def.type ?? AnyType, def.genericParams ?? [], def.paramNames ?? [])
                      : AnyFunctionType;
                  }
                } else if (importedClasses[name]) {
                  // Register imported class in current scope
                  const def = importedClasses[name];
                  scope[name] = def;
                  if (inferencePhase === 'inference' && nameNode.inferredType === undefined) {
                    nameNode.inferredType = def.type;
                  }
                }
              });
            } else if (node.named.name && !node.named.module) {
              // import User from './types.blop'
              const name = node.named.name.value;
              const nameNode = node.named.name;
              const { inferencePhase } = getState();
              if (result.typeAliases[name] && result.typeAliases[name].typeNode) {
                const aliasType = parseTypeExpression(result.typeAliases[name].typeNode);
                typeAliases[name] = aliasType;
                if (inferencePhase === 'inference' && nameNode.inferredType === undefined) {
                  nameNode.inferredType = aliasType;
                }
              } else if (importedFunctions[name]) {
                const def = importedFunctions[name];
                const { getCurrentScope } = getState();
                getCurrentScope()[name] = def;
                if (inferencePhase === 'inference' && nameNode.inferredType === undefined) {
                  nameNode.inferredType = def.params
                    ? new FunctionType(def.params, def.type ?? AnyType, def.genericParams ?? [], def.paramNames ?? [])
                    : AnyFunctionType;
                }
              } else if (importedClasses[name]) {
                const def = importedClasses[name];
                const { getCurrentScope } = getState();
                getCurrentScope()[name] = def;
                if (inferencePhase === 'inference' && nameNode.inferredType === undefined) {
                  nameNode.inferredType = def.type;
                }
              }
            } else {
              // import './types.blop' - import all types
              // or import './types.blop' as types - can't use types directly
              // For now, skip these cases
            }

            // Always merge all type aliases from the imported file into the
            // current file's typeAliases so that signatures of imported
            // functions/classes that reference them (e.g. Route in add(route: Route))
            // can be fully resolved in the consuming file.
            const importedTypeAliases = importedSymbolTable.getAllSymbols().typeAliases;
            for (const [aliasName, aliasValue] of Object.entries(importedTypeAliases)) {
              if (!typeAliases[aliasName]) {
                typeAliases[aliasName] = aliasValue;
              }
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
        // The type may be on expNode.inference (when visited via resolveTypes) OR
        // on node.inference (when the exp is a name_exp visited directly as a child,
        // which pushes its result to the parent statement node).
        const valueType = expNode?.inference?.[0] || node.inference?.[0];
        
        if (valueType && valueType !== AnyType) {
          const resolvedValueType = resolveTypeAlias(valueType, typeAliases);
          
          // Extract destructured variable names and stamp them with property types
          if (resolvedValueType instanceof ObjectType) {
            const destNode = node.named.destructuring.named.values;
            const bindings = extractDestructuringBindings(destNode);
            
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

                // For class instances, check if the property is explicitly declared.
                // If it is, validate the assignment; otherwise, allow it (constructor-assigned).
                const resolvedObjType = resolveTypeAlias(objectDef.type, typeAliases);
                const shouldSkipValidation = 
                  resolvedObjType.isClassInstance && 
                  propertyChain.length > 0 &&
                  !resolvedObjType.properties.has(propertyChain[0]);
                
                if (!shouldSkipValidation) {
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
        } else if (node.named.name && !node.named.path) {
          // Simple variable assignment: stamp the variable name  
          // At definition site, prefer declared annotation type over inferred type
          if (node.named.annotation && node.named.name.inferredType === undefined) {
            const annotationType = getAnnotationType(node.named.annotation);
            if (annotationType) {
              node.named.name.inferredType = annotationType;
            }
          } else {
            // No annotation, use inferred type from the expression
            const expNode = node.named.exp;
            const valueType = expNode && expNode.inference && expNode.inference[0];
            
            if (valueType && valueType !== AnyType && node.named.name.inferredType === undefined) {
              node.named.name.inferredType = resolveTypeAlias(valueType, typeAliases);
            }
          }
        }
        
        pushToParent(node, parent);
        pushInference(parent, node);
      }
    },
    
    condition: (node, parent) => {
      const { pushScope, popScope, lookupVariable, getCurrentScope, getFunctionScope, pushWarning, typeAliases } = getState();
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
      
      const typeGuard = detectTypeofCheck(node.named.exp) || detectEqualityCheck(node.named.exp) || detectTruthinessCheck(node.named.exp);
      const returnsBeforeIf = getReturnTypeCount(functionScope);
      
      // Visit condition expression
      if (node.named.exp) {
        visit(node.named.exp, node);
      }
      
      // Visit if branch (with type-narrowing scope when a type guard is present)
      if (typeGuard) {
        const ifScope = pushScope();
        applyIfBranchGuard(ifScope, typeGuard, lookupVariable);
        node.named.stats?.forEach(stat => visit(stat, node));
        popScope();
      } else {
        node.named.stats?.forEach(stat => visit(stat, node));
      }

      const returnsAfterIf = getReturnTypeCount(functionScope);

      // Visit else/elseif branch with type narrowing
      const elseNode = node.named.elseif;
      const isSimpleElse = elseNode && !elseNode.named?.exp && elseNode.named?.stats?.length > 0;

      if (isSimpleElse) {
        if (typeGuard) {
          const elseScope = pushScope();
          applyElseBranchGuard(elseScope, typeGuard, lookupVariable);
          elseNode.named.stats.forEach(stat => visit(stat, node));
          popScope();
        } else {
          visit(elseNode, node);
        }
      } else if (elseNode) {
        if (typeGuard) {
          const elseifScope = pushScope();
          applyElseBranchGuard(elseifScope, typeGuard, lookupVariable);
          visit(elseNode, node);
          popScope();
        } else {
          visit(elseNode, node);
        }
      }
      
      // When the if-branch is an early-exit type guard (always returns) with no else,
      // the code after this block is only reachable when the condition was false.
      // Apply type exclusion to the outer scope so subsequent statements see the narrowed type.
      // Note: the parser always creates an else_if node (matched with empty rule ['w?']) even
      // when there is no actual else clause, so we must check for meaningful else content.
      const ifBranchAlwaysReturns = returnsAfterIf > returnsBeforeIf;
      const elseHasContent = elseNode && (
        elseNode.named?.exp ||
        (elseNode.named?.stats && elseNode.named.stats.length > 0) ||
        elseNode.named?.elseif
      );
      if (typeGuard && !elseHasContent && ifBranchAlwaysReturns) {
        applyPostIfGuard(getCurrentScope(), typeGuard, lookupVariable);
      }
      
      pushToParent(node, parent);
    },

    else_if: (node, parent) => {
      const { pushScope, popScope, lookupVariable } = getState();

      // Simple else branch: no condition, just visit body
      if (!node.named?.exp) {
        node.named?.stats?.forEach(stat => visit(stat, node));
        if (node.named?.elseif) {
          visit(node.named.elseif, node);
        }
        pushToParent(node, parent);
        return;
      }

      // Visit the elseif condition expression
      visit(node.named.exp, node);

      // Apply type narrowing for this elseif's own condition
      const typeGuard = detectTypeofCheck(node.named.exp) || detectEqualityCheck(node.named.exp) || detectTruthinessCheck(node.named.exp);
      if (typeGuard) {
        const ifScope = pushScope();
        applyIfBranchGuard(ifScope, typeGuard, lookupVariable);
        node.named.stats?.forEach(stat => visit(stat, node));
        popScope();
      } else {
        node.named.stats?.forEach(stat => visit(stat, node));
      }

      // Visit chained else_if, applying exclusion from this branch's typeGuard
      if (node.named.elseif) {
        if (typeGuard) {
          const elseScope = pushScope();
          applyElseBranchGuard(elseScope, typeGuard, lookupVariable);
          visit(node.named.elseif, node);
          popScope();
        } else {
          visit(node.named.elseif, node);
        }
      }

      pushToParent(node, parent);
    },

    assign_op: (node, parent) => {
      const { lookupVariable, pushWarning, typeAliases, inferencePhase } = getState();

      // Always visit children so that expression inference is populated
      visitChildren(node);

      // Type-checking only happens in the checking phase.
      // Also skip property-access variants (e.g. obj.prop += 1) — those
      // require resolving the property type from the object, which is handled
      // by the property-access validators elsewhere.
      if (inferencePhase !== 'checking' || node.named.access) {
        pushToParent(node, parent);
        return;
      }

      const varName = node.named.name?.value;
      const expNode = node.named.exp;

      if (!varName || !expNode) {
        pushToParent(node, parent);
        return;
      }

      // Find the assign_operator token (e.g. '+=', '-=', '*=', '/=')
      const assignOperator = node.children?.find(c => c.type === 'assign_operator');
      if (!assignOperator) {
        pushToParent(node, parent);
        return;
      }

      // Strip the trailing '=' to get the base arithmetic operator
      const opChar = assignOperator.value.slice(0, -1); // '+=' -> '+'

      // Look up the variable's current type
      const varDef = lookupVariable(varName);
      if (!varDef || !varDef.type) {
        pushToParent(node, parent);
        return;
      }

      const varType = resolveTypeAlias(varDef.type, typeAliases);
      const rhsType = expNode.inference?.[0];

      if (!rhsType || rhsType === AnyType || varType === AnyType) {
        pushToParent(node, parent);
        return;
      }

      // Validate the compound assignment using the same math-operation rules
      const result = TypeChecker.checkMathOperation(varType, rhsType, opChar);
      if (!result.valid) {
        const msgs = result.warning ? [result.warning] : (result.warnings ?? []);
        msgs.forEach(msg => pushWarning(node, msg));
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
