const { expectCompilationError, expectCompiles } = require('./testHelpers');

describe('Object shorthand property inference', () => {
  test('infers single shorthand property', () => {
    const code = `
      a = 1
      obj = { a }
      
      def test() {
        obj.a
      }
    `;
    expectCompiles(code);
  });

  test('infers multiple shorthand properties', () => {
    const code = `
      a = 1
      b = 2
      c = 3
      obj = { a, b, c }
      
      def test() {
        obj.a
        obj.b
        obj.c
      }
    `;
    expectCompiles(code);
  });

  test('infers mixed shorthand and regular properties', () => {
    const code = `
      a = 1
      b = 2
      obj = { a, x: 10, b }
      
      def test() {
        obj.a
        obj.x
        obj.b
      }
    `;
    expectCompiles(code);
  });
});
