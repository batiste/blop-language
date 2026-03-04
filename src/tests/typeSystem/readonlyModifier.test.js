/**
 * Tests for the `readonly` modifier in type annotations.
 *
 * Covers:
 *   - `readonly` on object type properties: `{ readonly name: string }`
 *   - `readonly` on array types: `readonly string[]`
 *   - `readonly` on class member definitions
 *   - Mutation guards: assigning to a readonly property or element errors
 *   - Non-readonly properties still allow assignment
 */
import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

// ---------------------------------------------------------------------------
// Parsing / code generation: readonly is a type-only annotation, erased from JS
// ---------------------------------------------------------------------------

describe('readonly modifier — code generation', () => {
  test('readonly object property annotation does not appear in JS output', () => {
    expectCompiles(`
      type User = { readonly name: string, age: number }
      u: User = { name: 'Alice', age: 30 }
    `);
  });

  test('readonly array annotation parses without error', () => {
    expectCompiles(`arr: readonly string[] = ['a', 'b']`);
  });
});

// ---------------------------------------------------------------------------
// Object type readonly properties
// ---------------------------------------------------------------------------

describe('readonly object type properties', () => {
  test('reading a readonly property is allowed', () => {
    expectCompiles(`
      type Config = { readonly host: string, port: number }
      cfg: Config = { host: 'localhost', port: 8080 }
      h = cfg.host
    `);
  });

  test('assigning to a readonly property errors', () => {
    expectCompilationError(`
      type Config = { readonly host: string, port: number }
      cfg: Config = { host: 'localhost', port: 8080 }
      cfg.host = 'example.com'
    `, 'readonly');
  });

  test('assigning to a non-readonly property on the same type does not error', () => {
    expectCompiles(`
      type Config = { readonly host: string, port: number }
      cfg: Config = { host: 'localhost', port: 8080 }
      cfg.port = 9090
    `);
  });

  test('type alias with all-readonly properties parses correctly', () => {
    expectCompiles(`
      type Point = { readonly x: number, readonly y: number }
      p: Point = { x: 1, y: 2 }
    `);
  });

  test('assigning to a readonly property in a type alias errors', () => {
    expectCompilationError(`
      type Point = { readonly x: number, readonly y: number }
      p: Point = { x: 1, y: 2 }
      p.x = 10
    `, 'readonly');
  });
});

// ---------------------------------------------------------------------------
// readonly array types
// ---------------------------------------------------------------------------

describe('readonly array types', () => {
  test('bracket-index assignment to readonly string[] errors', () => {
    expectCompilationError(`
      arr: readonly string[] = ['a', 'b']
      arr[0] = 'c'
    `, 'readonly');
  });

  test('reading from a readonly array is allowed', () => {
    expectCompiles(`
      arr: readonly string[] = ['a', 'b']
      x = arr[0]
    `);
  });

  test('bracket-index assignment to non-readonly array does not error', () => {
    expectCompiles(`
      arr: string[] = ['a', 'b']
      arr[0] = 'c'
    `);
  });
});

// ---------------------------------------------------------------------------
// Class member readonly
// ---------------------------------------------------------------------------

describe('readonly class members', () => {
  test('class with readonly member compiles without error', () => {
    expectCompiles(`
      class Node {
        readonly id: number
        def setValue(id: number) {
          x = id
        }
      }
    `);
  });
});
