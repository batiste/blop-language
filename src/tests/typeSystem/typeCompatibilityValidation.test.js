import { isTypeCompatible } from '../../inference/typeSystem.js';
import { PrimitiveType, FunctionType, AnyType } from '../../inference/Type.js';
import { describe, test, expect } from 'vitest';

describe('Type compatibility validation', () => {
  test('should validate resolved types are proper Type objects', () => {
    // This test ensures the defensive check in isTypeCompatible works
    // by verifying that valid types pass through correctly
    const numberType = new PrimitiveType('number');
    const stringType = new PrimitiveType('string');
    
    // Should not throw
    expect(() => {
      isTypeCompatible(numberType, numberType, {});
    }).not.toThrow();
  });

  test('should accept number compatible with number', () => {
    const numberType = new PrimitiveType('number');
    expect(isTypeCompatible(numberType, numberType, {})).toBe(true);
  });

  test('should reject number when string expected', () => {
    const numberType = new PrimitiveType('number');
    const stringType = new PrimitiveType('string');
    expect(isTypeCompatible(numberType, stringType, {})).toBe(false);
  });

  test('should reject string type objects (should be parsed)', () => {
    const numberType = new PrimitiveType('number');
    
    expect(() => {
      isTypeCompatible('number', numberType, {});
    }).toThrow(/expects Type objects, not strings/);
  });

  test('should reject string target type objects (should be parsed)', () => {
    const numberType = new PrimitiveType('number');
    
    expect(() => {
      isTypeCompatible(numberType, 'number', {});
    }).toThrow(/expects Type objects, not strings/);
  });

  test('should accept function types with matching signatures', () => {
    const func1 = new FunctionType(
      [new PrimitiveType('number')],
      new PrimitiveType('string'),
      [],
      []
    );
    const func2 = new FunctionType(
      [new PrimitiveType('number')],
      new PrimitiveType('string'),
      [],
      []
    );
    
    expect(isTypeCompatible(func1, func2, {})).toBe(true);
  });

  test('should handle AnyType compatibility', () => {
    const numberType = new PrimitiveType('number');
    
    // AnyType is compatible with everything
    expect(isTypeCompatible(AnyType, numberType, {})).toBe(true);
    expect(isTypeCompatible(numberType, AnyType, {})).toBe(true);
  });
});
