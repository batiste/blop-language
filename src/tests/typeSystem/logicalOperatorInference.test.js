import { describe, it, expect } from 'vitest';
import { compileSource } from '../../compile.js';
import { expectCompilationError } from '../testHelpers.js';

describe('Logical operator (|| and &&) type inference', () => {
  it('infers string for string || string', () => {
    const src = `def test(): string {
    a = 'asdf' || 'adfs'
    return a
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('infers number for number || number', () => {
    const src = `def test(): number {
    a = 1 || 2
    return a
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('infers string union number for string || number', () => {
    const src = `def test(): string|number {
    a = 'hello' || 42
    return a
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('warns when || result is returned as wrong type', () => {
    const src = `def test(): number {
    a = 'asdf' || 'adfs'
    return a
}`;
    expectCompilationError(src, 'string');
  });

  it('infers string for string && string', () => {
    const src = `def test(): string {
    a = 'hello' && 'world'
    return a
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('comparison operators still infer boolean', () => {
    const src = `def test(): boolean {
    a = 1 > 2
    return a
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });

  it('== still infers boolean', () => {
    const src = `def test(): boolean {
    a = 'x' == 'y'
    return a
}`;
    expect(() => compileSource(src, 'test.blop')).not.toThrow();
  });
});
