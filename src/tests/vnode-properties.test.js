const { expectCompilationError, expectCompiles } = require('./testHelpers');

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
