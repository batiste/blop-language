/**
 * Tests for `typeof x` used as a value expression.
 *
 * The runtime always returns a string tag ('number', 'string', 'boolean',
 * 'object', 'undefined', 'function', 'symbol', 'bigint').  The inference
 * engine must therefore type `typeof expr` as `string`, regardless of the
 * static type of `expr`.
 *
 * Separate from the type-guard use of typeof (e.g. `if typeof x == 'number'`)
 * which is handled by detectTypeofCheck in typeGuards.js and is not a
 * value-expression use.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Result is string ──────────────────────────────────────────────────────

describe('typeof value expression produces string', () => {
  test('typeof number variable assignable to string', () => {
    expectCompiles(`
      def getTag(n: number): string {
        return typeof n
      }
    `);
  });

  test('typeof string variable assignable to string', () => {
    expectCompiles(`
      def getTag(s: string): string {
        return typeof s
      }
    `);
  });

  test('typeof boolean variable assignable to string', () => {
    expectCompiles(`
      def getTag(b: boolean): string {
        return typeof b
      }
    `);
  });

  test('typeof union variable assignable to string', () => {
    expectCompiles(`
      def getTag(val: string | number): string {
        return typeof val
      }
    `);
  });

  test('typeof result can be concatenated with a string literal', () => {
    expectCompiles(`
      def describe(x: number): string {
        return 'type is: ' + typeof x
      }
    `);
  });

  test('typeof result stored in a string variable', () => {
    expectCompiles(`
      def run() {
        n = 42
        tag: string = typeof n
      }
    `);
  });
});

// ─── 2. Wrong-type assignment is caught ───────────────────────────────────────

describe('typeof value expression wrong-type assignment is flagged', () => {
  test('assigning typeof result to number is flagged', () => {
    expectCompilationError(`
      def run() {
        n = 42
        tag: number = typeof n
      }
    `, /Cannot assign|string.*number/);
  });
});

// ─── 3. typeof does not suppress inner type-checking ─────────────────────────
// The operand is still visited, so errors inside the sub-expression still fire.

describe('typeof still type-checks its operand', () => {
  test('math on string inside typeof operand is still flagged', () => {
    expectCompilationError(`
      def run() {
        s: string = 'hello'
        tag = typeof s * 2
      }
    `, /Cannot apply.*[Mm]ath|operator.*string/);
  });
});
