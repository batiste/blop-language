/**
 * Tests for index signatures: { [key: string]: V }
 * Covers construction, display, compatibility, parsing, and inference integration.
 */

import { describe, test, expect } from 'vitest';

import {
  ObjectType, RecordType, UnionType,
  StringType, NumberType, BooleanType, AnyType,
  Types, TypeAliasMap,
} from '../../inference/Type.js';

import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NO_ALIASES = new TypeAliasMap();

function objType(props) {
  const map = new Map();
  for (const [k, v] of Object.entries(props)) map.set(k, { type: v, optional: false });
  return new ObjectType(map);
}

function indexedType(keyType, valueType, extraProps = {}) {
  const map = new Map();
  for (const [k, v] of Object.entries(extraProps)) map.set(k, { type: v, optional: false });
  return new ObjectType(map, null, { keyType, valueType });
}

// ---------------------------------------------------------------------------
// Construction & display
// ---------------------------------------------------------------------------

describe('ObjectType with index signature — construction', () => {
  test('null indexSignature by default', () => {
    const t = objType({ name: StringType });
    expect(t.indexSignature).toBeNull();
  });

  test('stores indexSignature when provided', () => {
    const t = indexedType(StringType, NumberType);
    expect(t.indexSignature).not.toBeNull();
    expect(t.indexSignature.keyType).toBe(StringType);
    expect(t.indexSignature.valueType).toBe(NumberType);
  });

  test('toString: pure index signature', () => {
    const t = indexedType(StringType, NumberType);
    expect(t.toString()).toBe('{[key: string]: number}');
  });

  test('toString: index signature with named property', () => {
    const t = indexedType(StringType, NumberType, { count: NumberType });
    expect(t.toString()).toContain('[key: string]: number');
    expect(t.toString()).toContain('count: number');
  });

  test('toString: empty object still returns {}', () => {
    expect(new ObjectType(new Map()).toString()).toBe('{}');
  });
});

describe('ObjectType with index signature — equals', () => {
  test('two identical index signatures are equal', () => {
    const a = indexedType(StringType, NumberType);
    const b = indexedType(StringType, NumberType);
    expect(a.equals(b)).toBe(true);
  });

  test('different value types are not equal', () => {
    const a = indexedType(StringType, NumberType);
    const b = indexedType(StringType, StringType);
    expect(a.equals(b)).toBe(false);
  });

  test('one with index sig, one without: not equal', () => {
    const a = indexedType(StringType, NumberType);
    const b = objType({ x: NumberType });
    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

describe('index signature compatibility', () => {
  test('named-property object is compatible with index signature when values match', () => {
    const source = objType({ x: NumberType, y: NumberType });
    const target = indexedType(StringType, NumberType);
    expect(source.isCompatibleWith(target, NO_ALIASES)).toBe(true);
  });

  test('named-property object is NOT compatible if a value type mismatches', () => {
    const source = objType({ x: NumberType, label: StringType });
    const target = indexedType(StringType, NumberType);
    expect(source.isCompatibleWith(target, NO_ALIASES)).toBe(false);
  });

  test('index-signature object is compatible with named object when value type covers it', () => {
    const source = indexedType(StringType, NumberType);
    const target = objType({ x: NumberType });
    expect(source.isCompatibleWith(target, NO_ALIASES)).toBe(true);
  });

  test('index-signature object is NOT compatible with named object when value type is wrong', () => {
    const source = indexedType(StringType, StringType);
    const target = objType({ x: NumberType });
    expect(source.isCompatibleWith(target, NO_ALIASES)).toBe(false);
  });

  test('two matching index signatures are mutually compatible', () => {
    const a = indexedType(StringType, NumberType);
    const b = indexedType(StringType, NumberType);
    expect(a.isCompatibleWith(b, NO_ALIASES)).toBe(true);
  });

  test('index-signature object is compatible with RecordType when value types match', () => {
    const source = indexedType(StringType, NumberType);
    const target = new RecordType(StringType, NumberType);
    expect(source.isCompatibleWith(target, NO_ALIASES)).toBe(true);
  });

  test('index-signature object is NOT compatible with RecordType when value types differ', () => {
    const source = indexedType(StringType, StringType);
    const target = new RecordType(StringType, NumberType);
    expect(source.isCompatibleWith(target, NO_ALIASES)).toBe(false);
  });

  test('any is always a valid target', () => {
    const source = indexedType(StringType, NumberType);
    expect(source.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPropertyType fallback
// ---------------------------------------------------------------------------

describe('getPropertyType fallback to index signature', () => {
  test('returns indexed value type for unknown property name', () => {
    const t = indexedType(StringType, NumberType);
    expect(t.getPropertyType('anything')).toBe(NumberType);
  });

  test('returns named property when present (takes precedence)', () => {
    const map = new Map([['count', { type: BooleanType, optional: false }]]);
    const t = new ObjectType(map, null, { keyType: StringType, valueType: NumberType });
    expect(t.getPropertyType('count')).toBe(BooleanType);
  });

  test('returns null when no named prop and no index signature', () => {
    const t = objType({ name: StringType });
    expect(t.getPropertyType('missing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Grammar / Parser integration
// ---------------------------------------------------------------------------

describe('index signature syntax — compiled code', () => {
  test('simple index signature annotation compiles', () => {
    expectCompiles(`
      x: { [key: string]: number } = {}
    `);
  });

  test('index signature with number value type compiles', () => {
    expectCompiles(`
      scores: { [key: string]: number } = {}
      scores['player1'] = 42
    `);
  });

  test('bracket assignment into indexed object compiles', () => {
    expectCompiles(`
      cache: { [key: string]: string } = {}
      cache['result'] = 'cached'
    `);
  });

  test('function parameter with index signature compiles', () => {
    expectCompiles(`
      def lookup(dict: { [key: string]: number }, key: string): number {
        return dict[key]
      }
    `);
  });

  test('index signature mixed with named properties compiles', () => {
    expectCompiles(`
      type Config = { host: string, [key: string]: string }
      c: Config = { host: 'localhost' }
    `);
  });

  test('assigning named-property object to index-signature variable compiles', () => {
    expectCompiles(`
      type Dict = { [key: string]: number }
      d: Dict = { x: 1, y: 2 }
    `);
  });

  test('returns inferred value type for bracket access on indexed annotation', () => {
    // If the access comes back as 'number', the return-type check should pass
    expectCompiles(`
      def getScore(scores: { [key: string]: number }, key: string): number {
        return scores[key]
      }
    `);
  });

  test('mismatched value type produces an error', () => {
    expectCompilationError(`
      type NumDict = { [key: string]: number }
      d: NumDict = { name: 'hello' }
    `, 'index signature expects number');
  });
});
