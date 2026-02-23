import { describe, it } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('elseif type narrowing', () => {
  it('narrows variable to the matched type in elseif body', () => {
    expectCompiles(`
      def f(val: string | number): number {
        if typeof val == 'string' {
          return 0
        } elseif typeof val == 'number' {
          return val * 2
        }
        return 0
      }
    `);
  });

  it('chains exclusions across three elseif branches', () => {
    // In the 'number' branch, val has been narrowed to number by its own guard.
    // In the 'boolean' branch, both string and number have been excluded.
    expectCompiles(`
      def f(val: string | number | boolean): string {
        if typeof val == 'string' {
          return val.toUpperCase()
        } elseif typeof val == 'number' {
          return val.toString()
        } elseif typeof val == 'boolean' {
          return val.toString()
        }
        return 'x'
      }
    `);
  });

  it('un-narrowed union union still fails math', () => {
    expectCompilationError(`
      def f(val: string | number): number {
        return val * 2
      }
    `, 'Math operator');
  });

  it('narrowed null exclusion in chained elseif still allows math', () => {
    expectCompiles(`
      def f(val: string | number | null): number {
        if val == null {
          return 0
        } elseif typeof val == 'number' {
          return val * 2
        }
        return 0
      }
    `);
  });
});

describe('return type checking', () => {
  it('rejects return value incompatible with declared return type', () => {
    expectCompilationError(`
      def f(val: string | undefined): string {
        if true {
          return 1
        }
        return val
      }
    `, 'returns number but declared as string');
  });

  it('rejects returning a string in a number-declared function', () => {
    expectCompilationError(`
      def f(): number {
        return 'hello'
      }
    `, 'returns string but declared as number');
  });
});

describe('binary op type checking on LiteralType variables', () => {
  it('inferred number literal + string fails', () => {
    expectCompilationError(`
      value = 5
      result = value + 'a'
    `, 'Cannot apply');
  });

  it('annotated number + string fails', () => {
    expectCompilationError(`
      value: number = 5
      result = value + 'a'
    `, 'Cannot apply');
  });

  it('inferred number literal + number passes', () => {
    expectCompiles(`
      value = 5
      result = value + 1
    `);
  });
});
