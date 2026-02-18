// ============================================================================
// Type - Structured type representation
// ============================================================================
// This module defines a structured, object-oriented type system to replace
// ============================================================================

/**
 * Base Type class - all types inherit from this
 */
export class Type {
  constructor() {}
  
  /**
   * Check if this type equals another type
   * @param {Type} other - Type to compare with
   * @returns {boolean}
   */
  equals(other) {
    return this.toString() === other.toString();
  }
  
  /**
   * Convert type to string representation (for debugging/display)
   * @returns {string}
   */
  toString() {
    throw new Error('toString() must be implemented by subclasses');
  }
  
  /**
   * Check if this type is compatible with another type
   * @param {Type} target - Target type
   * @param {TypeAliasMap} aliases - Type aliases
   * @returns {boolean}
   */
  isCompatibleWith(target, aliases) {
    // When the target is an intersection, the value must be compatible with the
    // merged type (for all-object intersections) or with every constituent.
    if (target instanceof IntersectionType) {
      const merged = target.merge(aliases);
      if (merged) {
        return this.isCompatibleWith(merged, aliases);
      }
      return target.types.every(t => this.isCompatibleWith(t, aliases));
    }
    // Default: check equality
    return this.equals(target) || (target instanceof PrimitiveType && target.name === 'any');
  }
}

/**
 * Primitive types: string, number, boolean, null, undefined, any, never
 */
export class PrimitiveType extends Type {
  constructor(name) {
    super();
    this.kind = 'primitive';
    this.name = name; // 'string', 'number', 'boolean', 'null', 'undefined', 'any', 'never'
  }
  
  toString() {
    return this.name;
  }
  
  equals(other) {
    return other instanceof PrimitiveType && this.name === other.name;
  }
  
  isCompatibleWith(target, aliases) {
    if ((target instanceof PrimitiveType && target.name === 'any') || 
        (this instanceof PrimitiveType && this.name === 'any')) return true;
    if (this instanceof PrimitiveType && this.name === 'never') return true;
    if (target instanceof PrimitiveType && target.name === 'never') return false;
    
    // Check if target is a union containing this type
    if (target instanceof UnionType) {
      return target.types.some(t => this.isCompatibleWith(t, aliases));
    }
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    return this.equals(target);
  }
}

// Singleton instances for common primitives
export const AnyType = new PrimitiveType('any');
export const NeverType = new PrimitiveType('never');
export const StringType = new PrimitiveType('string');
export const NumberType = new PrimitiveType('number');
export const BooleanType = new PrimitiveType('boolean');
export const NullType = new PrimitiveType('null');
export const UndefinedType = new PrimitiveType('undefined');
export const VoidType = new PrimitiveType('void');

/**
 * Literal types: "hello", 42, true, false
 */
export class LiteralType extends Type {
  constructor(value, baseType) {
    super();
    this.kind = 'literal';
    this.value = value;
    this.baseType = baseType; // StringType, NumberType, or BooleanType
  }
  
  toString() {
    if (this.baseType === StringType) {
      return `"${this.value}"`;
    }
    return String(this.value);
  }
  
  equals(other) {
    return other instanceof LiteralType && 
           this.value === other.value && 
           this.baseType.equals(other.baseType);
  }
  
  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;

    // Allow typed arrays to match the generic array alias
    if (target instanceof TypeAlias && target.name === 'array') {
      return true;
    }
    
    // Literal is compatible with its base type
    if (this.baseType.equals(target)) return true;
    
    // Check if target is a union containing this literal or base type
    if (target instanceof UnionType) {
      return target.types.some(t => this.isCompatibleWith(t, aliases));
    }
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    return this.equals(target);
  }
  
  getBaseType() {
    return this.baseType;
  }
}

/**
 * Array types: T[]
 */
export class ArrayType extends Type {
  constructor(elementType) {
    super();
    this.kind = 'array';
    this.elementType = elementType;
  }
  
