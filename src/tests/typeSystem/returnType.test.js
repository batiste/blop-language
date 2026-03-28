import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError, dedent } from '../testHelpers.js';

describe('ReturnType<T>', () => {
  test('extracts return type from function type alias', () => {
    expectCompiles(dedent(`
      type Fn = (name: string) => number
      type R = ReturnType<Fn>
      x: R = 42
    `));
  });

  test('works with inline function type argument', () => {
    expectCompiles(dedent(`
      type R = ReturnType<(a: number) => string>
      x: R = 'ok'
    `));
  });

  test('supports union of function types', () => {
    expectCompiles(dedent(`
      type F1 = (x: string) => number
      type F2 = (x: number) => string
      type F = F1 | F2
      type R = ReturnType<F>
      a: R = 1
      b: R = 'ok'
    `));
  });

  test('non-function argument falls back to never', () => {
    expectCompilationError(
      dedent(`
        type R = ReturnType<string>
        x: R = 1
      `),
      'Cannot assign 1 to R'
    );
  });
});
