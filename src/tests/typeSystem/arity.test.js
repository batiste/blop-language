import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Arity checking', () => {
  describe('rejects wrong argument counts for typed functions', () => {
    test('rejects too many arguments', () => {
      const code = `
        def add(a: number, b: number): number {
          return a + b
        }
        add(1, 2, 3)
      `;
      expectCompilationError(code, 'function add takes 2 arguments but got 3');
    });

    test('rejects too few arguments', () => {
      const code = `
        def add(a: number, b: number): number {
          return a + b
        }
        add(1)
      `;
      expectCompilationError(code, 'function add takes 2 arguments but got 1');
    });

    test('rejects zero arguments when arguments are required', () => {
      const code = `
        def greet(name: string): string {
          return name
        }
        greet()
      `;
      expectCompilationError(code, 'function greet takes 1 argument but got 0');
    });

    test('uses singular "argument" when there is exactly 1 required param', () => {
      const code = `
        def identity(x: number): number {
          return x
        }
        identity()
      `;
      expectCompilationError(code, 'takes 1 argument but got 0');
    });
  });

  describe('accepts correct argument counts', () => {
    test('accepts exact argument count', () => {
      const code = `
        def add(a: number, b: number): number {
          return a + b
        }
        add(1, 2)
      `;
      expectCompiles(code);
    });

    test('accepts single argument for single-param function', () => {
      const code = `
        def double(n: number): number {
          return n * 2
        }
        double(5)
      `;
      expectCompiles(code);
    });

    test('accepts zero arguments for zero-param function', () => {
      const code = `
        def zero(): number {
          return 0
        }
        zero()
      `;
      expectCompiles(code);
    });
  });

  describe('respects default parameter values', () => {
    test('accepts calling with all args when some have defaults', () => {
      const code = `
        def greet(name: string='World'): string {
          return name
        }
        greet('Alice')
      `;
      expectCompiles(code);
    });

    test('accepts calling with no args when all params have defaults', () => {
      const code = `
        def greet(name: string='World'): string {
          return name
        }
        greet()
      `;
      expectCompiles(code);
    });

    test('accepts calling with partial args when trailing params have defaults', () => {
      const code = `
        def range(start: number, end: number, step: number=1): number {
          return (end - start) / step
        }
        range(0, 10)
      `;
      expectCompiles(code);
    });

    test('rejects too many args even when some have defaults', () => {
      const code = `
        def greet(name: string='World'): string {
          return name
        }
        greet('Alice', 'extra')
      `;
      expectCompilationError(code, 'function greet takes 0-1 argument but got 2');
    });

    test('reports correct range in error when some params have defaults', () => {
      const code = `
        def range(start: number, end: number, step: number=1): number {
          return (end - start) / step
        }
        range()
      `;
      expectCompilationError(code, 'function range takes 2-3 arguments but got 0');
    });
  });

  describe('skips arity check for untyped functions', () => {
    test('does not warn when params have no type annotations', () => {
      // Untyped params (AnyType) indicate VNode/component functions whose
      // props are optional at the call site — arity check is intentionally skipped.
      const code = `
        def component(props) {
          <div>'hello'</div>
        }
        component()
      `;
      expectCompiles(code);
    });
  });
});
