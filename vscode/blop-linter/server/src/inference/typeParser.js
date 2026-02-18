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
  
  // Check for object type
  if (typePrimaryNode.children && typePrimaryNode.children[0] && 
      typePrimaryNode.children[0].type === 'object_type') {
    return parseObjectType(typePrimaryNode.children[0]);
  }
  
  // Check for string literal type
  if (typePrimaryNode.named.literal && typePrimaryNode.named.literal.type === 'str') {
    // Strip quotes from the token value
    const rawValue = typePrimaryNode.named.literal.value.slice(1, -1);
    return Types.literal(rawValue, StringType);
  }
  
  // Check for number literal type
  if (typePrimaryNode.named.literal && typePrimaryNode.named.literal.type === 'number') {
    const value = parseFloat(typePrimaryNode.named.literal.value);
    return Types.literal(value, NumberType);
  }
  
  const { name, type_args } = typePrimaryNode.named;
  if (!name) return Types.any;
  
  // name is a type_name node, get its first child
  const typeToken = name.children ? name.children[0] : name;
  const typeName = typeToken.value;
  
  // Check if it's a generic type instantiation: Type<Args>
  if (type_args) {
    const typeArgs = parseTypeArguments(type_args);
    const baseType = new TypeAlias(typeName);
    
    // Check if it's also an array: Type<Args>[]
    const hasArrayBrackets = typePrimaryNode.children?.some((child, i) => 
      child.value === '[' && typePrimaryNode.children[i + 1]?.value === ']'
    );
    
    const genericType = Types.generic(baseType, typeArgs);
    
    if (hasArrayBrackets) {
      return Types.array(genericType);
    }
    
    return genericType;
  }
  
  // Check if it's an array type (has [ ] after the name)
  if (typePrimaryNode.children && typePrimaryNode.children.length > 1) {
    const elementType = primitiveFromName(typeName);
    return Types.array(elementType);
  }
  
  // Simple type name
  return primitiveFromName(typeName);
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
 * Parse type arguments from type_arg_list
 * @param {Object} typeArgsNode - The type_arguments AST node
 * @returns {Type[]}
 */
export function parseTypeArguments(typeArgsNode) {
  if (!typeArgsNode) return [];
  
  const args = [];
  
  function collectArgs(node) {
    if (!node) return;
    
    // Check if this node has a named.arg (type_expression)
    if (node.named && node.named.arg) {
      const typeArg = parseTypeExpression(node.named.arg);
      if (typeArg) {
        args.push(typeArg);
      }
    }
    
    // Check if it has a named.rest (for comma-separated list)
    if (node.named && node.named.rest) {
      collectArgs(node.named.rest);
    }
  }
  
  // The node should have a child that is type_arg_list
  if (typeArgsNode.children) {
    for (const child of typeArgsNode.children) {
      if (child.type === 'type_arg_list') {
        collectArgs(child);
      }
    }
  }

  // Fallback: some AST shapes may include type_expression nodes directly
  const fallbackArgs = [];
  function collectTypeExpressions(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'type_expression') {
      const typeArg = parseTypeExpression(node);
      if (typeArg) {
        fallbackArgs.push(typeArg);
      }
      return;
    }
    if (node.children) {
      node.children.forEach(collectTypeExpressions);
    }
    if (node.named) {
      Object.values(node.named).forEach(collectTypeExpressions);
    }
  }
  collectTypeExpressions(typeArgsNode);
  if (fallbackArgs.length > args.length) {
    return fallbackArgs;
  }
  
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
