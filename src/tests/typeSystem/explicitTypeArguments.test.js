import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Explicit Type Arguments', () => {
  test('allows explicit type argument with matching value', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      result = identity<string>('hello')
    `;
    expectCompiles(code);
  });

  test('allows explicit number type argument', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      result = identity<number>(42)
    `;
    expectCompiles(code);
  });

  test('errors when explicit type does not match argument', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      result = identity<string>(42)
    `;
    expectCompilationError(code, /expected string.*but got.*42/i);
  });

  test('allows multiple type arguments', () => {
    const code = `
      def pair<T, U>(first: T, second: U): object {
        return { first, second }
      }
      
      result = pair<number, string>(1, 'one')
    `;
    expectCompiles(code);
  });

  test('errors when multiple type arguments do not match', () => {
    const code = `
      def pair<T, U>(first: T, second: U): object {
        return { first, second }
      }
      
      result = pair<string, number>('hello', 'world')
    `;
    expectCompilationError(code, /expected number.*but got.*"world"/i);
  });

  test('explicit types override inference', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      // Would infer as number, but explicitly set to string
      result = identity<string>(42)
    `;
    expectCompilationError(code, /expected string/i);
  });

  test('inference still works without explicit types', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      result1 = identity('hello')
      result2 = identity(42)
    `;
    expectCompiles(code);
  });

  test('explicit array type arguments work', () => {
    const code = `
      def firstElement<T>(arr: T[]): T | undefined {
        if arr.length > 0 {
          return arr[0]
        }
        return undefined
      }
      
      result = firstElement<number>([1, 2, 3])
    `;
    expectCompiles(code);
  });

  test('errors when array type argument does not match', () => {
    const code = `
      def firstElement<T>(arr: T[]): T | undefined {
        if arr.length > 0 {
          return arr[0]
        }
        return undefined
      }
      
      result = firstElement<string>([1, 2, 3])
    `;
    expectCompilationError(code, /expected string\[\].*but got.*number\[\]/i);
  });

  test('warns when wrong number of type arguments provided', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      result = identity<string, number>('hello')
    `;
    // Should warn about expecting 1 type arg but got 2
    expectCompilationError(code, /Expected 1 type argument.*but got 2/i);
  });

  test('explicit union types work', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      result = identity<string | number>('hello')
    `;
    expectCompiles(code);
  });

  test('explicit return type is computed correctly', () => {
    const code = `
      def identity<T>(value: T): T {
        return value
      }
      
      // Explicitly set return type via type argument
      result: string = identity<string>('hello')
    `;
    expectCompiles(code);
  });
});
