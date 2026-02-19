/**
 * Low-level tests for isTypeCompatible and individual Type.isCompatibleWith()
 * methods across all type classes: primitives, literals, arrays, objects,
 * unions, intersections, and FunctionType.
 */

import { describe, test, expect } from 'vitest';

import {
  PrimitiveType, LiteralType, ArrayType, ObjectType, UnionType,
  IntersectionType, FunctionType, TypeAlias, TypeAliasMap,
  AnyType, NeverType, StringType, NumberType, BooleanType, NullType,
  UndefinedType, AnyFunctionType, Types,
} from '../../inference/Type.js';

import { isTypeCompatible } from '../../inference/typeSystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Empty alias map used when no aliases are needed */
const NO_ALIASES = new TypeAliasMap();

function obj(props) {
  const map = new Map();
  for (const [k, v] of Object.entries(props)) {
    const optional = k.endsWith('?');
    const key = optional ? k.slice(0, -1) : k;
    map.set(key, { type: v, optional });
  }
  return new ObjectType(map);
}

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

describe('PrimitiveType compatibility', () => {
  test('string is compatible with string', () => {
    expect(StringType.isCompatibleWith(StringType, NO_ALIASES)).toBe(true);
  });

  test('number is NOT compatible with string', () => {
    expect(NumberType.isCompatibleWith(StringType, NO_ALIASES)).toBe(false);
  });

  test('anything is compatible with any', () => {
    expect(StringType.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
    expect(NumberType.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
    expect(NullType.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('any is compatible with any specific primitive (bidirectional)', () => {
    // In Blop: any is compatible both as value and as target
    expect(AnyType.isCompatibleWith(StringType, NO_ALIASES)).toBe(true);
    expect(AnyType.isCompatibleWith(NumberType, NO_ALIASES)).toBe(true);
  });

  test('never is the bottom type: compatible with everything', () => {
    // Blop treats never as assignable anywhere (bottom-type semantics)
    expect(NeverType.isCompatibleWith(StringType, NO_ALIASES)).toBe(true);
    expect(NeverType.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('never as TARGET is not compatible with non-never values', () => {
    expect(StringType.isCompatibleWith(NeverType, NO_ALIASES)).toBe(false);
    expect(NumberType.isCompatibleWith(NeverType, NO_ALIASES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Literal types
// ---------------------------------------------------------------------------

describe('LiteralType compatibility', () => {
  const litHello = Types.literal('hello', StringType);
  const litWorld = Types.literal('world', StringType);
  const lit42 = Types.literal(42, NumberType);
  const litTrue = Types.literal(true, BooleanType);

  test('string literal is compatible with string', () => {
    expect(litHello.isCompatibleWith(StringType, NO_ALIASES)).toBe(true);
  });

  test('number literal is compatible with number', () => {
    expect(lit42.isCompatibleWith(NumberType, NO_ALIASES)).toBe(true);
  });

  test('boolean literal is compatible with boolean', () => {
    expect(litTrue.isCompatibleWith(BooleanType, NO_ALIASES)).toBe(true);
  });

  test('string literal is NOT compatible with number', () => {
    expect(litHello.isCompatibleWith(NumberType, NO_ALIASES)).toBe(false);
  });

  test('same literal value is equal to itself', () => {
    expect(litHello.equals(Types.literal('hello', StringType))).toBe(true);
  });

  test('different literal values are not equal', () => {
    expect(litHello.equals(litWorld)).toBe(false);
  });

  test('literal is compatible with union containing its base type', () => {
    const union = Types.union([StringType, NullType]);
    expect(litHello.isCompatibleWith(union, NO_ALIASES)).toBe(true);
  });

  test('literal is compatible with union containing itself', () => {
    const union = Types.union([litHello, litWorld]);
    expect(litHello.isCompatibleWith(union, NO_ALIASES)).toBe(true);
  });

  test('string literal is NOT compatible with union of number | null', () => {
    const union = Types.union([NumberType, NullType]);
    expect(litHello.isCompatibleWith(union, NO_ALIASES)).toBe(false);
  });

  test('toString() wraps string literal in quotes', () => {
    expect(litHello.toString()).toBe('"hello"');
  });

  test('toString() for number literal has no quotes', () => {
    expect(lit42.toString()).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// ArrayType
// ---------------------------------------------------------------------------

describe('ArrayType compatibility', () => {
  const numArr = Types.array(NumberType);
  const strArr = Types.array(StringType);
  const anyArr = Types.array(AnyType);
  const numOrNullArr = Types.array(Types.union([NumberType, NullType]));

  test('number[] is compatible with number[]', () => {
    expect(numArr.isCompatibleWith(numArr, NO_ALIASES)).toBe(true);
  });

  test('number[] is NOT compatible with string[]', () => {
    expect(numArr.isCompatibleWith(strArr, NO_ALIASES)).toBe(false);
  });

  test('number[] is compatible with any[]', () => {
    expect(numArr.isCompatibleWith(anyArr, NO_ALIASES)).toBe(true);
  });

  test('number[] is compatible with any', () => {
    expect(numArr.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('(number | null)[] is NOT compatible with number[]', () => {
    expect(numOrNullArr.isCompatibleWith(numArr, NO_ALIASES)).toBe(false);
  });

  test('number[] is compatible with array alias', () => {
    expect(numArr.isCompatibleWith(new TypeAlias('array'), NO_ALIASES)).toBe(true);
  });

  test('number[] toString()', () => {
    expect(numArr.toString()).toBe('number[]');
  });

  test('(string | null)[] toString() wraps union in parens', () => {
    const unionArr = Types.array(Types.union([StringType, NullType]));
    expect(unionArr.toString()).toBe('(string | null)[]');
  });

  test('number[] equals number[]', () => {
    expect(numArr.equals(Types.array(NumberType))).toBe(true);
  });

  test('number[] does not equal string[]', () => {
    expect(numArr.equals(strArr)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ObjectType — structural subtyping
// ---------------------------------------------------------------------------

describe('ObjectType structural compatibility', () => {
  const point2D = obj({ x: NumberType, y: NumberType });
  const point3D = obj({ x: NumberType, y: NumberType, z: NumberType });
  const named   = obj({ name: StringType, age: NumberType });
  const optAge  = obj({ 'name': StringType, 'age?': NumberType });

  test('exact object is compatible with itself', () => {
    expect(point2D.isCompatibleWith(point2D, NO_ALIASES)).toBe(true);
  });

  test('superset is compatible with subset (structural subtyping)', () => {
    // point3D has x, y, z — compatible with point2D which only requires x, y
    expect(point3D.isCompatibleWith(point2D, NO_ALIASES)).toBe(true);
  });

  test('subset is NOT compatible with superset (missing required property)', () => {
    expect(point2D.isCompatibleWith(point3D, NO_ALIASES)).toBe(false);
  });

  test('wrong property type is NOT compatible', () => {
    const badPoint = obj({ x: StringType, y: NumberType });
    expect(badPoint.isCompatibleWith(point2D, NO_ALIASES)).toBe(false);
  });

  test('object with optional property accepts object without it', () => {
    // optAge has name (required) and age? (optional)
    const justName = obj({ name: StringType });
    expect(justName.isCompatibleWith(optAge, NO_ALIASES)).toBe(true);
  });

  test('object is compatible with any', () => {
    expect(point2D.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('object is compatible with "object" alias', () => {
    expect(point2D.isCompatibleWith(new TypeAlias('object'), NO_ALIASES)).toBe(true);
  });

  test('toString() formats properties', () => {
    expect(point2D.toString()).toBe('{x: number, y: number}');
  });

  test('empty object toString() is {}', () => {
    expect(new ObjectType(new Map()).toString()).toBe('{}');
  });
});

describe('ObjectType.excessPropertiesAgainst()', () => {
  const base = obj({ x: NumberType });
  const extra = obj({ x: NumberType, y: NumberType });

  test('returns no excess when shapes match', () => {
    expect(base.excessPropertiesAgainst(base)).toEqual([]);
  });

  test('returns excess property names', () => {
    expect(extra.excessPropertiesAgainst(base)).toEqual(['y']);
  });

  test('returns empty when target is not ObjectType', () => {
    expect(extra.excessPropertiesAgainst(NumberType)).toEqual([]);
  });
});

describe('ObjectType.getPropertyType()', () => {
  const user = obj({ name: StringType, age: NumberType });

  test('returns correct type for existing property', () => {
    expect(user.getPropertyType('name')).toBe(StringType);
    expect(user.getPropertyType('age')).toBe(NumberType);
  });

  test('returns null for missing property', () => {
    expect(user.getPropertyType('email')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UnionType
// ---------------------------------------------------------------------------

describe('UnionType', () => {
  const strOrNum = Types.union([StringType, NumberType]);
  const strOrNull = Types.union([StringType, NullType]);

  test('toString()', () => {
    expect(strOrNum.toString()).toBe('string | number');
  });

  test('is compatible with any of its members as target', () => {
    expect(strOrNum.isCompatibleWith(StringType, NO_ALIASES)).toBe(false);
    // Union is compatible with target only if ALL members are compatible — here number is not string
  });

  test('is compatible with any when target is any', () => {
    expect(strOrNum.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('removeNullish() strips null and undefined', () => {
    const result = strOrNull.removeNullish();
    expect(result).toBe(StringType);
  });

  test('removeNullish() on string | number | null -> string | number', () => {
    const threeWay = Types.union([StringType, NumberType, NullType]);
    const result = threeWay.removeNullish();
    expect(result).toBeInstanceOf(UnionType);
    expect(result.toString()).toBe('string | number');
  });

  test('removeNullish() on null | undefined -> NeverType', () => {
    const onlyNullish = Types.union([NullType, UndefinedType]);
    expect(onlyNullish.removeNullish()).toBe(NeverType);
  });

  test('flattens nested unions', () => {
    const nested = Types.union([strOrNum, BooleanType]);
    expect(nested.toString()).toBe('string | number | boolean');
  });

  test('absorbs to any when any is a member', () => {
    const withAny = Types.union([StringType, AnyType]);
    // any absorption: the union's toString() resolves to 'any'
    expect(withAny.toString()).toBe('any');
  });

  test('deduplicates repeated types', () => {
    const duped = Types.union([StringType, StringType, NumberType]);
    expect(duped.types).toHaveLength(2);
  });

  test('literal absorbed by its base type when both present', () => {
    const litHello = Types.literal('hello', StringType);
    const mixed = Types.union([litHello, StringType]);
    // string absorbs "hello", so only string remains
    expect(mixed.toString()).toBe('string');
  });

  test('narrow() to type present in union', () => {
    const result = strOrNum.narrow(StringType);
    expect(result).toBe(StringType);
  });

  test('narrow() to type absent from union -> NeverType', () => {
    const result = strOrNum.narrow(BooleanType);
    expect(result).toBe(NeverType);
  });

  test('exclude() removes a type from union', () => {
    const result = strOrNull.exclude(NullType);
    expect(result).toBe(StringType);
  });

  test('exclude() of absent type returns unchanged union', () => {
    const result = strOrNum.exclude(BooleanType);
    expect(result).toBeInstanceOf(UnionType);
    expect(result.toString()).toBe('string | number');
  });

  test('equals() is order-independent', () => {
    const a = Types.union([StringType, NumberType]);
    const b = Types.union([NumberType, StringType]);
    expect(a.equals(b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IntersectionType
// ---------------------------------------------------------------------------

describe('IntersectionType', () => {
  const hasName = obj({ name: StringType });
  const hasAge  = obj({ age: NumberType });
  const both    = Types.intersection([hasName, hasAge]);

  test('toString()', () => {
    expect(both.toString()).toBe('{name: string} & {age: number}');
  });

  test('merge() produces combined ObjectType', () => {
    const merged = both.merge(NO_ALIASES);
    expect(merged).toBeInstanceOf(ObjectType);
    expect(merged.getPropertyType('name')).toBe(StringType);
    expect(merged.getPropertyType('age')).toBe(NumberType);
  });

  test('merged intersection is compatible with a sub-shape', () => {
    expect(both.isCompatibleWith(hasName, NO_ALIASES)).toBe(true);
    expect(both.isCompatibleWith(hasAge, NO_ALIASES)).toBe(true);
  });

  test('merged intersection is NOT compatible with incompatible shape', () => {
    const hasEmail = obj({ email: StringType });
    expect(both.isCompatibleWith(hasEmail, NO_ALIASES)).toBe(false);
  });

  test('is compatible with any', () => {
    expect(both.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('merge() returns null for non-object intersection', () => {
    const mixed = Types.intersection([StringType, NumberType]);
    expect(mixed.merge(NO_ALIASES)).toBeNull();
  });

  test('equals() is order-independent', () => {
    const a = Types.intersection([hasName, hasAge]);
    const b = Types.intersection([hasAge, hasName]);
    expect(a.equals(b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FunctionType — variance
// ---------------------------------------------------------------------------

describe('FunctionType variance', () => {
  // (number) => string
  const numToStr = new FunctionType([NumberType], StringType);
  // (number) => number
  const numToNum = new FunctionType([NumberType], NumberType);
  // (string) => string
  const strToStr = new FunctionType([StringType], StringType);
  // (any) => string  — wider param
  const anyToStr = new FunctionType([AnyType], StringType);

  test('identical signatures are compatible', () => {
    expect(numToStr.isCompatibleWith(numToStr, NO_ALIASES)).toBe(true);
  });

  test('different return type is NOT compatible', () => {
    expect(numToStr.isCompatibleWith(numToNum, NO_ALIASES)).toBe(false);
  });

  test('different param type is NOT compatible', () => {
    expect(numToStr.isCompatibleWith(strToStr, NO_ALIASES)).toBe(false);
  });

  test('compatible with AnyFunctionType (target)', () => {
    expect(numToStr.isCompatibleWith(AnyFunctionType, NO_ALIASES)).toBe(true);
  });

  test('AnyFunctionType is compatible with specific type (target)', () => {
    expect(AnyFunctionType.isCompatibleWith(numToStr, NO_ALIASES)).toBe(true);
  });

  test('param count mismatch is NOT compatible', () => {
    const twoParams = new FunctionType([NumberType, StringType], NumberType);
    expect(numToNum.isCompatibleWith(twoParams, NO_ALIASES)).toBe(false);
  });

  test('toString() for specific signature', () => {
    expect(numToStr.toString()).toBe('(p0: number) => string');
  });

  test('toString() for AnyFunctionType', () => {
    expect(AnyFunctionType.toString()).toBe('() => any');
  });

  test('equals() for identical signatures', () => {
    expect(numToStr.equals(new FunctionType([NumberType], StringType))).toBe(true);
  });

  test('equals() returns false for different signatures', () => {
    expect(numToStr.equals(numToNum)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTypeCompatible — cross-cutting
// ---------------------------------------------------------------------------

describe('isTypeCompatible — cross-cutting', () => {
  test('value compatible with any target via AnyType', () => {
    expect(isTypeCompatible(StringType, AnyType, {})).toBe(true);
    expect(isTypeCompatible(NumberType, AnyType, {})).toBe(true);
    expect(isTypeCompatible(AnyFunctionType, AnyType, {})).toBe(true);
  });

  test('string is NOT compatible with number', () => {
    expect(isTypeCompatible(StringType, NumberType, {})).toBe(false);
  });

  test('string is compatible with string | null (union target)', () => {
    const strOrNull = Types.union([StringType, NullType]);
    expect(isTypeCompatible(StringType, strOrNull, {})).toBe(true);
  });

  test('number is NOT compatible with string | null', () => {
    const strOrNull = Types.union([StringType, NullType]);
    expect(isTypeCompatible(NumberType, strOrNull, {})).toBe(false);
  });

  test('null is compatible with string | null', () => {
    const strOrNull = Types.union([StringType, NullType]);
    expect(isTypeCompatible(NullType, strOrNull, {})).toBe(true);
  });

  test('object value is compatible with object-shaped target', () => {
    const value  = new ObjectType(new Map([['x', { type: NumberType, optional: false }]]));
    const target = new ObjectType(new Map([['x', { type: NumberType, optional: false }]]));
    expect(isTypeCompatible(value, target, {})).toBe(true);
  });

  test('resolves type aliases through plain-object alias map', () => {
    const aliases = { MyNum: NumberType };
    expect(isTypeCompatible(NumberType, new TypeAlias('MyNum'), aliases)).toBe(true);
    expect(isTypeCompatible(StringType, new TypeAlias('MyNum'), aliases)).toBe(false);
  });
});
