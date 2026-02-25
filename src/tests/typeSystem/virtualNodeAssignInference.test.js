import { describe, it, expect } from 'vitest';
import { compileSource } from '../../compile.js';

describe('virtual_node_assign type inference', () => {
  it('compiles virtual node assign without errors', () => {
    const src = `def Comp() {
    items = ['a', 'b', 'c']
    <div>
        = items
    </div>
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('compiles virtual node assign with a mapped expression', () => {
    const src = `def List() {
    nums = [1, 2, 3]
    <ul>
        = nums.map((n) => <li>n</li>)
    </ul>
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });
});
