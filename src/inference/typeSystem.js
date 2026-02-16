// ============================================================================
// Type System - Type aliases, unions, narrowing, and compatibility checking
// ============================================================================

/**
 * Resolve a type alias to its underlying type
 * @param {string} type - Type name that might be an alias
 * @param {Object} typeAliases - Map of type aliases
 * @returns {string} The resolved type (or original if not an alias)
 */
/**
 * Parse an object type string like "{name: string, id: number}" into a structured format
 * @param {string} objectTypeString - Object type string from type definition
 * @returns {Object|null} Object with property names as keys and types as values, or null if invalid
 */
function parseObjectTypeString(objectTypeString) {
  if (!objectTypeString || typeof objectTypeString !== 'string') {
    return null;
  }
  
  // Check if it's an object type
  if (!objectTypeString.startsWith('{') || !objectTypeString.endsWith('}')) {
    return null;
  }
  
  // Empty object
  if (objectTypeString === '{}') {
    return {};
  }
  
  // Extract the content between braces
  const content = objectTypeString.slice(1, -1).trim();
  if (!content) {
    return {};
  }
  
  const properties = {};
  
  // Split by comma, but be careful of nested structures and unions
  const parts = [];
  let current = '';
  let depth = 0;
  let inUnion = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '|' && depth === 0) inUnion = true;
    else if (char === ',' && depth === 0 && !inUnion) {
      parts.push(current.trim());
      current = '';
      inUnion = false;
      continue;
    }
    
    current += char;
    if (char !== '|' && char !== ' ') inUnion = false;
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  // Parse each part as "key: type" or "key?: type"
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    
    let key = part.slice(0, colonIndex).trim();
    const type = part.slice(colonIndex + 1).trim();
    
    // Check if the property is optional (key ends with ?)
    const isOptional = key.endsWith('?');
    if (isOptional) {
      key = key.slice(0, -1).trim();
    }
    
    if (key && type) {
      properties[key] = {
        type: type,
        optional: isOptional
      };
    }
  }
  
  return properties;
}

/**
 * Check if two object type structures are compatible (structural typing)
 * @param {Object} valueStructure - The structure of the value being assigned (properties can be strings or {type, optional})
 * @param {Object} targetStructure - The expected structure from type definition (properties are {type, optional})
 * @param {Object} typeAliases - Type aliases for resolving nested types
 * @returns {Object} { compatible: boolean, errors: string[] }
 */
