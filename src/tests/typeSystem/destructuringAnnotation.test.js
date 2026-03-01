/**
 * Tests for type annotation on destructuring assignments: { a, b }: Type = expr
 */

import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('Destructuring assignment with type annotation', () => {
  test('currently fails without the fix (regression guard)', () => {
    // { x }: MyType = obj should compile
    expectCompiles(`
      type Point = { x: number, y: number }
      p: Point = { x: 1, y: 2 }
      { x }: Point = p
    `);
  });

  test('annotated destructuring gives correct inferred types', () => {
    expectCompiles(`
      type Props = { state: string, count: number }
      obj: Props = { state: 'hello', count: 42 }
      { state, count }: Props = obj
      s: string = state
      n: number = count
    `);
  });

  test('reports type error when using destructured var as wrong type', () => {
    expectCompilationError(`
      type Props = { count: number }
      obj: Props = { count: 1 }
      { count }: Props = obj
      s: string = count
    `, 'string');
  });
});
