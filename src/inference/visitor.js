// ============================================================================
// Visitor - AST traversal, scope management, and type resolution
// ============================================================================

import TypeChecker from './typeChecker.js';
import { getAnnotationType, removeNullish, createUnionType, resolveTypeAlias, isTypeCompatible, getPropertyType, isUnionType, parseUnionType, parseTypePrimary } from './typeSystem.js';
import { ObjectType, ArrayType, AnyType, BooleanType, NeverType, NullType, UndefinedType } from './Type.js';

// Module state
let warnings;
let stream;
let functionScopes;
let typeAliases;
let symbolTable; // Live SymbolTable from binding phase (for functionLocals lookup)
let currentFilename;
let currentFunctionCall; // Track function name for call validation
let inferencePhase = 'inference'; // 'inference' or 'checking' - controls warning suppression

// Scope management
const getCurrentScope = () => functionScopes[functionScopes.length - 1];
const pushScope = () => functionScopes.push({}) && getCurrentScope();
const popScope = () => functionScopes.pop();

/**
 * Look up a variable in the scope chain
 * @param {string} name - Variable name to look up
 * @returns {Object|undefined} Variable definition or undefined
 */
function lookupVariable(name) {
  const scopes = functionScopes.slice().reverse();
  for (let i = 0; i < scopes.length; i++) {
    const definition = scopes[i][name];
    if (definition) {
      return definition;
    }
  }
}

/**
 * Find the function scope (the scope with __returnTypes)
 * @returns {Object|null} The function scope or null
 */
function getFunctionScope() {
  for (let i = functionScopes.length - 1; i >= 0; i--) {
    if (functionScopes[i].__returnTypes !== undefined) {
      return functionScopes[i];
    }
  }
  return null;
}

/**
 * Recursively stamp type annotation names with their type definitions for hover support.
 * Walks the annotation subtree uniformly: when a type_primary with a name is reached,
 * stamp that name node with the resolved Type object.
 * @param {Object} node - Any node within an annotation subtree
 */
function stampTypeAnnotation(node) {
  if (!node || inferencePhase !== 'inference') return;

  if (node.type === 'type_primary' && node.named?.name) {
    const nameNode = node.named.name;
    if (nameNode.inferredType === undefined) {
      const parsed = parseTypePrimary(node);
      // If it's a type alias, resolve to its full structure for hover
      const token = nameNode.children ? nameNode.children[0] : nameNode;
      token.inferredType = (token.value && typeAliases[token.value]) ?? parsed;
    }
  }

  if (node.children) {
    for (const child of node.children) stampTypeAnnotation(child);
  }
  if (node.named) {
    for (const child of Object.values(node.named)) {
      if (child && typeof child === 'object') stampTypeAnnotation(child);
    }
  }
}

function pushInference(node, inference) {
  // During checking && phase, don't populate inference arrays to avoid duplication
  //EXCEPT: For math/boolean/nullish operations, we need to re-validate, so we allow repopulation
  if (inferencePhase === 'checking') {
    // Check if the parent is an operation/exp node with math operators
    // We'll validate those operators during checking phase
    return;
  }
  if (!node.inference) {
    node.inference = [];
  }
  if (typeof inference === 'string') {
    throw new Error(`Inference should be a Type object, not a string. Got '${inference}' at node type '${node.type}'`);
  }
  node.inference.push(inference);
}

function pushWarning(node, message) {
  if (inferencePhase === 'inference') {
    return;
  }
  const error = new Error(message);
  const token = stream[node.stream_index];
  error.token = token;
  warnings.push(error);
}

// ============================================================================
// Type Resolution Helpers
// ============================================================================

/**
 * Extract the first property name from an object_access node  
 */
function extractPropertyNameFromAccess(accessNode) {
  if (!accessNode?.children) return null;
  for (const child of accessNode.children) {
    if (child.type === 'name') return child.value;
  }
  return null;
}

/**
 * Check if an access node is bracket notation (array indexing)
 */
function isBracketAccess(accessNode) {
  if (!accessNode?.children) return false;
  for (const child of accessNode.children) {
    if (child.value === '[') return true;
  }
  return false;
}

/**
 * Check if an access node uses optional chaining
 */
function isOptionalChainAccess(accessNode) {
  return !!(accessNode?.children?.some(child => child.type === 'optional_chain'));
}

/**
 * Run a math operation check and emit any warnings. Returns the result.
 */
function emitMathWarnings(leftType, rightType, operatorNode) {
  const result = TypeChecker.checkMathOperation(leftType, rightType, operatorNode.value);
  // Only emit warnings for actually invalid operations, not for style warnings
  if (!result.valid && (result.warning || result.warnings)) {
    if (result.warning) {
      const error = new Error(result.warning);
      const token = stream[operatorNode.stream_index];
      error.token = token;
      warnings.push(error);
    }
    if (result.warnings) {
      result.warnings.forEach(w => {
        const error = new Error(w);
        const token = stream[operatorNode.stream_index];
        error.token = token;
        warnings.push(error);
      });
    }
  }
  return result;
}