function checkObjectStructuralCompatibility(valueStructure, targetStructure, typeAliases = {}) {
  const errors = [];
  
  if (!valueStructure || !targetStructure) {
    return { compatible: false, errors: ['Invalid object structures'] };
  }
  
  // Check all required properties in target exist in value
  for (const [key, targetProp] of Object.entries(targetStructure)) {
    // Extract type and optional flag from target
    const targetType = typeof targetProp === 'string' ? targetProp : targetProp.type;
    const isOptional = typeof targetProp === 'object' && targetProp.optional === true;
    
    if (!(key in valueStructure)) {
      // Skip error for optional properties
      if (!isOptional) {
        errors.push(`Missing property '${key}'`);
      }
      continue;
    }
    
    // Extract type from value (handle both string and object formats)
    const valueType = typeof valueStructure[key] === 'string' 
      ? valueStructure[key] 
      : valueStructure[key].type;
    
    // Check if the property type is compatible
    if (!isTypeCompatible(valueType, targetType, typeAliases)) {
      errors.push(`Property '${key}' has type ${valueType} but expected ${targetType}`);
    }
  }
  
  // Check for excess properties (optional, could be a warning instead)
  for (const key of Object.keys(valueStructure)) {
    if (!(key in targetStructure)) {
      errors.push(`Excess property '${key}' not in type definition`);
    }
  }
  
  return {
    compatible: errors.length === 0,
    errors
  };
}

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
  
  // Check if it's a generic type instantiation like "Box<number>"
  const genericMatch = type.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, baseType, argsString] = genericMatch;
    
    // Check if the base type is a generic type alias
    const aliasInfo = typeAliases[baseType];
    if (aliasInfo && typeof aliasInfo === 'object' && aliasInfo.genericParams) {
      // Parse type arguments (simple comma split for now)
      const typeArgs = argsString.split(',').map(arg => arg.trim());
      
      // Create substitution map
      const substitutions = {};
      for (let i = 0; i < aliasInfo.genericParams.length && i < typeArgs.length; i++) {
        substitutions[aliasInfo.genericParams[i]] = typeArgs[i];
      }
      
      // Apply substitutions to the aliased type
      const instantiated = substituteType(aliasInfo.type, substitutions);
      
      // Recursively resolve in case the result contains more aliases
      return resolveTypeAlias(instantiated, typeAliases);
    }
    
    // Not a generic alias, return as-is
    return type;
  }
  
  // Resolve the alias itself (non-generic)
  if (typeAliases[type]) {
    const aliasValue = typeAliases[type];
    
    // Check if it's a generic type alias (should not be instantiated without args)
    if (typeof aliasValue === 'object' && aliasValue.genericParams) {
      // Generic type used without type arguments - return as-is or error
      // For now, return the raw type (could be enhanced to show error)
      return type;
    }
    
    // Regular alias - recursively resolve
    return resolveTypeAlias(aliasValue, typeAliases);
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
  let uniqueTypes = [...new Set(types.filter(t => t && t !== 'any'))];
  
  if (uniqueTypes.length === 0) {
    return 'any';
  }
  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }
  
  // Simplify unions: if a base type is present, remove its literals
  // e.g., "true" | "false" | boolean → boolean
  // e.g., "hello" | "world" | string → string
  // e.g., 1 | 2 | 3 | number → number
  const hasString = uniqueTypes.includes('string');
  const hasNumber = uniqueTypes.includes('number');
  const hasBoolean = uniqueTypes.includes('boolean');
  
  if (hasString || hasNumber || hasBoolean) {
    uniqueTypes = uniqueTypes.filter(t => {
      const base = getBaseTypeOfLiteral(t);
      // Remove literal if its base type is in the union
      if (base !== t) {
        if (base === 'string' && hasString) return false;
        if (base === 'number' && hasNumber) return false;
        if (base === 'boolean' && hasBoolean) return false;
      }
      return true;
    });
  }
  
  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }
  
  return uniqueTypes.join(' | ');
}

/**
 * Check if a type is a string literal type
 * @param {string} type - Type to check
 * @returns {boolean}
 */
function isStringLiteral(type) {
  return typeof type === 'string' && type.startsWith('"') && type.endsWith('"');
}

/**
 * Check if a type is a number literal type
 * @param {string} type - Type to check
 * @returns {boolean}
 */
function isNumberLiteral(type) {
  return typeof type === 'string' && /^-?\d+(\.\d+)?$/.test(type);
}

/**
 * Check if a type is a boolean literal type
 * @param {string} type - Type to check
 * @returns {boolean}
 */
function isBooleanLiteral(type) {
  return type === 'true' || type === 'false';
}

/**
 * Get the base type of a literal (e.g., "hello" -> string, 42 -> number)
 * @param {string} type - Literal type
 * @returns {string} Base type
 */
