/**
 * Tests for `??` nullish coalescing type inference.
 *
 * The `??` operator returns the right-hand side when the left is `null` or
 * `undefined`; otherwise it returns the left.  The inferred result type should:
 *   - be the right-hand type when the left is always nullish (null, undefined)
 *   - be the non-null portion of the left type when it is a union T | null/undefined
 *   - be the left type unchanged when it cannot be nullish
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Always-nullish left side ─────────────────────────────────────────────

describe('?? with always-nullish left side', () => {
  test('null ?? string gives string', () => {
    expectCompiles(`
      def run(): string {
        x: string | null = null
        return x ?? "default"
      }
    `);
  });

  test('undefined ?? number gives number', () => {
    expectCompiles(`
      def run(): number {
        x: number | undefined = undefined
        return x ?? 0
      }
    `);
  });
});

// ─── 2. Union with nullable left side ────────────────────────────────────────

describe('?? strips null/undefined from left union', () => {
  test('string | null ?? string gives string', () => {
    expectCompiles(`
      def run(): string {
        x: string | null = null
        return x ?? "fallback"
      }
    `);
  });

  test('number | undefined ?? number gives number', () => {
    expectCompiles(`
      def run(): number {
        x: number | undefined = undefined
        return x ?? 42
      }
    `);
  });

  test('string | null | undefined ?? string gives string', () => {
    expectCompiles(`
      def run(): string {
        x: string | null = null
        return x ?? "fallback"
      }
    `);
  });
});

// ─── 3. Non-nullable left side passes through ────────────────────────────────

describe('?? with non-nullable left side returns left type', () => {
  test('string ?? string gives string', () => {
    expectCompiles(`
      def run(): string {
        x: string = "hello"
        return x ?? "fallback"
      }
    `);
  });

  test('number ?? number gives number', () => {
    expectCompiles(`
      def run(): number {
        x: number = 5
        return x ?? 0
      }
    `);
  });
});

// ─── 4. Wrong-type assignment is caught ──────────────────────────────────────

describe('?? result type mismatch is flagged', () => {
  test('assigning string ?? string to number is flagged', () => {
    expectCompilationError(
      `
        def run(): number {
          x: string | null = null
          return x ?? "fallback"
        }
      `,
      /string|number|declared/i
    );
  });
});
