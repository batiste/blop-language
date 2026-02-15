
let warnings;
let stream;
let functionScopes;
let typeAliases; // Track type aliases defined with `type Name = Type`

const getCurrentScope = () => functionScopes[functionScopes.length - 1];
const pushScope = () => functionScopes.push({}) && getCurrentScope();
const popScope = () => functionScopes.pop();

// ============================================================================
// Type Alias Resolution
// ============================================================================

/**
 * Resolve a type alias to its underlying type
 * @param {string} type - Type name that might be an alias
 * @returns {string} The resolved type (or original if not an alias)
 */
function resolveTypeAlias(type) {
  if (!type || typeof type !== 'string') return type;
  
  // Check if it's a union or intersection type
  if (type.includes(' | ') || type.includes(' & ')) {
    // Parse and resolve each component
    const separator = type.includes(' | ') ? ' | ' : ' & ';
    const types = type.split(separator).map(t => t.trim());
    const resolved = types.map(t => resolveTypeAlias(t));
    return resolved.join(separator);
  }
  
  // Check if it's an array type
  if (type.endsWith('[]')) {
    const elementType = type.slice(0, -2);
    return resolveTypeAlias(elementType) + '[]';
  }
  
  // Resolve the alias itself
  if (typeAliases[type]) {
    // Recursively resolve in case an alias points to another alias
    return resolveTypeAlias(typeAliases[type]);
  }
  
  return type;
}

// ============================================================================
// Union Type Utilities
// ============================================================================

/**
 * Check if a type string represents a union type
 * @param {string} type - Type string to check
 * @returns {boolean}
 */
function isUnionType(type) {
  return typeof type === 'string' && type.includes(' | ');
}

/**
 * Parse a union type into its constituent types
 * @param {string} unionType - Union type string like "string | number"
 * @returns {string[]} Array of individual types
 */
function parseUnionType(unionType) {
  if (!isUnionType(unionType)) {
    return [unionType];
  }
  return unionType.split(' | ').map(t => t.trim());
}

/**
 * Create a union type string from multiple types
 * @param {string[]} types - Array of type strings
 * @returns {string} Union type string or single type
 */
function createUnionType(types) {
  // Remove duplicates and 'any'
  const uniqueTypes = [...new Set(types.filter(t => t && t !== 'any'))];
  
  if (uniqueTypes.length === 0) {
    return 'any';
  }
  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }
  
  return uniqueTypes.join(' | ');
}

/**
 * Check if a type is compatible with another, including union types
 * @param {string} valueType - The type being assigned
 * @param {string} targetType - The target type
 * @returns {boolean}
 */
function isTypeCompatible(valueType, targetType) {
  // Resolve type aliases first
  const resolvedValueType = resolveTypeAlias(valueType);
  const resolvedTargetType = resolveTypeAlias(targetType);
  
  if (resolvedValueType === 'any' || resolvedTargetType === 'any') {
    return true;
  }
  
  if (resolvedValueType === resolvedTargetType) {
    return true;
  }
  
  // Allow generic "array" to be compatible with typed arrays like "number[]"
  if (resolvedValueType === 'array' && resolvedTargetType.endsWith('[]')) {
    return true;
  }
  
  // Allow generic "object" to be compatible with any object-based type
  if (resolvedValueType === 'object' && resolvedTargetType === 'object') {
    return true;
  }
  
  // Check if valueType is in targetType's union
  if (isUnionType(resolvedTargetType)) {
    const targetTypes = parseUnionType(resolvedTargetType);
    if (isUnionType(resolvedValueType)) {
      const valueTypes = parseUnionType(resolvedValueType);
      // All value types must be in target types
      return valueTypes.every(vt => targetTypes.includes(vt));
    }
    return targetTypes.includes(resolvedValueType);
  }
  
  return false;
}

/**
 * Remove null and undefined from a union type (for nullish coalescing)
 * @param {string} type - Type to process
 * @returns {string} Type without null/undefined
 */
function removeNullish(type) {
  if (type === 'null' || type === 'undefined') {
    return 'never';
  }
  
  if (isUnionType(type)) {
    const types = parseUnionType(type).filter(t => t !== 'null' && t !== 'undefined');
    return createUnionType(types);
  }
  
  return type;
}

// ============================================================================
// Type Narrowing - Track type changes through control flow
// ============================================================================

