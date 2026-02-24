/**
 * Tests for `!x` logical negation as a value expression.
 *
 * The unary `!` operator always produces a boolean at runtime, regardless of
 * the static type of the operand.  The inference engine must therefore type
 * `!expr` as `boolean` and still visit the operand for inner type errors.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Result is boolean ─────────────────────────────────────────────────────

describe('unary ! produces boolean', () => {
  test('!boolean assignable to boolean', () => {
    expectCompiles(`
      def negate(b: boolean): boolean {
        return !b
      }
    `);
  });

  test('!number assignable to boolean', () => {
    expectCompiles(`
      def run(n: number): boolean {
        return !n
      }
    `);
  });

  test('!string assignable to boolean', () => {
    expectCompiles(`
      def run(s: string): boolean {
        return !s
      }
    `);
  });

  test('! result stored in boolean variable', () => {
    expectCompiles(`
      def run() {
        flag = true
        inv: boolean = !flag
      }
    `);
  });

  test('double negation !! assignable to boolean', () => {
    expectCompiles(`
      def toBool(n: number): boolean {
        return !!n
      }
    `);
  });
});

// ─── 2. Wrong-type assignment is caught ───────────────────────────────────────

describe('unary ! wrong-type assignment is flagged', () => {
  test('assigning !x to string is flagged', () => {
    expectCompilationError(`
      def run() {
        flag = true
        s: string = !flag
      }
    `, /Cannot assign|boolean.*string/);
  });

  test('assigning !x to number is flagged', () => {
    expectCompilationError(`
      def run() {
        flag = true
        n: number = !flag
      }
    `, /Cannot assign|boolean.*number/);
  });
});
