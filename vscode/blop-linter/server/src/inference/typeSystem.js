// ============================================================================
// Type System - Type aliases, unions, narrowing, and compatibility checking
// ============================================================================

/**
 * Resolve a type alias to its underlying type
 * @param {string} type - Type name that might be an alias
 * @param {Object} typeAliases - Map of type aliases
 * @returns {string} The resolved type (or original if not an alias)
 */
function resolveTypeAlias(type, typeAliases) {
  if (!type || typeof type !== 'string') return type;
  
  // Check if it's a union or intersection type
  if (type.includes(' | ') || type.includes(' & ')) {
    // Parse and resolve each component
    const separator = type.includes(' | ') ? ' | ' : ' & ';
    const types = type.split(separator).map(t => t.trim());
    const resolved = types.map(t => resolveTypeAlias(t, typeAliases));
    return resolved.join(separator);
  }
  
  // Check if it's an array type
  if (type.endsWith('[]')) {
    const elementType = type.slice(0, -2);
    return resolveTypeAlias(elementType, typeAliases) + '[]';
  }
  
  // Resolve the alias itself
  if (typeAliases[type]) {
    // Recursively resolve in case an alias points to another alias
    return resolveTypeAlias(typeAliases[type], typeAliases);
  }
  
  return type;
}

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
 * @param {Object} typeAliases - Map of type aliases
 * @returns {boolean}
 */
function isTypeCompatible(valueType, targetType, typeAliases = {}) {
  // Resolve type aliases first
  const resolvedValueType = resolveTypeAlias(valueType, typeAliases);
  const resolvedTargetType = resolveTypeAlias(targetType, typeAliases);
  
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

module.exports = {
  resolveTypeAlias,
  isUnionType,
  parseUnionType,
  createUnionType,
  isTypeCompatible,
  removeNullish,
  narrowType,
  excludeType,
  getAnnotationType,
  parseTypeExpression,
  parseTypePrimary,
};
