// ============================================================================
// Type Parser - Convert AST type nodes to structured Type objects
// ============================================================================

import {
  Type, Types, TypeAlias, UnionType, IntersectionType, ArrayType, ObjectType,
  GenericType, LiteralType, PrimitiveType,
  StringType, NumberType, BooleanType, NullType, UndefinedType,
  AnyFunctionType
} from './Type.js';

/**
 * Parse an annotation node into a Type object
 * @param {Object} annotationNode - The annotation AST node
 * @returns {Type}
 */
export function parseAnnotation(annotationNode) {
  if (!annotationNode) return Types.any;
  
  // annotation.named.type is a type_expression
  if (annotationNode.named && annotationNode.named.type) {
    return parseTypeExpression(annotationNode.named.type);
  }
  
  // Old format fallback: annotation.named.name
  if (annotationNode.named && annotationNode.named.name) {
    const name = annotationNode.named.name.value;
    return primitiveFromName(name);
  }
  
  return Types.any;
}

/**
 * Parse a type_expression AST node into a Type object
 * Handles union (|), intersection (&), and delegates to type_primary
 * @param {Object} typeExprNode - The type_expression AST node
 * @returns {Type}
 */
export function parseTypeExpression(typeExprNode) {
  if (!typeExprNode) return Types.any;
  
  // Check for union type: type_primary | type_expression
  if (typeExprNode.named && typeExprNode.named.union) {
    const leftType = parseTypePrimary(typeExprNode.children[0]);
    const rightType = parseTypeExpression(typeExprNode.named.union);
    
    // Combine types into union
    const leftTypes = leftType instanceof UnionType ? leftType.types : [leftType];
    const rightTypes = rightType instanceof UnionType ? rightType.types : [rightType];
    
    return Types.union([...leftTypes, ...rightTypes]);
  }
  
  // Check for intersection type: type_primary & type_expression  
  if (typeExprNode.named && typeExprNode.named.intersection) {
    const leftType = parseTypePrimary(typeExprNode.children[0]);
    const rightType = parseTypeExpression(typeExprNode.named.intersection);
    
    // Combine types into intersection
    const leftTypes = leftType instanceof IntersectionType ? leftType.types : [leftType];
    const rightTypes = rightType instanceof IntersectionType ? rightType.types : [rightType];
    
    return Types.intersection([...leftTypes, ...rightTypes]);
  }
  
  // Just a single type_primary
  if (typeExprNode.children && typeExprNode.children[0]) {
    return parseTypePrimary(typeExprNode.children[0]);
  }
  
  return Types.any;
}

/**
 * Parse a type_primary AST node into a Type object
 * Handles basic types, array types, object types, literal types, and generic type instantiation
 * @param {Object} typePrimaryNode - The type_primary AST node
 * @returns {Type}
 */
export function parseTypePrimary(typePrimaryNode) {
  if (!typePrimaryNode || !typePrimaryNode.named) return Types.any;
  
  let baseType = Types.any;
  
  // Check for object type
  if (typePrimaryNode.children && typePrimaryNode.children[0] && 
      typePrimaryNode.children[0].type === 'object_type') {
    baseType = parseObjectType(typePrimaryNode.children[0]);
  } else
  
  // Check for string literal type
  if (typePrimaryNode.named.literal && typePrimaryNode.named.literal.type === 'str') {
    // Strip quotes from the token value
    const rawValue = typePrimaryNode.named.literal.value.slice(1, -1);
    baseType = Types.literal(rawValue, StringType);
  } else
  
  // Check for number literal type
  if (typePrimaryNode.named.literal && typePrimaryNode.named.literal.type === 'number') {
    const value = parseFloat(typePrimaryNode.named.literal.value);
    baseType = Types.literal(value, NumberType);
  } else {
    const { name, type_args } = typePrimaryNode.named;
    if (name) {
      // name is a type_name node, get its first child
      const typeToken = name.children ? name.children[0] : name;
      const typeName = typeToken.value;
      
      // Check if it's a generic type instantiation: Type<Args>
      if (type_args) {
        const typeArgs = parseTypeArguments(type_args);
        baseType = Types.generic(new TypeAlias(typeName), typeArgs);
      } else {
        baseType = primitiveFromName(typeName);
      }
    }
  }
  
  // Handle array_suffix for any base type (object, named, literal, generic)
  // array_suffix appears in children array since it has no name label in grammar
  const arraySuffixNode = typePrimaryNode.children?.find(child => child.type === 'array_suffix');
  if (arraySuffixNode) {
    return parseArraySuffix(baseType, arraySuffixNode);
  }
  
  return baseType;
}

