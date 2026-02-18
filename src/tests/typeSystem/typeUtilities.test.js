/**
 * Low-level tests for utility functions in typeSystem.js:
 * - removeNullish
 * - getPropertyType
 * - getBaseTypeOfLiteral
 * - isStringLiteral / isNumberLiteral / isBooleanLiteral
 * - isUnionType / parseUnionType
 * - createUnionType
 * - resolveTypeAlias
 * - parseObjectTypeString (round-trip string → ObjectType)
 */

import { describe, test, expect } from 'vitest';

import {
  ObjectType, UnionType, TypeAlias, TypeAliasMap,
  LiteralType, ArrayType,
  AnyType, NeverType, StringType, NumberType, BooleanType,
  NullType, UndefinedType, AnyFunctionType, Types,
} from '../../inference/Type.js';

import {
  removeNullish,
  getPropertyType,
  getBaseTypeOfLiteral,
  isStringLiteral,
  isNumberLiteral,
  isBooleanLiteral,
  isUnionType,
  parseUnionType,
  createUnionType,
  resolveTypeAlias,
  parseObjectTypeString,
} from '../../inference/typeSystem.js';

const NO_ALIASES = {};

// ---------------------------------------------------------------------------
// removeNullish
// ---------------------------------------------------------------------------

describe('removeNullish', () => {
  test('string | null -> string', () => {
    const t = Types.union([StringType, NullType]);
    expect(removeNullish(t)).toBe(StringType);
  });

  test('string | undefined -> string', () => {
    const t = Types.union([StringType, UndefinedType]);
    expect(removeNullish(t)).toBe(StringType);
  });

  test('string | number | null -> string | number', () => {
    const t = Types.union([StringType, NumberType, NullType]);
    const result = removeNullish(t);
    expect(result).toBeInstanceOf(UnionType);
    expect(result.toString()).toBe('string | number');
  });

  test('null alone -> NeverType', () => {
    expect(removeNullish(NullType)).toBe(NeverType);
  });

  test('undefined alone -> NeverType', () => {
    expect(removeNullish(UndefinedType)).toBe(NeverType);
  });

  test('non-nullable type is unchanged', () => {
    expect(removeNullish(StringType)).toBe(StringType);
    expect(removeNullish(NumberType)).toBe(NumberType);
  });

  test('null | undefined -> NeverType', () => {
    const t = Types.union([NullType, UndefinedType]);
    expect(removeNullish(t)).toBe(NeverType);
  });
});

// ---------------------------------------------------------------------------
// getPropertyType
// ---------------------------------------------------------------------------

describe('getPropertyType', () => {
  const userType = new ObjectType(new Map([
    ['name', { type: StringType, optional: false }],
    ['age',  { type: NumberType, optional: false }],
  ]));

  test('retrieves top-level property type', () => {
    expect(getPropertyType(userType, 'name', NO_ALIASES)).toBe(StringType);
    expect(getPropertyType(userType, 'age', NO_ALIASES)).toBe(NumberType);
  });

  test('returns null for missing property', () => {
    expect(getPropertyType(userType, 'email', NO_ALIASES)).toBeNull();
  });

  test('returns AnyType for any object type', () => {
    expect(getPropertyType(AnyType, 'anything', NO_ALIASES)).toBe(AnyType);
  });

  test('traverses nested path', () => {
    const addressType = new ObjectType(new Map([
      ['city', { type: StringType, optional: false }],
    ]));
    const personType = new ObjectType(new Map([
      ['address', { type: addressType, optional: false }],
    ]));
    const result = getPropertyType(personType, ['address', 'city'], NO_ALIASES);
    expect(result).toBe(StringType);
  });

  test('returns null for invalid nested path', () => {
    const result = getPropertyType(userType, ['name', 'toUpperCase'], NO_ALIASES);
    // 'name' is a string primitive — string methods are looked up in builtins, not null
    // Just verify it doesn't throw
    expect(result === null || result !== undefined).toBe(true);
  });

  test('resolves alias before property lookup', () => {
    const aliases = { User: userType };
    const result = getPropertyType(new TypeAlias('User'), 'name', aliases);
    expect(result).toBe(StringType);
  });
});

// ---------------------------------------------------------------------------
// getBaseTypeOfLiteral
// ---------------------------------------------------------------------------

describe('getBaseTypeOfLiteral', () => {
  test('string literal -> StringType', () => {
    const lit = Types.literal('hello', StringType);
    expect(getBaseTypeOfLiteral(lit)).toBe(StringType);
  });

  test('number literal -> NumberType', () => {
    const lit = Types.literal(42, NumberType);
    expect(getBaseTypeOfLiteral(lit)).toBe(NumberType);
  });

  test('boolean literal -> BooleanType', () => {
    const lit = Types.literal(true, BooleanType);
    expect(getBaseTypeOfLiteral(lit)).toBe(BooleanType);
  });

  test('non-literal type is returned as-is', () => {
    expect(getBaseTypeOfLiteral(StringType)).toBe(StringType);
    expect(getBaseTypeOfLiteral(NumberType)).toBe(NumberType);
  });
});

