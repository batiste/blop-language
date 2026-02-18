// ============================================================================
// Visitor - AST traversal, scope management, and type resolution
// ============================================================================

import TypeChecker from './typeChecker.js';
import { getAnnotationType, removeNullish, createUnionType, resolveTypeAlias, parseObjectTypeString, isTypeCompatible, getPropertyType, stringToType } from './typeSystem.js';
import { ObjectType, ArrayType } from './typeSystem.js';

// Module state
let warnings;
let stream;
let functionScopes;
let typeAliases;
let currentFilename;
let currentFunctionCall; // Track function name for call validation
let expectedObjectType; // Track expected type for object literals
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
 * Recursively stamp type annotation names with their type definitions for hover support
 * @param {Object} node - The annotation or type_expression node to traverse
 */
function stampTypeAnnotation(node) {
  if (!node || inferencePhase !== 'inference') {
    return;
  }
  
  // Handle annotation node - extract the type_expression
  if (node.type === 'annotation' && node.named && node.named.type) {
    stampTypeAnnotation(node.named.type);
    return;
  }
  
  // Handle type_expression - recursively process children
  if (node.type === 'type_expression') {
    if (node.named) {
      // Handle union/intersection branches
      if (node.named.union) stampTypeAnnotation(node.named.union);
      if (node.named.intersection) stampTypeAnnotation(node.named.intersection);
    }
    // Process children for type_primary
    if (node.children) {
      node.children.forEach(child => stampTypeAnnotation(child));
    }
    return;
  }
  
  // Handle type_primary - look for names and object types
  if (node.type === 'type_primary') {
    // Check for basic type name
    if (node.named && node.named.name) {
      const nameNode = node.named.name;
      const typeName = nameNode.value;
      
      // Check if it's a type alias
      if (typeAliases[typeName]) {
        if (nameNode.inferredType === undefined) {
          nameNode.inferredType = typeAliases[typeName];
        }
      } else if (['string', 'number', 'boolean', 'any', 'undefined', 'null'].includes(typeName)) {
        // Built-in type
        if (nameNode.inferredType === undefined) {
          nameNode.inferredType = typeName;
        }
      }
    }
    
    // Handle array types (name followed by [])
    if (node.named && node.named.array_suffix) {
      stampTypeAnnotation(node.named.name);
    }
    
    // Handle generic type instantiation (name<typeargs>)
    if (node.named && node.named.type_args) {
      if (node.named.name) stampTypeAnnotation(node.named.name);
      // Recursively stamp type arguments
      const typeArgsNode = node.named.type_args;
      if (typeArgsNode.named && typeArgsNode.named.args) {
        const stampTypeArgs = (argsNode) => {
          if (argsNode.named && argsNode.named.arg) {
            stampTypeAnnotation(argsNode.named.arg);
          }
          if (argsNode.named && argsNode.named.rest) {
            stampTypeArgs(argsNode.named.rest);
          }
        };
        stampTypeArgs(typeArgsNode.named.args);
      }
    }
    
    // Handle object types
    if (node.children) {
      node.children.forEach(child => {
        if (child.type === 'object_type') {
          stampObjectType(child);
        }
      });
    }
    return;
  }
  
  // Handle other nodes recursively
  if (node.children) {
    node.children.forEach(child => stampTypeAnnotation(child));
  }
  if (node.named) {
    Object.values(node.named).forEach(child => {
      if (child && typeof child === 'object') {
        stampTypeAnnotation(child);
      }
    });
  }
}

/**
 * Stamp property names in object type definitions
 * @param {Object} objectTypeNode - The object_type node
 */
function stampObjectType(objectTypeNode) {
  if (!objectTypeNode || inferencePhase !== 'inference') {
    return;
  }
  
  // Traverse object type properties
  const traverse = (node) => {
    if (!node) return;
    
    // Look for object_type_property nodes
    if (node.type === 'object_type_property') {
      // Stamp the property name with its type
      if (node.named && node.named.key) {
        const keyNode = node.named.key;
        if (node.named.valueType && keyNode.inferredType === undefined) {
          const valueType = getAnnotationType(node.named);
          if (valueType) {
            // inferredType is used for hover display - normalize to string
            keyNode.inferredType = valueType.toString();
          }
        }
      }
      // Recursively stamp the value type annotation
      if (node.named && node.named.valueType) {
        stampTypeAnnotation(node.named.valueType);
      }
    }
    
    // Continue traversing
    if (node.children) {
      node.children.forEach(child => traverse(child));
    }
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object') {
          traverse(child);
        }
      });
    }
  };
  
  traverse(objectTypeNode);
}

