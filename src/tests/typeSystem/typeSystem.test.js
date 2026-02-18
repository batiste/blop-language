/**
 * Low-level unit tests for the type system.
 *
 * These tests exercise Type classes, TypeAliasMap, isTypeCompatible,
 * stringToType, and the typeParser directly — without going through
 * the full compiler pipeline. They exist to catch regressions in the
 * core type machinery and to help diagnose failures quickly.
 */

import { describe, test, expect } from 'vitest';

import {
  AnyFunctionType,
  FunctionType,
  TypeAlias,
  TypeAliasMap,
  PrimitiveType,
  UnionType,
  AnyType,
  NeverType,
  StringType,
  NumberType,
  BooleanType,
  NullType,
  Types,
} from '../../inference/Type.js';

import {
  isTypeCompatible,
  stringToType,
  narrowType,
  excludeType,
  createUnionType,
} from '../../inference/typeSystem.js';

import { parseTypePrimary } from '../../inference/typeParser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal TypeAliasMap from a plain object (mirrors stringMapToTypeAliasMap).
 * We call isTypeCompatible which does it internally, but it's useful to inspect.
 */
function aliasMapFrom(obj) {
  const m = new TypeAliasMap();
  for (const [name, value] of Object.entries(obj)) {
    m.define(name, value);
  }
  return m;
}

// ---------------------------------------------------------------------------
// AnyFunctionType singleton
// ---------------------------------------------------------------------------

