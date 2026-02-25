import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('VNode type properties', () => {
  test('allows access to elm property on VNode', () => {
    const code = `
      input = <input type="text" />
      
      def test() {
        elem = input.elm
      }
    `;
    expectCompiles(code);
  });

  test('allows access to elm.value property chain on VNode', () => {
    const code = `
      input = <input type="text" />
      
      def test() {
        val = input.elm.value
      }
    `;
    expectCompiles(code);
  });

  test('allows assignment to elm.value on VNode', () => {
    const code = `
      input = <input type="text" />
      
      def test() {
        input.elm.value = 'hello'
      }
    `;
    expectCompiles(code);
  });

  test('allows access to data property on VNode', () => {
    const code = `
      node = <div />
      
      def test() {
        d = node.data
      }
    `;
    expectCompiles(code);
  });

  test('allows access to children property on VNode', () => {
    const code = `
      node = <div />
      
      def test() {
        c = node.children
      }
    `;
    expectCompiles(code);
  });
});

describe('VNode multiple children', () => {
  test('virtual_node_exp with multiple children on separate lines compiles', () => {
    // Regression: top-level virtual_node_exp (IIFE) must push a FUNCTION scope
    // so child virtual_node statements pass the MIN_FUNCTION_DEPTH guard.
    const code = `
      content = <div>
        <strong>'hello'</strong>
        'world'
      </div>
    `;
    expectCompiles(code);
  });

  test('inline multiple children gives a clear error message', () => {
    const code = `content = <div><strong>'hello'</strong>'world'</div>`;
    expectCompilationError(code, 'Multiple virtual node children must be on separate lines');
  });
});
