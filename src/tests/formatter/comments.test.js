import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('comment formatting', () => {
  describe('single-line comments (//)', () => {
    it('preserves a standalone top-level comment', () => {
      expect(format('// top comment\nx = 1')).toBe('// top comment\nx = 1\n');
    });

    it('preserves consecutive standalone comments', () => {
      expect(format('// line 1\n// line 2\nx = 1')).toBe('// line 1\n// line 2\nx = 1\n');
    });

    it('preserves a comment between two statements', () => {
      expect(format('x = 1\n// between\ny = 2')).toBe('x = 1\n// between\ny = 2\n');
    });

    it('indents a comment inside a function body', () => {
      expect(format('def f() {\n// check\nreturn 1\n}')).toBe('def f() {\n  // check\n  return 1\n}\n');
    });

    it('indents a comment inside an if block', () => {
      expect(format('def f() {\nif x {\n// branch\nreturn x\n}\n}')).toBe(
        'def f() {\n  if x {\n    // branch\n    return x\n  }\n}\n',
      );
    });

    it('preserves trailing inline comment after a scoped statement', () => {
      expect(format('def f() {\nreturn 1 // done\n}')).toBe('def f() {\n  return 1 // done\n}\n');
    });

    it('preserves trailing inline comment on second top-level statement', () => {
      // The grammar allows wcomment? after GLOBAL_STATEMENTS (but not the very first)
      expect(format('x = 1\ny = 2 // comment on second')).toBe('x = 1\ny = 2 // comment on second\n');
    });
  });

  describe('block comments (/* */)', () => {
    it('preserves a standalone top-level block comment', () => {
      expect(format('/* header */\nx = 1')).toBe('/* header */\nx = 1\n');
    });

    it('indents a block comment inside a function body', () => {
      expect(format('def f() {\n/* init */\nx = 0\nreturn x\n}')).toBe(
        'def f() {\n  /* init */\n  x = 0\n  return x\n}\n',
      );
    });

    it('preserves trailing inline block comment after a scoped statement', () => {
      expect(format('def f() {\nx = 0 /* zero */\nreturn x\n}')).toBe(
        'def f() {\n  x = 0 /* zero */\n  return x\n}\n',
      );
    });

    it('handles multiline block comment at top level', () => {
      const src = '/*\n * File header\n */\nx = 1';
      const result = format(src);
      expect(result).toContain('/*');
      expect(result).toContain('*/');
      expect(result).toContain('x = 1');
    });
  });

  describe('comment with blank lines', () => {
    it('keeps blank line before a comment', () => {
      const result = format('x = 1\n\n// section\ny = 2');
      expect(result).toContain('\n\n// section\n');
    });

    it('does not inflate blank lines around comments', () => {
      const result = format('x = 1\n\n\n// section\ny = 2');
      // Should collapse to at most 1 blank line before comment
      expect(result).toBe('x = 1\n\n// section\ny = 2\n');
    });
  });
});
