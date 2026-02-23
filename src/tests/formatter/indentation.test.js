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
});
