/**
 * Tests for `as` type assertion.
 *
 * Semantics (identical to TypeScript):
 *   - `expr as T` is a compile-time-only operation: the expression keeps its
 *     runtime value, but downstream type inference treats it as type T.
 *   - No warning is emitted for the assertion itself (it's an escape hatch).
 *   - The inferred type at the assertion site becomes T, so callers/assignments
 *     that consume T no longer warn.
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
// Code-generation: `as` is erased at runtime
// ---------------------------------------------------------------------------

describe('as — code generation', () => {
  test('as on a number literal does not appear in JS output', () => {
    const result = compile(`x = 42 as number`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bas\b/);
    expect(result.code).toMatch(/42/);
  });

  test('as on a string literal does not appear in JS output', () => {
    const result = compile(`x = "hello" as string`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bas\b/);
    expect(result.code).toMatch(/hello/); // value present (Blop uses single quotes)
  });

  test('as on an arithmetic expression emits only the expression', () => {
    const result = compile(`x = (1 + 2) as number`);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bas\b/);
    expect(result.code).toMatch(/1 \+ 2|1\+2/);
  });
});

// ---------------------------------------------------------------------------
// Type inference: downstream sees the asserted type
// ---------------------------------------------------------------------------

describe('as — type narrowing', () => {
  test('number asserted as string satisfies a string parameter', () => {
    expectNoErrors(`
      def greet(name: string) {
        return name
      }
      n = 42
      greet(n as string)
    `);
  });

  test('number asserted as string can be assigned to a string variable', () => {
    expectNoErrors(`
      n = 42
      s: string = n as string
    `);
  });

  test('object literal asserted via type alias satisfies typed parameter', () => {
    expectNoErrors(`
      type Point = { x: number, y: number }
      def takePoint(p: Point) {
        return p
      }
      takePoint({ x: 1, y: 2 } as Point)
    `);
  });

  test('number asserted as any — no errors downstream', () => {
    expectNoErrors(`
      n = 42
      val: any = n as any
    `);
  });
});

// ---------------------------------------------------------------------------
// Composability: as inside larger expressions
// ---------------------------------------------------------------------------

describe('as — composability', () => {
  test('as inside a function argument', () => {
    expectNoErrors(`
      def double(n: number): number {
        return n * 2
      }
      s = "3"
      result = double(s as number)
    `);
  });

  test('as chained with another as', () => {
    expectNoErrors(`
      n = 42
      x = n as any as string
    `);
  });

  test('as inside parentheses followed by arithmetic', () => {
    expectNoErrors(`
      s = "3"
      result = (s as number) * 2
    `);
  });
});
