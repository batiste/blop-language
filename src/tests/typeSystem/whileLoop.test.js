/**
 * Tests that document known gaps in while_loop inference support.
 *
 * The grammar has a `while_loop` rule but no dedicated handler exists in the
 * inference engine. The fallback (visitChildren + pushToParent) keeps basic
 * type-checking alive inside the body, but three behaviours that every other
 * control-flow construct provides are missing:
 *
 *   1. Type narrowing from the condition into the body
 *   2. Dead-code detection after a while loop that always terminates
 *   3. Scope isolation (the loop variable should not outlive the block)
 *
 * Every test below is expected to FAIL until the while_loop handler is added.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Type narrowing ────────────────────────────────────────────────────────
// The `condition` handler narrows types inside `if` bodies.  The same narrowing
// should apply to `while` bodies — e.g. inside `while typeof val == 'number'`
// the compiler knows `val` is `number`, not `string | number`.

describe('while_loop type narrowing', () => {
  test('typeof narrowing: number math inside while body should compile', () => {
    // Without narrowing, `val` remains `string | number` inside the body and
    // `val * 2` triggers a "Cannot apply Math operator" error.
    expectCompiles(`
      def process(val: string | number): number {
        while typeof val == 'number' {
          return val * 2
        }
        return 0
      }
    `);
  });

  test('typeof narrowing: string concat inside while body should compile', () => {
    // Without narrowing, `val` is still `string | number` inside the body.
    // Concatenating `string | number` with a string literal fails with
    // "Cannot apply '+' operator to string | number and string".
    // Once narrowing is in place, `val` is `string` and the concat is valid.
    expectCompiles(`
      def shout(val: string | number): string {
        result = ''
        while typeof val == 'string' {
          result := result + val
          break
        }
        return result
      }
    `);
  });

  test('equality narrowing: null-guarded access inside while body should compile', () => {
    // `while val != null` should narrow `val` to `string` inside the body.
    expectCompiles(`
      def drain(val: string | null): string {
        result = ''
        while val != null {
          result := result + val.toUpperCase()
          val := null
        }
        return result
      }
    `);
  });
});

// ─── 2. Dead-code detection ───────────────────────────────────────────────────
// `findDeadCodeStart` checks whether a statement always terminates (return,
// throw, condition-always-returns, …).  `while_loop` is not in that list, so
// code placed after a `while true { return … }` is never flagged as unreachable.

describe('while_loop dead-code detection', () => {
  test('statement after while true { return } is unreachable', () => {
    expectCompilationError(`
      def f(x: number): number {
        while true {
          return x * 2
        }
        return 0
      }
    `, 'unreachable');
  });

  test('statement after while true { throw } is unreachable', () => {
    expectCompilationError(`
      def f(x: number): number {
        while true {
          throw 'always'
        }
        return x
      }
    `, 'unreachable');
  });
});

// ─── 3. Narrowed type must not leak past the loop ────────────────────────────
// The while body runs in a fresh scope so that type narrowing applied inside
// (e.g. `typeof val == 'number'` narrows val to `number`) is discarded once
// the body exits.  Without a dedicated handler the fallback does NOT push a
// scope, so the narrowed type is stamped directly onto the enclosing scope and
// the variable remains `number` outside the loop — masking real type errors.

describe('while_loop type narrowing does not persist after the loop', () => {
  test('narrowed-to-number type is not used for string operations after the loop', () => {
    // After `while typeof val == 'number' { }`, val is still `string | number`
    // in the outer scope — NOT just `number`.  If narrowing leaked, the
    // subsequent `val.toUpperCase()` call would pass (number has no such method
    // but the leak makes the checker see number-only and skip string checks).
    // The correct behaviour is that both branches of the union are still
    // available outside the loop, so returning `val.toUpperCase()` should
    // compile fine (string method on a string | number union is valid because
    // string is in the union).
    expectCompiles(`
      def f(val: string | number): string {
        while typeof val == 'number' {
          val := val.toString()
          break
        }
        return val.toString()
      }
    `);
  });

  test('val is still string | number after a narrowing while loop, math still requires narrowing', () => {
    // `val` should remain `string | number` after the loop — doing math on it
    // without re-narrowing must still be rejected.
    expectCompilationError(`
      def f(val: string | number): number {
        while typeof val == 'number' {
          break
        }
        return val * 2
      }
    `, 'Math operator');
  });
});
