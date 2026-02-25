// ============================================================================
// Visitor - AST traversal, scope management, and type resolution
// ============================================================================

import TypeChecker from './typeChecker.js';
import { getAnnotationType, resolveTypeAlias, isTypeCompatible, getPropertyType, parseTypePrimary } from './typeSystem.js';
import { ObjectType, ArrayType, AnyType, TypeAlias, RecordType, PrimitiveType } from './Type.js';
import { isBuiltinObjectType, getArrayMemberType, getBuiltinObjectType, getPrimitiveMemberType } from './builtinTypes.js';

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
  for (let i = functionScopes.length - 1; i >= 0; i--) {
    const definition = functionScopes[i][name];
    if (definition) return definition;
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
  if (inferencePhase === 'checking') {
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
 * Run a math operation check and emit any warnings. Returns the result.
 */
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
    
    // Record<K, V>: every destructured key gets the value type V
    if (resolvedValueType instanceof RecordType) {
      const valueTypeForKey = resolvedValueType.valueType;
      for (const { varName, node: varNode } of destructuredBindings) {
        const scope = getCurrentScope();
        scope[varName] = { type: valueTypeForKey, node: assignNode };
        if (varNode.inferredType === undefined) {
          varNode.inferredType = valueTypeForKey;
        }
      }
    }

    // If the value is an object type (or a built-in type alias like Component),
    // infer property types for each destructured variable
    const isDestructurable = resolvedValueType instanceof ObjectType ||
      (resolvedValueType instanceof TypeAlias && isBuiltinObjectType(resolvedValueType.name));
    if (isDestructurable) {
      for (const { propertyName, varName, node: varNode, annotationNode } of destructuredBindings) {
        // Inline type annotation takes priority over the inferred property type
        const inlineAnnotationType = annotationNode ? getAnnotationType(annotationNode) : null;
        if (inlineAnnotationType) {
          const scope = getCurrentScope();
          scope[varName] = { type: inlineAnnotationType, node: assignNode };
          if (varNode.inferredType === undefined) {
            varNode.inferredType = inlineAnnotationType;
          }
          continue;
        }

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
    const propertyType = getPropertyType(objectType, propertyName, typeAliases);
    if (propertyType === null) {
      // Class instances may have constructor-assigned properties not tracked in ObjectType.
      // Suppress false-positive warnings for those; only warn for explicitly typed objects.
      // (The typeAliases map stores copies of class ObjectTypes *without* isClassInstance so
      // that TypeAlias resolution via the chain — e.g. this.route.test — does not suppress.)
      if (!resolvedType.isClassInstance) {
        pushWarning(accessNode, `Property '${propertyName}' does not exist on type ${objectType}`);
      }
      return AnyType;
    }
    // Stamp the member name node for hover support
    const nameNode = accessNode?.children?.find(c => c.type === 'name');
    if (nameNode && nameNode.inferredType === undefined) nameNode.inferredType = propertyType;
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

  // Builtin namespace types (Math, Array, JSON, etc.) — look up member in builtin map
  if (resolvedType instanceof TypeAlias && isBuiltinObjectType(resolvedType.name)) {
    const builtinType = getBuiltinObjectType(resolvedType.name);
    const memberType = propertyName ? builtinType?.[propertyName] : undefined;
    if (memberType == null) {
      if (propertyName) {
        pushWarning(accessNode, `Property '${propertyName}' does not exist on type '${resolvedType.name}'`);
      }
      return AnyType;
    }
    // Stamp member name node for hover support
    const nameNode = accessNode?.children?.find(c => c.type === 'name');
    if (nameNode && nameNode.inferredType === undefined) nameNode.inferredType = memberType;
    return memberType;
  }

  // Primitive types (string, number, boolean) — look up member in primitive map
  if (resolvedType instanceof PrimitiveType &&
      propertyName &&
      (resolvedType.name === 'string' || resolvedType.name === 'number' || resolvedType.name === 'boolean')) {
    const memberType = getPrimitiveMemberType(resolvedType.name, propertyName);
    if (memberType == null) {
      pushWarning(accessNode, `Property '${propertyName}' does not exist on type ${resolvedType}`);
      return AnyType;
    }
    return memberType;
  }

  // Not an object or array type — skip validation
  return AnyType;
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

      if (t && t.type === 'assign') {
        handleAssignment(types, i, t);
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
      const annotationNode = node.named.annotation || null;
      
      bindings.push({
        propertyName,
        varName,
        node: varNode,
        annotationNode,
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
  validateObjectPropertyAccess,
};