function handleMathOperator(types, i, operatorNode) {
  const result = emitMathWarnings(types[i - 1], types[i - 2], operatorNode);
  types[i - 2] = result.resultType;
  types.splice(i - 1, 2);
  return i - 2;
}

function checkMathOperator(types, i, operatorNode) {
  const leftType = types[i - 1];
  const rightType = types[i - 2];
  if (leftType && rightType) emitMathWarnings(leftType, rightType, operatorNode);
}

function handleBooleanOperator(types, i) {
  types[i - 2] = BooleanType;
  types.splice(i - 1, 2);
  return i - 2;
}

function handleNullishOperator(types, i) {
  // Nullish coalescing: left ?? right
  // If left is never nullish → result is left; otherwise → (non-null left) | right
  const leftType = types[i - 1];
  const rightType = types[i - 2];

  const leftCanBeNullish = leftType === NullType || leftType === UndefinedType ||
    (isUnionType(leftType) && parseUnionType(leftType).some(t => t === NullType || t === UndefinedType));

  if (!leftCanBeNullish) {
    types[i - 2] = leftType;
  } else {
    const nonNullishLeft = removeNullish(leftType);
    types[i - 2] = nonNullishLeft === NeverType
      ? rightType
      : createUnionType([nonNullishLeft, rightType].filter(Boolean));
  }

  types.splice(i - 1, 2);
  return i - 2;
}

function handleAssignment(types, i, assignNode) {
  const { annotation, name, explicit_assign, destructuring } = assignNode.named;
  const valueType = types[i - 1];
  // Parse annotation type once, used both for type-checking and scope registration
  const annotationType = annotation ? getAnnotationType(annotation) : null;

  if (annotationType && valueType && valueType !== AnyType) {
    const result = TypeChecker.checkAssignment(valueType, annotationType, typeAliases);
    if (!result.valid) {
      pushWarning(assignNode, result.warning);
    }
  }
  
  // Handle destructuring assignment: { total, text } = attributes
  if (destructuring && valueType && valueType !== AnyType) {
    const resolvedValueType = resolveTypeAlias(valueType, typeAliases);
    
    // Extract destructured variable names from the destructuring node
    const destructuredBindings = extractDestructuredNames(destructuring);
    
    // If the value is an object type, infer property types for each destructured variable
    if (resolvedValueType instanceof ObjectType) {
      for (const { propertyName, varName, node: varNode } of destructuredBindings) {
        // Look up property on the object using the PROPERTY NAME
        const propertyType = getPropertyType(valueType, propertyName, typeAliases);
        
        if (propertyType !== null) {
          // Create variable definition with inferred type using the VARIABLE NAME
          const scope = getCurrentScope();
          scope[varName] = {
            type: propertyType,
            node: assignNode,
          };
          
          // Stamp hover type information - do this unconditionally like regular assignments
          if (varNode.inferredType === undefined) {
            varNode.inferredType = propertyType;
          }
        } else {
          // Property doesn't exist on the object type
          pushWarning(
            destructuring,
            `Property '${propertyName}' does not exist on type ${valueType}`
          );
        }
      }
    }
    // Don't return - let other assignment logic continue if needed
  }
  
  if (valueType && name && valueType !== AnyType) {
    // Check if this is a property assignment (e.g., u.name = 1)
    if (name.type === 'name_exp' && name.named && name.named.access) {
      // Extract object and property names
      const objectName = name.named.name?.value;
      const accessNode = name.named.access;
      
      // Find the property name from the access node
      let propertyName = null;
      const findPropertyName = (node) => {
        if (!node) return;
        if (node.type === 'name' && !propertyName) {
          propertyName = node.value;
          return;
        }
        if (node.children) {
          node.children.forEach(findPropertyName);
        }
        if (node.named) {
          Object.values(node.named).forEach(child => {
            if (child && typeof child === 'object') {
              findPropertyName(child);
            }
          });
        }
      };
      findPropertyName(accessNode);
      
      if (objectName && propertyName) {
        // Look up the object's type
        const objectDef = lookupVariable(objectName);
        if (objectDef && objectDef.type) {
          const expectedType = getPropertyType(objectDef.type, propertyName, typeAliases);
          if (expectedType !== null) {
            const resolvedExpectedType = resolveTypeAlias(expectedType, typeAliases);
            if (!isTypeCompatible(valueType, resolvedExpectedType, typeAliases)) {
              pushWarning(
                assignNode,
                `Cannot assign ${valueType} to property '${propertyName}' of type ${expectedType}`
              );
            }
          }
        }
      }
    }
    // If explicit_assign (:=), always create new variable in current scope
    else if (explicit_assign && name.value) {
      const scope = getCurrentScope();
      scope[name.value] = {
        type: valueType,
        node: assignNode,
      };
      if (inferencePhase === 'inference' && name.inferredType === undefined) {
        name.inferredType = valueType;
      }
    } else if (name.value) {
      // Regular assignment (=), check if reassigning existing variable
      const result = TypeChecker.checkVariableReassignment(valueType, name.value, lookupVariable, typeAliases);
      if (!result.valid) {
        pushWarning(assignNode, result.warning);
      } else if (!result.definition) {
        const scope = getCurrentScope();
        scope[name.value] = {
          type: annotationType ?? valueType,
          node: assignNode,
        };
      }
      // Stamp definition site for hover — prefer declared annotation type if available
      if (inferencePhase === 'inference' && name.inferredType === undefined) {
        name.inferredType = annotationType ?? valueType;
      }
    }
  }
}

