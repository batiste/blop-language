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