/**
 * Narrow a union type to only include specified types
 * @param {string} type - Original type
 * @param {string} narrowedType - Type to narrow to
 * @returns {string} Narrowed type
 */
function narrowType(type, narrowedType) {
  if (type === 'any') {
    return narrowedType;
  }
  
  if (!isUnionType(type)) {
    // If it's already the narrowed type, keep it
    if (type === narrowedType) {
      return type;
    }
    // Otherwise, narrowing is impossible
    return 'never';
  }
  
  const types = parseUnionType(type);
  const narrowedTypes = types.filter(t => t === narrowedType);
  
  if (narrowedTypes.length === 0) {
    return 'never';
  }
  
  return createUnionType(narrowedTypes);
}

/**
 * Narrow a union type by removing specified types (for else branches)
 * @param {string} type - Original type
 * @param {string} excludedType - Type to exclude
 * @returns {string} Type with excluded types removed
 */
function excludeType(type, excludedType) {
  if (type === 'any') {
    return 'any';
  }
  
  if (!isUnionType(type)) {
    if (type === excludedType) {
      return 'never';
    }
    return type;
  }
  
  const types = parseUnionType(type);
  const remainingTypes = types.filter(t => t !== excludedType);
  
  if (remainingTypes.length === 0) {
    return 'never';
  }
  
  return createUnionType(remainingTypes);
}

/**
 * Detect typeof checks in expressions
 * Returns { variable, checkType } if detected, null otherwise
 * @param {Object} expNode - Expression node to analyze
 * @returns {Object|null} Type guard info or null
 */
function detectTypeofCheck(expNode) {
  if (!expNode) {
    return null;
  }
  
  // Look for pattern: typeof variable == 'type'
  // Collect all relevant nodes first
  let hasTypeof = false;
  let typeofVar = null;
  let comparisonType = null;
  let hasComparison = false;
  
  // Walk the entire expression tree and collect pieces
  const checkNode = (node) => {
    if (!node) return;
    
    // Check for typeof operand
    if (node.type === 'operand' && node.value && node.value.includes('typeof')) {
      hasTypeof = true;
    }
    
    // Check for variable name
    if (node.type === 'name' && hasTypeof && !typeofVar) {
      typeofVar = node.value;
    }
    
    // Check for comparison type (string literal)
    if (node.type === 'str' && hasTypeof) {
      // Extract string value (remove quotes)
      const strValue = node.value.slice(1, -1);
      comparisonType = strValue;
    }
    
    // Check for comparison operator
    if (node.type === 'boolean_operator' && (node.value === '==' || node.value === '!=')) {
      hasComparison = true;
    }
    
    // Recurse into children
    if (node.children) {
      node.children.forEach(checkNode);
    }
  };
  
  checkNode(expNode);
  
  if (hasTypeof && typeofVar && comparisonType && hasComparison) {
    return { variable: typeofVar, checkType: comparisonType };
  }
  
  return null;
}

/**
 * Apply type narrowing to a scope
 * @param {Object} scope - Scope to apply narrowing to
 * @param {string} variable - Variable name to narrow
 * @param {string} narrowedType - Type to narrow to
 */
function applyNarrowing(scope, variable, narrowedType) {
  const def = lookupVariable(variable);
  if (def && def.type) {
    const newType = narrowType(def.type, narrowedType);
    // Create a narrowed version in the current scope
    scope[variable] = {
      ...def,
      type: newType,
      narrowed: true,
    };
  }
}

/**
 * Apply type exclusion to a scope (for else branches)
 * @param {Object} scope - Scope to apply exclusion to
 * @param {string} variable - Variable name
 * @param {string} excludedType - Type to exclude
 */
function applyExclusion(scope, variable, excludedType) {
  const def = lookupVariable(variable);
  if (def && def.type) {
    const newType = excludeType(def.type, excludedType);
    scope[variable] = {
      ...def,
      type: newType,
      narrowed: true,
    };
  }
}

/**
 * Extract type name from annotation node
 * Handles both old format (name) and new format (type_expression) with union/intersection types
 * @param {Object} annotationNode - The annotation AST node
 * @returns {string} The type name (may be a union/intersection type string)
 */
