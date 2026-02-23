import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('indentation normalization', () => {
  describe('default indent (2 spaces)', () => {
    it('indents function body', () => {
      expect(format(`def greet(name) {\nreturn name\n}`)).toBe(
        `def greet(name) {\n  return name\n}\n`
      );
    });

    it('normalises over-indented code', () => {
      expect(format(`def greet(name) {\n        return name\n}`)).toBe(
        `def greet(name) {\n  return name\n}\n`
      );
    });

    it('normalises tab-indented code', () => {
      expect(format(`def greet(name) {\n\treturn name\n}`)).toBe(
        `def greet(name) {\n  return name\n}\n`
      );
    });

    it('indents nested if/else blocks', () => {
      expect(format(`def check(x) {\nif x > 0 {\nreturn true\n} else {\nreturn false\n}\n}`)).toBe(
        `def check(x) {\n  if x > 0 {\n    return true\n  } else {\n    return false\n  }\n}\n`
      );
    });

    it('normalises over-indented nested blocks', () => {
      expect(format(`def check(x) {\n        if x > 0 {\n                return true\n        } else {\n                return false\n        }\n}`)).toBe(
        `def check(x) {\n  if x > 0 {\n    return true\n  } else {\n    return false\n  }\n}\n`
      );
    });

    it('preserves newlines between top-level definitions', () => {
      const result = format(`def foo(x) {\nreturn x\n}\ndef bar(x) {\nreturn x\n}`);
      expect(result).toBe(`def foo(x) {\n  return x\n}\ndef bar(x) {\n  return x\n}\n`);
    });
  });

  describe('custom indent config', () => {
    it('respects 4-space indent', () => {
      expect(format(`def greet(name) {\nreturn name\n}`, { indentSize: 4 })).toBe(
        `def greet(name) {\n    return name\n}\n`
      );
    });

    it('respects tab indent', () => {
      expect(format(`def greet(name) {\nreturn name\n}`, { indentChar: '\t', indentSize: 1 })).toBe(
        `def greet(name) {\n\treturn name\n}\n`
      );
    });
  });

  describe('operator preservation', () => {
    it('preserves := (explicit assign)', () => {
      expect(format(`def f() {\nx := 1\n}`)).toBe(
        `def f() {\n  x := 1\n}\n`
      );
    });

    it('preserves += (assign_op)', () => {
      expect(format(`def f() {\nx += 1\n}`)).toBe(
        `def f() {\n  x += 1\n}\n`
      );
    });
  });

  describe('blank lines', () => {
    it('preserves a single blank line between statements', () => {
      expect(format(`def f() {\nx = 1\n\ny = 2\n}`)).toBe(
        `def f() {\n  x = 1\n\n  y = 2\n}\n`
      );
    });
  });

  describe('VNode indentation', () => {
    it('indents VNode children', () => {
      expect(format(`def f() {\n<div>\n<span>'hi'</span>\n</div>\n}`)).toBe(
        `def f() {\n  <div>\n    <span>'hi'</span>\n  </div>\n}\n`
      );
    });

    it('indents nested VNodes', () => {
      expect(format(`def f() {\n<div>\n<section>\n<p>'text'</p>\n</section>\n</div>\n}`)).toBe(
        `def f() {\n  <div>\n    <section>\n      <p>'text'</p>\n    </section>\n  </div>\n}\n`
      );
    });
  });

  describe('line length breaking', () => {
    it('keeps short func calls on one line', () => {
      const result = format(`x = foo(a, b)`);
      expect(result.trim()).toBe(`x = foo(a, b)`);
    });

    it('breaks long func call args onto separate lines', () => {
      // Each arg is ~30 chars, total exceeds 120
      const longArg = 'a'.repeat(40);
      const src = `x = foo(${longArg}, ${longArg}, ${longArg})`;
      const result = format(src);
      expect(result.trim().includes('\n')).toBe(true);
    });

    it('keeps short object literals on one line', () => {
      const result = format(`x = { a: 1, b: 2 }`);
      expect(result.trim()).toBe(`x = { a: 1, b: 2 }`);
    });

    it('breaks long object literals', () => {
      const longVal = `'${'x'.repeat(50)}'`;
      const src = `x = { alpha: ${longVal}, beta: ${longVal} }`;
      const result = format(src);
      expect(result.trim().includes('\n')).toBe(true);
    });
  });
});