function getBaseTypeOfLiteral(type) {
  if (isStringLiteral(type)) return 'string';
  if (isNumberLiteral(type)) return 'number';
  if (isBooleanLiteral(type)) return 'boolean';
  return type;
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
  
  // Literal type widening: literal types can be assigned to their base types
  // e.g., "hello" can be assigned to string, 42 can be assigned to number
  const valueBaseType = getBaseTypeOfLiteral(resolvedValueType);
  if (valueBaseType !== resolvedValueType && valueBaseType === resolvedTargetType) {
    return true;
  }
  
  // Allow generic "array" to be compatible with typed arrays like "number[]"
  if (resolvedValueType === 'array' && resolvedTargetType.endsWith('[]')) {
    return true;
  }
  
  // Allow typed arrays like "number[]" to be compatible with generic "array"
  if (resolvedValueType.endsWith('[]') && resolvedTargetType === 'array') {
    return true;
  }
  
  // Allow union arrays like "(string | null)[]" to be compatible with generic "array"
  if (resolvedValueType.match(/\(.+\)\[\]$/) && resolvedTargetType === 'array') {
    return true;
  }
  
  // Allow generic "object" to be compatible with any object-based type
  if (resolvedValueType === 'object' && resolvedTargetType === 'object') {
    return true;
  }
  
  // Allow object structure to be compatible with generic "object" (widening)
  if (resolvedValueType.startsWith('{') && resolvedTargetType === 'object') {
    return true;
  }
  
  // Structural type checking for object types
  // Both value and target are object type structures like "{name: string, id: number}"
  if (resolvedValueType.startsWith('{') && resolvedTargetType.startsWith('{')) {
    const valueStructure = parseObjectTypeString(resolvedValueType);
    const targetStructure = parseObjectTypeString(resolvedTargetType);
    
    if (valueStructure && targetStructure) {
      const result = checkObjectStructuralCompatibility(valueStructure, targetStructure, typeAliases);
      return result.compatible;
    }
    
    // If parsing failed, fall back to string comparison
    return resolvedValueType === resolvedTargetType;
  }
  
  // Generic "object" assigned to an object type structure - not enough information
  // This should ideally not happen if we infer proper structures for object literals
  if (resolvedValueType === 'object' && resolvedTargetType.startsWith('{')) {
    return true; // Allow for now, but this won't validate structure
  }
  
  // Check if valueType is in targetType's union
  if (isUnionType(resolvedTargetType)) {
    const targetTypes = parseUnionType(resolvedTargetType);
    if (isUnionType(resolvedValueType)) {
      const valueTypes = parseUnionType(resolvedValueType);
      // All value types must be compatible with at least one target type
      return valueTypes.every(vt => 
        targetTypes.some(tt => isTypeCompatible(vt, tt, typeAliases))
      );
    }
    // Single value type must be compatible with at least one target type
    return targetTypes.some(tt => isTypeCompatible(resolvedValueType, tt, typeAliases));
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
 * Handles basic types, array types, object types, literal types, and generic type instantiation
 * @param {Object} typePrimaryNode - The type_primary AST node
 * @returns {string} The parsed type string
 */
function parseTypePrimary(typePrimaryNode) {
  if (!typePrimaryNode || !typePrimaryNode.named) return 'any';
  
  // Check for object type
  if (typePrimaryNode.children && typePrimaryNode.children[0] && 
      typePrimaryNode.children[0].type === 'object_type') {
    return parseObjectType(typePrimaryNode.children[0]);
  }
  
  // Check for string literal type
  if (typePrimaryNode.named.literal && typePrimaryNode.named.literal.type === 'str') {
    // Strip quotes from the token value (which includes quotes like 'hello' or "hello")
    const rawValue = typePrimaryNode.named.literal.value.slice(1, -1);
    return `"${rawValue}"`;
  }
  
  // Check for number literal type
  if (typePrimaryNode.named.literal && typePrimaryNode.named.literal.type === 'number') {
    return typePrimaryNode.named.literal.value;
  }
  
  const { name, type_args } = typePrimaryNode.named;
  if (!name) return 'any';
  
  // name is now a type_name node, get its first child
  const typeToken = name.children ? name.children[0] : name;
  const typeName = typeToken.value;
  
  // Check if it's a generic type instantiation: Type<Args>
  if (type_args) {
    const typeArgs = parseGenericArguments(type_args);
    const instantiatedType = `${typeName}<${typeArgs.join(', ')}>`;
    
    // Check if it's also an array: Type<Args>[]
    const hasArrayBrackets = typePrimaryNode.children?.some((child, i) => 
      child.value === '[' && typePrimaryNode.children[i + 1]?.value === ']'
    );
    
    if (hasArrayBrackets) {
      return `${instantiatedType}[]`;
    }
    
    return instantiatedType;
  }
  
  // Check if it's an array type (has [ ] after the name)
  // The grammar matches: ['type_name:name', '[', ']']
  if (typePrimaryNode.children && typePrimaryNode.children.length > 1) {
    return `${typeName}[]`;
  }
  
  return typeName;
}

/**
 * Parse an object_type AST node into a type string
 * @param {Object} objectTypeNode - The object_type AST node
 * @returns {string} The parsed type string like "{name: string, id: number}"
 */
function parseObjectType(objectTypeNode) {
  if (!objectTypeNode || !objectTypeNode.named || !objectTypeNode.named.properties) {
    return '{}'; // Empty object type
  }
  
  // Collect all properties from the recursive properties structure
  function collectProperties(propertiesNode) {
    if (!propertiesNode) return [];
    
    const props = [];
    let current = propertiesNode;
    
    // Handle the recursive structure: object_type_properties can contain another object_type_properties
    while (current) {
      // Find the object_type_property node
      const propertyNode = current.children ? current.children.find(c => c.type === 'object_type_property') : null;
      
      if (propertyNode && propertyNode.named && propertyNode.named.key && propertyNode.named.valueType) {
        const key = propertyNode.named.key.value;
        const valueType = parseTypeExpression(propertyNode.named.valueType);
        const isOptional = propertyNode.named.optional ? true : false;
        
        if (isOptional) {
          props.push(`${key}?: ${valueType}`);
        } else {
          props.push(`${key}: ${valueType}`);
        }
      }
      
      // Check for nested object_type_properties
      const nested = current.children ? current.children.find(c => c.type === 'object_type_properties') : null;
      current = nested;
    }
    
    return props;
  }
  
  const propertyStrings = collectProperties(objectTypeNode.named.properties);
  return `{${propertyStrings.join(', ')}}`;
}

// ============================================================================
// Generic Type System
// ============================================================================

/**
 * Parse generic parameters from generic_params AST node
 * @param {Object} genericParamsNode - The generic_params AST node
 * @returns {string[]} Array of type parameter names (e.g., ['T', 'U'])
 */
function parseGenericParams(genericParamsNode) {
  if (!genericParamsNode || !genericParamsNode.named || !genericParamsNode.named.params) {
    return [];
  }
  
  const params = [];
  let current = genericParamsNode.named.params;
  
  // Traverse the recursive generic_param_list structure
  while (current) {
    if (current.named && current.named.param) {
      params.push(current.named.param.value);
    }
    current = current.named ? current.named.rest : null;
  }
  
  return params;
}

/**
 * Parse generic type arguments from type_arg_list AST node
 * @param {Object} typeArgListNode - The type_arg_list AST node
 * @returns {string[]} Array of type arguments (e.g., ['number', 'string'])
 */
function parseGenericArguments(typeArgListNode) {
  if (!typeArgListNode) {
    return [];
  }
  
  const args = [];
  let current = typeArgListNode;
  
  // Traverse the recursive type_arg_list structure
  while (current) {
    if (current.named && current.named.arg) {
      const argType = parseTypeExpression(current.named.arg);
      args.push(argType);
    }
    current = current.named ? current.named.rest : null;
  }
  
  return args;
}

/**
 * Check if a type string is a generic type parameter (single uppercase letter or name)
 * @param {string} type - Type string to check
 * @param {string[]} genericParams - List of generic parameter names in scope
 * @returns {boolean}
 */
function isGenericTypeParameter(type, genericParams = []) {
  if (!type || typeof type !== 'string') return false;
  
  // Check if it's in the list of current generic parameters
  if (genericParams.includes(type)) {
    return true;
  }
  
  // Fallback: single uppercase letter (T, U, V, K, etc.)
  return /^[A-Z]$/.test(type);
}

/**
 * Substitute generic type parameters with concrete types
 * @param {string} type - Type string that may contain type parameters
 * @param {Object} substitutions - Map of type parameter names to concrete types (e.g., {T: 'number', U: 'string'})
 * @returns {string} Type with substitutions applied
 */
function substituteType(type, substitutions = {}) {
  if (!type || typeof type !== 'string') return type;
  
  // Direct substitution for simple type parameter
  if (substitutions[type]) {
    return substitutions[type];
  }
  
  // Handle union types
  if (isUnionType(type)) {
    const types = parseUnionType(type);
    const substituted = types.map(t => substituteType(t, substitutions));
    return createUnionType(substituted);
  }
  
  // Handle array types
  if (type.endsWith('[]')) {
    const elementType = type.slice(0, -2);
    const substitutedElement = substituteType(elementType, substitutions);
    return substitutedElement + '[]';
  }
  
  // Handle object types
  if (type.startsWith('{') && type.endsWith('}')) {
    const structure = parseObjectTypeString(type);
    if (!structure) return type;
    
    const substitutedProps = [];
    for (const [key, prop] of Object.entries(structure)) {
      const propType = typeof prop === 'string' ? prop : prop.type;
      const optional = typeof prop === 'object' && prop.optional;
      const substitutedType = substituteType(propType, substitutions);
      
      if (optional) {
        substitutedProps.push(`${key}?: ${substitutedType}`);
      } else {
        substitutedProps.push(`${key}: ${substitutedType}`);
      }
    }
    
    return `{${substitutedProps.join(', ')}}`;
  }
  
  // Handle generic type instantiation like "Box<T>" -> "Box<number>"
  // This is a simplified version - full implementation would need proper parsing
  const genericMatch = type.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, baseType, args] = genericMatch;
    // Parse and substitute each argument
    const argTypes = args.split(',').map(arg => arg.trim());
    const substitutedArgs = argTypes.map(arg => substituteType(arg, substitutions));
    return `${baseType}<${substitutedArgs.join(', ')}>`;
  }
  
  // No substitution needed
  return type;
}

