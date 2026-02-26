import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Object type structural validation - negative tests', () => {
  test('rejects object missing required property', () => {
    const code = `
      type User = {
        name: string,
        id: number
      }
      
      user: User = { name: 'Alice' }
      user
    `;
    expectCompilationError(code, 'Missing property');
  });

  test('rejects object with wrong property type', () => {
    const code = `
      type User = {
        name: string,
        id: number
      }
      
      user: User = { name: 'Alice', id: 'not-a-number' }
      user
    `;
    expectCompilationError(code, "but expected number");
  });

  test('rejects object with excess properties', () => {
    const code = `
      type User = {
        name: string,
        id: number
      }
      
      user: User = { name: 'Alice', id: 123, extra: 'field' }
      user
    `;
    expectCompilationError(code, 'Excess property');
  });

  test('accepts object with correct structure', () => {
    const code = `
      type User = {
        name: string,
        id: number
      }
      
      user: User = { name: 'Alice', id: 123 }
      user
    `;
    expectCompiles(code);
  });

  test('accepts nested object type assignment', () => {
    // Regression: nested object type properties (e.g. score inside dogPage) were
    // being hoisted to the top-level of the parent type, causing false positives.
    const code = `
      type State = {
        dogPage: { score: number }
      }

      test: State = {
        dogPage: { score: 0 }
      }
      test
    `;
    expectCompiles(code);
  });

  test('rejects nested object with wrong property type', () => {
    const code = `
      type State = {
        dogPage: { score: number }
      }

      test: State = {
        dogPage: { score: 'not-a-number' }
      }
      test
    `;
    expectCompilationError(code, 'score');
  });
});

describe('Object literal string literal union compatibility', () => {
  test('object literal with string matching a union param compiles', () => {
    const code = `
      type User = { name: string, age: number, role: 'admin' | 'viewer' }
      def buggy(newValue: User | null) {
        console.log('User updated:', newValue)
      }
      buggy({ name: 'Alice', age: 30, role: 'admin' })
    `;
    expectCompiles(code);
  });

  test('rejects string value not in the union', () => {
    const code = `
      type User = { name: string, role: 'admin' | 'viewer' }
      def f(u: User) { u }
      f({ name: 'Alice', role: 'superuser' })
    `;
    expectCompilationError(code, 'role');
  });

  test('numeric literals in object literal still widen to number', () => {
    const code = `
      def test() {
        obj = { a: 1, b: 2, c: 3 }
        result = 0
        for key, value in obj {
          result := result + value
        }
        return result
      }
    `;
    expectCompiles(code);
  });
});
