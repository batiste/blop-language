/**
 * Tests for Mapped Types: { [K in keyof T]: T[K] }
 *
 * Covers:
 *  - MappedType construction and display
 *  - TypeAliasMap.resolveMappedType  
 *  - Built-in utility types: Partial<T>, Required<T>, Readonly<T>, Pick<T,K>, Omit<T,K>
 *  - TypeIndexAccess resolution
 *  - End-to-end Blop syntax parsing and compilation
 */

import { describe, test, expect } from 'vitest';

import {
  MappedType, TypeIndexAccess, KeyofType,
  ObjectType, UnionType, LiteralType, TypeAlias,
  StringType, NumberType, BooleanType, AnyType,
  Types, TypeAliasMap,
} from '../../inference/Type.js';

import { expectCompilationError, expectCompiles, dedent } from '../testHelpers.js';
import { compileSource } from '../../compile.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function objType(props, optionals = {}) {
  const map = new Map();
  for (const [k, v] of Object.entries(props)) {
    map.set(k, { type: v, optional: !!optionals[k] });
  }
  return new ObjectType(map);
}

function aliasesWithUser() {
  const aliases = new TypeAliasMap();
  aliases.define('User', objType({ name: StringType, age: NumberType }));
  return aliases;
}

function compile(src) {
  return compileSource(dedent(src), 'test.blop', true);
}

// ---------------------------------------------------------------------------
// MappedType construction & display
// ---------------------------------------------------------------------------

describe('MappedType construction', () => {
  test('toString without optional', () => {
    const t = new MappedType('K', new KeyofType(Types.alias('T')), new TypeIndexAccess(Types.alias('T'), Types.alias('K')));
    expect(t.toString()).toBe('{ [K in keyof T]: T[K] }');
  });

  test('toString with optional', () => {
    const t = new MappedType('K', new KeyofType(Types.alias('T')), new TypeIndexAccess(Types.alias('T'), Types.alias('K')), true);
    expect(t.toString()).toBe('{ [K in keyof T]?: T[K] }');
  });

  test('toString with readonly', () => {
    const t = new MappedType('K', new KeyofType(Types.alias('T')), new TypeIndexAccess(Types.alias('T'), Types.alias('K')), false, true);
    expect(t.toString()).toBe('{ readonly [K in keyof T]: T[K] }');
  });
});

// ---------------------------------------------------------------------------
// TypeIndexAccess resolution
// ---------------------------------------------------------------------------

describe('TypeAliasMap.resolveIndexAccess', () => {
  test('T[K] where K is a string literal resolves to the property type', () => {
    const aliases = aliasesWithUser();
    const access = new TypeIndexAccess(new TypeAlias('User'), new LiteralType('name', StringType));
    const resolved = aliases.resolve(access);
    expect(resolved).toBe(StringType);
  });

  test('T[K] where K is unknown returns any', () => {
    const aliases = aliasesWithUser();
    const access = new TypeIndexAccess(new TypeAlias('User'), new TypeAlias('K'));
    const resolved = aliases.resolve(access);
    expect(resolved).toBe(AnyType);
  });
});

// ---------------------------------------------------------------------------
// resolveMappedType
// ---------------------------------------------------------------------------

describe('TypeAliasMap.resolveMappedType', () => {
  test('{ [K in keyof User]: User[K] } resolves to same shape as User', () => {
    const aliases = aliasesWithUser();
    const mapped = new MappedType(
      'K',
      new KeyofType(new TypeAlias('User')),
      new TypeIndexAccess(new TypeAlias('User'), new TypeAlias('K')),
      false
    );
    const resolved = aliases.resolve(mapped);
    expect(resolved).toBeInstanceOf(ObjectType);
    expect(resolved.properties.has('name')).toBe(true);
    expect(resolved.properties.has('age')).toBe(true);
    expect(resolved.properties.get('name').type).toBe(StringType);
    expect(resolved.properties.get('age').type).toBe(NumberType);
    expect(resolved.properties.get('name').optional).toBe(false);
  });

  test('{ [K in keyof User]?: User[K] } resolves with all props optional', () => {
    const aliases = aliasesWithUser();
    const mapped = new MappedType(
      'K',
      new KeyofType(new TypeAlias('User')),
      new TypeIndexAccess(new TypeAlias('User'), new TypeAlias('K')),
      true  // optional
    );
    const resolved = aliases.resolve(mapped);
    expect(resolved).toBeInstanceOf(ObjectType);
    expect(resolved.properties.get('name').optional).toBe(true);
    expect(resolved.properties.get('age').optional).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Built-in utility types: Partial<T>
// ---------------------------------------------------------------------------

describe('Partial<T>', () => {
  test('Partial<User> defined as type alias compiles without errors', () => {
    expectCompiles(dedent(`
      type User = { name: string, age: number }
      type PartialUser = Partial<User>
      x: PartialUser = {}
    `));
  });

  test('Partial<User> allows missing properties', () => {
    expectCompiles(dedent(`
      type User = { name: string, age: number }
      x: Partial<User> = {}
    `));
  });

  test('Partial<User> allows partial object', () => {
    expectCompiles(dedent(`
      type User = { name: string, age: number }
      x: Partial<User> = { name: 'Alice' }
    `));
  });
});

// ---------------------------------------------------------------------------
// Built-in utility types: Required<T>
// ---------------------------------------------------------------------------

describe('Required<T>', () => {
  test('Required<OptionalUser> removes optional from props', () => {
    expectCompiles(dedent(`
      type OptionalUser = { name?: string, age?: number }
      x: Required<OptionalUser> = { name: 'Bob', age: 30 }
    `));
  });
});

// ---------------------------------------------------------------------------
// Built-in utility types: Pick<T, K>
// ---------------------------------------------------------------------------

describe('Pick<T, K>', () => {
  test('Pick<User, name> produces an object with only the named key', () => {
    expectCompiles(dedent(`
      type User = { name: string, age: number }
      x: Pick<User, 'name'> = { name: 'Alice' }
    `));
  });
});

// ---------------------------------------------------------------------------
// Built-in utility types: Omit<T, K>
// ---------------------------------------------------------------------------

describe('Omit<T, K>', () => {
  test('Omit<User, age> produces an object without the omitted key', () => {
    expectCompiles(dedent(`
      type User = { name: string, age: number }
      x: Omit<User, 'age'> = { name: 'Alice' }
    `));
  });
});

// ---------------------------------------------------------------------------
// Inline mapped type syntax
// ---------------------------------------------------------------------------

describe('inline mapped type syntax', () => {
  test('user-defined Partial type alias using mapped type syntax compiles', () => {
    expectCompiles(dedent(`
      type User = { name: string, age: number }
      type MyPartial<T> = { [K in keyof T]?: T[K] }
      x: MyPartial<User> = {}
    `));
  });

  test('user-defined identity mapped type preserves all props', () => {
    expectCompiles(dedent(`
      type Point = { x: number, y: number }
      type Identity<T> = { [K in keyof T]: T[K] }
      p: Identity<Point> = { x: 1, y: 2 }
    `));
  });

  test('mapped type keyword is not emitted in JS output', () => {
    const result = compile(`
      type User = { name: string, age: number }
      type MyPartial<T> = { [K in keyof T]?: T[K] }
      x = 42
    `);
    expect(result.success).toBe(true);
    // mapped type syntax should not appear in output
    expect(result.code).not.toMatch(/\bin\b.*keyof/);
  });
});
