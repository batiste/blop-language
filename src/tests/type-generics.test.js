/**
 * Low-level tests for generic type inference and substitution:
 * - substituteTypeParams / substituteType
 * - inferGenericArguments
 * - instantiateGenericType
 * - Handling of AnyFunctionType inside generic machinery (null params guard)
 */

import { describe, test, expect } from 'vitest';

import {
  TypeAlias, TypeAliasMap, ArrayType, FunctionType,
  AnyType, StringType, NumberType, BooleanType,
  AnyFunctionType, Types, substituteTypeParams,
} from '../inference/Type.js';

import {
  inferGenericArguments,
  substituteType,
  instantiateGenericType,
} from '../inference/typeSystem.js';

const NO_ALIASES = {};

// ---------------------------------------------------------------------------
// substituteTypeParams
// ---------------------------------------------------------------------------

describe('substituteTypeParams', () => {
  test('replaces a direct type parameter', () => {
    const T = new TypeAlias('T');
    const subs = new Map([['T', NumberType]]);
    expect(substituteTypeParams(T, subs)).toBe(NumberType);
  });

  test('replaces element type inside an array', () => {
    const arr = Types.array(new TypeAlias('T'));
    const subs = new Map([['T', StringType]]);
    const result = substituteTypeParams(arr, subs);
    expect(result).toBeInstanceOf(ArrayType);
    expect(result.elementType).toBe(StringType);
  });

  test('replaces types inside a union', () => {
    const union = Types.union([new TypeAlias('T'), NumberType]);
    const subs = new Map([['T', StringType]]);
    const result = substituteTypeParams(union, subs);
    expect(result.toString()).toBe('string | number');
  });

  test('leaves non-parameter type aliases untouched', () => {
    const alias = new TypeAlias('SomeAlias');
    const subs = new Map([['T', NumberType]]);
    const result = substituteTypeParams(alias, subs);
    expect(result).toBe(alias);
  });

  test('leaves primitives unchanged', () => {
    const subs = new Map([['T', NumberType]]);
    expect(substituteTypeParams(StringType, subs)).toBe(StringType);
    expect(substituteTypeParams(NumberType, subs)).toBe(NumberType);
  });

  test('replaces param in FunctionType return type', () => {
    const fn = new FunctionType([NumberType], new TypeAlias('T'));
    const subs = new Map([['T', StringType]]);
    const result = substituteTypeParams(fn, subs);
    expect(result.returnType).toBe(StringType);
    expect(result.params[0]).toBe(NumberType);
  });

  test('replaces param in FunctionType params', () => {
    const fn = new FunctionType([new TypeAlias('T')], NumberType);
    const subs = new Map([['T', StringType]]);
    const result = substituteTypeParams(fn, subs);
    expect(result.params[0]).toBe(StringType);
  });

  test('AnyFunctionType (null params) is returned unchanged', () => {
    // Regression: substituteTypeParams used to crash on null .params
    const subs = new Map([['T', NumberType]]);
    const result = substituteTypeParams(AnyFunctionType, subs);
    expect(result).toBe(AnyFunctionType);
  });
});

// ---------------------------------------------------------------------------
// substituteType (typeSystem wrapper that accepts Map or plain object)
// ---------------------------------------------------------------------------

describe('substituteType', () => {
  test('works with a plain object substitution map', () => {
    const T = new TypeAlias('T');
    const result = substituteType(T, { T: NumberType });
    expect(result).toBe(NumberType);
  });

  test('works with a Map substitution map', () => {
    const T = new TypeAlias('T');
    const result = substituteType(T, new Map([['T', StringType]]));
    expect(result).toBe(StringType);
  });

  test('AnyFunctionType is safe to substitute', () => {
    const result = substituteType(AnyFunctionType, { T: NumberType });
    expect(result).toBe(AnyFunctionType);
  });
});

// ---------------------------------------------------------------------------
// inferGenericArguments — simple cases
// ---------------------------------------------------------------------------

describe('inferGenericArguments', () => {
  test('no generic params returns empty substitutions', () => {
    const { substitutions, errors } = inferGenericArguments(
      [],
      [NumberType],
      [NumberType],
      NO_ALIASES,
    );
    expect(substitutions.size).toBe(0);
    expect(errors).toHaveLength(0);
  });

  test('infers T = number from a direct parameter', () => {
    const T = new TypeAlias('T');
    const { substitutions } = inferGenericArguments(
      ['T'],
      [T],
      [NumberType],
      NO_ALIASES,
    );
    expect(substitutions.get('T')).toBe(NumberType);
  });

  test('infers T = string from a direct parameter', () => {
    const T = new TypeAlias('T');
    const { substitutions } = inferGenericArguments(
      ['T'],
      [T],
      [StringType],
      NO_ALIASES,
    );
    expect(substitutions.get('T')).toBe(StringType);
  });

  test('infers T = number from T[] parameter with number[] argument', () => {
    const T = new TypeAlias('T');
    const { substitutions } = inferGenericArguments(
      ['T'],
      [Types.array(T)],
      [Types.array(NumberType)],
      NO_ALIASES,
    );
    expect(substitutions.get('T')).toBe(NumberType);
  });

  test('fills unresolved params with any', () => {
    const T = new TypeAlias('T');
    const U = new TypeAlias('U');
    const { substitutions } = inferGenericArguments(
      ['T', 'U'],
      [T],        // only one param, U never appears
      [NumberType],
      NO_ALIASES,
    );
    expect(substitutions.get('T')).toBe(NumberType);
    expect(substitutions.get('U')).toBe(AnyType);
  });

  test('reports error when same T inferred as two incompatible types', () => {
    const T = new TypeAlias('T');
    const { errors } = inferGenericArguments(
      ['T'],
      [T, T],
      [NumberType, StringType],
      NO_ALIASES,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/T/);
  });

  test('widens literal to base type when T inferred from two literals of same base', () => {
    const T = new TypeAlias('T');
    const lit1 = Types.literal(1, NumberType);
    const lit2 = Types.literal(2, NumberType);
    const { substitutions } = inferGenericArguments(
      ['T'],
      [T, T],
      [lit1, lit2],
      NO_ALIASES,
    );
    // Both literals share base NumberType, so T should be widened to number
    expect(substitutions.get('T')).toBe(NumberType);
  });
});

// ---------------------------------------------------------------------------
// instantiateGenericType
// ---------------------------------------------------------------------------

describe('instantiateGenericType', () => {
  test('instantiates Array<T> with number gives number[]', () => {
    const aliases = new TypeAliasMap();
    const T = new TypeAlias('T');
    aliases.define('Box', Types.array(T), ['T']);

    const result = instantiateGenericType('Box', [NumberType], aliases);
    expect(result.toString()).toBe('number[]');
  });

  test('unknown generic name returns TypeAlias as-is', () => {
    const aliases = new TypeAliasMap();
    const result = instantiateGenericType('Unknown', [NumberType], aliases);
    expect(result).toBeInstanceOf(TypeAlias);
    expect(result.name).toBe('Unknown');
  });
});