function getAnnotationType(annotationNode) {
  if (!annotationNode) return null;
  
  // New format: annotation.named.type is a type_expression
  if (annotationNode.named && annotationNode.named.type) {
    return parseTypeExpression(annotationNode.named.type);
  }
  
  // Old format fallback: annotation.named.name
  if (annotationNode.named && annotationNode.named.name) {
    return annotationNode.named.name.value;
  }
  
  return null;
}

/**
 * Parse a type_expression AST node into a type string
 * Handles union (|), intersection (&), and array types
 * @param {Object} typeExprNode - The type_expression AST node
 * @returns {string} The parsed type string
 */
function parseTypeExpression(typeExprNode) {
  if (!typeExprNode) return 'any';
  
  // Check for union type: type_primary | type_expression
  if (typeExprNode.named && typeExprNode.named.union) {
    const leftType = parseTypePrimary(typeExprNode.children[0]);
    const rightType = parseTypeExpression(typeExprNode.named.union);
    return `${leftType} | ${rightType}`;
  }
  
  // Check for intersection type: type_primary & type_expression  
  if (typeExprNode.named && typeExprNode.named.intersection) {
    const leftType = parseTypePrimary(typeExprNode.children[0]);
    const rightType = parseTypeExpression(typeExprNode.named.intersection);
    return `${leftType} & ${rightType}`;
  }
  
  // Just a single type_primary
  if (typeExprNode.children && typeExprNode.children[0]) {
    return parseTypePrimary(typeExprNode.children[0]);
  }
  
  return 'any';
}

/**
 * Parse a type_primary AST node into a type string
 * Handles basic types and array types
 * @param {Object} typePrimaryNode - The type_primary AST node
 * @returns {string} The parsed type string
 */
function parseTypePrimary(typePrimaryNode) {
  if (!typePrimaryNode || !typePrimaryNode.named) return 'any';
  
  const { name } = typePrimaryNode.named;
  if (!name) return 'any';
  
  // name is now a type_name node, get its first child
  const typeToken = name.children ? name.children[0] : name;
  const typeName = typeToken.value;
  
  // Check if it's an array type (has [ ] after the name)
  // The grammar matches: ['type_name:name', '[', ']']
  if (typePrimaryNode.children && typePrimaryNode.children.length > 1) {
    return `${typeName}[]`;
  }
  
  return typeName;
}

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
// Type Checker - Validates type operations and assignments
// ============================================================================

const TypeChecker = {
  /**
   * Check if a math operation is valid for the given types
   */
  checkMathOperation(leftType, rightType, operator) {
    if (operator === '+') {
      if (leftType === 'string' && rightType === 'string') {
        return { valid: false, resultType: 'string', warning: 'Use template strings instead of \'++\' for string concatenation' };
      }
      if ((leftType === 'string' && rightType === 'number') || (leftType === 'number' && rightType === 'string')) {
        return { valid: true, resultType: 'string' };
      }
      if ((leftType === 'number' || leftType === 'any') && (rightType === 'number' || rightType === 'any')) {
        return { valid: true, resultType: 'number' };
      }
      return { valid: false, resultType: 'any', warning: `Cannot apply '+' operator to ${rightType} and ${leftType}` };
    } else {
      // Other math operators require numbers
      const warnings = [];
      if (leftType !== 'number' && leftType !== 'any') {
        warnings.push(`Math operator '${operator}' not allowed on ${leftType}`);
      }
      if (rightType !== 'number' && rightType !== 'any') {
        warnings.push(`Math operator '${operator}' not allowed on ${rightType}`);
      }
      return { valid: warnings.length === 0, resultType: 'number', warnings };
    }
  },

  /**
   * Check if an assignment is valid
   */
  checkAssignment(valueType, annotationType) {
    if (annotationType && valueType !== 'any') {
      if (!isTypeCompatible(valueType, annotationType)) {
        return { valid: false, warning: `Cannot assign ${valueType} to ${annotationType}` };
      }
    }
    return { valid: true };
  },

  /**
   * Check if a variable reassignment matches its declared type
   */
  checkVariableReassignment(valueType, variable) {
    const def = lookupVariable(variable);
    if (def && !isTypeCompatible(valueType, def.type)) {
      return { valid: false, warning: `Cannot assign ${valueType} to ${def.type}` };
    }
    return { valid: true, definition: def };
  },

  /**
   * Check function call arguments against signature
   */
  checkFunctionCall(args, expectedParams, functionName) {
    const warnings = [];
    for (let i = 0; i < expectedParams.length; i++) {
      const arg = args[i];
      const expected = expectedParams[i];
      if (arg && expected && !isTypeCompatible(arg, expected)) {
        warnings.push(`function ${functionName} expected ${expected} for param ${i + 1} but got ${arg}`);
      }
    }
    return { valid: warnings.length === 0, warnings };
  },

  /**
   * Check if function return types match declaration
   */
  checkReturnTypes(returnTypes, declaredType, functionName) {
    if (!declaredType || declaredType === 'any') {
      return { valid: true };
    }
    
    const explicitReturns = returnTypes.filter(t => t !== 'undefined' && t);
    if (explicitReturns.length === 0) {
      return { valid: true };
    }

    for (const returnType of explicitReturns) {
      if (!isTypeCompatible(returnType, declaredType)) {
        return { 
          valid: false, 
          warning: `Function '${functionName}' returns ${returnType} but declared as ${declaredType}` 
        };
      }
    }
    return { valid: true };
  },
};