  toString() {
    const elementStr = this.elementType.toString();
    if (this.elementType instanceof UnionType || this.elementType instanceof IntersectionType) {
      return `(${elementStr})[]`;
    }
    return `${elementStr}[]`;
  }
  
  equals(other) {
    return other instanceof ArrayType && this.elementType.equals(other.elementType);
  }
  
  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;

    // Allow typed arrays to match the generic array alias
    if (target instanceof TypeAlias && target.name === 'array') {
      return true;
    }
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    // Check structural compatibility
    if (target instanceof ArrayType) {
      return this.elementType.isCompatibleWith(target.elementType, aliases);
    }
    
    // Check if target is a union containing array types
    if (target instanceof UnionType) {
      return target.types.some(t => this.isCompatibleWith(t, aliases));
    }
    
    return false;
  }
}

/**
 * Object types: { name: string, age: number }
 */
export class ObjectType extends Type {
  constructor(properties = new Map()) {
    super();
    this.kind = 'object';
    this.properties = properties; // Map<string, {type: Type, optional: boolean}>
  }
  
  toString() {
    if (this.properties.size === 0) return '{}';
    
    const props = Array.from(this.properties.entries())
      .map(([key, prop]) => {
        const optMarker = prop.optional ? '?' : '';
        return `${key}${optMarker}: ${prop.type.toString()}`;
      })
      .join(', ');
    
    return `{${props}}`;
  }
  
  equals(other) {
    if (!(other instanceof ObjectType)) return false;
    if (this.properties.size !== other.properties.size) return false;
    
    for (const [key, prop] of this.properties) {
      const otherProp = other.properties.get(key);
      if (!otherProp) return false;
      if (prop.optional !== otherProp.optional) return false;
      if (!prop.type.equals(otherProp.type)) return false;
    }
    
    return true;
  }
  
  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;

    // When target is an intersection, delegate to merged type or check all constituents
    if (target instanceof IntersectionType) {
      const merged = target.merge(aliases);
      if (merged) {
        return this.isCompatibleWith(merged, aliases);
      }
      return target.types.every(t => this.isCompatibleWith(t, aliases));
    }

    // Allow object types to match the generic object alias
    if (target instanceof TypeAlias && target.name === 'object') {
      return true;
    }
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    // Check structural compatibility
    if (target instanceof ObjectType) {
      // Check all required properties in target exist in this object
      for (const [key, targetProp] of target.properties) {
        if (!targetProp.optional && !this.properties.has(key)) {
          return false; // Missing required property
        }
        
        const thisProp = this.properties.get(key);
        if (thisProp && !thisProp.type.isCompatibleWith(targetProp.type, aliases)) {
          return false; // Property type mismatch
        }
      }
      
      return true;
    }
    
    // Check if target is a union containing object types
    if (target instanceof UnionType) {
      return target.types.some(t => this.isCompatibleWith(t, aliases));
    }
    
    return false;
  }
  
  /**
   * Get the type of a property
   * @param {string} propertyName
   * @returns {Type|null}
   */
  getPropertyType(propertyName) {
    const prop = this.properties.get(propertyName);
    return prop ? prop.type : null;
  }

  /**
   * Check for excess properties against a target type.
   * Unlike isCompatibleWith (which allows extras for structural subtyping),
   * this is used at direct assignment sites (object literals) where excess
   * properties are an error, matching TypeScript's excess property checking.
   * @param {ObjectType} target
   * @returns {string[]} Array of excess property names
   */
  excessPropertiesAgainst(target) {
    if (!(target instanceof ObjectType)) return [];
    const excess = [];
    for (const key of this.properties.keys()) {
      if (!target.properties.has(key)) {
        excess.push(key);
      }
    }
    return excess;
  }
}

/**
 * Union types: string | number
 */
export class UnionType extends Type {
  constructor(types) {
    super();
    this.kind = 'union';
    this.types = this._normalizeTypes(types);
  }
  