function pushInference(node, inference) {
  if (inferencePhase === 'checking') {
    return;
  }
  if (!node.inference) {
    node.inference = [];
  }
  // Normalize string type values to Type objects; leave AST nodes (they have .type) as-is
  const value = (typeof inference === 'string')
    ? stringToType(inference)
    : inference;
  node.inference.push(value);
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

function handleMathOperator(types, i, operatorNode) {
  const leftType = types[i - 1];
  const rightType = types[i - 2];
  const operator = operatorNode.value;
  
  const result = TypeChecker.checkMathOperation(leftType, rightType, operator);
  
  if (result.warning) {
    pushWarning(operatorNode, result.warning);
  }
  if (result.warnings) {
    result.warnings.forEach(warning => pushWarning(operatorNode, warning));
  }
  
  types[i - 2] = result.resultType;
  types.splice(i - 1, 2);
  return i - 2;
}

function checkMathOperator(types, i, operatorNode) {
  const leftType = types[i - 1];
  const rightType = types[i - 2];
  const operator = operatorNode.value;

  if (!leftType || !rightType) {
    return;
  }

  const result = TypeChecker.checkMathOperation(leftType, rightType, operator);

  if (result.warning) {
    pushWarning(operatorNode, result.warning);
  }
  if (result.warnings) {
    result.warnings.forEach(warning => pushWarning(operatorNode, warning));
  }
}

function handleBooleanOperator(types, i) {
  types[i - 2] = 'boolean';
  types.splice(i - 1, 2);
  return i - 2;
}

function handleNullishOperator(types, i) {
  // Nullish coalescing: left ?? right
  // Returns the left side if it's not null/undefined, otherwise right side
  const leftType = types[i - 1];
  const rightType = types[i - 2];
  
  // If left can never be nullish, result is left type
  const { isUnionType, parseUnionType } = require('./typeSystem');
  if (leftType !== 'null' && leftType !== 'undefined' && 
      !isUnionType(leftType) || 
      (isUnionType(leftType) && !parseUnionType(leftType).some(t => t === 'null' || t === 'undefined'))) {
    types[i - 2] = leftType;
  } else {
    // Remove nullish from left and union with right
    const nonNullishLeft = removeNullish(leftType);
    if (nonNullishLeft === 'never') {
      // Left is definitely null/undefined, result is right type
      types[i - 2] = rightType;
    } else {
      // Left might be nullish, result is union of non-nullish left and right
      const resultTypes = [];
      if (nonNullishLeft !== 'never') {
        resultTypes.push(nonNullishLeft);
      }
      if (rightType) {
        resultTypes.push(rightType);
      }
      types[i - 2] = createUnionType(resultTypes);
    }
  }
  types.splice(i - 1, 2);
  return i - 2;
}

function handleAssignment(types, i, assignNode) {
  const { annotation, name, explicit_assign } = assignNode.named;
  const valueType = types[i - 1];
  
  if (annotation && valueType && valueType !== 'any') {
    const annotationType = getAnnotationType(annotation);
    if (annotationType) {
      const result = TypeChecker.checkAssignment(valueType, annotationType, typeAliases);
      if (!result.valid) {
        pushWarning(assignNode, result.warning);
      }
    }
  }
  
  if (valueType && name && valueType !== 'any') {
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
          const _resolvedObjectType = resolveTypeAlias(objectDef.type, typeAliases);
          // parseObjectTypeString expects a string; normalize Type objects
          const resolvedObjectType = typeof _resolvedObjectType === 'string'
            ? _resolvedObjectType
            : _resolvedObjectType.toString();
          const properties = parseObjectTypeString(resolvedObjectType);
          
          if (properties && properties[propertyName]) {
            const expectedType = properties[propertyName].type;
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
    } else if (name.value) {
      // Regular assignment (=), check if reassigning existing variable
      const result = TypeChecker.checkVariableReassignment(valueType, name.value, lookupVariable, typeAliases);
      if (!result.valid) {
        pushWarning(assignNode, result.warning);
      } else if (!result.definition) {
        const scope = getCurrentScope();
        scope[name.value] = {
          type: valueType,
          node: assignNode,
        };
      }
    }
  }
}

function handleObjectAccess(types, i) {
  const objectType = types[i - 1];
  const accessNode = types[i];
  
  // Check if this is optional chaining
  const isOptionalChain = accessNode && accessNode.children && 
    accessNode.children.some(child => child.type === 'optional_chain');
  
  // Extract property name from the object_access node
  let propertyName = null;
  if (accessNode && accessNode.children) {
    for (const child of accessNode.children) {
      if (child.type === 'name') {
        propertyName = child.value;
        break;
      }
    }
  }
  
  // Skip validation for optional chaining - it's designed to safely access potentially non-existent properties
  if (isOptionalChain) {
    types[i - 1] = 'any';
    types.splice(i, 1);
    return i - 1;
  }
  
  // Only validate property access for object types (types that resolve to {...})
  if (objectType && objectType !== 'any' && propertyName) {
    // Resolve type alias to check if it's an object type
    const resolvedType = resolveTypeAlias(objectType, typeAliases);
    
    // Skip validation for empty object type {} as it's often used when type inference fails
    if (resolvedType.toString() === '{}') {
      types[i - 1] = 'any';
      types.splice(i, 1);
      return i - 1;
    }
    
    // Skip validation for non-object types and array types
    if (resolvedType instanceof ObjectType) {
      // This is an object type - validate property access
      const propertyType = getPropertyType(objectType, propertyName, typeAliases);
      
      if (propertyType === null) {
        // Property doesn't exist on this type
        pushWarning(
          accessNode,
          `Property '${propertyName}' does not exist on type ${objectType}`
        );
        types[i - 1] = 'any';
      } else {
        // Update to the property's type
        types[i - 1] = propertyType;
      }
    } else {
      // Not an object type (array, string, etc.) - don't validate
      types[i - 1] = 'any';
    }
  } else {
    types[i - 1] = 'any';
  }
  
  types.splice(i, 1);
  return i - 1;
}

function checkObjectAccess(types, i) {
  const objectType = types[i - 1];
  const accessNode = types[i];

  const isOptionalChain = accessNode && accessNode.children &&
    accessNode.children.some(child => child.type === 'optional_chain');

  if (isOptionalChain) {
    return;
  }

  let propertyName = null;
  if (accessNode && accessNode.children) {
    for (const child of accessNode.children) {
      if (child.type === 'name') {
        propertyName = child.value;
        break;
      }
    }
  }

  if (objectType && objectType !== 'any' && propertyName) {
    const resolvedType = resolveTypeAlias(objectType, typeAliases);

    if (resolvedType.toString() === '{}') {
      return;
    }

    if (resolvedType instanceof ObjectType) {
      const propertyType = getPropertyType(objectType, propertyName, typeAliases);

      if (propertyType === null) {
        pushWarning(
          accessNode,
          `Property '${propertyName}' does not exist on type ${objectType}`
        );
      }
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
    const types = node.inference;
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
        if (typeof value === 'string') {
          node.inferredType = value;
          break;
        }
        if (value && typeof value.toString === 'function' && value.type === undefined) {
          node.inferredType = value.toString();
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
    // Normalize Type objects to strings (AST nodes have .type, Type objects use .kind)
    node.inferredType = (raw && raw.kind !== undefined) ? raw.toString() : raw;
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
function initVisitor(_warnings, _stream, _functionScopes, _typeAliases, _filename, _phase = 'inference') {
  warnings = _warnings;
  stream = _stream;
  functionScopes = _functionScopes;
  typeAliases = _typeAliases;
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
    getExpectedObjectType: () => expectedObjectType,
    setExpectedObjectType: (type) => { expectedObjectType = type; },
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