/**
 * Parse an array_suffix node to handle one or more [] pairs
 * Multi-dimensional arrays recursively wrap the type
 * @param {Type} elementType - The base type before array notation
 * @param {Object} arraySuffixNode - The array_suffix AST node
 * @returns {ArrayType}
 */
function parseArraySuffix(elementType, arraySuffixNode) {
  let result = Types.array(elementType);
  
  // array_suffix recursively contains more array_suffix nodes via named.array_suffix
  if (arraySuffixNode.named && arraySuffixNode.named.array_suffix) {
    // This means we have [][] or more
    return parseArraySuffix(result, arraySuffixNode.named.array_suffix);
  }
  
  return result;
}

/**
 * Parse an object_type AST node into an ObjectType
 * @param {Object} objectTypeNode - The object_type AST node
 * @returns {ObjectType}
 */
export function parseObjectType(objectTypeNode) {
  if (!objectTypeNode || !objectTypeNode.named || !objectTypeNode.named.properties) {
    return Types.object(new Map());
  }
  
  const properties = new Map();
  
  function collectProperties(node) {
    if (!node) return;
    
    // Check if this is a single property node
    if (node.type === 'object_type_property') {
      const key = node.named.key?.value;
      const optional = !!node.named.optional;
      const valueType = parseTypeExpression(node.named.valueType);
      
      if (key) {
        properties.set(key, { type: valueType, optional });
      }
    }
    
    // Recursively process children
    if (node.children) {
      node.children.forEach(collectProperties);
    }
    
    // Recursively process named children
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object' && child.type) {
          collectProperties(child);
        }
      });
    }
  }
  
  collectProperties(objectTypeNode.named.properties);
  
  return Types.object(properties);
}

/**
 * Parse type arguments from a type_arg_list node.
 * @param {Object} typeArgsNode - The type_arg_list AST node
 * @returns {Type[]}
 */
export function parseTypeArguments(typeArgsNode) {
  if (!typeArgsNode) return [];

  const args = [];

  function collectArgs(node) {
    if (!node?.named) return;
    if (node.named.arg) {
      const typeArg = parseTypeExpression(node.named.arg);
      if (typeArg) args.push(typeArg);
    }
    if (node.named.rest) collectArgs(node.named.rest);
  }

  // typeArgsNode is the type_arg_list node itself: call collectArgs directly.
  collectArgs(typeArgsNode);
  return args;
}

/**
 * Parse generic parameters from generic_params node
 * @param {Object} genericParamsNode - The generic_params AST node
 * @returns {string[]} Array of type parameter names
 */
export function parseGenericParams(genericParamsNode) {
  if (!genericParamsNode || !genericParamsNode.named || !genericParamsNode.named.params) {
    return [];
  }
  
  const params = [];
  
  function collectParams(node) {
    if (!node) return;
    
    if (node.named && node.named.param) {
      params.push(node.named.param.value);
    }
    
    if (node.named && node.named.rest) {
      collectParams(node.named.rest);
    }
  }
  
  collectParams(genericParamsNode.named.params);
  
  return params;
}

/**
 * Convert a type name string to a Type object
 * Handles primitive types, boolean literals, and type alias references
 * @param {string} name - Type name
 * @returns {Type}
 */
export function primitiveFromName(name) {
  switch (name) {
    case 'string': return StringType;
    case 'number': return NumberType;
    case 'boolean': return BooleanType;
    case 'null': return NullType;
    case 'undefined': return UndefinedType;
    case 'any': return Types.any;
    case 'never': return Types.never;
    case 'void': return Types.void;
    case 'function': return AnyFunctionType;
    case 'true': return Types.literal(true, BooleanType);
    case 'false': return Types.literal(false, BooleanType);
    default:
      // Unknown type - treat as type alias reference
      return new TypeAlias(name);
  }
}

/**
 * Get the base type of a literal type (for widening)
 * @param {Type} type
 * @returns {Type}
 */
export function getBaseType(type) {
  if (type instanceof LiteralType) {
    return type.baseType;
  }
  return type;
}
