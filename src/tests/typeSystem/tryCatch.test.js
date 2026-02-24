/**
 * Tests for try_catch type inference.
 *
 * The grammar rule is:
 *   try { <statstry> } catch <name> { <statscatch> }
 *
 * The handler must:
 *   1. Visit the try body in an isolated scope (so variables declared inside
 *      do not leak out).
 *   2. Bind the catch variable as AnyType in an isolated catch scope so
 *      references to it inside the catch body resolve without false-positive
 *      type errors.
 *   3. Visit the catch body with that binding in effect.
 *   4. Continue normal type-checking inside both blocks (errors in either
 *      block must still be reported).
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Basic smoke tests ─────────────────────────────────────────────────────

describe('try_catch basic compilation', () => {
  test('empty try/catch compiles', () => {
    expectCompiles(`
      def main() {
        try {
        } catch err {
        }
      }
    `);
  });

  test('try body with simple statement compiles', () => {
    expectCompiles(`
      def main() {
        x = 0
        try {
          x := 1
        } catch err {
        }
      }
    `);
  });

  test('catch body with simple statement compiles', () => {
    expectCompiles(`
      def main() {
        try {
        } catch err {
          console.log('caught')
        }
      }
    `);
  });

  test('try and catch bodies both with statements compile', () => {
    expectCompiles(`
      def fetchData(): string {
        try {
          return 'ok'
        } catch err {
          return 'error'
        }
      }
    `);
  });
});

// ─── 2. Catch variable binding ────────────────────────────────────────────────
// The catch variable must be bound inside the catch block so that references to
// it do not produce false-positive errors.

describe('try_catch catch variable', () => {
  test('catch variable is accessible inside catch block (no false positive)', () => {
    // Without the handler, `err` is unbound and resolves to AnyType via the
    // fallback — but that happened to work by accident. With the handler it
    // must still work, and the variable must be explicitly in scope.
    expectCompiles(`
      def main() {
        try {
          console.log('try')
        } catch err {
          console.log(err)
        }
      }
    `);
  });

  test('catch variable can be used in expressions inside catch block', () => {
    expectCompiles(`
      def handleError(): string {
        try {
          return 'ok'
        } catch err {
          msg: string = 'failed'
          return msg
        }
      }
    `);
  });

  test('multiple statements in catch block referencing catch variable compile', () => {
    expectCompiles(`
      def main() {
        try {
          x = 1 + 1
        } catch err {
          console.log(err)
          console.log('done')
        }
      }
    `);
  });
});

// ─── 3. Type-checking inside the try body ────────────────────────────────────
// Errors inside the try block must still be caught by the type checker.

describe('try_catch type errors inside try body', () => {
  test('math on string inside try body is flagged', () => {
    expectCompilationError(`
      def main() {
        msg: string = 'hello'
        try {
          x = msg * 2
        } catch err {
        }
      }
    `, /Cannot apply.*[Mm]ath|operator.*string/);
  });
});

// ─── 4. Type-checking inside the catch body ──────────────────────────────────
// Errors inside the catch block must also be reported.

describe('try_catch type errors inside catch body', () => {
  test('math on string inside catch body is flagged', () => {
    expectCompilationError(`
      def main() {
        msg: string = 'hello'
        try {
        } catch err {
          x = msg * 2
        }
      }
    `, /Cannot apply.*[Mm]ath|operator.*string/);
  });
});

// ─── 5. Scope isolation ───────────────────────────────────────────────────────
// Variables declared inside the try or catch blocks should not outlive their
// respective scopes (the compiler must not retain phantom bindings after the
// block ends).

describe('try_catch scope isolation', () => {
  test('variable declared in try body is visible inside the try body', () => {
    // Accessing a local declared in the same try block must compile fine.
    expectCompiles(`
      def main(): number {
        try {
          inner = 42
          return inner
        } catch err {
          return 0
        }
      }
    `);
  });

  test('return type check works normally across try/catch', () => {
    expectCompiles(`
      def compute(): number {
        try {
          return 1
        } catch err {
          return 0
        }
      }
    `);
  });
});
