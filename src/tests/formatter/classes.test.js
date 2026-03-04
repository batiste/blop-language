import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('class formatting', () => {
  describe('basic class definitions', () => {
    it('formats an empty class', () => {
      expect(format('class Foo {}')).toBe('class Foo {}\n');
    });

    it('formats a class with a single method', () => {
      expect(format('class Foo {\ndef bar() {\nreturn 1\n}\n}')).toBe(
        'class Foo {\n  def bar() {\n    return 1\n  }\n}\n',
      );
    });

    it('formats a class with multiple methods', () => {
      const src = 'class Calculator {\ndef add(a, b) {\nreturn a + b\n}\ndef sub(a, b) {\nreturn a - b\n}\n}';
      expect(format(src)).toBe(
        'class Calculator {\n  def add(a, b) {\n    return a + b\n  }\n  def sub(a, b) {\n    return a - b\n  }\n}\n',
      );
    });

    it('formats a class with an async method', () => {
      expect(format('class Api {\nasync def fetch(url) {\nresult = await load(url)\nreturn result\n}\n}')).toBe(
        'class Api {\n  async def fetch(url) {\n    result = await load(url)\n    return result\n  }\n}\n',
      );
    });
  });

  describe('class inheritance', () => {
    it('formats a class that extends another', () => {
      expect(format('class Dog extends Animal {\ndef speak() {\nreturn "woof"\n}\n}')).toBe(
        'class Dog extends Animal {\n  def speak() {\n    return "woof"\n  }\n}\n',
      );
    });

    it('formats an empty class with extends', () => {
      expect(format('class Cat extends Animal {}')).toBe('class Cat extends Animal {}\n');
    });
  });

  describe('class method signatures', () => {
    it('formats method with typed parameters', () => {
      const src = 'class Math {\ndef add(a: number, b: number): number {\nreturn a + b\n}\n}';
      expect(format(src)).toBe(
        'class Math {\n  def add(a: number, b: number): number {\n    return a + b\n  }\n}\n',
      );
    });

    it('formats method with no parameters', () => {
      expect(format('class State {\ndef reset() {\nvalue := 0\n}\n}')).toBe(
        'class State {\n  def reset() {\n    value := 0\n  }\n}\n',
      );
    });
  });

  describe('class with blank lines between methods', () => {
    it('preserves one blank line between methods', () => {
      const src = 'class Foo {\ndef a() {\nreturn 1\n}\n\ndef b() {\nreturn 2\n}\n}';
      const result = format(src);
      expect(result).toContain('  }\n\n  def b()');
    });

    it('collapses multiple blank lines between methods', () => {
      const src = 'class Foo {\ndef a() {\nreturn 1\n}\n\n\ndef b() {\nreturn 2\n}\n}';
      const result = format(src);
      // Should have at most one blank line
      expect(result).not.toContain('\n\n\n');
    });
  });

  describe('class with comments', () => {
    it('formats a comment before a method', () => {
      const src = 'class Foo {\n// sum two numbers\ndef add(a, b) {\nreturn a + b\n}\n}';
      expect(format(src)).toBe('class Foo {\n  // sum two numbers\n  def add(a, b) {\n    return a + b\n  }\n}\n');
    });
  });
});
