import { describe, it, expect } from 'vitest';
import { compileSource } from '../../compile.js';
import { expectCompilationError } from '../testHelpers.js';

describe('delete operator type inference', () => {
  it('infers boolean for delete expression', () => {
    const src = `def test(): boolean {
    obj = { a: 1 }
    result = delete obj.a
    return result
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('warns when delete result is used as non-boolean', () => {
    const src = `def test(): number {
    obj = { a: 1 }
    result = delete obj.a
    return result
}`;
    expectCompilationError(src, 'boolean');
  });
});
