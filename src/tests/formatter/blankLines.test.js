import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('blank line normalization', () => {
  describe('collapses multiple blank lines to one', () => {
    it('collapses two blank lines (3 newlines) to one blank line', () => {
      expect(format('x = 1\n\n\ny = 2')).toBe('x = 1\n\ny = 2\n');
    });

    it('collapses three blank lines (4 newlines) to one blank line', () => {
      expect(format('x = 1\n\n\n\ny = 2')).toBe('x = 1\n\ny = 2\n');
    });

    it('collapses five blank lines to one blank line', () => {
      expect(format('x = 1\n\n\n\n\n\ny = 2')).toBe('x = 1\n\ny = 2\n');
    });

    it('preserves exactly one blank line between top-level statements', () => {
      expect(format('x = 1\n\ny = 2')).toBe('x = 1\n\ny = 2\n');
    });

    it('collapses blank lines between function definitions', () => {
      const src = 'def foo() {\n  return 1\n}\n\n\ndef bar() {\n  return 2\n}';
      expect(format(src)).toBe('def foo() {\n  return 1\n}\n\ndef bar() {\n  return 2\n}\n');
    });

    it('collapses blank lines inside a function body', () => {
      const src = 'def f() {\nx = 1\n\n\n\ny = 2\n}';
      expect(format(src)).toBe('def f() {\n  x = 1\n\n  y = 2\n}\n');
    });

    it('preserves a single blank line inside a function body', () => {
      const src = 'def f() {\nx = 1\n\ny = 2\n}';
      expect(format(src)).toBe('def f() {\n  x = 1\n\n  y = 2\n}\n');
    });

    it('collapses blank lines between class methods', () => {
      const src = 'class Foo {\ndef a() {\nreturn 1\n}\n\n\ndef b() {\nreturn 2\n}\n}';
      expect(format(src)).toBe('class Foo {\n  def a() {\n    return 1\n  }\n\n  def b() {\n    return 2\n  }\n}\n');
    });
  });

  describe('no trailing newline inflation', () => {
    it('ends with exactly one newline', () => {
      const result = format('x = 1');
      expect(result.endsWith('\n')).toBe(true);
      expect(result.endsWith('\n\n')).toBe(false);
    });

    it('ends with exactly one newline even for multi-statement source', () => {
      const result = format('x = 1\ny = 2');
      expect(result.endsWith('\n')).toBe(true);
      expect(result.endsWith('\n\n')).toBe(false);
    });
  });
});
