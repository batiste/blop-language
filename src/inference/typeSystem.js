// ============================================================================
// Type System - Refactored to use structured Type objects
// ============================================================================
// This module provides the main interface for type operations using the
// structured Type system. All types are Type objects, never strings.
// ============================================================================

// NOTE: String-based type APIs (from legacy code) are consolidated in
// stringToType() and primitiveFromName() for backward compatibility in
// resolveTypeAlias() which handles type alias lookup by name.

import {
  Type, Types, TypeAliasMap,
  PrimitiveType, LiteralType, ArrayType, ObjectType, UnionType,
  IntersectionType, GenericType, FunctionType, TypeAlias,
  substituteTypeParams, createUnion,
  StringType, NumberType, BooleanType, NullType, UndefinedType,
  AnyType, NeverType, AnyFunctionType
} from './Type.js';
import { parseAnnotation, parseTypeExpression, parseGenericParams, getBaseType, primitiveFromName } from './typeParser.js';
import { getBuiltinObjectType, isBuiltinObjectType, getPrimitiveMemberType, getArrayMemberType } from './builtinTypes.js';


function resolveGenericType(type, aliasMap) {
  if (type instanceof GenericType) {
    let baseName = null;
    if (type.baseType instanceof TypeAlias) {
      baseName = type.baseType.name;
    } else {
      baseName = type.baseType.toString();
    }
    return aliasMap.instantiate(baseName, type.typeArgs);
  }
  return type;
}

function resolveAliasType(type, aliasMap) {
  if (type instanceof TypeAlias) {
    return aliasMap.resolve(type);
  }
  return type;
}

/**
 * Check if a type is compatible with another type
 * @param {Type|string} valueType - The type being assigned
 * @param {Type|string} targetType - The target type
 * @param {TypeAliasMap} aliases - Type aliases map
 * @returns {boolean}
 */
export function isTypeCompatible(valueType, targetType, aliases) {
  const aliasMap = aliases instanceof TypeAliasMap ? aliases : stringMapToTypeAliasMap(aliases);

  // All types should be Type objects from grammar parsing, never strings
  if (typeof valueType === 'string' || typeof targetType === 'string') {
    throw new Error(
      `isTypeCompatible expects Type objects, not strings. ` +
      `Use parseAnnotation() or parseTypeExpression() to parse AST nodes into Type objects. ` +
      `Got: valueType=${typeof valueType}, targetType=${typeof targetType}`
    );
  }

  const resolvedValue = resolveAliasType(resolveGenericType(valueType, aliasMap), aliasMap);
  const resolvedTarget = resolveAliasType(resolveGenericType(targetType, aliasMap), aliasMap);
  
  return resolvedValue.isCompatibleWith(resolvedTarget, aliasMap);
}

/**
 * Resolve a type alias to its underlying type
 * @param {Type|string} type - Type that might be an alias
 * @param {TypeAliasMap|Object} aliases - Type aliases
 * @returns {Type|string} Resolved type (matches input format)
 */
export function resolveTypeAlias(type, aliases) {
  const aliasMap = aliases instanceof TypeAliasMap ? aliases : stringMapToTypeAliasMap(aliases);
  
  if (typeof type === 'string') {
    const typeObj = stringToType(type);
    return aliasMap.resolve(typeObj);
  }
  
  return aliasMap.resolve(type);
}

/**
 * Create a union type from multiple types
 * @param {Array<Type|string>} types - Types to union
 * @returns {Type|string} Union type (matches input format)
 */
export function createUnionType(types) {
  if (types.length === 0) return AnyType;
  return createUnion(types);
}

/**
 * Remove null and undefined from a type (for nullish coalescing)
 * @param {Type|string} type - Type to process
 * @returns {Type|string} Type without null/undefined (matches input format)
 */
export function removeNullish(type) {
  if (type instanceof UnionType) {
    return type.removeNullish();
  }
  
  if (type instanceof PrimitiveType && (type.name === 'null' || type.name === 'undefined')) {
    return NeverType;
  }
  
  return type;
}

/**
 * Narrow a union type to only specified type
 * @param {Type|string} type - Original type
 * @param {Type|string} narrowedType - Type to narrow to
 * @returns {Type|string} Narrowed type (matches input format)
 */
export function narrowType(type, narrowedType) {
  if (type instanceof UnionType) {
    return type.narrow(narrowedType);
  }
  
  if (type.equals(narrowedType)) {
    return type;
  }
  
  return NeverType;
}

/**
 * Narrow a union type by removing specified type (for else branches)
 * @param {Type|string} type - Original type
 * @param {Type|string} excludedType - Type to exclude
 * @returns {Type|string} Type with excluded types removed (matches input format)
 */