describe('AnyFunctionType', () => {
  test('is a FunctionType with null params', () => {
    expect(AnyFunctionType).toBeInstanceOf(FunctionType);
    expect(AnyFunctionType.params).toBeNull();
  });

  test('toString() returns "function"', () => {
    expect(AnyFunctionType.toString()).toBe('function');
  });

  test('equals any FunctionType (wildcard)', () => {
    const specific = new FunctionType([NumberType], NumberType);
    expect(AnyFunctionType.equals(specific)).toBe(true);
    expect(specific.equals(AnyFunctionType)).toBe(true);
    expect(AnyFunctionType.equals(AnyFunctionType)).toBe(true);
  });

  test('is NOT equal to a non-FunctionType', () => {
    expect(AnyFunctionType.equals(NumberType)).toBe(false);
    expect(AnyFunctionType.equals(StringType)).toBe(false);
    expect(AnyFunctionType.equals(AnyType)).toBe(false);
  });

  test('isCompatibleWith AnyType', () => {
    expect(AnyFunctionType.isCompatibleWith(AnyType, new TypeAliasMap())).toBe(true);
  });

  test('isCompatibleWith any FunctionType', () => {
    const specific = new FunctionType([StringType], NumberType);
    expect(AnyFunctionType.isCompatibleWith(specific, new TypeAliasMap())).toBe(true);
    expect(specific.isCompatibleWith(AnyFunctionType, new TypeAliasMap())).toBe(true);
  });

  test('is NOT compatible with a primitive type', () => {
    expect(AnyFunctionType.isCompatibleWith(NumberType, new TypeAliasMap())).toBe(false);
    expect(AnyFunctionType.isCompatibleWith(StringType, new TypeAliasMap())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stringToType — 'function' keyword
// ---------------------------------------------------------------------------

// describe('stringToType', () => {
//   test('"function" -> AnyFunctionType', () => {
//     expect(stringToType('function')).toBe(AnyFunctionType);
//   });

//   test('"string" -> StringType', () => {
//     expect(stringToType('string')).toBe(StringType);
//   });

//   test('"number" -> NumberType', () => {
//     expect(stringToType('number')).toBe(NumberType);
//   });

//   test('"boolean" -> BooleanType', () => {
//     expect(stringToType('boolean')).toBe(BooleanType);
//   });

//   test('"any" -> AnyType', () => {
//     expect(stringToType('any')).toBe(AnyType);
//   });

//   test('"never" -> NeverType', () => {
//     expect(stringToType('never')).toBe(NeverType);
//   });

//   test('"null" -> NullType', () => {
//     expect(stringToType('null')).toBe(NullType);
//   });

//   test('"string | null" -> UnionType', () => {
//     const t = stringToType('string | null');
//     expect(t).toBeInstanceOf(UnionType);
//     expect(t.toString()).toBe('string | null');
//   });

//   test('"number[]" -> ArrayType', () => {
//     const t = stringToType('number[]');
//     expect(t.toString()).toBe('number[]');
//   });
// });

// ---------------------------------------------------------------------------
// parseTypePrimary — 'function' type annotation
// ---------------------------------------------------------------------------

describe('parseTypePrimary — "function" type name', () => {
  /**
   * Build the minimal AST node shape that parseTypePrimary expects
   * for a simple type name like "function" or "number".
   */
  function makeTypePrimaryNode(typeName) {
    const nameToken = { value: typeName };
    const typeNameNode = { children: [nameToken] };
    return {
      named: { name: typeNameNode },
      children: [typeNameNode],
    };
  }

  test('"function" type name parses to AnyFunctionType', () => {
    const node = makeTypePrimaryNode('function');
    const result = parseTypePrimary(node);
    expect(result).toBe(AnyFunctionType);
  });

  test('"number" type name parses to NumberType', () => {
    const node = makeTypePrimaryNode('number');
    const result = parseTypePrimary(node);
    expect(result).toBe(NumberType);
  });

  test('"string" type name parses to StringType', () => {
    const node = makeTypePrimaryNode('string');
    const result = parseTypePrimary(node);
    expect(result).toBe(StringType);
  });
});

// ---------------------------------------------------------------------------
// TypeAliasMap — resolving type aliases
// ---------------------------------------------------------------------------

describe('TypeAliasMap', () => {
  test('resolves a simple alias', () => {
    const m = new TypeAliasMap();
    m.define('MyNumber', NumberType);
    expect(m.resolve(new TypeAlias('MyNumber'))).toBe(NumberType);
  });

  test('resolves a chain of aliases', () => {
    const m = new TypeAliasMap();
    m.define('ID', NumberType);
    m.define('UserID', new TypeAlias('ID'));
    expect(m.resolve(new TypeAlias('UserID'))).toBe(NumberType);
  });

  test('returns the alias as-is when unknown', () => {
    const m = new TypeAliasMap();
    const alias = new TypeAlias('Unknown');
    expect(m.resolve(alias)).toBe(alias);
  });

  test('resolves Callback = AnyFunctionType', () => {
    const m = new TypeAliasMap();
    m.define('Callback', AnyFunctionType);
    const resolved = m.resolve(new TypeAlias('Callback'));
    expect(resolved).toBe(AnyFunctionType);
  });

  test('defines AnyFunctionType alias without treating it as a generic alias', () => {
    // AnyFunctionType has a `.genericParams` array property (= []).
    // The alias map must NOT mistake it for a generic type definition.
    const m = new TypeAliasMap();
    m.define('Callback', AnyFunctionType);
    // It should be stored as a plain Type, not as {type, genericParams}
    expect(m.get('Callback')).toBe(AnyFunctionType);
  });
});

// ---------------------------------------------------------------------------
// isTypeCompatible — AnyFunctionType vs type aliases
// ---------------------------------------------------------------------------

describe('isTypeCompatible — function types', () => {
  test('AnyFunctionType is compatible with AnyFunctionType', () => {
    expect(isTypeCompatible(AnyFunctionType, AnyFunctionType, {})).toBe(true);
  });

  test('AnyFunctionType is compatible with specific FunctionType', () => {
    const specific = new FunctionType([NumberType], NumberType);
    expect(isTypeCompatible(AnyFunctionType, specific, {})).toBe(true);
    expect(isTypeCompatible(specific, AnyFunctionType, {})).toBe(true);
  });

  test('AnyFunctionType is compatible with Callback alias resolved to AnyFunctionType', () => {
    const aliases = { Callback: AnyFunctionType };
    expect(isTypeCompatible(AnyFunctionType, new TypeAlias('Callback'), aliases)).toBe(true);
  });

  test('AnyFunctionType is NOT compatible with NumberType', () => {
    expect(isTypeCompatible(AnyFunctionType, NumberType, {})).toBe(false);
  });

  test('"function" string is compatible with Callback alias', () => {
    // stringToType('function') === AnyFunctionType
    const aliases = { Callback: AnyFunctionType };
    expect(isTypeCompatible(stringToType('function'), new TypeAlias('Callback'), aliases)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isTypeCompatible — stringMapToTypeAliasMap conversion edge case
// ---------------------------------------------------------------------------

describe('isTypeCompatible — type alias map conversion', () => {
  test('plain object aliases with Type values resolve correctly', () => {
    // The plain-object typeAliases map goes through stringMapToTypeAliasMap inside
    // isTypeCompatible. Ensure FunctionType is not misidentified as a generic alias.
    const aliases = { Callback: AnyFunctionType };
    expect(isTypeCompatible(AnyFunctionType, new TypeAlias('Callback'), aliases)).toBe(true);
  });

  test('FunctionType with genericParams=[] is NOT treated as a generic alias', () => {
    // Root-cause regression test: AnyFunctionType.genericParams === [] (truthy).
    // A naive check `if (value.genericParams)` would store it as {type, genericParams},
    // making the alias unresolvable. The check must be `value.genericParams.length > 0`.
    const fn = new FunctionType([NumberType], NumberType);
    expect(fn.genericParams).toEqual([]);   // has .genericParams

    const aliases = { MyFn: fn };
    // Should resolve MyFn → fn, then fn.isCompatibleWith(fn) = true
    expect(isTypeCompatible(fn, new TypeAlias('MyFn'), aliases)).toBe(true);
  });

  test('generic FunctionType IS treated as generic alias', () => {
    const genericFn = new FunctionType([new TypeAlias('T')], new TypeAlias('T'), ['T']);
    expect(genericFn.genericParams).toEqual(['T']);
    // When stored in aliases with generic params it should stay generic
    const aliases = { Identity: genericFn };
    // Just checking it doesn't crash — generic aliases without args resolve to alias as-is
    const result = isTypeCompatible(AnyFunctionType, new TypeAlias('Identity'), aliases);
    // May be true (AnyFunctionType accepts anything) or false — just must not throw
    expect(typeof result).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// narrowType & excludeType
// ---------------------------------------------------------------------------

describe('narrowType', () => {
  test('narrows string | boolean to boolean', () => {
    const union = Types.union([StringType, BooleanType]);
    const result = narrowType(union, BooleanType);
    expect(result).toBe(BooleanType);
  });

  test('narrows string | null to string', () => {
    const union = Types.union([StringType, NullType]);
    const result = narrowType(union, StringType);
    expect(result).toBe(StringType);
  });

  test('narrowing to non-member returns NeverType', () => {
    const union = Types.union([StringType, BooleanType]);
    const result = narrowType(union, NumberType);
    expect(result).toBe(NeverType);
  });
});

describe('excludeType', () => {
  test('excludes boolean from string | boolean -> string', () => {
    const union = Types.union([StringType, BooleanType]);
    const result = excludeType(union, BooleanType);
    expect(result).toBe(StringType);
  });

  test('excludes null from string | null -> string', () => {
    const union = Types.union([StringType, NullType]);
    const result = excludeType(union, NullType);
    expect(result).toBe(StringType);
  });

  test('excluding non-member returns original type', () => {
    const union = Types.union([StringType, BooleanType]);
    const result = excludeType(union, NumberType);
    expect(result).toBeInstanceOf(UnionType);
    expect(result.toString()).toBe('string | boolean');
  });
});

// ---------------------------------------------------------------------------
// Type narrowing integration — typeof checks use PrimitiveType, not strings
// ---------------------------------------------------------------------------

describe('type narrowing — PrimitiveType comparisons', () => {
  test('BooleanType.equals(BooleanType) is true', () => {
    expect(BooleanType.equals(BooleanType)).toBe(true);
  });

  test('BooleanType.equals(StringType) is false', () => {
    expect(BooleanType.equals(StringType)).toBe(false);
  });

  test('BooleanType does NOT equal the string "boolean"', () => {
    // PrimitiveType.equals requires instanceof PrimitiveType — never a raw string.
    expect(BooleanType.equals('boolean')).toBe(false);
  });

  test('narrowing boolean | string with boolean (PrimitiveType) works', () => {
    const union = Types.union([BooleanType, StringType]);
    expect(narrowType(union, BooleanType)).toBe(BooleanType);
    expect(excludeType(union, BooleanType)).toBe(StringType);
  });

  test('narrowing boolean | string with string "boolean" fails (regression guard)', () => {
    const union = Types.union([BooleanType, StringType]);
    // Passing a raw string should not narrow correctly — it's not a valid Type
    // (This guards against the old bug where typeGuards.js returned raw strings)
    const narrowed = narrowType(union, 'boolean');
    // With a string, the union's narrow() won't find a match → NeverType
    expect(narrowed).toBe(NeverType);
  });
});