/**
 * Infer generic type arguments from function call
 * @param {string[]} genericParams - Generic parameter names (e.g., ['T', 'U'])
 * @param {string[]} paramTypes - Expected parameter types (may contain type variables)
 * @param {string[]} argTypes - Actual argument types from call site
 * @param {Object} typeAliases - Type aliases for compatibility checking
 * @returns {Object} Object with `substitutions` map and `errors` array
 */
function inferGenericArguments(genericParams, paramTypes, argTypes, typeAliases = {}) {
  const substitutions = {};
  const errors = [];
  
  if (!genericParams || genericParams.length === 0) {
    return { substitutions, errors };
  }
  
  // Iterate through parameters and arguments to collect constraints
  for (let i = 0; i < Math.min(paramTypes.length, argTypes.length); i++) {
    const paramType = paramTypes[i];
    const argType = argTypes[i];
    
    if (!paramType || !argType) continue;
    
    // Simple case: parameter is directly a type parameter
    if (genericParams.includes(paramType)) {
      if (substitutions[paramType]) {
        // Type parameter already inferred - check consistency
        const existingType = substitutions[paramType];
        
        if (existingType !== argType) {
          // Check if both are literals of the same base type
          const argBase = getBaseTypeOfLiteral(argType);
          const existingBase = getBaseTypeOfLiteral(existingType);
          
          if (argBase === existingBase && argBase !== argType) {
            // Both are literals of the same base type (e.g., 1 and 2 are both numbers)
            // Unify to the base type
            substitutions[paramType] = argBase;
          } else {
            // Check if types are compatible before reporting error
            const compatible = isTypeCompatible(argType, existingType, typeAliases) ||
                             isTypeCompatible(existingType, argType, typeAliases);
            
            if (!compatible) {
              errors.push(
                `Type parameter ${paramType} inferred as both ${existingType} and ${argType} (param ${i + 1})`
              );
            } else {
              // Types are compatible - use more specific type if one is a literal
              if (argBase === existingType && argType !== existingType) {
                // argType is a literal of existingType - keep existingType
              } else if (existingBase === argType && existingType !== argType) {
                // existingType is a literal of argType - keep argType
                substitutions[paramType] = argType;
              } else if (argType === 'any') {
                // Keep existing type
              } else if (existingType === 'any') {
                substitutions[paramType] = argType;
              }
              // Otherwise keep the existing type
            }
          }
        }
      } else {
        substitutions[paramType] = argType;
      }
      continue;
    }
    
    // Array case: T[] with number[] => T = number
    if (paramType.endsWith('[]') && argType.endsWith('[]')) {
      const paramElement = paramType.slice(0, -2);
      const argElement = argType.slice(0, -2);
      
      if (genericParams.includes(paramElement)) {
        if (substitutions[paramElement]) {
          const existingType = substitutions[paramElement];
          
          if (existingType !== argElement) {
            // Check if both are literals of the same base type
            const argBase = getBaseTypeOfLiteral(argElement);
            const existingBase = getBaseTypeOfLiteral(existingType);
            
            if (argBase === existingBase && argBase !== argElement) {
              // Both are literals of the same base type - unify to base type
              substitutions[paramElement] = argBase;
            } else {
              const compatible = isTypeCompatible(argElement, existingType, typeAliases) ||
                               isTypeCompatible(existingType, argElement, typeAliases);
              
              if (!compatible) {
                errors.push(
                  `Type parameter ${paramElement} inferred as both ${existingType}[] and ${argElement}[] (param ${i + 1})`
                );
              }
            }
          }
        } else {
          substitutions[paramElement] = argElement;
        }
      }
      continue;
    }
    
    // Union type case: T | null with specific type => T = specific type
    if (paramType.includes(' | ') && !argType.includes(' | ')) {
      const unionTypes = parseUnionType(paramType);
      
      // Check if one of the union members is a type parameter
      for (const unionMember of unionTypes) {
        if (genericParams.includes(unionMember)) {
          // Try to infer the type parameter from the argument
          // If argType matches another member of the union, we can't infer
          // Otherwise, infer T as argType
          const otherMembers = unionTypes.filter(t => t !== unionMember);
          const matchesOther = otherMembers.some(t => 
            isTypeCompatible(argType, t, typeAliases)
          );
          
          if (!matchesOther) {
            if (substitutions[unionMember]) {
              const existingType = substitutions[unionMember];
              if (existingType !== argType) {
                const compatible = isTypeCompatible(argType, existingType, typeAliases) ||
                                 isTypeCompatible(existingType, argType, typeAliases);
                if (!compatible) {
                  errors.push(
                    `Type parameter ${unionMember} inferred as both ${existingType} and ${argType} (param ${i + 1})`
                  );
                }
              }
            } else {
              substitutions[unionMember] = argType;
            }
          }
        }
      }
    }
    
    // Object type inference - simplified for now
    // Future: traverse object structures and infer nested type parameters
  }
  
  // Fill in any remaining unresolved type parameters with 'any'
  for (const param of genericParams) {
    if (!substitutions[param]) {
      substitutions[param] = 'any';
    }
  }
  
  return { substitutions, errors };
}