// ============================================================================
// Type Resolution Helpers - Extract and simplify checkStatement logic
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
      const result = TypeChecker.checkAssignment(valueType, annotationType);
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
      const result = TypeChecker.checkVariableReassignment(valueType, name.value);
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

// ============================================================================
// Node Handlers - Type inference visitors for different AST node types
// ============================================================================

const literalHandlers = {
  number: (node, parent) => {
    pushInference(parent, 'number');
  },
  str: (node, parent) => {
    pushInference(parent, 'string');
  },
  null: (node, parent) => {
    pushInference(parent, 'null');
  },
  undefined: (node, parent) => {
    pushInference(parent, 'undefined');
  },
  true: (node, parent) => {
    pushInference(parent, 'boolean');
  },
  false: (node, parent) => {
    pushInference(parent, 'boolean');
  },
  array_literal: (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'array');
  },
  object_literal: (node, parent) => {
    resolveTypes(node);
    pushInference(parent, 'object');
  },
  virtual_node: (node, parent) => {
    resolveTypes(node);
    pushInference(parent, 'VNode');
  },
  virtual_node_exp: (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'VNode');
  },
};

const expressionHandlers = {
  math: (node, parent) => {
    visitChildren(node);
    pushInference(parent, 'number');
  },
  name_exp: (node, parent) => {
    const { name, access, op } = node.named;
    if (access) {
      visitChildren(access);
      pushInference(parent, 'any');
      return;
    }
    const def = lookupVariable(name.value);
    
    // Check if it's a variable definition
    if (def) {
      if (def.source === 'func_def') {
        pushInference(parent, 'function');
      } else {
        pushInference(parent, def.type);
      }
    } else {
      // Unknown identifier - could be undefined or from outer scope
      pushInference(parent, 'any');
    }
    if (op) {
      nodeHandlers.operation(op, node);
      pushToParent(node, parent);
    }
  },
  operation: (node, parent) => {
    visitChildren(node);
    pushToParent(node, parent);
    if (node.named.math_op) {
      pushInference(parent, node.named.math_op);
    }
    if (node.named.boolean_op) {
      pushInference(parent, node.named.boolean_op);
    }
  },
  access_or_operation: (node, parent) => {
    visitChildren(node);
    pushToParent(node, parent);
    if (node.named.access) {
      pushInference(parent, node.named.access);
    }
  },
  new: (node, parent) => {
    resolveTypes(node);
    pushInference(parent, 'object');
  },
};

