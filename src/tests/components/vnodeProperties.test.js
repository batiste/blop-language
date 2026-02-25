import { expectCompilationError, expectCompiles } from '../testHelpers.js';
import { compileSource } from '../../compile.js';

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

  test('virtual node inside string interpolation is an error', () => {
    const code = `x = <p>'hello'<span>'world'</span></p>`;
    expectCompilationError(code, 'virtual node cannot be used inside a string interpolation');
  });

  test('closing tag on a different line from inline content gives a clear error', () => {
    const code = `
      def f() {
        _a = <p>'hello'
        </p>
      }
    `;
    expectCompilationError(code, 'Closing tag must be on the same line as its inline content');
  });

  test('closing tag on different line with trailing expression also gives a clear error', () => {
    // <p>'text'a\n  </p> — 'text'a looks like an incomplete interpolation to the
    // parser; the error must still be attributed to the closing tag placement.
    const code = `
      def f() {
        a = 1
        <p>'text'a
        </p>
      }
    `;
    expectCompilationError(code, 'Closing tag must be on the same line as its inline content');
  });

  test('virtual_node_exp as assignment RHS does not pollute function return type', () => {
    // `_a = <p>...</p>` (inline) should NOT count as an implicit VNode return.
    const code = `
      def test(): number {
        _a = <p>'This is a test'</p>
        return 42
      }
    `;
    const result = compileSource(code.trim(), 'test.blop', true);
    const vnodeWarnings = (result.warnings ?? []).filter(w =>
      w.message && w.message.includes('VNode')
    );
    expect(vnodeWarnings).toHaveLength(0);
  });

  test('multiline virtual_node as assignment RHS does not pollute function return type', () => {
    // `_a = <p>\n  <span></span></p>` (multiline) should also NOT register as a
    // function return — neither the outer <p> nor the inner <span>.
    const code = `
      def test(): number {
        _a = <p>
          <span></span></p>
        return 1
      }
    `;
    const result = compileSource(code.trim(), 'test.blop', true);
    const vnodeWarnings = (result.warnings ?? []).filter(w =>
      w.message && w.message.includes('VNode')
    );
    expect(vnodeWarnings).toHaveLength(0);
  });
});
