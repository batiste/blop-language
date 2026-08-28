/**
 * Contextual typing of array literals against tuple targets.
 *
 * An array literal has no intrinsic tuple-ness: `['a', 1]` infers as
 * (string | number)[]. When the target is a tuple, the literal's positional
 * element types are compared position by position instead.
 *
 * Freshness only survives while the literal is still an expression: once it is
 * bound to a variable (or becomes a function's inferred return type) the type
 * widens to a plain array, matching TypeScript.
 */

import { describe, test, expect } from 'vitest';

import {
  ArrayLiteralType, ArrayType, TupleType, TypeAliasMap,
  StringType, NumberType, BooleanType, AnyType, Types,
} from '../../inference/Type.js';
import { isTypeCompatible, widenFreshness } from '../../inference/typeSystem.js';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

const NO_ALIASES = new TypeAliasMap();

function fresh(...elements) {
  return new ArrayLiteralType(Types.union(elements), elements);
}

// ---------------------------------------------------------------------------
// ArrayLiteralType unit behaviour
// ---------------------------------------------------------------------------

describe('ArrayLiteralType', () => {
  test('is an ArrayType', () => {
    expect(fresh(StringType, NumberType)).toBeInstanceOf(ArrayType);
  });

  test('displays as its widened array type, not as a tuple', () => {
    expect(fresh(StringType, NumberType).toString()).toBe('(string | number)[]');
    expect(fresh(StringType, StringType).toString()).toBe('string[]');
  });

  test('compatible with a matching tuple', () => {
    const target = new TupleType([StringType, NumberType]);
    expect(fresh(StringType, NumberType).isCompatibleWith(target, NO_ALIASES)).toBe(true);
  });

  test('NOT compatible with a tuple in the wrong order', () => {
    const target = new TupleType([NumberType, StringType]);
    expect(fresh(StringType, NumberType).isCompatibleWith(target, NO_ALIASES)).toBe(false);
  });

  test('NOT compatible with a longer tuple', () => {
    const target = new TupleType([StringType, NumberType, BooleanType]);
    expect(fresh(StringType, NumberType).isCompatibleWith(target, NO_ALIASES)).toBe(false);
  });

  test('NOT compatible with a shorter tuple', () => {
    const target = new TupleType([StringType]);
    expect(fresh(StringType, NumberType).isCompatibleWith(target, NO_ALIASES)).toBe(false);
  });

  test('still compatible with plain arrays like any array literal', () => {
    const target = new ArrayType(Types.union([StringType, NumberType]));
    expect(fresh(StringType, NumberType).isCompatibleWith(target, NO_ALIASES)).toBe(true);
  });

  test('compatible with any', () => {
    expect(fresh(StringType).isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('isTypeCompatible helper honours positional elements', () => {
    const t = fresh(StringType, NumberType);
    expect(isTypeCompatible(t, new TupleType([StringType, NumberType]), NO_ALIASES)).toBe(true);
    expect(isTypeCompatible(t, new TupleType([NumberType, NumberType]), NO_ALIASES)).toBe(false);
  });

  test('a plain ArrayType is never tuple-compatible', () => {
    const plain = new ArrayType(Types.union([StringType, NumberType]));
    expect(plain.isCompatibleWith(new TupleType([StringType, NumberType]), NO_ALIASES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// widenFreshness
// ---------------------------------------------------------------------------

describe('widenFreshness', () => {
  test('turns a fresh literal into a plain array', () => {
    const widened = widenFreshness(fresh(StringType, NumberType));
    expect(widened).toBeInstanceOf(ArrayType);
    expect(widened).not.toBeInstanceOf(ArrayLiteralType);
    expect(widened.toString()).toBe('(string | number)[]');
  });

  test('widens freshness nested inside an object property', () => {
    const obj = Types.object(new Map([['pair', { type: fresh(StringType, NumberType), optional: false }]]));
    const widened = widenFreshness(obj);
    expect(widened.properties.get('pair').type).not.toBeInstanceOf(ArrayLiteralType);
  });

  test('widens freshness nested inside an array element', () => {
    const nested = new ArrayLiteralType(fresh(StringType, NumberType), [fresh(StringType, NumberType)]);
    const widened = widenFreshness(nested);
    expect(widened).not.toBeInstanceOf(ArrayLiteralType);
    expect(widened.elementType).not.toBeInstanceOf(ArrayLiteralType);
  });

  test('leaves types without freshness untouched', () => {
    const plain = new ArrayType(StringType);
    expect(widenFreshness(plain)).toBe(plain);
    expect(widenFreshness(StringType)).toBe(StringType);
  });
});

// ---------------------------------------------------------------------------
// Positive: array literals accepted in every tuple position
// ---------------------------------------------------------------------------

describe('array literals against tuple targets', () => {
  test('annotated variable declaration', () => {
    expectCompiles(`t: [string, number] = ['a', 1]`);
  });

  test('homogeneous tuple annotation', () => {
    expectCompiles(`t: [string, string] = ['a', 'b']`);
  });

  test('single element tuple', () => {
    expectCompiles(`t: [number] = [1]`);
  });

  test('function argument', () => {
    expectCompiles(`
      def process(pair: [string, number]) {
        return pair[0]
      }
      r = process(['a', 1])
    `);
  });

  test('return statement', () => {
    expectCompiles(`
      def make(): [string, number] {
        return ['a', 1]
      }
    `);
  });

  test('through a type alias', () => {
    expectCompiles(`
      type Pair = [string, number]
      p: Pair = ['a', 1]
    `);
  });

  test('nested tuple', () => {
    expectCompiles(`t: [string, [number, boolean]] = ['a', [1, true]]`);
  });

  test('tuple as an object property', () => {
    expectCompiles(`o: { pair: [string, number] } = { pair: ['a', 1] }`);
  });

  test('array of tuples', () => {
    expectCompiles(`entries: [string, number][] = [['x', 1], ['y', 2]]`);
  });

  test('tuple element access keeps positional types', () => {
    expectCompiles(`
      t: [string, number] = ['a', 1]
      s: string = t[0]
      n: number = t[1]
    `);
  });

  test('literal element types widen to the annotated element type', () => {
    // 'a' is the literal type "a"; it must be accepted for a `string` slot.
    expectCompiles(`t: [string, number] = ['a', 1]`);
  });

  test('tuple inside a union target', () => {
    expectCompiles(`t: [string, number] | null = ['a', 1]`);
  });

  test('array literal still works without a tuple target', () => {
    expectCompiles(`
      names: string[] = ['a', 'b']
      mixed = ['a', 1]
    `);
  });
});

// ---------------------------------------------------------------------------
// Spread elements
// ---------------------------------------------------------------------------

describe('spread inside an array literal', () => {
  test('spreading a tuple keeps the positions known', () => {
    expectCompiles(`
      pair: [string, number] = ['a', 1]
      copy: [string, number] = [...pair]
    `);
  });

  test('spreading a tuple then appending', () => {
    expectCompiles(`
      pair: [string, number] = ['a', 1]
      extended: [string, number, boolean] = [...pair, true]
    `);
  });

  test('a spread tuple is still checked positionally', () => {
    expectCompilationError(`
      pair: [string, number] = ['a', 1]
      wrong: [number, string] = [...pair]
    `, 'Cannot assign [string, number] to [number, string]');
  });

  test('spreading a tuple contributes its elements to the element type', () => {
    // Used to infer any[] because a TupleType is not an ArrayType
    expectCompilationError(`
      pair: [string, number] = ['a', 1]
      copy = [...pair]
      wrong: string[] = copy
    `, 'Cannot assign (string | number)[] to string[]');
  });

  test('spreading a plain array cannot satisfy a tuple — length is unknown', () => {
    expectCompilationError(`
      names: string[] = ['a']
      pair: [string, string] = [...names]
    `, 'Cannot assign string[] to [string, string]');
  });
});

// ---------------------------------------------------------------------------
// Negative: positional mismatches must still be caught
// ---------------------------------------------------------------------------

describe('tuple mismatches are reported', () => {
  test('wrong element order', () => {
    expectCompilationError(`t: [string, number] = [1, 'a']`, /\[string, number\]/);
  });

  test('too many elements', () => {
    expectCompilationError(`t: [string, number] = ['a', 1, 2]`, /\[string, number\]/);
  });

  test('too few elements', () => {
    expectCompilationError(`t: [string, number] = ['a']`, /\[string, number\]/);
  });

  test('wrong element type at a single position', () => {
    expectCompilationError(`t: [string, number] = ['a', true]`, /\[string, number\]/);
  });

  test('wrong argument tuple at a call site', () => {
    expectCompilationError(`
      def process(pair: [string, number]) {
        return pair
      }
      process([42, 'hello'])
    `, /\[string, number\]/);
  });

  test('wrong returned tuple length', () => {
    expectCompilationError(`
      def getTriplet(): [string, number, boolean] {
        return ['a', 1]
      }
    `, /\[string, number, boolean\]/);
  });

  test('nested tuple mismatch', () => {
    expectCompilationError(`t: [string, [number, boolean]] = ['a', [true, 1]]`, /\[string, \[number, boolean\]\]/);
  });

  test('object property tuple mismatch', () => {
    expectCompilationError(`o: { pair: [string, number] } = { pair: [1, 'a'] }`, /\[string, number\]/);
  });

  test('the message shows the literal positionally, not as a widened union', () => {
    // `(string | number)[]` would say nothing about which position is wrong
    expectCompilationError(`t: [string, number] = [1, 'a']`,
      'Cannot assign [number, string] to [string, number]');
  });

  test('the message shows a length mismatch positionally', () => {
    expectCompilationError(`t: [string, number] = ['a', 1, 2]`,
      'Cannot assign [string, number, number] to [string, number]');
  });

  test('the message is positional at call sites too', () => {
    expectCompilationError(`
      def f(p: [string, number]) {
        return p
      }
      f([42, 'hello'])
    `, 'expected [string, number] for param 1 but got [number, string]');
  });

  test('the message is positional for nested tuples', () => {
    expectCompilationError(`t: [string, [number, boolean]] = ['a', [true, 1]]`,
      'Cannot assign [string, [boolean, number]] to [string, [number, boolean]]');
  });

  test('freshness does not survive a variable binding', () => {
    // `mixed` is (string | number)[] — assigning it to a tuple must fail.
    expectCompilationError(`
      mixed = ['a', 1]
      t: [string, number] = mixed
    `, /\[string, number\]/);
  });

  test('freshness does not survive an inferred function return type', () => {
    expectCompilationError(`
      def pair() {
        return ['a', 1]
      }
      t: [string, number] = pair()
    `, /\[string, number\]/);
  });
});
