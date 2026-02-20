import { describe, it, expect } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Binary operator order - debugging', () => {
  it('number + string should fail', () => {
    const code = `
      value = 5
      result = value + 'a'
    `;
    expectCompilationError(code, 'Cannot apply');
  });

  it('string + number should fail', () => {
    const code = `
      value = 5
      result = 'a' + value
    `;
    expectCompilationError(code, 'Cannot apply');
  });

  it('with useState - number + string should fail', () => {
    const code = `
      def CounterDemo(_attributes, _children, node: Component): VNode {
        { value } = node.useState<number>('count', 0)
        result = value + 'a'
        return <div>value</div>
      }
    `;
    expectCompilationError(code, 'Cannot apply');
  });

  it('with useState - string + number should fail', () => {
    const code = `
      def CounterDemo(_attributes, _children, node: Component): VNode {
        { value } = node.useState<number>('count', 0)
        result = 'a' + value
        return <div>value</div>
      }
    `;
    expectCompilationError(code, 'Cannot apply');
  });
});
