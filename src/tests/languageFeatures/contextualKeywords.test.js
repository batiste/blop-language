import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Context-scoped built-ins: arguments, this, super', () => {

  // ---------------------------------------------------------------------------
  // arguments
  // ---------------------------------------------------------------------------

  test('arguments is valid inside a function body', () => {
    expectCompiles(`
      def myFunc() {
        args = arguments
      }
    `);
  });

  test('arguments is invalid at global scope', () => {
    expectCompilationError(
      `args = arguments`,
      /only available inside a function body/i,
    );
  });

  // ---------------------------------------------------------------------------
  // this
  // ---------------------------------------------------------------------------

  test('this is valid inside a regular function', () => {
    expectCompiles(`
      def greet() {
        return this
      }
    `);
  });

  test('this is valid inside a class method', () => {
    expectCompiles(`
      class Foo {
        def bar() {
          return this
        }
      }
    `);
  });

  test('this is invalid at global scope', () => {
    expectCompilationError(
      `x = this`,
      /only available inside a function body/i,
    );
  });

  // ---------------------------------------------------------------------------
  // super
  // ---------------------------------------------------------------------------

  test('super is valid inside a class method', () => {
    expectCompiles(`
      class Base {
        def greet() {
          return 1
        }
      }
      class Child extends Base {
        def greet() {
          return super.greet()
        }
      }
    `);
  });

  test('super is invalid at global scope', () => {
    expectCompilationError(
      `super.greet()`,
      /only available inside a class body/i,
    );
  });

  test('super is invalid inside a plain function (not a class method)', () => {
    expectCompilationError(
      `
        def notAMethod() {
          return super.greet()
        }
      `,
      /only available inside a class body/i,
    );
  });

});
