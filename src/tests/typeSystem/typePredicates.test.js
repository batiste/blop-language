/**
 * Tests for user-defined type predicates: `x is T` in function return annotations.
 *
 * Semantics (identical to TypeScript):
 *   - A function returning `x is T` is called a "type predicate" (or "type guard function").
 *   - The function body must return boolean.
 *   - At call sites used as an `if` condition, the compiler narrows the predicate
 *     argument to T in the true branch and excludes T in the false branch.
 *   - The `x is T` annotation is fully erased at runtime — the function is an
 *     ordinary boolean function.
 */

import { describe, test, expect } from 'vitest';
import {
  PredicateType, FunctionType,
  StringType, NumberType, BooleanType, AnyType,
  Types,
} from '../../inference/Type.js';
import { expectCompilationError, expectCompiles, dedent } from '../testHelpers.js';
import { compileSource } from '../../compile.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(src) {
  return compileSource(dedent(src), 'test.blop', true);
}

function expectNoErrors(src) {
  const result = compile(src);
  if (!result.success) {
    throw new Error(`Expected no errors but got: ${JSON.stringify(result.errors)}`);
  }
}

// ---------------------------------------------------------------------------
// PredicateType class: construction, display, equality, compatibility
// ---------------------------------------------------------------------------

describe('PredicateType construction', () => {
  test('toString: x is string', () => {
    const p = new PredicateType('x', StringType);
    expect(p.toString()).toBe('x is string');
  });

  test('toString: val is number', () => {
    const p = new PredicateType('val', NumberType);
    expect(p.toString()).toBe('val is number');
  });

  test('kind is predicate', () => {
    const p = new PredicateType('x', StringType);
    expect(p.kind).toBe('predicate');
  });
});

describe('PredicateType.equals', () => {
  test('equal when same paramName and guardType', () => {
    const a = new PredicateType('x', StringType);
    const b = new PredicateType('x', StringType);
    expect(a.equals(b)).toBe(true);
  });

  test('not equal with different paramName', () => {
    const a = new PredicateType('x', StringType);
    const b = new PredicateType('y', StringType);
    expect(a.equals(b)).toBe(false);
  });

  test('not equal with different guardType', () => {
    const a = new PredicateType('x', StringType);
    const b = new PredicateType('x', NumberType);
    expect(a.equals(b)).toBe(false);
  });
});

describe('PredicateType.isCompatibleWith', () => {
  const aliases = new Types.constructor ? undefined : { resolve: t => t };
  // Use a no-op alias map stub
  const noAliases = { resolve: t => t, resolveMemberAccess: t => t };

  test('compatible with boolean', () => {
    const p = new PredicateType('x', StringType);
    expect(p.isCompatibleWith(BooleanType, noAliases)).toBe(true);
  });

  test('compatible with any', () => {
    const p = new PredicateType('x', StringType);
    expect(p.isCompatibleWith(AnyType, noAliases)).toBe(true);
  });

  test('not compatible with string primitive', () => {
    const p = new PredicateType('x', StringType);
    expect(p.isCompatibleWith(StringType, noAliases)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grammar + annotation parsing
// ---------------------------------------------------------------------------

describe('predicate annotation — annotation parses', () => {
  test('function with predicate annotation compiles without error', () => {
    expectNoErrors(`
      def isString(x: any): x is string {
        return typeof x == 'string'
      }
    `);
  });

  test('predicate function can take additional parameters', () => {
    expectNoErrors(`
      def isType(x: any, tag: string): x is string {
        return typeof x == 'string'
      }
    `);
  });

  test('predicate return annotation with complex guard type compiles', () => {
    expectNoErrors(`
      type Point = { x: number, y: number }
      def isPoint(v: any): v is Point {
        return typeof v == 'object'
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// Return type checking
// ---------------------------------------------------------------------------

describe('predicate function — return type must be boolean', () => {
  test('returning boolean expression compiles without error', () => {
    expectNoErrors(`
      def isString(x: any): x is string {
        return typeof x == 'string'
      }
    `);
  });

  test('returning a number warns', () => {
    expectCompilationError(
      `
        def badPredicate(x: any): x is string {
          return 42
        }
      `,
      'returns number but declared as x is string'
    );
  });
});

// ---------------------------------------------------------------------------
// Call-site narrowing: if condition
// ---------------------------------------------------------------------------

describe('predicate — type narrowing in if branches', () => {
  test('no warning when passing narrowed variable to string-typed parameter', () => {
    expectNoErrors(`
      def isString(x: any): x is string {
        return typeof x == 'string'
      }
      def greet(name: string) {
        return name
      }
      val: any = 'hello'
      if isString(val) {
        greet(val)
      }
    `);
  });

  test('no warning assigning narrowed variable to string-typed variable', () => {
    expectNoErrors(`
      def isNumber(x: any): x is number {
        return typeof x == 'number'
      }
      val: any = 5
      if isNumber(val) {
        n: number = val
      }
    `);
  });

  test('narrowing works after early-return predicate guard', () => {
    expectNoErrors(`
      def isString(x: any): x is string {
        return typeof x == 'string'
      }
      def process(val: any): string {
        if !isString(val) {
          return 'not a string'
        }
        return val
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// Code generation: annotation erased
// ---------------------------------------------------------------------------

describe('predicate — code generation', () => {
  test('is annotation absent from emitted JS', () => {
    const result = compile(`
      def isString(x: any): x is string {
        return typeof x == 'string'
      }
    `);
    expect(result.success).toBe(true);
    expect(result.code).not.toMatch(/\bis\b/);
  });

  test('emitted JS is a plain boolean function', () => {
    const result = compile(`
      def isString(x: any): x is string {
        return typeof x == 'string'
      }
    `);
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/typeof x/);
  });
});
