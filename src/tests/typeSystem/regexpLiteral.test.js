/**
 * Tests for regexp literal type inference.
 *
 * A regexp literal `/pattern/flags` should be inferred as the builtin `RegExp`
 * type, not `any`.  This lets annotated variables and return types that expect
 * `RegExp` accept literals without errors.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Regexp literal is typed as RegExp ────────────────────────────────────

describe('regexp literal typed as RegExp', () => {
  test('regexp literal assignable to RegExp annotation', () => {
    expectCompiles(`
      type R = { val: RegExp }
      obj: R = { val: /hello/ }
    `);
  });

  test('regexp literal with flags assignable to RegExp', () => {
    expectCompiles(`
      type R = { val: RegExp }
      obj: R = { val: /hello/gi }
    `);
  });

  test('regexp returned from function typed as RegExp', () => {
    expectCompiles(`
      def getPattern(): RegExp {
        return /[0-9]+/
      }
    `);
  });

  test('regexp stored in variable and property accessed', () => {
    expectCompiles(`
      def run() {
        pattern = /\\w+/
        result = pattern.test("hello")
      }
    `);
  });
});

// ─── 2. Wrong-type assignment is flagged ─────────────────────────────────────

describe('regexp literal wrong-type assignment is flagged', () => {
  test('assigning regexp literal to string is flagged', () => {
    expectCompilationError(
      `
        type Config = { r: string }
        config: Config = { r: /hello/ }
      `,
      /Cannot assign|type/i
    );
  });

  test('assigning regexp literal to number is flagged', () => {
    expectCompilationError(
      `
        type Config = { r: number }
        config: Config = { r: /hello/ }
      `,
      /Cannot assign|type/i
    );
  });
});
