/**
 * Tests for exhaustiveness checking via type narrowing.
 *
 * When a variable is narrowed step-by-step through early-return if-guards,
 * its type reduces to `never` after all union members have been handled.
 * Any subsequent use of that variable is unreachable and flagged as a warning.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ---------------------------------------------------------------------------
// Positive: code where all union paths are handled and no residual use
// ---------------------------------------------------------------------------

describe('exhaustiveness — valid exhaustive handling', () => {
  test('all branches return — no use of narrowed variable after', () => {
    expectCompiles(`
      def describe(x: 'a' | 'b'): string {
        if x == 'a' {
          return 'A'
        }
        if x == 'b' {
          return 'B'
        }
        return 'default'
      }
    `);
  });

  test('non-exhaustive check with fallback return is fine', () => {
    expectCompiles(`
      def label(status: 'ok' | 'error' | 'pending'): string {
        if status == 'ok' {
          return 'OK'
        }
        return 'other'
      }
    `);
  });

  test('three-case union fully covered', () => {
    expectCompiles(`
      def traffic(light: 'red' | 'yellow' | 'green'): string {
        if light == 'red' {
          return 'stop'
        }
        if light == 'yellow' {
          return 'slow'
        }
        if light == 'green' {
          return 'go'
        }
        return 'unknown'
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// Negative: using a `never`-narrowed variable is an error
// ---------------------------------------------------------------------------

describe('exhaustiveness — using a never-narrowed variable', () => {
  test('returning a never-narrowed variable emits a warning', () => {
    expectCompilationError(
      `
        def describe(x: 'a' | 'b'): string {
          if x == 'a' {
            return 'A'
          }
          if x == 'b' {
            return 'B'
          }
          return x
        }
      `,
      "never"
    );
  });

  test('using never-narrowed variable in an expression emits a warning', () => {
    expectCompilationError(
      `
        def process(kind: 'circle' | 'square') {
          if kind == 'circle' {
            return 1
          }
          if kind == 'square' {
            return 2
          }
          result = kind
        }
      `,
      "never"
    );
  });
});