export function excludeType(type, excludedType) {
  if (type instanceof PrimitiveType && type.name === 'any') {
    return AnyType;
  }
  
  if (type instanceof UnionType) {
    return type.exclude(excludedType);
  }
  
  if (type.equals(excludedType)) {
    return NeverType;
  }
  
  return type;
}

/**
 * Get the property type from an object type
 * @param {Type|string} objectType - Object type
 * @param {string|string[]} propertyPath - Property name or path
 * @param {TypeAliasMap|Object} aliases - Type aliases
 * @returns {Type|string|null} Property type or null (matches input format)
 */
export function getPropertyType(objectType, propertyPath, aliases) {
  const aliasMap = aliases instanceof TypeAliasMap ? aliases : stringMapToTypeAliasMap(aliases);
  return getPropertyTypeFromType(objectType, propertyPath, aliasMap);
}

function getPropertyTypeFromType(type, propertyPath, aliases) {
  if (type instanceof PrimitiveType && type.name === 'any') {
    return AnyType;
  }
  
  // Resolve alias
  let resolvedType = aliases.resolve(type);
  
  // Handle unions - get property from non-nullish parts
  if (resolvedType instanceof UnionType) {
    resolvedType = resolvedType.removeNullish();
    if (resolvedType instanceof PrimitiveType && resolvedType.name === 'never') {
      return null;
    }
  }
  
  // Convert single property to array
  const properties = Array.isArray(propertyPath) ? propertyPath : [propertyPath];
  
  let currentType = resolvedType;
  
  for (const propName of properties) {
    if (currentType instanceof PrimitiveType && currentType.name === 'any') {
      return AnyType;
    }
    
    // Check primitive types (string, number, boolean)
    if (currentType instanceof PrimitiveType) {
      const memberType = getPrimitiveMemberType(currentType.name, propName);
      if (memberType !== null) {
        currentType = memberType;
        continue;
      }
      return null;
    }

    // Check array types (T[])
    if (currentType instanceof ArrayType) {
      const memberType = getArrayMemberType(currentType, propName);
      if (memberType !== null) {
        currentType = memberType;
        continue;
      }
      return null;
    }

    // Check built-in objects
    if (currentType instanceof TypeAlias && isBuiltinObjectType(currentType.name)) {
      const builtinType = getBuiltinObjectType(currentType.name);
      if (builtinType && builtinType[propName]) {
        currentType = builtinType[propName];
        continue;
      }
      return null;
    }
    
    // Check object types
    if (currentType instanceof ObjectType) {
      const propType = currentType.getPropertyType(propName);
      if (!propType) return null;
      
      currentType = aliases.resolve(propType);
      
      // Handle unions at each level
      if (currentType instanceof UnionType) {
        currentType = currentType.removeNullish();
        if (currentType instanceof PrimitiveType && currentType.name === 'never') {
          return null;
        }
      }
    } else {
      return null;
    }
  }
  
  return currentType;
}

/**
 * Get the base type of a literal type
 * @param {Type|string} type - Type to check
 * @returns {Type|string} Base type (matches input format)
 */
export function getBaseTypeOfLiteral(type) {
  return getBaseType(type);
}

/**
 * Check if a type is a string literal
 * @param {Type|string} type
 * @returns {boolean}
 */
export function isStringLiteral(type) {
  return type instanceof LiteralType && type.baseType === StringType;
}

/**
 * Check if a type is a number literal
 * @param {Type|string} type
 * @returns {boolean}
 */
export function isNumberLiteral(type) {
  return type instanceof LiteralType && type.baseType === NumberType;
}

/**
 * Check if a type is a boolean literal
 * @param {Type|string} type
 * @returns {boolean}
 */
export function isBooleanLiteral(type) {
  return type instanceof LiteralType && type.baseType === BooleanType;
}

/**
 * Check if a type is a union type
 * @param {Type|string} type
 * @returns {boolean}
 */
export function isUnionType(type) {
  return type instanceof UnionType;
}

/**
 * Parse a union type into its constituent types
 * @param {Type|string} unionType
 * @returns {Array<Type|string>} Array of types (matches input format)
 */
export function parseUnionType(unionType) {
  if (unionType instanceof UnionType) {
    return unionType.types;
  }
  return [unionType];
}

/**
 * Extract type from annotation node
 * @param {Object} annotationNode - AST annotation node
 * @returns {Type}
 */
export function getAnnotationType(annotationNode) {
  return parseAnnotation(annotationNode);
}

// Re-export from typeParser for backward compatibility
export { parseTypeExpression, parseGenericParams } from './typeParser.js';

