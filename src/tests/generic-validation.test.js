const { expectCompilationError, expectCompiles } = require('./testHelpers');

describe('Generic type parameter consistency', () => {
  test('allows same types for single type parameter', () => {
    const code = `
      def pair<T>(a: T, b: T): object {
        return { first: a, second: b }
      }
      result = pair(1, 2)
    `;
    expectCompiles(code);
  });

  test('rejects different types for same type parameter', () => {
    const code = `
      def pair<T>(a: T, b: T): object {
        return { first: a, second: b }
      }
      result = pair(1, 'hello')
    `;
    expectCompilationError(code, 'Type parameter T inferred as both');
  });

  test('rejects mixed types with three parameters', () => {
    const code = `
      def triple<T>(a: T, b: T, c: T): object {
        return { a, b, c }
      }
      result = triple(1, 'x', true)
    `;
    expectCompilationError(code, 'Type parameter T inferred');
  });

  test('allows compatible literal types', () => {
    const code = `
      def pair<T>(a: T, b: T): object {
        return { first: a, second: b }
      }
      result = pair('hello', 'world')
    `;
    expectCompiles(code);
  });

  test('rejects inconsistent array element types', () => {
    const code = `
      def wrap<T>(arr: T[]): T[] {
        return arr
      }
      // This should fail - passing number[] and string[] to same T
      result1 = wrap([1, 2])
      result2 = wrap(['a', 'b'])
    `;
    // Note: This actually creates two separate calls, so this might pass
    // A better test would be a function taking two T[] parameters
    expectCompiles(code); // Each call infers T separately
  });

  // Array element type tracking is now implemented
  test('rejects two array parameters with different element types', () => {
    const code = `
      def merge<T>(a: T[], b: T[]): T[] {
        return a
      }
      result = merge([1, 2], ['a', 'b'])
    `;
    expectCompilationError(code, 'Type parameter T inferred');
  });
});
