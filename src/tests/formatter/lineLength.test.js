import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

const SHORT = { maxLineLength: 40 };

describe('line length breaking', () => {
  describe('function calls', () => {
    it('keeps short calls on one line', () => {
      expect(format(`result = foo(a, b)`, SHORT)).toBe(`result = foo(a, b)\n`);
    });

    it('breaks long call arguments onto separate lines', () => {
      expect(format(`result = someFunction(firstArgument, secondArgument, thirdArgument)`, SHORT)).toBe(
        `result = someFunction(\n  firstArgument,\n  secondArgument,\n  thirdArgument\n)\n`
      );
    });

    it('respects indentation level when breaking', () => {
      const src = `def check(x) {\nresult = someFunction(firstArgument, secondArgument, thirdArgument)\n}`;
      expect(format(src, SHORT)).toBe(
        `def check(x) {\n  result = someFunction(\n    firstArgument,\n    secondArgument,\n    thirdArgument\n  )\n}\n`
      );
    });
  });

  describe('array literals', () => {
    it('keeps short arrays on one line', () => {
      expect(format(`items = [a, b, c]`, SHORT)).toBe(`items = [a, b, c]\n`);
    });

    it('breaks long arrays onto separate lines', () => {
      expect(format(`items = [firstItem, secondItem, thirdItem, fourthItem]`, SHORT)).toBe(
        `items = [\n  firstItem,\n  secondItem,\n  thirdItem,\n  fourthItem\n]\n`
      );
    });
  });

  describe('object literals', () => {
    it('keeps short objects on one line', () => {
      expect(format(`cfg = { a: x, b: y }`, SHORT)).toBe(`cfg = { a: x, b: y }\n`);
    });

    it('breaks long objects onto separate lines', () => {
      expect(format(`cfg = { firstKey: firstValue, secondKey: secondValue, thirdKey: thirdValue }`, SHORT)).toBe(
        `cfg = {\n  firstKey: firstValue,\n  secondKey: secondValue,\n  thirdKey: thirdValue,\n}\n`
      );
    });
  });

  describe('default maxLineLength is 120', () => {
    it('does not break a 119-char line', () => {
      // "result = someFunction(" = 22 chars, ")" = 1, so 119 - 23 = 96 arg chars
      const longLine = `result = someFunction(${'a'.repeat(96)})`;
      const result = format(longLine);
      expect(result.trim().includes('\n')).toBe(false);
    });

    it('breaks a 121-char line', () => {
      // "result = someFunction(" = 22 chars, ")" = 1, so 121 - 23 = 98 arg chars
      const longLine = `result = someFunction(${'a'.repeat(98)})`;
      const result = format(longLine);
      expect(result.trim().includes('\n')).toBe(true);
    });
  });
});
