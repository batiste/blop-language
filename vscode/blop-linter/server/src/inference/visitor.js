// ============================================================================
// Visitor - AST traversal, scope management, and type resolution
// ============================================================================

import TypeChecker from './typeChecker.js';
import { getAnnotationType, removeNullish, createUnionType } from './typeSystem.js';

// Module state
let warnings;
let stream;
let functionScopes;
let typeAliases;
let currentFunctionCall; // Track function name for call validation

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

function pushInference(node, inference) {
  if (!node.inference) {
    node.inference = [];
  }
  node.inference.push(inference);
}

function pushWarning(node, message) {
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
    // If explicit_assign (:=), always create new variable in current scope
    if (explicit_assign) {
      const scope = getCurrentScope();
      scope[name.value] = {
        type: valueType,
        node: assignNode,
      };
    } else {
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
  types[i - 1] = 'any';
  types.splice(i, 1);
  return i - 1;
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
 * Initialize visitor state for a new file
 */
function initVisitor(_warnings, _stream, _functionScopes, _typeAliases) {
  warnings = _warnings;
  stream = _stream;
  functionScopes = _functionScopes;
  typeAliases = _typeAliases;
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
    getCurrentScope,
    pushScope,
    popScope,
    lookupVariable,
    getFunctionScope,
    pushInference,
    pushWarning,
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
};
