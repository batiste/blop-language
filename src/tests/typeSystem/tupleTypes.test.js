/**
 * Tests for TupleType: structural type, compatibility, parsing, and inference.
 */

import { describe, test, expect } from 'vitest';

import {
  TupleType, ArrayType, UnionType, PrimitiveType, LiteralType,
  StringType, NumberType, BooleanType, AnyType, NeverType,
  Types, TypeAliasMap,
} from '../../inference/Type.js';

import { isTypeCompatible } from '../../inference/typeSystem.js';
import { expectCompilationError } from '../testHelpers.js';

const NO_ALIASES = new TypeAliasMap();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tuple(...elements) {
  return new TupleType(elements);
}

// ---------------------------------------------------------------------------
// Construction & display
// ---------------------------------------------------------------------------

describe('TupleType construction', () => {
  test('toString with two elements', () => {
    expect(tuple(StringType, NumberType).toString()).toBe('[string, number]');
  });

  test('toString with one element', () => {
    expect(tuple(BooleanType).toString()).toBe('[boolean]');
  });

  test('toString with nested array element', () => {
    const t = tuple(StringType, new ArrayType(NumberType));
    expect(t.toString()).toBe('[string, number[]]');
  });

  test('getLengthType returns the correct literal', () => {
    const lt = tuple(StringType, NumberType).getLengthType();
    expect(lt).toBeInstanceOf(LiteralType);
    expect(lt.value).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// equals
// ---------------------------------------------------------------------------

describe('TupleType equals', () => {
  test('same structure', () => {
    expect(tuple(StringType, NumberType).equals(tuple(StringType, NumberType))).toBe(true);
  });

  test('different element types', () => {
    expect(tuple(StringType, NumberType).equals(tuple(NumberType, StringType))).toBe(false);
  });

  test('different length', () => {
    expect(tuple(StringType).equals(tuple(StringType, NumberType))).toBe(false);
  });

  test('not equal to ArrayType', () => {
    expect(tuple(StringType).equals(new ArrayType(StringType))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getElementType
// ---------------------------------------------------------------------------

describe('TupleType.getElementType', () => {
  const t = tuple(StringType, NumberType, BooleanType);

  test('index 0', () => {
    expect(t.getElementType(0)).toBe(StringType);
  });

  test('index 2', () => {
    expect(t.getElementType(2)).toBe(BooleanType);
  });

  test('out of bounds returns null', () => {
    expect(t.getElementType(3)).toBeNull();
    expect(t.getElementType(-1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

describe('TupleType compatibility', () => {
  const t = tuple(StringType, NumberType);

  test('compatible with identical tuple', () => {
    expect(t.isCompatibleWith(tuple(StringType, NumberType), NO_ALIASES)).toBe(true);
  });

  test('NOT compatible with longer tuple', () => {
    expect(t.isCompatibleWith(tuple(StringType, NumberType, BooleanType), NO_ALIASES)).toBe(false);
  });

  test('NOT compatible with shorter tuple', () => {
    expect(t.isCompatibleWith(tuple(StringType), NO_ALIASES)).toBe(false);
  });

  test('NOT compatible with wrong element type', () => {
    expect(t.isCompatibleWith(tuple(NumberType, NumberType), NO_ALIASES)).toBe(false);
  });

  test('compatible with any', () => {
    expect(t.isCompatibleWith(AnyType, NO_ALIASES)).toBe(true);
  });

  test('compatible with T[] when all elements match T', () => {
    const homogeneous = tuple(StringType, StringType);
    expect(homogeneous.isCompatibleWith(new ArrayType(StringType), NO_ALIASES)).toBe(true);
  });

  test('NOT compatible with T[] when elements are heterogeneous', () => {
    expect(t.isCompatibleWith(new ArrayType(StringType), NO_ALIASES)).toBe(false);
  });

  test('compatible with (string|number)[] for heterogeneous tuple', () => {
    const union = new UnionType([StringType, NumberType]);
    expect(t.isCompatibleWith(new ArrayType(union), NO_ALIASES)).toBe(true);
  });

  test('compatible through union target', () => {
    const unionTarget = new UnionType([tuple(StringType, NumberType), NeverType]);
    expect(t.isCompatibleWith(unionTarget, NO_ALIASES)).toBe(true);
  });

  test('isTypeCompatible helper works with tuples', () => {
    expect(isTypeCompatible(t, tuple(StringType, NumberType), NO_ALIASES)).toBe(true);
    expect(isTypeCompatible(t, tuple(StringType), NO_ALIASES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Types factory helper
// ---------------------------------------------------------------------------

describe('Types.tuple factory', () => {
  test('creates a TupleType', () => {
    const t = Types.tuple([StringType, NumberType]);
    expect(t).toBeInstanceOf(TupleType);
    expect(t.elements).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: type annotations & inference
// ---------------------------------------------------------------------------

describe('Tuple type annotations (compilation errors)', () => {
  test('wrong element type at position 0 produces a warning', () => {
    expectCompilationError(
      `
      def process(pair: [string, number]) {
        return pair
      }
      process([42, 'hello'])
      `,
      /\[string, number\]/
    );
  });

  test('wrong tuple length (too short) produces a warning', () => {
    expectCompilationError(
      `
      def getTriplet(): [string, number, boolean] {
        return ['a', 1]
      }
      `,
      /\[string, number, boolean\]/
    );
  });
});
