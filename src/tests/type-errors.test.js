const { expectCompilationError, expectCompiles } = require('./testHelpers');

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
    expectCompilationError(code, "returns string but declared as VNode");
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
});

describe('Type inference - negative tests', () => {
  // TODO: Implement parameter type checking
  test.skip('rejects mismatched parameter types', () => {
    const code = `
      def add(a: number, b: number): number {
        return a + b
      }
      add('hello', 5)
    `;
    expectCompilationError(code, /string|number/);
  });

  // TODO: Fix string return type inference
  test.skip('rejects return type mismatch', () => {
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
});