/**
 * Instantiate a generic type with concrete type arguments
 * @param {string} genericType - Generic type name (e.g., 'Box')
 * @param {string[]} typeArgs - Type arguments (e.g., ['number'])
 * @param {Object} typeAliases - Type aliases map
 * @returns {string} Instantiated type
 */
function instantiateGenericType(genericType, typeArgs, typeAliases) {
  const aliasInfo = typeAliases[genericType];
  
  if (!aliasInfo || !aliasInfo.genericParams) {
    // Not a generic type, return as-is
    return genericType;
  }
  
  const { genericParams, type } = aliasInfo;
  
  // Create substitution map
  const substitutions = {};
  for (let i = 0; i < genericParams.length && i < typeArgs.length; i++) {
    substitutions[genericParams[i]] = typeArgs[i];
  }
  
  // Apply substitutions
  return substituteType(type, substitutions);
}

export {
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
  parseObjectType,
  parseObjectTypeString,
  checkObjectStructuralCompatibility,
  isStringLiteral,
  isNumberLiteral,
  isBooleanLiteral,
  getBaseTypeOfLiteral,
  // Generic type system
  parseGenericParams,
  parseGenericArguments,
  isGenericTypeParameter,
  substituteType,
  inferGenericArguments,
  instantiateGenericType,
};