  _normalizeTypes(types) {
    // Remove duplicates and flatten nested unions
    const flattened = [];
    const seen = new Set();
    
    for (const type of types) {
      if (type instanceof UnionType) {
        // Flatten nested unions
        flattened.push(...type.types);
      } else if (type instanceof PrimitiveType && type.name === 'any') {
        // any absorbs everything
        return [Types.any];
      } else if (!(type instanceof PrimitiveType && type.name === 'never')) {
        // Skip never, don't add duplicates
        const str = type.toString();
        if (!seen.has(str)) {
          seen.add(str);
          flattened.push(type);
        }
      }
    }
    
    // Simplify: if base type is present, remove its literals
    const hasString = flattened.some(t => t instanceof PrimitiveType && t.name === 'string');
    const hasNumber = flattened.some(t => t instanceof PrimitiveType && t.name === 'number');
    const hasBoolean = flattened.some(t => t instanceof PrimitiveType && t.name === 'boolean');
    
    if (hasString || hasNumber || hasBoolean) {
      return flattened.filter(t => {
        if (t instanceof LiteralType) {
          if (t.baseType === StringType && hasString) return false;
          if (t.baseType === NumberType && hasNumber) return false;
          if (t.baseType === BooleanType && hasBoolean) return false;
        }
        return true;
      });
    }
    
    return flattened;
  }
  
  toString() {
    if (this.types.length === 0) return 'never';
    if (this.types.length === 1) return this.types[0].toString();
    return this.types.map(t => t.toString()).join(' | ');
  }
  
  equals(other) {
    if (!(other instanceof UnionType)) return false;
    if (this.types.length !== other.types.length) return false;
    
    // Check if all types are present (order independent)
    const thisStrs = new Set(this.types.map(t => t.toString()));
    const otherStrs = new Set(other.types.map(t => t.toString()));
    
    for (const str of thisStrs) {
      if (!otherStrs.has(str)) return false;
    }
    
    return true;
  }
  
  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    // Union is compatible if all constituent types are compatible
    return this.types.every(t => t.isCompatibleWith(target, aliases));
  }
  
  /**
   * Remove null and undefined from the union
   * @returns {Type}
   */
  removeNullish() {
    const filtered = this.types.filter(t => 
      !(t instanceof PrimitiveType && (t.name === 'null' || t.name === 'undefined'))
    );
    
    if (filtered.length === 0) return NeverType;
    if (filtered.length === 1) return filtered[0];
    return new UnionType(filtered);
  }
  
  /**
   * Narrow union to only specified type
   * @param {Type} narrowedType
   * @returns {Type}
   */
  narrow(narrowedType) {
    const filtered = this.types.filter(t => t.equals(narrowedType));
    
    if (filtered.length === 0) return Types.never;
    if (filtered.length === 1) return filtered[0];
    return new UnionType(filtered);
  }
  
  /**
   * Remove specified type from union
   * @param {Type} excludedType
   * @returns {Type}
   */
  exclude(excludedType) {
    const filtered = this.types.filter(t => !t.equals(excludedType));
    
    if (filtered.length === 0) return Types.never;
    if (filtered.length === 1) return filtered[0];
    return new UnionType(filtered);
  }
}

/**
 * Intersection types: A & B
 *
 * Semantics: a value of intersection type A & B satisfies *both* A and B.
 * For object types this means the merged set of all properties from every
 * constituent type.  For non-object types it means the value must satisfy
 * every constituent independently.
 */
export class IntersectionType extends Type {
  constructor(types) {
    super();
    this.kind = 'intersection';
    this.types = types;
    // Cache the merged object type so it is computed once per instance.
    this._merged = null;
  }