/**
 * Validate property access on an object type and emit a warning if missing.
 * Returns the resolved property type, or null if not found / not applicable.
 */
function validateObjectPropertyAccess(objectType, propertyName, accessNode) {
  if (!objectType || objectType === AnyType) return AnyType;

  const resolvedType = resolveTypeAlias(objectType, typeAliases);

  // Skip empty object type — often produced when inference fails
  if (resolvedType.toString() === '{}') return AnyType;

  if (resolvedType instanceof ObjectType) {
    if (!propertyName) return AnyType;
    // Class instance types only track method signatures — constructor-assigned
    // properties (this.x = ...) are not tracked, so suppress false positives.
    if (resolvedType.isClassInstance) return AnyType;
    const propertyType = getPropertyType(objectType, propertyName, typeAliases);
    if (propertyType === null) {
      pushWarning(accessNode, `Property '${propertyName}' does not exist on type ${objectType}`);
      return AnyType;
    }
    return propertyType;
  }

  // Handle array types with bracket access (element access)
  if (resolvedType instanceof ArrayType && !propertyName) {
    return resolvedType.elementType;
  }

  // Array with property name (e.g., arr.length is handled via getArrayMemberType)
  if (resolvedType instanceof ArrayType && propertyName) {
    const memberType = getArrayMemberType(resolvedType, propertyName);
    if (memberType === AnyType && propertyName !== 'length' && propertyName !== 'push' && propertyName !== 'pop') {
      pushWarning(accessNode, `Property '${propertyName}' does not exist on array type`);
    }
    return memberType;
  }

  // Not an object or array type — skip validation
  return AnyType;
}

function handleObjectAccess(types, i) {
  const objectType = types[i - 1];
  const accessNode = types[i];

  if (isOptionalChainAccess(accessNode)) {
    types[i - 1] = AnyType;
    types.splice(i, 1);
    return i - 1;
  }

  // Handle bracket access (array indexing) - propertyName is null, returns element type
  if (isBracketAccess(accessNode)) {
    types[i - 1] = validateObjectPropertyAccess(objectType, null, accessNode);
    types.splice(i, 1);
    return i - 1;
  }

  // Handle dot notation property access
  const propertyName = extractPropertyNameFromAccess(accessNode);
  types[i - 1] = validateObjectPropertyAccess(objectType, propertyName, accessNode);
  types.splice(i, 1);
  return i - 1;
}

function checkObjectAccess(types, i) {
  const objectType = types[i - 1];
  const accessNode = types[i];

  if (!isOptionalChainAccess(accessNode)) {
    // Handle bracket access (array indexing)
    if (isBracketAccess(accessNode)) {
      validateObjectPropertyAccess(objectType, null, accessNode);
    } else {
      // Handle dot notation property access
      const propertyName = extractPropertyNameFromAccess(accessNode);
      validateObjectPropertyAccess(objectType, propertyName, accessNode);
    }
  }
}

/**
 * Resolves types in an inference stack and checks for type errors
 * @param {Object} node - AST node with inference array
 */
