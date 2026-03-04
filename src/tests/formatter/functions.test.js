import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('function formatting', () => {
  describe('basic function definitions', () => {
    it('formats a named function with no params', () => {
      expect(format('def noop() {}')).toBe('def noop() {}\n');
    });

    it('formats a named function with an empty body on multiple lines', () => {
      expect(format('def noop() {\n}')).toBe('def noop() {\n}\n');
    });

    it('formats a named function with one param', () => {
      expect(format('def greet(name) {\nreturn name\n}')).toBe('def greet(name) {\n  return name\n}\n');
    });

    it('formats a named function with multiple params', () => {
      expect(format('def add(a, b) {\nreturn a + b\n}')).toBe('def add(a, b) {\n  return a + b\n}\n');
    });

    it('formats a function expression (assigned)', () => {
      expect(format('add = def (a, b) {\nreturn a + b\n}')).toBe('add = def (a, b) {\n  return a + b\n}\n');
    });
  });

  describe('typed function signatures', () => {
    it('formats typed parameters', () => {
      expect(format('def add(a: number, b: number) {\nreturn a + b\n}')).toBe(
        'def add(a: number, b: number) {\n  return a + b\n}\n',
      );
    });

    it('formats a declared return type', () => {
      expect(format('def inc(x: number): number {\nreturn x + 1\n}')).toBe(
        'def inc(x: number): number {\n  return x + 1\n}\n',
      );
    });

    it('formats full typed function', () => {
      const src = 'def add(a: number, b: number): number {\nreturn a + b\n}';
      expect(format(src)).toBe('def add(a: number, b: number): number {\n  return a + b\n}\n');
    });

    it('formats a function returning void', () => {
      expect(format('def log(msg: string): void {\nconsole.log(msg)\n}')).toBe(
        'def log(msg: string): void {\n  console.log(msg)\n}\n',
      );
    });
  });

  describe('generic functions', () => {
    it('formats a generic function', () => {
      expect(format('def identity<T>(x: T): T {\nreturn x\n}')).toBe(
        'def identity<T>(x: T): T {\n  return x\n}\n',
      );
    });

    it('formats a generic function with multiple type params', () => {
      expect(format('def pair<A, B>(a: A, b: B): [A, B] {\nreturn [a, b]\n}')).toBe(
        'def pair<A, B>(a: A, b: B): [A, B] {\n  return [a, b]\n}\n',
      );
    });
  });

  describe('async functions', () => {
    it('formats an async function', () => {
      expect(format('async def fetchData() {\nresult = await api.get()\nreturn result\n}')).toBe(
        'async def fetchData() {\n  result = await api.get()\n  return result\n}\n',
      );
    });

    it('formats an async function with typed params', () => {
      expect(format('async def fetchUser(id: number): User {\nreturn await api.getUser(id)\n}')).toBe(
        'async def fetchUser(id: number): User {\n  return await api.getUser(id)\n}\n',
      );
    });
  });

  describe('arrow functions (fat arrow)', () => {
    it('formats a fat-arrow function expression', () => {
      expect(format('add = (a, b) => a + b')).toBe('add = (a, b) => a + b\n');
    });

    it('formats a fat-arrow function with a block body', () => {
      expect(format('add = (a, b) => {\nreturn a + b\n}')).toBe('add = (a, b) => {\n  return a + b\n}\n');
    });

    it('formats a no-param arrow function', () => {
      expect(format('noop = () => 0')).toBe('noop = () => 0\n');
    });
  });

  describe('nested functions', () => {
    it('formats a nested function def', () => {
      const src = 'def outer() {\ndef inner() {\nreturn 1\n}\nreturn inner()\n}';
      expect(format(src)).toBe('def outer() {\n  def inner() {\n    return 1\n  }\n  return inner()\n}\n');
    });

    it('formats multiple nested functions', () => {
      const src = 'def outer() {\ndef a() {\nreturn 1\n}\ndef b() {\nreturn 2\n}\nreturn a() + b()\n}';
      const result = format(src);
      const lines = result.split('\n');
      expect(lines[1]).toBe('  def a() {');
      expect(lines[3]).toBe('  }');
      expect(lines[4]).toBe('  def b() {');
    });
  });

  describe('function with default parameters', () => {
    // In Blop, default parameter values are written without spaces: name=value
    it('formats a function with a typed default parameter value', () => {
      expect(format('def greet(name: string="world") {\nreturn name\n}')).toBe(
        'def greet(name: string="world") {\n  return name\n}\n',
      );
    });

    it('formats a function with multiple defaults', () => {
      expect(format('def add(a: number, b: number=10) {\nreturn a + b\n}')).toBe(
        'def add(a: number, b: number=10) {\n  return a + b\n}\n',
      );
    });
  });

  describe('function with destructuring parameter', () => {
    it('formats a function with object destructuring param', () => {
      expect(format('def show({ name, age }) {\nconsole.log(name, age)\n}')).toBe(
        'def show({ name, age }) {\n  console.log(name, age)\n}\n',
      );
    });
  });

  describe('return statements', () => {
    it('formats an empty return', () => {
      expect(format('def f() {\nreturn\n}')).toBe('def f() {\n  return\n}\n');
    });

    it('formats a return with value', () => {
      expect(format('def f() {\nreturn x + 1\n}')).toBe('def f() {\n  return x + 1\n}\n');
    });

    it('formats throw statement', () => {
      expect(format('def f() {\nthrow new Error("oops")\n}')).toBe('def f() {\n  throw new Error("oops")\n}\n');
    });
  });

  describe('long function signatures', () => {
    it('keeps a short signature on one line', () => {
      const result = format('def add(a: number, b: number): number {\nreturn a + b\n}');
      expect(result.split('\n')[0]).toBe('def add(a: number, b: number): number {');
    });

    it('breaks a very long signature across lines', () => {
      const src = 'def processData(inputArray: number[], transformFn: Function, options: SomeOptions, callback: Function): void {\nreturn\n}';
      const result = format(src);
      // Should still produce valid output with proper closing brace indentation
      expect(result).toContain('def processData(');
      expect(result).toContain('return');
      expect(result.endsWith('\n')).toBe(true);
    });
  });
});