  /**
   * If every constituent is an ObjectType (or resolves to one via aliases),
   * return a single ObjectType whose properties are the union of all
   * constituent properties.  Later properties override earlier ones when
   * names collide (matching TypeScript's intersection merge semantics for
   * same-named primitive properties – keep both for object-typed ones in a
   * real implementation; here we keep the last declaration for simplicity).
   *
   * @param {TypeAliasMap|null} aliases
   * @returns {ObjectType|null}  null when any constituent is not an ObjectType
   */
  merge(aliases) {
    if (this._merged) return this._merged;

    const merged = new Map();
    for (const t of this.types) {
      const resolved = aliases ? aliases.resolve(t) : t;
      if (!(resolved instanceof ObjectType)) {
        return null; // Can't merge – at least one constituent is non-object
      }
      for (const [key, prop] of resolved.properties) {
        merged.set(key, prop);
      }
    }

    this._merged = new ObjectType(merged);
    return this._merged;
  }

  toString() {
    return this.types.map(t => t.toString()).join(' & ');
  }

  equals(other) {
    if (!(other instanceof IntersectionType)) return false;
    if (this.types.length !== other.types.length) return false;

    // Order-independent comparison
    const thisStrs = new Set(this.types.map(t => t.toString()));
    const otherStrs = new Set(other.types.map(t => t.toString()));

    for (const str of thisStrs) {
      if (!otherStrs.has(str)) return false;
    }

    return true;
  }

  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;

    // Resolve aliases on the target side
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      if (resolved === target) return false; // Unresolvable alias
      return this.isCompatibleWith(resolved, aliases);
    }

    // For all-object intersections delegate to the merged ObjectType so that
    // property presence and types are checked correctly (structural subtyping).
    const merged = this.merge(aliases);
    if (merged) {
      return merged.isCompatibleWith(target, aliases);
    }

    // For mixed/non-object intersections: the value satisfies *all* constituents,
    // so it is compatible with target if at least one constituent is compatible.
    // This covers cases like `string & Serializable` being compatible with `string`.
    return this.types.some(t => t.isCompatibleWith(target, aliases));
  }
}

/**
 * Generic type instantiation: Box<T>
 */
export class GenericType extends Type {
  constructor(baseType, typeArgs) {
    super();
    this.kind = 'generic';
    this.baseType = baseType; // Type or string (name)
    this.typeArgs = typeArgs; // Type[]
  }
  
  toString() {
    const baseStr = typeof this.baseType === 'string' ? this.baseType : this.baseType.toString();
    const argsStr = this.typeArgs.map(t => t.toString()).join(', ');
    return `${baseStr}<${argsStr}>`;
  }
  
  equals(other) {
    if (!(other instanceof GenericType)) return false;
    
    const baseEqual = typeof this.baseType === 'string' 
      ? this.baseType === other.baseType
      : this.baseType.equals(other.baseType);
    
    if (!baseEqual) return false;
    if (this.typeArgs.length !== other.typeArgs.length) return false;
    
    return this.typeArgs.every((arg, i) => arg.equals(other.typeArgs[i]));
  }
  
  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    // Check if both are the same generic type with compatible args
    if (target instanceof GenericType) {
      const baseEqual = typeof this.baseType === 'string' 
        ? this.baseType === target.baseType
        : this.baseType.equals(target.baseType);
      
      if (!baseEqual) return false;
      if (this.typeArgs.length !== target.typeArgs.length) return false;
      
      return this.typeArgs.every((arg, i) => 
        arg.isCompatibleWith(target.typeArgs[i], aliases)
      );
    }
    
    return false;
  }
}

/**
 * Function types: (a: string, b: number) => boolean
 */
export class FunctionType extends Type {
  constructor(params, returnType, genericParams = []) {
    super();
    this.kind = 'function';
    this.params = params; // Type[]
    this.returnType = returnType; // Type
    this.genericParams = genericParams; // string[]
  }
  
  toString() {
    const generics = this.genericParams.length > 0 
      ? `<${this.genericParams.join(', ')}>` 
      : '';
    const params = this.params.map((p, i) => `p${i}: ${p.toString()}`).join(', ');
    return `${generics}(${params}) => ${this.returnType.toString()}`;
  }
  
  equals(other) {
    if (!(other instanceof FunctionType)) return false;
    if (this.params.length !== other.params.length) return false;
    if (!this.returnType.equals(other.returnType)) return false;
    
    return this.params.every((param, i) => param.equals(other.params[i]));
  }
  
