import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('VNode type validation - negative tests', () => {
  test('rejects arrow function returning number instead of VNode', () => {
    const code = `
      Test = (): VNode => {
        return 1
      }
      Test()
    `;
    expectCompilationError(code, 'returns number but declared as VNode');
  });

  test('rejects arrow function with implicit return of number instead of VNode', () => {
    const code = `
      Test = (): VNode => 1
      Test()
    `;
    expectCompilationError(code, 'returns number but declared as VNode');
  });

  test('rejects named function returning string instead of VNode', () => {
    const code = `
      def Test(): VNode {
        return 'hello'
      }
      Test()
    `;
    expectCompilationError(code, 'but declared as VNode');
  });

  test('rejects empty function body declared as VNode', () => {
    const code = `
      def Test(): VNode {
      }
      Test()
    `;
    expectCompilationError(code, 'returns undefined but declared as VNode');
  });

  test('rejects function with conditional returning number | VNode', () => {
    const code = `
      def Test(): VNode {
        if 1 == 1 {
          1
        } else {
          <span>'Hello'</span>
        }
      }
      Test()
    `;
    expectCompilationError(code, 'VNode | undefined');
  });

  test('accepts valid VNode returns', () => {
    const code = `
      def Test(): VNode {
        <div>'Valid'</div>
      }
      Test()
    `;
    expectCompiles(code);
  });

  test('accepts arrow function with VNode return', () => {
    const code = `
      Test = (): VNode => {
        <span>'Valid'</span>
      }
      Test()
    `;
    expectCompiles(code);
  });

  test('accepts conditional with VNode in all branches', () => {
    const code = `
      def Test(show: boolean): VNode {
        if show {
          <div>'True'</div>
        } else {
          <span>'False'</span>
        }
      }
      Test(true)
    `;
    expectCompiles(code);
  });

  test('rejects function with if but no else returning VNode', () => {
    const code = `
      def Test(show: boolean): VNode {
        if show {
          <div>'Content'</div>
        }
      }
      Test(true)
    `;
    expectCompilationError(code, 'VNode | undefined');
  });

  test('rejects if/elseif without else when declared as VNode', () => {
    const code = `
      def Test(value: number): VNode {
        if value > 10 {
          <div>'High'</div>
        } elseif value > 5 {
          <span>'Medium'</span>
        }
      }
      Test(3)
    `;
    expectCompilationError(code, 'undefined');
  });

  test('rejects arrow function with empty block body declared as VNode', () => {
    const code = `
      Test = (): VNode => {}
      Test()
    `;
    expectCompilationError(code, 'returns undefined but declared as VNode');
  });

  test('rejects function returning object instead of VNode', () => {
    const code = `
      def Test(): VNode {
        obj = {}
        return obj
      }
      Test()
    `;
    expectCompilationError(code, 'but declared as VNode');
  });

  test('rejects function returning boolean instead of VNode', () => {
    const code = `
      def Test(): VNode {
        return true
      }
      Test()
    `;
    expectCompilationError(code, 'but declared as VNode');
  });

  test('rejects function returning array instead of VNode', () => {
    const code = `
      def Test(): VNode {
        return [1, 2, 3]
      }
      Test()
    `;
    expectCompilationError(code, 'returns number[] but declared as VNode');
  });

  test('rejects nested conditionals with type mismatches', () => {
    const code = `
      def Test(a: boolean, b: boolean): VNode {
        if a {
          if b {
            <div>'Both true'</div>
          } else {
            return 42
          }
        } else {
          <span>'A is false'</span>
        }
      }
      Test(true, false)
    `;
    expectCompilationError(code, 'returns number but declared as VNode');
  });
});

describe('Type inference - negative tests', () => {
  test('rejects mismatched parameter types', () => {
    const code = `
      def add(a: number, b: number): number {
        return a + b
      }
      add('hello', 5)
    `;
    expectCompilationError(code, /string|number/);
  });

  test('rejects return type mismatch', () => {
    const code = `
      def getString(): string {
        return 42
      }
      getString()
    `;
    expectCompilationError(code, 'returns number but declared as string');
  });

  test('accepts correct types', () => {
    const code = `
      def add(a: number, b: number): number {
        return a + b
      }
      add(1, 2)
    `;
    expectCompiles(code);
  });

  test('rejects function with returns of different primitive types', () => {
    const code = `
      def Test(flag: boolean): number {
        if flag {
          return 42
        } else {
          return 'not a number'gi
        }
      }
      Test(true)
    `;
    expectCompilationError(code, /string|number/);
  });

  test('rejects function with if declared to return string but can return undefined', () => {
    const code = `
      def validatePassword(password: string): string {
        if !password {
          return 'Password is required'
        }
      }
      validatePassword('test')
    `;
    expectCompilationError(code, /undefined|declared as string/);
  });

  test('rejects function with if else declared to return string but can return undefined', () => {
    const code = `
      def validatePassword(password: string): string {
        if !password {
          return 'Password is required'
        } else {
          1 + 1
        }
      }
      validatePassword('test')
    `;
    expectCompilationError(code, /undefined|declared as string/);
  });
});



describe('Math operation type validation - negative tests', () => {
  test('rejects multiplication of number and string', () => {
    const code = `
      result = 1 * 'asdf'
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('rejects division of number and string', () => {
    const code = `
      result = 10 / 'text'
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('rejects subtraction of number and string', () => {
    const code = `
      result = 5 - 'number'
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('rejects modulo of number and string', () => {
    const code = `
      result = 20 % 'divisor'
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('rejects power operation of number and string', () => {
    const code = `
      result = 2 ^ 'exponent'
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('rejects string concatenation with incompatible types', () => {
    const code = `
      result = 'text' + {}
    `;
    expectCompilationError(code, /cannot|operator|object|string/i);
  });

  test('rejects addition of number and string (strict concatenation)', () => {
    const code = `
      result = 2 + 'text'
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('rejects addition of string and number (strict concatenation)', () => {
    const code = `
      result = 'text' + 2
    `;
    expectCompilationError(code, /cannot|operator|string|number/i);
  });

  test('accepts addition of boolean and number', () => {
    const code = `
      result = true + 5
    `;
    expectCompiles(code);
  });

  test('accepts standard math operations with numbers', () => {
    const code = `
      a = 10 + 5
      b = 20 - 3
      c = 4 * 5
      d = 100 / 10
      e = 17 % 5
      f = 2 ^ 8
    `;
    expectCompiles(code);
  });

  test('accepts string concatenation with addition', () => {
    const code = `
      greeting = 'Hello' + 'World'
    `;
    expectCompiles(code);
  });
});
