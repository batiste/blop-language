/**
 * Regression tests for short_if_expression (ternary without else) type inference.
 *
 * Bug: When a `short_if_expression` had no `else` branch, the inferred result
 * type was T (the true-branch type) instead of T | undefined.  This caused the
 * type system to silently accept code that could produce runtime `undefined`
 * values where a concrete T was expected.
 *
 * Example:
 *   def f(): number {
 *     return if x > 0 => 42   // could return undefined; should warn
 *   }
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('short_if_expression without else - type inference', () => {
  // ─── Return type checking ────────────────────────────────────────────────

  test('warns when function declared :number returns ternary with no else', () => {
    // Without a fix the return type is `number`, which satisfies `: number`.
    // After the fix the return type is `number | undefined`, which does NOT.
    const code = `
      def getNumber(): number {
        return if true => 42
      }
    `;
    expectCompilationError(code, /undefined|number \| undefined/i);
  });

  test('warns when function declared :string returns ternary with no else', () => {
    const code = `
      def getWord(): string {
        return if true => "hello"
      }
    `;
    expectCompilationError(code, /undefined|string \| undefined/i);
  });

  // ─── With else: no warning expected ─────────────────────────────────────

  test('accepts a ternary WITH else when return type matches the true branch', () => {
    const code = `
      def getNumber(): number {
        return if true => 42 else 0
      }
    `;
    expectCompiles(code);
  });

  // ─── Variable usage after no-else ternary ────────────────────────────────

  test('warns when result of no-else ternary is passed to a :number param', () => {
    // `result` should be inferred as `number | undefined`.
    // Passing it to a function expecting `number` must produce a type error.
    const code = `
      def expectNumber(n: number) {
        n + 1
      }
      count: number = 0
      result = if count > 0 => 42
      expectNumber(result)
    `;
    expectCompilationError(code, /undefined|number \| undefined|expected number/i);
  });

  test('does not warn when result of ternary-with-else is passed to a :number param', () => {
    // With an else branch the result is always a number — no warning expected.
    const code = `
      def expectNumber(n: number) {
        n + 1
      }
      count: number = 0
      result: number = if count > 0 => 42 else 0
      expectNumber(result)
    `;
    expectCompiles(code);
  });
});
