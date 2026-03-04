// ============================================================================
// Type Guards - Pattern detection and type narrowing
// ============================================================================

import { narrowType, excludeType, parseUnionType, isUnionType, resolveTypeAlias, getPropertyType, stringToType } from './typeSystem.js';
import { LiteralType, StringType, NumberType, NullType, UndefinedType, PredicateType, ObjectType, TypeAlias } from './Type.js';
import { getBuiltinObjectType, isBuiltinObjectType } from './builtinTypes.js';

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
  
  // Look for pattern: typeof variable == 'type' OR typeof obj.prop == 'type'
  let hasTypeof = false;
  let hasComparison = false;
  let isNegated = false;
  let comparisonType = null;
  // property access candidate (obj.prop)
  let typeofVar = null;
  let typeofProp = null;

  // Pass 1: collect typeof presence, comparison operator, comparison string, and any property access
  // We need typeof to be present before relying on the property access, so do one flat scan first.
  let propertyAccessCandidates = []; // {obj, prop} pairs

  const scan = (node) => {
    if (!node) return;
    if (node.type === 'operand' && node.value && node.value.includes('typeof')) {
      hasTypeof = true;
    }
    if (node.type === 'boolean_operator' && ['==', '===', '!=', '!=='].includes(node.value)) {
      hasComparison = true;
      if (node.value === '!=' || node.value === '!==') isNegated = true;
    }
    if (node.type === 'str' && node.value) {
      const strValue = node.value.slice(1, -1);
      comparisonType = stringToType(strValue);
    }
    // Collect property access nodes (named.obj + named.prop)
    if (node.named?.prop && node.named?.obj) {
      const findFirstName = (n) => {
        if (!n) return null;
        if (n.type === 'name') return n.value;
        for (const c of (n.children || [])) { const r = findFirstName(c); if (r) return r; }
        return null;
      };
      const objName = findFirstName(node.named.obj);
      const propName = node.named.prop.value;
      if (objName && propName) propertyAccessCandidates.push({ obj: objName, prop: propName });
    }
    if (node.children) node.children.forEach(scan);
  };
  scan(expNode);

  if (!hasTypeof || !hasComparison || !comparisonType) return null;

  // Pass 2: resolve variable/property — prefer property access over plain name
  if (propertyAccessCandidates.length > 0) {
    typeofVar = propertyAccessCandidates[0].obj;
    typeofProp = propertyAccessCandidates[0].prop;
  } else {
    // Fall back to first plain name token
    const findFirstName = (node) => {
      if (!node) return null;
      if (node.type === 'name') return node.value;
      for (const c of (node.children || [])) { const r = findFirstName(c); if (r) return r; }
      return null;
    };
    typeofVar = findFirstName(expNode);
  }

  if (!typeofVar) return null;

  if (typeofProp) {
    return { variable: typeofVar, property: typeofProp, checkType: comparisonType, negated: isNegated };
  }
  return { variable: typeofVar, checkType: comparisonType, negated: isNegated };
}

/**
 * Apply a type transformation (narrow or exclude) to a variable in scope
 * @param {Function} typeOp - narrowType or excludeType
 * @param {Object} scope - Scope to update
 * @param {string} variable - Variable name
 * @param {*} effectType - Type operand for the operation
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 */
function applyTypeEffect(typeOp, scope, variable, effectType, lookupVariable) {
  const def = lookupVariable(variable);
  if (def && def.type) {
    scope[variable] = { ...def, type: typeOp(def.type, effectType), narrowed: true };
  }
}

/** Apply type narrowing to a scope (for if-true branch) */
function applyNarrowing(scope, variable, narrowedType, lookupVariable) {
  applyTypeEffect(narrowType, scope, variable, narrowedType, lookupVariable);
}

/** Apply type exclusion to a scope (for else branch) */
function applyExclusion(scope, variable, excludedType, lookupVariable) {
  applyTypeEffect(excludeType, scope, variable, excludedType, lookupVariable);
}

/**
 * Detect impossible literal comparisons in expressions
 * Returns warning message if comparison is impossible, null otherwise
 * @param {Object} expNode - Expression node to analyze
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 * @param {Object} typeAliases - Type aliases map
 * @returns {Object|null} { variable, comparedValue, varType } if impossible, null otherwise
 */