// Re-export structured parsing functions
export { parseAnnotation, parseTypePrimary, parseObjectType } from './typeParser.js';

/**
 * Substitute type parameters with concrete types
 * @param {Type|string} type - Type with parameters
 * @param {Map|Object} substitutions - Parameter substitutions
 * @returns {Type|string} Type with substitutions (matches input format)
 */
export function substituteType(type, substitutions) {
  const substMap = substitutions instanceof Map ? substitutions : objectToMap(substitutions);
  return substituteTypeParams(type, substMap);
}

/**
 * Infer generic type arguments from call site
 * @param {string[]} genericParams - Generic parameter names
 * @param {Array<Type|string>} paramTypes - Expected parameter types
 * @param {Array<Type|string>} argTypes - Actual argument types
 * @param {TypeAliasMap|Object} aliases - Type aliases
 * @returns {Object} {substitutions: Map<string, Type>, errors: string[]}
 */
export function inferGenericArguments(genericParams, paramTypes, argTypes, aliases) {
  const aliasMap = aliases instanceof TypeAliasMap ? aliases : stringMapToTypeAliasMap(aliases);
  const substitutions = new Map();
  const errors = [];
  
  if (!genericParams || genericParams.length === 0) {
    return { substitutions, errors };
  }
  
  const params = paramTypes;
  const args = argTypes;
  
  // Iterate through parameters to collect constraints
  for (let i = 0; i < Math.min(params.length, args.length); i++) {
    const paramType = params[i];
    const argType = args[i];
    
    if (!paramType || !argType) continue;
    
    // Direct type parameter
    if (paramType instanceof TypeAlias && genericParams.includes(paramType.name)) {
      const paramName = paramType.name;
      
      if (substitutions.has(paramName)) {
        const existing = substitutions.get(paramName);
        if (!existing.equals(argType)) {
          // Try to unify literals
          const argBase = getBaseType(argType);
          const existingBase = getBaseType(existing);
          
          if (argBase.equals(existingBase) && !argBase.equals(argType)) {
            substitutions.set(paramName, argBase);
          } else if (!argType.isCompatibleWith(existing, aliasMap) && 
                     !existing.isCompatibleWith(argType, aliasMap)) {
            errors.push(
              `Type parameter ${paramName} inferred as both ${typeToString(existing)} and ${typeToString(argType)}`
            );
          }
        }
      } else {
        substitutions.set(paramName, argType);
      }
      continue;
    }
    
    // Array type: T[] with number[] => T = number
    if (paramType instanceof ArrayType && argType instanceof ArrayType) {
      const paramElement = paramType.elementType;
      
      if (paramElement instanceof TypeAlias && genericParams.includes(paramElement.name)) {
        const paramName = paramElement.name;
        const argElement = argType.elementType;
        
        if (substitutions.has(paramName)) {
          const existing = substitutions.get(paramName);
          if (!existing.equals(argElement)) {
            const argBase = getBaseType(argElement);
            const existingBase = getBaseType(existing);
            
            if (argBase.equals(existingBase) && !argBase.equals(argElement)) {
              substitutions.set(paramName, argBase);
            } else if (!argElement.isCompatibleWith(existing, aliasMap) && 
                       !existing.isCompatibleWith(argElement, aliasMap)) {
              errors.push(
                `Type parameter ${paramName} inferred as both ${typeToString(existing)}[] and ${typeToString(argElement)}[]`
              );
            }
          }
        } else {
          substitutions.set(paramName, argElement);
        }
      }
      continue;
    }
    
    // Union type: T | null with specific => T = specific
    if (paramType instanceof UnionType) {
      for (const unionMember of paramType.types) {
        if (unionMember instanceof TypeAlias && genericParams.includes(unionMember.name)) {
          const paramName = unionMember.name;
          const otherMembers = paramType.types.filter(t => !t.equals(unionMember));
          const matchesOther = otherMembers.some(t => argType.isCompatibleWith(t, aliasMap));
          
          if (!matchesOther) {
            if (substitutions.has(paramName)) {
              const existing = substitutions.get(paramName);
              if (!existing.equals(argType)) {
                if (!argType.isCompatibleWith(existing, aliasMap) && 
                    !existing.isCompatibleWith(argType, aliasMap)) {
                  errors.push(
                    `Type parameter ${paramName} inferred as both ${typeToString(existing)} and ${typeToString(argType)}`
                  );
                }
              }
            } else {
              substitutions.set(paramName, argType);
            }
          }
        }
      }
    }
  }
  
  // Fill in unresolved parameters with 'any'
  for (const param of genericParams) {
    if (!substitutions.has(param)) {
      substitutions.set(param, AnyType);
    }
  }
  
  return { substitutions, errors };
}