  isCompatibleWith(target, aliases) {
    if (target instanceof PrimitiveType && target.name === 'any') return true;
    
    // Resolve aliases
    if (target instanceof TypeAlias) {
      const resolved = aliases.resolve(target);
      // Avoid infinite recursion if alias can't be resolved
      if (resolved === target) return false;
      return this.isCompatibleWith(resolved, aliases);
    }
    
    // Simple function compatibility (contravariant params, covariant return)
    if (target instanceof FunctionType) {
      if (this.params.length !== target.params.length) return false;
      
      // Parameters are contravariant
      const paramsCompatible = target.params.every((targetParam, i) =>
        targetParam.isCompatibleWith(this.params[i], aliases)
      );
      
      // Return type is covariant
      const returnCompatible = this.returnType.isCompatibleWith(target.returnType, aliases);
      
      return paramsCompatible && returnCompatible;
    }
    
    return false;
  }
}

/**
 * Type alias reference (not resolved yet)
 */
export class TypeAlias extends Type {
  constructor(name) {
    super();
    this.kind = 'alias';
    this.name = name;
  }
  
  toString() {
    return this.name;
  }
  
  equals(other) {
    return other instanceof TypeAlias && this.name === other.name;
  }
  
  isCompatibleWith(target, aliases) {
    // Always resolve aliases before checking compatibility
    const resolved = aliases.resolve(this);
    
    // If resolution didn't change the type (circular reference), check by name
    if (resolved instanceof TypeAlias && resolved.name === this.name) {
      if (target instanceof UnionType) {
        if (target.types.some(t => t instanceof TypeAlias && t.name === this.name)) {
          return true;
        }
      }
      if (this.name === 'array') {
        if (target instanceof ArrayType) return true;
        if (target instanceof TypeAlias && target.name === 'array') return true;
        if (target instanceof UnionType) {
          return target.types.some(t => this.isCompatibleWith(t, aliases));
        }
      }
      if (this.name === 'object') {
        if (target instanceof ObjectType) return true;
        if (target instanceof TypeAlias && target.name === 'object') return true;
        if (target instanceof UnionType) {
          return target.types.some(t => this.isCompatibleWith(t, aliases));
        }
      }
      // Circular alias - check if target is the same alias
      if (target instanceof TypeAlias && target.name === this.name) {
        return true;
      }
      // Otherwise, treat as 'any' to avoid errors
      return target instanceof PrimitiveType && target.name === 'any';
    }
    
    return resolved.isCompatibleWith(target, aliases);
  }
}

/**
 * Type alias map - stores and resolves type aliases
 */
export class TypeAliasMap {
  constructor() {
    this.aliases = new Map(); // Map<string, Type | {type: Type, genericParams: string[]}>
    this._resolving = new Set(); // Track currently resolving aliases to prevent cycles
  }
  
  /**
   * Define a type alias
   * @param {string} name
   * @param {Type} type
   * @param {string[]} genericParams
   */
  define(name, type, genericParams = []) {
    if (genericParams.length > 0) {
      this.aliases.set(name, { type, genericParams });
    } else {
      this.aliases.set(name, type);
    }
  }
  
  /**
   * Check if an alias exists
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.aliases.has(name);
  }
  
  /**
   * Get alias definition (unresolved)
   * @param {string} name
   * @returns {Type | {type: Type, genericParams: string[]}}
   */
  get(name) {
    return this.aliases.get(name);
  }
  
  /**
   * Resolve a type alias (recursive with cycle detection)
   * @param {Type} type
   * @returns {Type}
   */
  resolve(type) {
    if (!(type instanceof TypeAlias)) {
      return type;
    }
    
    // Check for cycles
    if (this._resolving.has(type.name)) {
      // Circular reference detected - return as-is to break the cycle
      return type;
    }
    
    const aliasValue = this.aliases.get(type.name);
    
    if (!aliasValue) {
      // Unknown alias - return as-is
      return type;
    }
    
    // Check if it's a generic alias (should not be used without type args)
    if (typeof aliasValue === 'object' && aliasValue.genericParams) {
      // Generic type used without type arguments - return as-is
      return type;
    }
    
    // Mark this alias as currently being resolved
    this._resolving.add(type.name);
    
    try {
      // Recursively resolve
      return this.resolve(aliasValue);
    } finally {
      // Clean up after resolution
      this._resolving.delete(type.name);
    }
  }
  
