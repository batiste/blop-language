/**
 * Tests for the `void` return type.
 *
 * A function annotated `: void` returns nothing useful. A body that falls
 * through, or returns with no expression, yields `undefined` — which is
 * assignable to `void`, as in TypeScript. Returning an actual value is not.
 *
 * Unlike TypeScript, `void` and `undefined` are interchangeable in both
 * directions here; see the note in PrimitiveType.isCompatibleWith.
 */

import { describe, test, expect } from 'vitest';
import { UndefinedType, VoidType, NullType, StringType, NeverType, AnyType, TypeAliasMap } from '../../inference/Type.js';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

const NO_ALIASES = new TypeAliasMap();

describe('void compatibility', () => {
  test('undefined is assignable to void', () => {
    expect(UndefinedType.isCompatibleWith(VoidType, NO_ALIASES)).toBe(true);
  });

  test('void is assignable to void', () => {
    expect(VoidType.isCompatibleWith(VoidType, NO_ALIASES)).toBe(true);
  });

  test('void is assignable to undefined', () => {
    expect(VoidType.isCompatibleWith(UndefinedType, NO_ALIASES)).toBe(true);
  });

  test('never is assignable to void', () => {
    expect(NeverType.isCompatibleWith(VoidType, NO_ALIASES)).toBe(true);
  });

  test('void is assignable to any', () => {
    expect(VoidType.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('null is NOT assignable to void', () => {
    expect(NullType.isCompatibleWith(VoidType, NO_ALIASES)).toBe(false);
  });

  test('string is NOT assignable to void', () => {
    expect(StringType.isCompatibleWith(VoidType, NO_ALIASES)).toBe(false);
  });

  test('void is NOT assignable to string', () => {
    expect(VoidType.isCompatibleWith(StringType, NO_ALIASES)).toBe(false);
  });
});

describe('void-annotated functions', () => {
  test('a bare return compiles', () => {
    expectCompiles(`
      def log(): void {
        return
      }
    `);
  });

  test('a body with no return statement compiles', () => {
    expectCompiles(`
      def log(): void {
        x = 1
      }
    `);
  });

  test('an early bare return compiles', () => {
    expectCompiles(`
      def log(flag: boolean): void {
        if flag {
          return
        }
        y = 2
      }
    `);
  });

  test('returning a value is flagged', () => {
    expectCompilationError(`
      def log(): void {
        return 42
      }
    `, /returns.*but declared/);
  });

  test('a void arrow function compiles', () => {
    expectCompiles(`
      log = (): void => {
        x = 1
      }
    `);
  });

  test('a void class method compiles', () => {
    expectCompiles(`
      class Service {
        def reset(): void {
          return
        }
      }
    `);
  });

  test('async void compiles', () => {
    expectCompiles(`
      async def save(): void {
        return
      }
    `);
  });
});
