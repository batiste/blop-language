/**
 * Tests for keyof operator: KeyofType construction, resolution, compatibility, and integration.
 */

import { describe, test, expect } from 'vitest';

import {
  KeyofType, ObjectType, RecordType, UnionType, LiteralType,
  StringType, NumberType, AnyType, NeverType,
  Types, TypeAliasMap,
} from '../../inference/Type.js';

import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NO_ALIASES = new TypeAliasMap();

function objType(props) {
  // props: { key: Type }
  const map = new Map();
  for (const [k, v] of Object.entries(props)) map.set(k, { type: v, optional: false });
  return new ObjectType(map);
}

// ---------------------------------------------------------------------------
// Construction & display
// ---------------------------------------------------------------------------

describe('KeyofType construction', () => {
  test('toString wraps subject in keyof', () => {
    const t = new KeyofType(Types.alias('State'));
    expect(t.toString()).toBe('keyof State');
  });

  test('equals two equivalent KeyofTypes', () => {
    const a = new KeyofType(Types.alias('State'));
    const b = new KeyofType(Types.alias('State'));
    expect(a.equals(b)).toBe(true);
  });

  test('does not equal different subject', () => {
    const a = new KeyofType(Types.alias('State'));
    const b = new KeyofType(Types.alias('Props'));
    expect(a.equals(b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Resolution via TypeAliasMap
// ---------------------------------------------------------------------------

describe('TypeAliasMap.resolveKeyof — ObjectType', () => {
  test('two-property object resolves to string literal union', () => {
    const aliases = new TypeAliasMap();
    aliases.define('State', objType({ counter: NumberType, name: StringType }));

    const keyofState = new KeyofType(Types.alias('State'));
    const resolved = aliases.resolveKeyof(keyofState);
    expect(resolved).toBeInstanceOf(UnionType);
    const names = resolved.types.map(t => t.value).sort();
    expect(names).toEqual(['counter', 'name']);
  });

  test('single-property object resolves to a single string literal', () => {
    const aliases = new TypeAliasMap();
    aliases.define('Point', objType({ x: NumberType }));

    const resolved = aliases.resolveKeyof(new KeyofType(Types.alias('Point')));
    expect(resolved).toBeInstanceOf(LiteralType);
    expect(resolved.value).toBe('x');
  });

  test('empty object resolves to never', () => {
    const aliases = new TypeAliasMap();
    aliases.define('Empty', objType({}));

    const resolved = aliases.resolveKeyof(new KeyofType(Types.alias('Empty')));
    expect(resolved).toBe(NeverType);
  });
});

describe('TypeAliasMap.resolveKeyof — RecordType', () => {
  test('Record<string, V> resolves keyof to string', () => {
    const aliases = new TypeAliasMap();
    aliases.define('Dict', new RecordType(StringType, NumberType));

    const resolved = aliases.resolveKeyof(new KeyofType(Types.alias('Dict')));
    expect(resolved).toBe(StringType);
  });

  test('Record<number, V> resolves keyof to number', () => {
    const aliases = new TypeAliasMap();
    aliases.define('Arr', new RecordType(NumberType, StringType));

    const resolved = aliases.resolveKeyof(new KeyofType(Types.alias('Arr')));
    expect(resolved).toBe(NumberType);
  });
});

describe('TypeAliasMap.resolveKeyof — special subjects', () => {
  test('keyof any resolves to string | number', () => {
    const resolved = NO_ALIASES.resolveKeyof(new KeyofType(AnyType));
    expect(resolved).toBeInstanceOf(UnionType);
    const names = resolved.types.map(t => t.toString()).sort();
    expect(names).toEqual(['number', 'string']);
  });

  test('unresolvable subject falls back to string', () => {
    const resolved = NO_ALIASES.resolveKeyof(new KeyofType(Types.alias('Unknown')));
    expect(resolved).toBe(StringType);
  });
});

// ---------------------------------------------------------------------------
// isCompatibleWith delegation
// ---------------------------------------------------------------------------

describe('KeyofType.isCompatibleWith (via aliases)', () => {
  function aliasesFor(obj) {
    const aliases = new TypeAliasMap();
    aliases.define('T', obj);
    return aliases;
  }

  test('string literal "a" is compatible with keyof T where T has property a', () => {
    const aliases = aliasesFor(objType({ a: NumberType, b: StringType }));
    const keyofT = new KeyofType(Types.alias('T'));
    const litA = Types.literal('a', StringType);
    // "a" can be assigned to keyof T (which resolves to "a" | "b")
    expect(litA.isCompatibleWith(keyofT, aliases)).toBe(true);
  });

  test('non-key literal "z" is not compatible with keyof T', () => {
    const aliases = aliasesFor(objType({ a: NumberType }));
    const keyofT = new KeyofType(Types.alias('T'));
    const litZ = Types.literal('z', StringType);
    expect(litZ.isCompatibleWith(keyofT, aliases)).toBe(false);
  });

  test('keyof T (union) is not assignable to one key literal (superset not a subtype)', () => {
    const aliases = aliasesFor(objType({ a: NumberType, b: StringType }));
    const keyofT = new KeyofType(Types.alias('T'));
    const litA = Types.literal('a', StringType);
    // A union "a"|"b" is not assignable to "a"
    expect(keyofT.isCompatibleWith(litA, aliases)).toBe(false);
  });

  test('resolved keyof union is compatible with string (string literal assignable to string)', () => {
    const aliases = aliasesFor(objType({ a: NumberType }));
    const keyofT = new KeyofType(Types.alias('T'));
    const resolved = keyofT.resolve(aliases); // LiteralType("a")
    expect(resolved.isCompatibleWith(StringType, aliases)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: parse & compile keyof annotations
// ---------------------------------------------------------------------------

describe('keyof integration (compile)', () => {
  test('variable annotated keyof ObjectType alias accepts a valid key string', () => {
    expectCompiles(`
      type State = {
        counter: number,
        name: string
      }
      k: keyof State = 'counter'
    `);
  });

  test('function parameter typed as keyof accepts valid key', () => {
    expectCompiles(`
      type Shape = {
        width: number,
        height: number
      }
      def getKey(k: keyof Shape): string {
        return k
      }
    `);
  });

  test('assigning a non-key string literal to keyof raises a type error', () => {
    expectCompilationError(`
      type State = {
        counter: number
      }
      k: keyof State = 'missing'
    `, /assign|keyof/i);
  });

  test('keyof alias used in return type', () => {
    expectCompiles(`
      type Config = {
        host: string,
        port: number
      }
      def configKey(): keyof Config {
        return 'host'
      }
    `);
  });

  test('keyof Record resolves to key type (string)', () => {
    expectCompiles(`
      type Dict = Record<string, number>
      def dictKey(): keyof Dict {
        return 'anything'
      }
    `);
  });
});
