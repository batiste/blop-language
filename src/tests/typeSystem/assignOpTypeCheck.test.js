/**
 * Regression tests for assign_op (+=, -=, *=, /=) type checking.
 *
 * Bug: The inference engine had no handler for `assign_op` nodes, so compound
 * assignment operators were never type-checked. Writing `x: number += "hello"`
 * silently compiled without any warning.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('assign_op type checking', () => {
  // ─── += ──────────────────────────────────────────────────────────────────

  test('warns when += assigns a string to a number variable', () => {
    const code = `
      x: number = 5
      x += "hello"
    `;
    expectCompilationError(code, /\+|assign|string.*number|number.*string/i);
  });

  test('warns when += assigns a number to a string variable', () => {
    const code = `
      s: string = "hello"
      s += 42
    `;
    expectCompilationError(code, /\+|assign|string.*number|number.*string/i);
  });

  test('accepts += between two numbers', () => {
    const code = `
      x: number = 5
      x += 3
    `;
    expectCompiles(code);
  });

  test('accepts += between two strings', () => {
    const code = `
      s: string = "hello"
      s += " world"
    `;
    expectCompiles(code);
  });

  // ─── -= ──────────────────────────────────────────────────────────────────

  test('warns when -= assigns a string rhs to a number variable', () => {
    const code = `
      x: number = 10
      x -= "3"
    `;
    expectCompilationError(code, /-|assign|string|number/i);
  });

  test('accepts -= between two numbers', () => {
    const code = `
      x: number = 10
      x -= 3
    `;
    expectCompiles(code);
  });

  // ─── *= ──────────────────────────────────────────────────────────────────

  test('warns when *= uses a string rhs on a number variable', () => {
    const code = `
      x: number = 2
      x *= "3"
    `;
    expectCompilationError(code, /\*|assign|string|number/i);
  });

  test('accepts *= between two numbers', () => {
    const code = `
      x: number = 2
      x *= 3
    `;
    expectCompiles(code);
  });

  // ─── /= ──────────────────────────────────────────────────────────────────

  test('warns when /= uses a string rhs on a number variable', () => {
    const code = `
      x: number = 10
      x /= "2"
    `;
    expectCompilationError(code, /\/|assign|string|number/i);
  });

  test('accepts /= between two numbers', () => {
    const code = `
      x: number = 10
      x /= 2
    `;
    expectCompiles(code);
  });
});