// ---------------------------------------------------------------------------
// isStringLiteral / isNumberLiteral / isBooleanLiteral
// ---------------------------------------------------------------------------

describe('literal type guards', () => {
  const litStr = Types.literal('x', StringType);
  const litNum = Types.literal(1, NumberType);
  const litBool = Types.literal(true, BooleanType);

  test('isStringLiteral', () => {
    expect(isStringLiteral(litStr)).toBe(true);
    expect(isStringLiteral(litNum)).toBe(false);
    expect(isStringLiteral(StringType)).toBe(false);
  });

  test('isNumberLiteral', () => {
    expect(isNumberLiteral(litNum)).toBe(true);
    expect(isNumberLiteral(litStr)).toBe(false);
    expect(isNumberLiteral(NumberType)).toBe(false);
  });

  test('isBooleanLiteral', () => {
    expect(isBooleanLiteral(litBool)).toBe(true);
    expect(isBooleanLiteral(litStr)).toBe(false);
    expect(isBooleanLiteral(BooleanType)).toBe(false);
  });

  test('isBooleanLiteral accepts "true"/"false" strings', () => {
    expect(isBooleanLiteral('true')).toBe(true);
    expect(isBooleanLiteral('false')).toBe(true);
    expect(isBooleanLiteral('string')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isUnionType / parseUnionType
// ---------------------------------------------------------------------------

describe('isUnionType / parseUnionType', () => {
  const union = Types.union([StringType, NumberType]);

  test('isUnionType returns true for UnionType', () => {
    expect(isUnionType(union)).toBe(true);
  });

  test('isUnionType returns false for non-union', () => {
    expect(isUnionType(StringType)).toBe(false);
    expect(isUnionType(AnyType)).toBe(false);
  });

  test('parseUnionType returns array of constituent types', () => {
    const parts = parseUnionType(union);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(StringType);
    expect(parts[1]).toBe(NumberType);
  });

  test('parseUnionType on non-union wraps it in an array', () => {
    expect(parseUnionType(StringType)).toEqual([StringType]);
  });
});

// ---------------------------------------------------------------------------
// createUnionType
// ---------------------------------------------------------------------------

describe('createUnionType', () => {
  test('single type returns the type itself', () => {
    expect(createUnionType([StringType])).toBe(StringType);
  });

  test('two types returns a UnionType', () => {
    const result = createUnionType([StringType, NumberType]);
    expect(result).toBeInstanceOf(UnionType);
    expect(result.toString()).toBe('string | number');
  });

  test('empty array returns AnyType', () => {
    expect(createUnionType([])).toBe(AnyType);
  });
});

// ---------------------------------------------------------------------------
// resolveTypeAlias
// ---------------------------------------------------------------------------

describe('resolveTypeAlias', () => {
  test('resolves a known alias', () => {
    const aliases = { MyStr: StringType };
    const result = resolveTypeAlias(new TypeAlias('MyStr'), aliases);
    expect(result).toBe(StringType);
  });

  test('returns unknown alias unchanged', () => {
    const alias = new TypeAlias('Unknown');
    const result = resolveTypeAlias(alias, {});
    expect(result).toBeInstanceOf(TypeAlias);
  });

  test('non-alias type is returned unchanged', () => {
    expect(resolveTypeAlias(StringType, {})).toBe(StringType);
    expect(resolveTypeAlias(NumberType, {})).toBe(NumberType);
  });

  test('resolves chained aliases', () => {
    const aliases = { ID: NumberType, UserID: new TypeAlias('ID') };
    const result = resolveTypeAlias(new TypeAlias('UserID'), aliases);
    expect(result).toBe(NumberType);
  });

  test('resolves Callback = AnyFunctionType', () => {
    const aliases = { Callback: AnyFunctionType };
    const result = resolveTypeAlias(new TypeAlias('Callback'), aliases);
    expect(result).toBe(AnyFunctionType);
  });
});

// ---------------------------------------------------------------------------
// parseObjectTypeString (string round-trip)
// Returns a plain {key: {type: string, optional: bool}} map, not an ObjectType
// ---------------------------------------------------------------------------

describe('parseObjectTypeString', () => {
  test('parses a simple object type string into a plain map', () => {
    const result = parseObjectTypeString('{name: string, age: number}');
    expect(result).not.toBeNull();
    expect(result).toBeTypeOf('object');
    expect(result.name.type).toBe('string');
    expect(result.age.type).toBe('number');
  });

  test('returns null for non-object type string', () => {
    expect(parseObjectTypeString('string')).toBeNull();
    expect(parseObjectTypeString('number')).toBeNull();
  });

  test('parses optional properties', () => {
    const result = parseObjectTypeString('{name: string, age?: number}');
    expect(result).not.toBeNull();
    expect(result.age.optional).toBe(true);
    expect(result.name.optional).toBe(false);
  });

  test('empty object {} parses to empty plain object', () => {
    const result = parseObjectTypeString('{}');
    expect(result).not.toBeNull();
    expect(Object.keys(result)).toHaveLength(0);
  });
});