function detectImpossibleComparison(expNode, lookupVariable, typeAliases) {
  if (!expNode) {
    return null;
  }
  
  // Look for pattern: variable == "literal" OR object.property == "literal"
  // where literal is not in variable's/property's type union
  let names = [];
  let literalValue = null;
  let hasEqualityCheck = false;
  
  const checkNode = (node) => {
    if (!node) return;
    
    // Collect all variable names (for property access detection)
    if (node.type === 'name') {
      names.push(node.value);
    }
    
    // Check for string literal
    if (node.type === 'str' && !literalValue) {
      literalValue = node.value; // Keep quotes for now
    }
    
    // Check for number literal
    if (node.type === 'number' && !literalValue) {
      literalValue = node.value;
    }
    
    // Check for equality operator
    if (node.type === 'boolean_operator' && (node.value === '==' || node.value === '===')) {
      hasEqualityCheck = true;
    }
    
    // Recurse into children
    if (node.children) {
      node.children.forEach(checkNode);
    }
    
    // Check named properties
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object') {
          checkNode(child);
        }
      });
    }
  };
  
  checkNode(expNode);
  
  if (hasEqualityCheck && names.length > 0 && literalValue) {
    // Deduplicate names while preserving order
    const uniqueNames = [];
    const seen = new Set();
    for (const name of names) {
      if (!seen.has(name)) {
        seen.add(name);
        uniqueNames.push(name);
      }
    }
    
    let varType = null;
    let displayName = null;
    
    if (uniqueNames.length === 1) {
      // Simple variable comparison: variable == "literal"
      const varName = uniqueNames[0];
      const varDef = lookupVariable(varName);
      if (varDef && varDef.type) {
        varType = varDef.type;
        displayName = varName;
      }
    } else if (uniqueNames.length === 2) {
      // Property access: object.property == "literal"
      const [objectName, propertyName] = uniqueNames;
      const objectDef = lookupVariable(objectName);
      
      if (objectDef && objectDef.type) {
        // Use getPropertyType to resolve the property type
        varType = getPropertyType(objectDef.type, propertyName, typeAliases);
        displayName = `${objectName}.${propertyName}`;
      }
    }
    
    if (varType) {
      // Resolve type alias (in case the property type is also an alias)
      const resolvedType = resolveTypeAlias(varType, typeAliases);
      
      // Check if it's a union of string literals
      if (isUnionType(resolvedType)) {
        const unionTypes = parseUnionType(resolvedType);
        
        // Check if all union members are string/number literals (LiteralType objects)
        const allLiterals = unionTypes.every(t => {
          return t instanceof LiteralType && 
                 (t.baseType === StringType || t.baseType === NumberType);
        });
        
        if (allLiterals) {
          // Check if the compared value is in the union
          // literalValue still has quotes for string literals, e.g. `"hello"`
          const isInUnion = unionTypes.some(t => {
            if (t instanceof LiteralType && t.baseType === StringType) {
              return `"${t.value}"` === literalValue;
            }
            if (t instanceof LiteralType && t.baseType === NumberType) {
              return String(t.value) === literalValue;
            }
            return false;
          });
          
          if (!isInUnion) {
            return {
              variable: displayName,
              comparedValue: literalValue,
              varType: resolvedType,
              possibleValues: unionTypes
            };
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Detect equality checks used as type guards in expressions.
 * Handles patterns like: val == null, val === undefined, val === 'literal'
 * Returns { variable, checkType } if detected, null otherwise.
 * @param {Object} expNode - Expression node to analyze
 * @returns {Object|null} Type guard info or null
 */
function detectEqualityCheck(expNode) {
  if (!expNode) return null;

  let comparedType = null;
  let hasEqualityCheck = false;
  let isNegated = false;
  let hasTypeofKeyword = false;
  let propertyAccessCandidates = []; // {obj, prop} pairs
  let firstPlainName = null;

  const checkNode = (node) => {
    if (!node) return;

    // If there's a typeof operand, this is a typeof check — skip it
    if (node.type === 'operand' && node.value && node.value.includes('typeof')) {
      hasTypeofKeyword = true;
      return;
    }

    // Collect property access nodes (named.obj + named.prop) — takes priority over plain name
    if (node.named?.prop && node.named?.obj) {
      const findFirstName = (n) => {
        if (!n) return null;
        if (n.type === 'name') return n.value;
        for (const c of (n.children || [])) { const r = findFirstName(c); if (r) return r; }
        return null;
      };
      const objName = findFirstName(node.named.obj);
      const propName = node.named.prop.value;
      if (objName && propName) propertyAccessCandidates.push({ obj: objName, prop: propName });
    }

    // Capture first plain variable name as fallback
    if (node.type === 'name' && !firstPlainName) {
      firstPlainName = node.value;
    }

    // null literal
    if (node.type === 'null' && !comparedType) {
      comparedType = NullType;
    }

    // undefined literal
    if (node.type === 'undefined' && !comparedType) {
      comparedType = UndefinedType;
    }

    // String literal → LiteralType (e.g. val === 'active')
    if (node.type === 'str' && !comparedType) {
      const strValue = node.value.slice(1, -1);
      comparedType = new LiteralType(strValue, StringType);
    }

    // Number literal → LiteralType (e.g. val === 42)
    if (node.type === 'number' && !comparedType) {
      comparedType = new LiteralType(Number(node.value), NumberType);
    }

    // Equality operator (including negated forms)
    if (node.type === 'boolean_operator' && (node.value === '==' || node.value === '===' || node.value === '!=' || node.value === '!==')) {
      hasEqualityCheck = true;
      if (node.value === '!=' || node.value === '!==') isNegated = true;
    }

    if (node.children) {
      node.children.forEach(checkNode);
    }
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object') checkNode(child);
      });
    }
  };

  checkNode(expNode);

  if (hasTypeofKeyword || !hasEqualityCheck || !comparedType) return null;

  // Prefer property access over plain name
  if (propertyAccessCandidates.length > 0) {
    const { obj, prop } = propertyAccessCandidates[0];
    return { variable: obj, property: prop, checkType: comparedType, negated: isNegated };
  }

  if (firstPlainName) {
    return { variable: firstPlainName, checkType: comparedType, negated: isNegated };
  }

  return null;
}

/**
 * Detect truthiness checks: bare `if val { }` patterns.
 * Returns { variable, truthiness: true } when the condition is a plain variable
 * with no operators, enabling null/undefined exclusion in the if-branch.
 * @param {Object} expNode - Expression node to analyze
 * @returns {Object|null} Type guard info or null
 */
function detectTruthinessCheck(expNode) {
  if (!expNode) return null;

  let variableName = null;
  let hasComplexity = false;

  const checkNode = (node) => {
    if (!node || hasComplexity) return;

    // Any operator or typeof makes this a complex expression
    if (
      node.type === 'boolean_operator' ||
      node.type === 'math_operator' ||
      node.type === 'unary' ||
      node.type === 'func_call' ||
      (node.type === 'operand' && node.value?.includes('typeof'))
    ) {
      hasComplexity = true;
      return;
    }

    // A name_exp with no access = plain variable reference
    if (node.type === 'name_exp' && !node.named?.access && node.named?.name) {
      variableName = node.named.name.value;
      return; // don't recurse further into this subtree
    }

    if (node.children) node.children.forEach(checkNode);
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object') checkNode(child);
      });
    }
  };

  checkNode(expNode);

  if (!hasComplexity && variableName) {
    return { variable: variableName, truthiness: true };
  }

  return null;
}

