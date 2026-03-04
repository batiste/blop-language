/**
 * Tests for `as const` const assertion.
 *
 * Semantics:
 *   - `expr as const` freezes the inferred type to its literal equivalent.
 *   - Number literals: `42 as const` → type `42` (LiteralType), not `number`.
 *   - String literals: `"hi" as const` → type `"hi"` (LiteralType), not `string`.
 *   - Boolean literals: `true as const` → type `true`, not `boolean`.
 *   - Object literals: `{ x: 1 } as const` → `{ x: 1 }` (literal property types).
 *   - Array literals: `[1, 2] as const` → `[1, 2]` (TupleType of literals).
 *   - Non-literal expressions: falls back to the already-inferred type.
 *   - `as const` is fully erased from the JS output (no runtime cost).
 */

import { describe, test, expect } from 'vitest';
import { compileSource } from '../../compile.js';
import { expectCompilationError, dedent } from '../testHelpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(src) {
  const result = compileSource(dedent(src), 'test.blop', true);
  return result;
}

function expectNoErrors(src) {
  const result = compile(src);
  if (!result.success) {
    throw new Error(`Expected no errors but got: ${JSON.stringify(result.errors)}`);
  }
}

// ---------------------------------------------------------------------------
// Code generation: `as const` is fully erased
// ---------------------------------------------------------------------------

describe('as const — code generation', () => {
  test('as const on a number literal does not appear in JS output', () => {
    const result = compile(`x = 42 as const`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bconst\b/);
    expect(result.code).toMatch(/42/);
  });

  test('as const on a string literal does not appear in JS output', () => {
    const result = compile(`x = 'hello' as const`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bas\b/);
    expect(result.code).toMatch(/hello/);
  });

  test('as const on an object literal does not appear in JS output', () => {
    const result = compile(`x = { a: 1 } as const`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bas\b/);
    expect(result.code).toMatch(/a/);
  });

  test('as const on an array literal does not appear in JS output', () => {
    const result = compile(`x = [1, 2] as const`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bas\b/);
    expect(result.code).toMatch(/1/);
  });
});

// ---------------------------------------------------------------------------
// Primitive literals: type is frozen to the literal value
// ---------------------------------------------------------------------------

describe('as const — primitive literals', () => {
  test('number as const satisfies a literal-typed parameter', () => {
    expectNoErrors(`
      def f(n: 42) {}
      x = 42 as const
      f(x)
    `);
  });

  test('string as const satisfies a literal-typed parameter', () => {
    expectNoErrors(`
      def f(s: 'hello') {}
      x = 'hello' as const
      f(x)
    `);
  });

  test('boolean as const produces literal type, assignable to boolean', () => {
    expectNoErrors(`
      x: boolean = true as const
    `);
  });

  test('as const on a literal is still assignable to base type', () => {
    expectNoErrors(`
      x: number = 42 as const
    `);
  });
});

// ---------------------------------------------------------------------------
// Object literals: property types frozen to literals
// ---------------------------------------------------------------------------

describe('as const — object literals', () => {
  test('object as const satisfies a type with literal property', () => {
    expectNoErrors(`
      type Config = { mode: 'production' }
      def apply(c: Config) {}
      apply({ mode: 'production' } as const)
    `);
  });

  test('object without as const does NOT satisfy a type with literal number property', () => {
    expectCompilationError(`
      type Config = { code: 42 }
      def apply(c: Config) {}
      apply({ code: 42 })
    `, '');
  });

  test('object as const satisfies a type with literal number property', () => {
    expectNoErrors(`
      type Config = { code: 42 }
      def apply(c: Config) {}
      apply({ code: 42 } as const)
    `);
  });

  test('nested object as const freezes inner properties', () => {
    expectNoErrors(`
      type Inner = { y: 1 }
      type Outer = { x: Inner }
      def f(o: Outer) {}
      f({ x: { y: 1 } } as const)
    `);
  });

  test('multi-property object as const', () => {
    expectNoErrors(`
      type Point = { x: 0, y: 0 }
      def origin(p: Point) {}
      origin({ x: 0, y: 0 } as const)
    `);
  });
});

// ---------------------------------------------------------------------------
// Array literals: converted to tuple types
// ---------------------------------------------------------------------------

describe('as const — array literals', () => {
  test('array as const satisfies a tuple type', () => {
    expectNoErrors(`
      type Pair = [1, 2]
      def f(p: Pair) {}
      f([1, 2] as const)
    `);
  });

  test('array without as const does NOT satisfy a tuple type', () => {
    expectCompilationError(`
      type Pair = [1, 2]
      def f(p: Pair) {}
      f([1, 2])
    `, '');
  });
});

// ---------------------------------------------------------------------------
// Readonly: mutation of as const values is a type error
// ---------------------------------------------------------------------------

describe('as const — readonly mutation guards', () => {
  test('bracket-index assignment to as const array errors', () => {
    expectCompilationError(`
      tasdf = [1, 2] as const
      tasdf[0] = 3
    `, 'readonly');
  });

  test('dot-property assignment to as const object errors', () => {
    expectCompilationError(`
      obj = { x: 1 } as const
      obj.x = 2
    `, 'readonly');
  });

  test('bracket-index assignment to non-const array does not error', () => {
    expectNoErrors(`
      arr = [1, 2]
      arr[0] = 3
    `);
  });

  test('dot-property assignment to non-const object does not error', () => {
    expectNoErrors(`
      obj = { x: 1 }
      obj.x = 2
    `);
  });
});

// ---------------------------------------------------------------------------
// Non-literal expressions: fall back to inferred type
// ---------------------------------------------------------------------------

describe('as const — non-literal expressions', () => {
  test('as const on a variable compiles without error', () => {
    expectNoErrors(`
      x = 42
      y = x as const
    `);
  });

  test('as const on any compiles without error', () => {
    expectNoErrors(`
      x: any = 42
      y = x as const
    `);
  });
});
