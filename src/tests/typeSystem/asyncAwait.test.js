/**
 * Tests for async/await type inference.
 *
 *  Async function
 *    - The external (caller-visible) type is Promise<T> where T is the
 *      declared/inferred body return type.
 *    - The *body* is type-checked against T, not Promise<T>, so returning a
 *      wrong type from an async function is caught normally.
 *    - Both annotation spellings mean the same thing on an async function:
 *      `async def f(): string` and `async def f(): Promise<string>`. The
 *      second is what TypeScript requires, so it must not be penalised.
 *      A *sync* function annotated Promise<T> still has to return an actual
 *      promise — the unwrapping applies to async functions only.
 *
 *  await expression
 *    - `await Promise<T>` resolves to T.
 *    - Awaiting a non-Promise passthrough (opaque) type is a no-op.
 */

import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

// ─── 1. Async function body type-checking ─────────────────────────────────────

describe('async function body type-checking', () => {
  test('correct return type in async body compiles', () => {
    expectCompiles(`
      async def fetchName(): string {
        return 'Alice'
      }
    `);
  });

  test('wrong return type in async body is flagged', () => {
    expectCompilationError(`
      async def fetchCount(): number {
        return 'not a number'
      }
    `, /returns.*but declared/);
  });

  test('async function with no annotation compiles', () => {
    expectCompiles(`
      async def doWork() {
        x = 1
      }
    `);
  });
});

// ─── 1b. Promise<T> annotation spelling ───────────────────────────────────────

describe('async function annotated Promise<T>', () => {
  test('returning T from a Promise<T>-annotated async function compiles', () => {
    expectCompiles(`
      async def fetchName(): Promise<string> {
        return 'Alice'
      }
    `);
  });

  test('returning the wrong type is still flagged', () => {
    expectCompilationError(`
      async def fetchCount(): Promise<number> {
        return 'not a number'
      }
    `, /returns.*but declared/);
  });

  test('the diagnostic names the annotation as written', () => {
    expectCompilationError(`
      async def fetchCount(): Promise<number> {
        return 'not a number'
      }
    `, 'declared as Promise<number>');
  });

  test('Promise<void> with a bare return compiles', () => {
    expectCompiles(`
      async def save(): Promise<void> {
        return
      }
    `);
  });

  test('Promise<void> with no return statement compiles', () => {
    expectCompiles(`
      async def save(): Promise<void> {
        x = 1
      }
    `);
  });

  test('Promise<void> returning a value is flagged', () => {
    expectCompilationError(`
      async def save(): Promise<void> {
        return 42
      }
    `, /returns.*but declared/);
  });

  test('async arrow annotated Promise<T> compiles', () => {
    expectCompiles(`
      handler = async (): Promise<string> => {
        return 'ok'
      }
    `);
  });

  test('async arrow annotated Promise<T> still checks T', () => {
    expectCompilationError(`
      handler = async (): Promise<number> => {
        return 'oops'
      }
    `, /returns.*but declared/);
  });

  test('async class method annotated Promise<T> compiles', () => {
    expectCompiles(`
      class Service {
        async def load(): Promise<string> {
          return 'data'
        }
      }
    `);
  });

  test('async class method annotated Promise<T> still checks T', () => {
    expectCompilationError(`
      class Service {
        async def load(): Promise<number> {
          return 'data'
        }
      }
    `, /returns.*but declared/);
  });

  test('awaiting a Promise<T>-annotated function yields T', () => {
    expectCompiles(`
      async def fetchName(): Promise<string> {
        return 'Alice'
      }
      async def main() {
        name: string = await fetchName()
      }
    `);
  });

  test('awaiting a Promise<T>-annotated function does not yield Promise<T>', () => {
    expectCompilationError(`
      async def fetchName(): Promise<string> {
        return 'Alice'
      }
      async def main() {
        n: number = await fetchName()
      }
    `, /Cannot assign/);
  });

  test('callers still see Promise<T>, not T', () => {
    expectCompilationError(`
      async def fetchName(): Promise<string> {
        return 'Alice'
      }
      s: string = fetchName()
    `, 'Cannot assign Promise<string> to string');
  });

  test('Promise is not double-wrapped for callers', () => {
    expectCompiles(`
      async def fetchName(): Promise<string> {
        return 'Alice'
      }
      p: Promise<string> = fetchName()
    `);
  });

  test('a sync function annotated Promise<T> must still return a promise', () => {
    // The unwrapping is for async functions only
    expectCompilationError(`
      def fetchName(): Promise<string> {
        return 'Alice'
      }
    `, /returns.*but declared/);
  });

  test('a sync function returning a real promise compiles', () => {
    expectCompiles(`
      def fetchName(): Promise<string> {
        return Promise.resolve('Alice')
      }
    `);
  });
});

// ─── 2. await unwraps Promise<T> ──────────────────────────────────────────────

describe('await unwraps Promise<T>', () => {
  test('awaited async string function assignable to string variable', () => {
    expectCompiles(`
      async def fetchName(): string {
        return 'Alice'
      }
      async def main() {
        name: string = await fetchName()
      }
    `);
  });

  test('awaited async number function assignable to number variable', () => {
    expectCompiles(`
      async def getCount(): number {
        return 42
      }
      async def main() {
        n: number = await getCount()
      }
    `);
  });

  test('assigning awaited result to wrong type is flagged', () => {
    expectCompilationError(`
      async def fetchName(): string {
        return 'Alice'
      }
      async def main() {
        n: number = await fetchName()
      }
    `, /Cannot assign|string.*number/);
  });

  test('using await result in arithmetic on string is flagged', () => {
    expectCompilationError(`
      async def fetchName(): string {
        return 'hello'
      }
      async def run() {
        name = await fetchName()
        result = name * 2
      }
    `, /Cannot apply.*[Mm]ath|operator.*string/);
  });
});

// ─── 3. Async anonymous functions ─────────────────────────────────────────────

describe('async anonymous functions', () => {
  test('async arrow-style function with correct return type compiles', () => {
    expectCompiles(`
      handler = async (): string => {
        return 'ok'
      }
    `);
  });

  test('async arrow-style function with wrong return type is flagged', () => {
    expectCompilationError(`
      handler = async (): number => {
        return 'oops'
      }
    `, /returns.*but declared/);
  });
});

// ─── 4. Async class methods ───────────────────────────────────────────────────

describe('async class methods', () => {
  test('async class method with correct return type compiles', () => {
    expectCompiles(`
      class Service {
        async def load(): string {
          return 'data'
        }
      }
    `);
  });

  test('async class method with wrong return type is flagged', () => {
    expectCompilationError(`
      class Service {
        async def getCount(): number {
          return 'not a number'
        }
      }
    `, /returns.*but declared/);
  });
});