  /**
   * Instantiate a generic type alias
   * @param {string} name - Alias name
   * @param {Type[]} typeArgs - Type arguments
   * @returns {Type}
   */
  instantiate(name, typeArgs) {
    const aliasValue = this.aliases.get(name);
    
    if (!aliasValue || !aliasValue.genericParams) {
      // Not a generic alias
      return new TypeAlias(name);
    }
    
    // Create substitution map
    const substitutions = new Map();
    for (let i = 0; i < aliasValue.genericParams.length && i < typeArgs.length; i++) {
      substitutions.set(aliasValue.genericParams[i], typeArgs[i]);
    }
    
    // Substitute type parameters
    return substituteTypeParams(aliasValue.type, substitutions);
  }
}

/**
 * Substitute type parameters in a type
 * @param {Type} type
 * @param {Map<string, Type>} substitutions
 * @returns {Type}
 */
export function substituteTypeParams(type, substitutions) {
  if (type instanceof TypeAlias) {
    // Check if this is a type parameter
    if (substitutions.has(type.name)) {
      return substitutions.get(type.name);
    }
    return type;
  }
  
  if (type instanceof ArrayType) {
    return new ArrayType(substituteTypeParams(type.elementType, substitutions));
  }
  
  if (type instanceof ObjectType) {
    const newProps = new Map();
    for (const [key, prop] of type.properties) {
      newProps.set(key, {
        type: substituteTypeParams(prop.type, substitutions),
        optional: prop.optional
      });
    }
    return new ObjectType(newProps);
  }
  
  if (type instanceof UnionType) {
    return new UnionType(type.types.map(t => substituteTypeParams(t, substitutions)));
  }
  
  if (type instanceof IntersectionType) {
    return new IntersectionType(type.types.map(t => substituteTypeParams(t, substitutions)));
  }
  
  if (type instanceof GenericType) {
    return new GenericType(
      type.baseType,
      type.typeArgs.map(t => substituteTypeParams(t, substitutions))
    );
  }
  
  if (type instanceof FunctionType) {
    if (type.params === null) return type; // AnyFunctionType — no substitution needed
    return new FunctionType(
      type.params.map(t => substituteTypeParams(t, substitutions)),
      substituteTypeParams(type.returnType, substitutions),
      type.genericParams
    );
  }
  
  // Primitives and literals don't need substitution
  return type;
}

/**
 * Create a union type, with automatic normalization
 * @param {Type[]} types
 * @returns {Type}
 */
export function createUnion(types) {
  if (types.length === 0) return NeverType;
  if (types.length === 1) return types[0];
  
  const union = new UnionType(types);
  if (union.types.length === 1) return union.types[0];
  return union;
}

/**
 * Helper to create common types
 */
export const Types = {
  any: AnyType,
  never: NeverType,
  string: StringType,
  number: NumberType,
  boolean: BooleanType,
  null: NullType,
  undefined: UndefinedType,
  void: VoidType,
  
  literal(value, baseType) {
    return new LiteralType(value, baseType);
  },
  
  array(elementType) {
    return new ArrayType(elementType);
  },
  
  object(properties) {
    return new ObjectType(properties);
  },
  
  union(types) {
    return createUnion(types);
  },
  
  intersection(types) {
    return new IntersectionType(types);
  },
  
  generic(baseType, typeArgs) {
    return new GenericType(baseType, typeArgs);
  },
  
  function(params, returnType, genericParams = []) {
    return new FunctionType(params, returnType, genericParams);
  },
  
  alias(name) {
    return new TypeAlias(name);
  }
};
