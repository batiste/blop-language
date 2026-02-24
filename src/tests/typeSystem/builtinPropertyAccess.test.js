import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Property access on builtin types', () => {
  test('warns when calling a non-existent method on a Component parameter', () => {
    const code = `
      def MyComp(ctx: Component): VNode {
        ctx.doesNotExist()
        <div></div>
      }
    `;
    expectCompilationError(code, "does not exist on type 'Component'");
  });

  test('warns when accessing a non-existent property on a Component parameter', () => {
    const code = `
      def MyComp(ctx: Component): VNode {
        x = ctx.doesNotExist
        <div></div>
      }
    `;
    expectCompilationError(code, "does not exist on type 'Component'");
  });

  test('accepts known Component method calls', () => {
    const code = `
      def MyComp(ctx: Component): VNode {
        ctx.mount(() => {})
        <div></div>
      }
    `;
    expectCompiles(code);
  });

  test('accepts known Component property access', () => {
    const code = `
      def MyComp(ctx: Component): VNode {
        { attributes } = ctx
        <div></div>
      }
    `;
    expectCompiles(code);
  });
});
