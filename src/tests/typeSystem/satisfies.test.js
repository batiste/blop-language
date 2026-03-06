/**
 * Tests for the `satisfies` operator.
 *
 * Semantics:
 *   - `expr satisfies T` is a compile-time-only check: it verifies that the
 *     expression's type is assignable to T, then keeps the original inferred
 *     type for downstream inference (unlike `as`, which replaces the type).
 *   - A warning is emitted when the types are incompatible.
 *   - The `satisfies` keyword is erased in JS output.
 */

import { describe, test, expect } from 'vitest';
import { compileSource } from '../../compile.js';
import { expectCompilationError, expectCompiles, dedent } from '../testHelpers.js';

function compile(src) {
  return compileSource(dedent(src), 'test.blop', true);
}

function expectNoErrors(src) {
  const result = compile(src);
  if (!result.success) {
    throw new Error(`Expected no errors but got: ${JSON.stringify(result.errors)}`);
  }
}

// ---------------------------------------------------------------------------
// Code generation: `satisfies` is erased at runtime
// ---------------------------------------------------------------------------

describe('satisfies — code generation', () => {
  test('satisfies keyword does not appear in JS output', () => {
    const result = compile(`x = 42 satisfies number`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bsatisfies\b/);
    expect(result.code).toMatch(/42/);
  });

  test('satisfies on a string literal emits only the string', () => {
    const result = compile(`x = 'hello' satisfies string`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bsatisfies\b/);
    expect(result.code).toMatch(/hello/);
  });
});

// ---------------------------------------------------------------------------
// Type checking: compatibility is verified
// ---------------------------------------------------------------------------

describe('satisfies — compatibility check', () => {
  test('compatible types produce no error', () => {
    expectNoErrors(`
      type Point = { x: number, y: number }
      p = { x: 1, y: 2 } satisfies Point
    `);
  });

  test('number satisfies number — no error', () => {
    expectNoErrors(`n = 42 satisfies number`);
  });

  test('string satisfies string — no error', () => {
    expectNoErrors(`s = 'hi' satisfies string`);
  });

  test('incompatible type emits a warning', () => {
    expectCompilationError(
      `n = 42 satisfies string`,
      'does not satisfy'
    );
  });

  test('object missing a required property fails satisfies', () => {
    expectCompilationError(
      `
        type Point = { x: number, y: number }
        p = { x: 1 } satisfies Point
      `,
      'does not satisfy'
    );
  });

  test('satisfies on a literal union member — no error', () => {
    expectNoErrors(`
      type Status = 'ok' | 'error'
      s: Status = 'ok' satisfies Status
    `);
  });
});

// ---------------------------------------------------------------------------
// `satisfies` keeps the original (non-asserted) type downstream
// ---------------------------------------------------------------------------

describe('satisfies — original type preserved downstream', () => {
  test('object literal retains its precise shape after satisfies', () => {
    // The narrower inferred type (with literal 'circle') should flow through,
    // not widen to just the `Shape` type.
    expectNoErrors(`
      type Shape = { kind: string }
      s = { kind: 'circle', radius: 5 } satisfies Shape
      r = s.radius
    `);
  });

  test('satisfies does not widen a literal type', () => {
    // `42 satisfies number` keeps the LiteralType(42) downstream rather than
    // replacing it with the plain number type.
    const result = compile(`
      x = 42 satisfies number
      y: 42 = x
    `);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Composability
// ---------------------------------------------------------------------------

describe('satisfies — composability', () => {
  test('satisfies inside a function call argument', () => {
    expectNoErrors(`
      def greet(name: string) {
        return name
      }
      greet('Alice' satisfies string)
    `);
  });

  test('satisfies inside an assignment with annotation', () => {
    expectNoErrors(`
      type Config = { debug: boolean }
      cfg: Config = { debug: true } satisfies Config
    `);
  });
});