/**
 * Exclude both null and undefined from a variable's type in scope.
 * Used for truthiness narrowing in if-branches.
 */
function applyNullishExclusion(scope, variable, lookupVariable) {
  applyExclusion(scope, variable, NullType, lookupVariable);
  applyExclusion(scope, variable, UndefinedType, lookupVariable);
}

/**
 * Apply a type transformation to a single named property of an object in scope.
 * Rebuilds the object type with the property type updated.
 * @param {Function} typeOp - narrowType or excludeType
 * @param {Object} scope - Scope to update
 * @param {string} variable - Object variable name
 * @param {string} property - Property name to narrow
 * @param {*} effectType - Type operand for the operation
 * @param {Function} lookupVariable - Function to lookup variables in scope chain
 * @param {Object} typeAliases - Type aliases map
 */
function applyPropertyTypeEffect(typeOp, scope, variable, property, effectType, lookupVariable, typeAliases) {
  const def = lookupVariable(variable);
  if (!def?.type) return;

  let resolvedType = resolveTypeAlias(def.type, typeAliases);
  // Fallback: if alias not in user typeAliases, check builtin object types (e.g. VNode)
  if (resolvedType instanceof TypeAlias && isBuiltinObjectType(resolvedType.name)) {
    const builtinMembers = getBuiltinObjectType(resolvedType.name);
    const props = new Map();
    for (const [key, val] of Object.entries(builtinMembers)) {
      props.set(key, { type: val, optional: false });
    }
    resolvedType = new ObjectType(props, null);
  }
  if (!(resolvedType instanceof ObjectType)) return;

  const propEntry = resolvedType.properties.get(property);
  if (!propEntry) return;

  const newPropType = typeOp(propEntry.type, effectType);
  const newProps = new Map(resolvedType.properties);
  newProps.set(property, { ...propEntry, type: newPropType });

  const newType = new ObjectType(newProps, resolvedType.indexSignature);
  if (resolvedType.readonly) newType.readonly = true;
  if (resolvedType.isClassInstance) newType.isClassInstance = true;

  scope[variable] = { ...def, type: newType, narrowed: true };
}