const functionHandlers = {
  func_def_params: (node) => {
    const scope = getCurrentScope();
    if (!scope.__currentFctParams) {
      scope.__currentFctParams = [];
    }
    if (node.named.annotation) {
      const annotation = getAnnotationType(node.named.annotation);
      if (annotation) {
        scope[node.named.name.value] = {
          type: annotation,
        };
        scope.__currentFctParams.push(annotation);
      } else {
        scope.__currentFctParams.push('any');
      }
    } else {
      scope.__currentFctParams.push('any');
    }
    visitChildren(node);
  },
  named_func_call: (node, parent) => {
    visitChildren(node);
    const { name } = node.named;
    const def = lookupVariable(name.value);
    if (def && def.params) {
      if (node.inference) {
        const result = TypeChecker.checkFunctionCall(node.inference, def.params, name.value);
        if (!result.valid) {
          result.warnings.forEach(warning => pushWarning(name, warning));
        }
      }
      if (def.type) {
        pushInference(parent, def.type);
      }
    }
  },
  func_def: (node, parent) => {
    const parentScope = getCurrentScope();
    const scope = pushScope();
    scope.__currentFctParams = [];
    scope.__returnTypes = [];
    
    visitChildren(node);
    
    // Anonymous functions as expressions should infer as 'function'
    if (parent && !node.named.name) {
      pushInference(parent, 'function');
    }
    
    if (node.named.name) {
      const { annotation } = node.named;
      const declaredType = annotation ? getAnnotationType(annotation) : null;
      
      // Debug logging for specific functions
      if (process.env.BLOP_DEBUG_TYPES && (node.named.name.value === 'handleBoolean' || node.named.name.value === 'getNestedValue')) {
        console.log(`\nFunction ${node.named.name.value}:`);
        console.log('  Return types collected:', scope.__returnTypes);
        console.log('  Declared type:', declaredType);
      }
      
      // Infer return type from actual returns
      let inferredType = 'any';
      if (scope.__returnTypes && scope.__returnTypes.length > 0) {
        // Filter out empty/undefined returns unless they're all undefined
        const explicitReturns = scope.__returnTypes.filter(t => t && t !== 'undefined');
        
        if (explicitReturns.length > 0) {
          // Create union type from all return types
          inferredType = createUnionType(explicitReturns);
        } else if (scope.__returnTypes.every(t => t === 'undefined')) {
          // All returns are undefined (bare return or no return)
          inferredType = 'undefined';
        }
      }
      
      // Use declared type if provided, otherwise use inferred type
      const finalType = declaredType || inferredType;
      
      // Validate inferred type matches declared type if both exist
      if (declaredType && inferredType !== 'any') {
        if (!isTypeCompatible(inferredType, declaredType)) {
          pushWarning(
            node.named.name,
            `Function '${node.named.name.value}' returns ${inferredType} but declared as ${declaredType}`
          );
        }
      }
      
      parentScope[node.named.name.value] = {
        source: 'func_def',
        type: finalType,
        inferredReturnType: inferredType,
        declaredReturnType: declaredType,
        node,
        params: scope.__currentFctParams,
      };
    }
    popScope();
  },
};

const statementHandlers = {
  GLOBAL_STATEMENT: resolveTypes,
  SCOPED_STATEMENTS: resolveTypes,
  SCOPED_STATEMENT: (node, parent) => {
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
    // Extract the alias name and its type
    const aliasName = node.named.name.value;
    const aliasType = parseTypeExpression(node.named.type);
    
    // Store the type alias
    typeAliases[aliasName] = aliasType;
    
    // Type aliases don't produce values, so don't push to parent
  },
  assign: (node, parent) => {
    if (node.named.name) {
      visit(node.named.exp, node);
      pushToParent(node, parent);
      pushInference(parent, node);
    }
  },
  condition: (node, parent) => {
    // Check if this is a typeof check that enables type narrowing
    const typeGuard = detectTypeofCheck(node.named.exp);
    
    if (typeGuard) {
      // Process expression first
      visit(node.named.exp, node);
      
      // Create a new scope for the if branch with narrowed type
      const ifScope = pushScope();
      applyNarrowing(ifScope, typeGuard.variable, typeGuard.checkType);
      
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
          applyExclusion(elseScope, typeGuard.variable, typeGuard.checkType);
          
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

// Combine all handlers into a single registry
const nodeHandlers = {
  ...literalHandlers,
  ...expressionHandlers,
  ...functionHandlers,
  ...statementHandlers,
};

// ============================================================================
// Visitor Pattern - Traverse AST and apply type inference
// ============================================================================

function visit(node, parent) {
  if (nodeHandlers[node.type]) {
    nodeHandlers[node.type](node, parent);
  } else if (nodeHandlers[node.type]) {
    nodeHandlers[node.type](node, parent);
  } else {
    visitChildren(node);
    pushToParent(node, parent);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run type inference on an AST and return any type warnings
 * @param {Object} node - Root AST node
 * @param {Array} _stream - Token stream for error reporting
 * @returns {Array} Array of type warning errors
 */
function inference(node, _stream) {
  warnings = [];
  functionScopes = [{}];
  typeAliases = {}; // Reset type aliases for each file
  stream = _stream;
  visit(node);
  return warnings;
}

module.exports = {
  check: visit,
  inference,
};
