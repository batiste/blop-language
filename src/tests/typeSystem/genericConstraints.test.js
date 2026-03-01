import { describe, test } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Generic Constraints (T extends X)', () => {
  // ── Positive cases ─────────────────────────────────────────────────────────

  test('parses constraint syntax without error', () => {
    expectCompiles(`
      def first<T extends string>(x: T): T {
        return x
      }
      r = first('hello')
    `);
  });

  test('constraint with object type bound', () => {
    expectCompiles(`
      def getVal<T extends { value: string }>(x: T): string {
        return x.value
      }
      r = getVal({ value: 'hello' })
    `);
  });

  test('type alias with constrained generic param parses correctly', () => {
    expectCompiles(`
      type Wrapped<T extends string> = { value: T }
      w: Wrapped<string> = { value: 'ok' }
    `);
  });

  test('multiple constrained params', () => {
    expectCompiles(`
      def merge<T extends string, U extends number>(a: T, b: U): T {
        return a
      }
      r = merge('hello', 42)
    `);
  });

  test('mix of constrained and unconstrained params', () => {
    expectCompiles(`
      def wrap<T extends string, U>(key: T, value: U): object {
        return { key, value }
      }
      r = wrap('myKey', 123)
    `);
  });

  // ── Negative cases ─────────────────────────────────────────────────────────

  test('inferred type arg violates constraint — warns', () => {
    expectCompilationError(`
      def first<T extends string>(x: T): T {
        return x
      }
      r = first(42)
    `, 'does not satisfy constraint');
  });

  test('inferred type arg violates number constraint — warns', () => {
    expectCompilationError(`
      def wrap<T extends number>(x: T): T {
        return x
      }
      r = wrap('notANumber')
    `, 'does not satisfy constraint');
  });

  test('explicit type arg violates constraint — warns', () => {
    expectCompilationError(`
      def first<T extends string>(x: T): T {
        return x
      }
      r = first<number>(42)
    `, 'does not satisfy constraint');
  });

  test('constraint violation names the type parameter', () => {
    expectCompilationError(`
      def fn<T extends string>(x: T): T {
        return x
      }
      fn(100)
    `, 'T');
  });

  test('constraint violation names the constraint type', () => {
    expectCompilationError(`
      def fn<T extends string>(x: T): T {
        return x
      }
      fn(100)
    `, 'string');
  });
});