/**
 * Apply the correct scope effect for the if/true branch of a type guard.
 * - normal: narrows to the checked type
 * - negated: excludes the checked type
 * - truthiness: excludes null and undefined
 * @param {Object} typeAliases - Required when typeGuard.property is set
 */
function applyIfBranchGuard(scope, typeGuard, lookupVariable, typeAliases) {
  if (typeGuard.property) {
    if (typeGuard.negated) {
      applyPropertyTypeEffect(excludeType, scope, typeGuard.variable, typeGuard.property, typeGuard.checkType, lookupVariable, typeAliases);
    } else {
      applyPropertyTypeEffect(narrowType, scope, typeGuard.variable, typeGuard.property, typeGuard.checkType, lookupVariable, typeAliases);
    }
    return;
  }

  if (typeGuard.truthiness) {
    applyNullishExclusion(scope, typeGuard.variable, lookupVariable);
  } else if (typeGuard.negated) {
    applyExclusion(scope, typeGuard.variable, typeGuard.checkType, lookupVariable);
  } else {
    applyNarrowing(scope, typeGuard.variable, typeGuard.checkType, lookupVariable);
  }
}

/**
 * Apply the correct scope effect for the else/false branch of a type guard.
 * - normal: excludes the checked type
 * - negated: narrows to the checked type
 * - truthiness: no narrowing (falsy branch includes unknown falsy values)
 * @param {Object} typeAliases - Required when typeGuard.property is set
 */
function applyElseBranchGuard(scope, typeGuard, lookupVariable, typeAliases) {
  if (typeGuard.property) {
    if (typeGuard.negated) {
      applyPropertyTypeEffect(narrowType, scope, typeGuard.variable, typeGuard.property, typeGuard.checkType, lookupVariable, typeAliases);
    } else {
      applyPropertyTypeEffect(excludeType, scope, typeGuard.variable, typeGuard.property, typeGuard.checkType, lookupVariable, typeAliases);
    }
    return;
  }
  if (typeGuard.truthiness) {
    // falsy branch: we don't know which falsy value it is — leave type unchanged
  } else if (typeGuard.negated) {
    applyNarrowing(scope, typeGuard.variable, typeGuard.checkType, lookupVariable);
  } else {
    applyExclusion(scope, typeGuard.variable, typeGuard.checkType, lookupVariable);
  }
}

/**
 * Apply the correct scope effect to the outer scope after an early-return if guard.
 * Same semantics as applyElseBranchGuard: code past the if block is the "false" path.
 * @param {Object} typeAliases - Required when typeGuard.property is set
 */
function applyPostIfGuard(scope, typeGuard, lookupVariable, typeAliases) {
  if (typeGuard.property) {
    if (typeGuard.negated) {
      applyPropertyTypeEffect(narrowType, scope, typeGuard.variable, typeGuard.property, typeGuard.checkType, lookupVariable, typeAliases);
    } else {
      applyPropertyTypeEffect(excludeType, scope, typeGuard.variable, typeGuard.property, typeGuard.checkType, lookupVariable, typeAliases);
    }
    return;
  }
  if (typeGuard.truthiness) {
    // no narrowing — callers can only reach here when val was falsy (unknown)
  } else if (typeGuard.negated) {
    applyNarrowing(scope, typeGuard.variable, typeGuard.checkType, lookupVariable);
  } else {
    applyExclusion(scope, typeGuard.variable, typeGuard.checkType, lookupVariable);
  }
}

/**
 * Detect user-defined type predicate calls.
 * Requires the expression to have already been visited (so inferredType is stamped)
 * and for handleFuncCallAccess to have stamped __predicateArg on the call node.
 * Returns { variable, checkType } if detected, null otherwise.
 * @param {Object} expNode - Already-visited expression node
 * @returns {Object|null}
 */
function detectPredicateGuard(expNode) {
  if (!expNode?.inferredType) return null;
  if (!(expNode.inferredType instanceof PredicateType)) return null;
  const varName = expNode.__predicateArg;
  if (!varName) return null;
  return { variable: varName, checkType: expNode.inferredType.guardType, negated: false };
}

export {
  detectTypeofCheck,
  detectEqualityCheck,
  detectTruthinessCheck,
  detectPredicateGuard,
  applyNarrowing,
  applyExclusion,
  applyIfBranchGuard,
  applyElseBranchGuard,
  applyPostIfGuard,
  detectImpossibleComparison,
};
