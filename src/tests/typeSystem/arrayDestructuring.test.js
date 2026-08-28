/**
 * Type inference and checking for array destructuring: `[a, b] = pair`.
 *
 * Runtime behaviour lives in languageFeatures/arrayDestructuring.test.blop.
 */

import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('array destructuring — element types', () => {
  test('a tuple binds each position to its own type', () => {
    expectCompiles(`
      pair: [string, number] = ['a', 1]
      [label, count] = pair
      s: string = label
      n: number = count
    `);
  });

  test('wrong use of a tuple element is reported', () => {
    expectCompilationError(`
      pair: [string, number] = ['a', 1]
      [label, count] = pair
      wrong: number = label
    `, 'Cannot assign string to number');
  });

  test('an array binds every name to the element type', () => {
    expectCompiles(`
      names: string[] = ['a', 'b']
      [first, second] = names
      s: string = first
      t: string = second
    `);
  });

  test('wrong use of an array element is reported', () => {
    expectCompilationError(`
      names: string[] = ['a', 'b']
      [first] = names
      wrong: number = first
    `, 'Cannot assign string to number');
  });

  test('destructures a tuple returned by a function', () => {
    expectCompiles(`
      def makePair(): [string, number] {
        return ['a', 1]
      }
      [label, count] = makePair()
      s: string = label
      n: number = count
    `);
  });

  test('destructures an array literal directly', () => {
    expectCompiles(`
      [x, y] = [10, 20]
      n: number = x
    `);
  });

  test('destructures through a type alias', () => {
    expectCompiles(`
      type Entry = [string, number]
      entry: Entry = ['a', 1]
      [key, value] = entry
      s: string = key
      n: number = value
    `);
  });

  test('nested tuple element keeps its tuple type', () => {
    expectCompiles(`
      nested: [string, [number, boolean]] = ['a', [1, true]]
      [label, inner] = nested
      pair: [number, boolean] = inner
    `);
  });
});

describe('array destructuring — annotations', () => {
  test('inline annotations on names are honoured', () => {
    expectCompiles(`
      [name: string, age: number] = ['Alice', 30]
      s: string = name
      n: number = age
    `);
  });

  test('an inline annotation overrides the element type', () => {
    expectCompilationError(`
      pair: [string, number] = ['a', 1]
      [label: number, count] = pair
      s: string = label
    `, 'Cannot assign number to string');
  });

  test('an annotation on the whole pattern types the elements', () => {
    expectCompiles(`
      [host, port]: [string, number] = ['example.com', 443]
      s: string = host
      n: number = port
    `);
  });

  test('the right-hand side is checked against a pattern annotation', () => {
    expectCompilationError(`
      [host, port]: [string, number] = [443, 'example.com']
    `, 'Cannot assign [number, string] to [string, number]');
  });

  test('a pattern annotation catches a length mismatch', () => {
    expectCompilationError(`
      [host, port]: [string, number] = ['example.com']
    `, 'Cannot assign [string] to [string, number]');
  });
});

describe('array destructuring — diagnostics', () => {
  test('more names than the tuple has elements is reported', () => {
    expectCompilationError(`
      pair: [string, number] = ['a', 1]
      [a, b, c] = pair
    `, 'Tuple [string, number] has no element at index 2');
  });

  test('fewer names than elements is fine', () => {
    expectCompiles(`
      pair: [string, number] = ['a', 1]
      [onlyFirst] = pair
      s: string = onlyFirst
    `);
  });

  test('destructuring a number is reported', () => {
    expectCompilationError(`
      n = 42
      [a] = n
    `, 'Cannot destructure 42 as an array');
  });

  test('destructuring a boolean is reported', () => {
    expectCompilationError(`
      flag: boolean = true
      [a] = flag
    `, 'Cannot destructure boolean as an array');
  });

  test('destructuring a string is allowed — strings are iterable', () => {
    expectCompiles(`
      word: string = 'hi'
      [firstChar] = word
    `);
  });

  test('destructuring an untyped value does not warn', () => {
    expectCompiles(`
      def anything(x) {
        [a, b] = x
        return b
      }
    `);
  });
});
