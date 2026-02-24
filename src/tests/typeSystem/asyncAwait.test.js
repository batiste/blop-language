/**
 * Tests for async/await type inference.
 *
 *  Async function
 *    - The external (caller-visible) type is Promise<T> where T is the
 *      declared/inferred body return type.
 *    - The *body* is still type-checked against T, not Promise<T>, so
 *      returning a wrong type from an async function is caught normally.
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