function resolveTypes(node) {
  visitChildren(node);
  
  if (node.inference) {
    let types = node.inference;
    
    for (let i = 0; i < types.length; i++) {
      const t = types[i];

      if (inferencePhase === 'checking') {
        if (t && t.type === 'math_operator' && types[i - 1] && types[i - 2]) {
          checkMathOperator(types, i, t);
        } else if (t && t.type === 'assign') {
          handleAssignment(types, i, t);
        } else if (t && t.type === 'object_access' && types[i - 1]) {
          checkObjectAccess(types, i);
        }
        continue;
      }
      
      if (t && t.type === 'math_operator' && types[i - 1] && types[i - 2]) {
        i = handleMathOperator(types, i, t);
      } else if (t && t.type === 'boolean_operator') {
        i = handleBooleanOperator(types, i);
      } else if (t && t.type === 'nullish') {
        i = handleNullishOperator(types, i);
      } else if (t && t.type === 'assign') {
        handleAssignment(types, i, t);
      } else if (t && t.type === 'object_access' && types[i - 1]) {
        i = handleObjectAccess(types, i);
      }
    }

    if (inferencePhase === 'inference') {
      for (let i = types.length - 1; i >= 0; i--) {
        const value = types[i];
        // Skip AST nodes (they have a .type string property like 'assign', 'math_operator', etc.)
        if (value && value.kind !== undefined) {
          node.inferredType = value;
          break;
        }
      }
    }
  }
}

function pushToParent(node, parent) {
  if (!node.inference || !parent) {
    return;
  }
  for (let i = 0; i < node.inference.length; i++) {
    pushInference(parent, node.inference[i]);
  }
}

function visitChildren(node) {
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i], node);
    }
  }
}

/**
 * Phase 2.5: Stamp inferred types onto AST nodes for hover support
 * Walks the entire AST and copies node.inference[0] to node.inferredType
 */
function stampInferredTypes(node) {
  if (!node) return;
  
  // Stamp this node if it has inferred type (but preserve existing stamps)
  if (node.inference && node.inference.length > 0 && !node.inferredType) {
    const raw = node.inference[0];
    // Store Type objects directly; skip AST nodes (they have .type like 'assign')
    if (raw && raw.kind !== undefined) {
      node.inferredType = raw;
    }
  }
  
  // Recursively stamp all children
  if (node.children) {
    for (const child of node.children) {
      stampInferredTypes(child);
    }
  }
  
  // Recursively stamp all named properties
  if (node.named) {
    for (const key in node.named) {
      stampInferredTypes(node.named[key]);
    }
  }
}

/**
 * Initialize visitor state for a new file
 * @param {Array} _warnings - Array to collect warnings
 * @param {Array} _stream - Token stream for error reporting
 * @param {Array} _functionScopes - Function scope stack
 * @param {Object} _typeAliases - Type aliases map
 * @param {String} _filename - Current filename being processed
 * @param {String} _phase - 'inference' or 'checking' - controls warning suppression
 */
function initVisitor(_warnings, _stream, _functionScopes, _typeAliases, _filename, _phase = 'inference', _symbolTable = null) {
  warnings = _warnings;
  stream = _stream;
  functionScopes = _functionScopes;
  typeAliases = _typeAliases;
  symbolTable = _symbolTable;
  currentFilename = _filename;
  inferencePhase = _phase;
}

/**
 * Get current visitor state
 */
function getVisitorState() {
  return {
    warnings,
    stream,
    functionScopes,
    typeAliases,
    symbolTable,
    currentFilename,
    inferencePhase,
    getCurrentScope,
    pushScope,
    popScope,
    lookupVariable,
    getFunctionScope,
    pushInference,
    pushWarning,
    stampTypeAnnotation,
  };
}

// Forward declaration for handlers
let nodeHandlers;

function visit(node, parent) {
  if (nodeHandlers[node.type]) {
    nodeHandlers[node.type](node, parent);
  } else {
    visitChildren(node);
    pushToParent(node, parent);
  }
}

function setHandlers(handlers) {
  nodeHandlers = handlers;
}

/**
 * Extract destructured variable names from an object_destructuring node
 * @param {Object} destructuringNode - The object_destructuring AST node
 * @returns {Object[]} Array of name token nodes (the actual 'name' tokens to stamp)
 */
function extractDestructuredNames(destructuringNode) {
  if (!destructuringNode) return [];
  
  const bindings = [];
  
  // Get the destructuring_values node from within the object_destructuring wrapper
  const valuesNode = destructuringNode.named?.values || 
                      destructuringNode.children?.find(c => c.type === 'destructuring_values');
  
  if (!valuesNode) return [];
  
  // Traverse the destructuring_values tree to extract property->variable mappings
  const extractBindings = (node) => {
    if (!node || node.type !== 'destructuring_values') return;
    
    // Extract current binding
    if (node.named?.name) {
      const propertyName = node.named.name.value;
      const varName = node.named.rename?.value || propertyName;
      const varNode = node.named.rename || node.named.name;
      
      bindings.push({
        propertyName,
        varName,
        node: varNode
      });
    }
    
    // Recurse for more values
    if (node.named?.more) {
      extractBindings(node.named.more);
    }
  };
  
  extractBindings(valuesNode);
  return bindings;
}

export {
  visit,
  visitChildren,
  pushToParent,
  resolveTypes,
  initVisitor,
  getVisitorState,
  setHandlers,
  stampTypeAnnotation,
  stampInferredTypes,
};