/**
 * Instantiate a generic type with type arguments
 * @param {string} genericTypeName - Generic type name
 * @param {Array<Type>} typeArgs - Type arguments (Type objects only)
 * @param {TypeAliasMap|Object} aliases - Type aliases
 * @returns {Type} Instantiated type
 */
export function instantiateGenericType(genericTypeName, typeArgs, aliases) {
  const aliasMap = aliases instanceof TypeAliasMap ? aliases : stringMapToTypeAliasMap(aliases);
  return aliasMap.instantiate(genericTypeName, typeArgs);
}

/**
 * Parse an object type string into a structure (for backward compatibility)
 * @param {string} objectTypeString - Object type string
 * @returns {Object|null} Property structure
 */
export function parseObjectTypeString(objectTypeString) {
  const type = stringToType(objectTypeString);
  
  if (!(type instanceof ObjectType)) {
    return null;
  }
  
  const result = {};
  for (const [key, prop] of type.properties) {
    result[key] = {
      type: typeToString(prop.type),
      optional: prop.optional
    };
  }
  
  return result;
}

/**
 * Check object structural compatibility
 * @param {ObjectType} valueType
 * @param {ObjectType} targetType
 * @param {TypeAliasMap|Object} aliases
 * @returns {Object} {compatible: boolean, errors: string[]}
 */
export function checkObjectStructuralCompatibility(valueType, targetType, aliases) {
  const aliasMap = aliases instanceof TypeAliasMap ? aliases : stringMapToTypeAliasMap(aliases);
  const errors = [];
  
  if (!(valueType instanceof ObjectType) || !(targetType instanceof ObjectType)) {
    return { compatible: true, errors: [] };
  }
  
  // Check compatibility (structural subtyping - ignores excess properties)
  if (valueType.isCompatibleWith(targetType, aliasMap)) {
    // Even if structurally compatible, report excess properties at assignment sites
    const excessKeys = valueType.excessPropertiesAgainst(targetType);
    if (excessKeys.length > 0) {
      for (const key of excessKeys) {
        errors.push(`Excess property '${key}' not in type definition`);
      }
      return { compatible: false, errors };
    }
    return { compatible: true, errors: [] };
  }
  
  // Generate detailed errors
  for (const [key, targetProp] of targetType.properties) {
    if (!targetProp.optional && !valueType.properties.has(key)) {
      errors.push(`Missing property '${key}'`);
    } else if (valueType.properties.has(key)) {
      const valueProp = valueType.properties.get(key);
      if (!valueProp.type.isCompatibleWith(targetProp.type, aliasMap)) {
        errors.push(
          `Property '${key}' has type ${typeToString(valueProp.type)} but expected ${typeToString(targetProp.type)}`
        );
      }
    }
  }
  
  for (const key of valueType.excessPropertiesAgainst(targetType)) {
    errors.push(`Excess property '${key}' not in type definition`);
  }
  
  return { compatible: false, errors };
}

// ============================================================================
// Conversion Utilities (string <-> Type)
// ============================================================================

/**
 * Convert type string to Type object
 * Handles primitive names, boolean literals, and type alias references
 * @param {string} typeString
 * @returns {Type}
 */
export function stringToType(typeString) {
  if (typeof typeString !== 'string') {
    throw new Error(`stringToType expects a string input. Received: ${typeof typeString}`);
  }

  return primitiveFromName(typeString);
}

/**
 * Convert a Type object to a string
 * @param {Type} type
 * @returns {string}
 */
function typeToString(type) {
  return type.toString();
}

/**
 * Convert object map to TypeAliasMap
 * @param {Object} obj
 * @returns {TypeAliasMap}
 */
function stringMapToTypeAliasMap(obj) {
  if (!obj || typeof obj !== 'object') {
    return new TypeAliasMap();
  }
  
  const aliasMap = new TypeAliasMap();
  
  for (const [name, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value.genericParams && value.genericParams.length > 0) {
      // Generic alias - type should be a Type object
      aliasMap.define(name, value.type, value.genericParams);
    } else {
      // Regular alias - value should be a Type object
      aliasMap.define(name, value);
    }
  }
  
  return aliasMap;
}

/**
 * Convert object to Map
 * @param {Object} obj
 * @returns {Map}
 */
function objectToMap(obj) {
  if (obj instanceof Map) return obj;
  
  const map = new Map();
  for (const [key, value] of Object.entries(obj)) {
    map.set(key, value);
  }
  return map;
}

export {
  Type, Types, TypeAliasMap,
  PrimitiveType, LiteralType, ArrayType, ObjectType, UnionType,
  IntersectionType, GenericType, FunctionType, TypeAlias
};
