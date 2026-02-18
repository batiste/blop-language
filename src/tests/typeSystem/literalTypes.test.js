const { expectCompilationError } = require('../testHelpers');

describe('Literal Types - Error Cases', () => {
  test('string literal type rejects wrong literal', () => {
    const code = `
      type Direction = "north"
      dir: Direction = "south"
    `;
    expectCompilationError(code, "south");
  });

  test('string literal union rejects values not in union', () => {
    const code = `
      type Direction = "north" | "south" | "east" | "west"
      dir: Direction = "up"
    `;
    expectCompilationError(code, "up");
  });

  test('number literal type rejects wrong literal', () => {
    const code = `
      type StatusCode = 200
      status: StatusCode = 404
    `;
    expectCompilationError(code, "404");
  });

  test('number literal union rejects values not in union', () => {
    const code = `
      type StatusCode = 200 | 404 | 500
      status: StatusCode = 201
    `;
    expectCompilationError(code, "201");
  });

  test('mixed literal union rejects wrong type', () => {
    const code = `
      type Value = "auto" | 100
      val: Value = "100"
    `;
    expectCompilationError(code, '"100"');
  });

  test('literal type cannot be assigned broader type variable', () => {
    const code = `
      type Exact = "hello"
      message: string = "world"
      exact: Exact = message
    `;
    expectCompilationError(code, "string");
  });
});
