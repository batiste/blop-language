const { expectCompilationError, expectCompiles } = require('../testHelpers');

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
});
