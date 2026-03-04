import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

/**
 * Idempotency: format(format(src)) === format(src) for all valid Blop sources.
 * A formatter should be stable — running it twice produces the same output.
 */
describe('formatter idempotency', () => {
  function idempotent(src) {
    const first = format(src);
    const second = format(first);
    expect(second).toBe(first);
  }

  describe('simple statements', () => {
    it('is idempotent for a basic assignment', () => idempotent('x = 1'));
    it('is idempotent for a typed assignment', () => idempotent('x: number = 42'));
    it('is idempotent for a reassignment', () => idempotent('def f() {\nx := 2\n}'));
  });

  describe('functions', () => {
    it('is idempotent for a simple function', () =>
      idempotent('def greet(name) {\nreturn name\n}'));

    it('is idempotent for a typed function', () =>
      idempotent('def add(a: number, b: number): number {\nreturn a + b\n}'));

    it('is idempotent for an async function', () =>
      idempotent('async def fetchData() {\nresult = await api.get()\nreturn result\n}'));

    it('is idempotent for a nested function', () =>
      idempotent('def outer() {\ndef inner() {\nreturn 1\n}\nreturn inner()\n}'));

    it('is idempotent for an arrow function', () => idempotent('add = (a, b) => a + b'));
  });

  describe('control flow', () => {
    it('is idempotent for if/else', () =>
      idempotent('if x > 0 {\nreturn 1\n} else {\nreturn 0\n}'));

    it('is idempotent for if/elseif/else', () =>
      idempotent('if x > 0 {\nreturn 1\n} elseif x == 0 {\nreturn 0\n} else {\nreturn -1\n}'));

    it('is idempotent for a for-in loop', () =>
      idempotent('for item in items {\nconsole.log(item)\n}'));

    it('is idempotent for a while loop', () =>
      idempotent('while x > 0 {\nx := x - 1\n}'));

    it('is idempotent for try/catch', () =>
      idempotent('try {\nfoo()\n} catch e {\nconsole.error(e)\n}'));
  });

  describe('classes', () => {
    it('is idempotent for a class definition', () =>
      idempotent('class Foo {\ndef bar() {\nreturn 1\n}\n}'));

    it('is idempotent for a class with extends', () =>
      idempotent('class Dog extends Animal {\ndef speak() {\nreturn "woof"\n}\n}'));
  });

  describe('VNodes', () => {
    it('is idempotent for a self-closing tag', () =>
      idempotent('def C() {\n<input type="text" />\n}'));

    it('is idempotent for a tag with children', () =>
      idempotent('def C() {\n<div>\n<span>text</span>\n</div>\n}'));

    it('is idempotent for a deeply nested vnode', () =>
      idempotent('def C() {\n<section>\n<article>\n<p>content</p>\n</article>\n</section>\n}'));
  });

  describe('imports', () => {
    it('is idempotent for a named import', () =>
      idempotent('import { foo, bar } from "mod"'));

    it('is idempotent for a Blop namespace import', () =>
      idempotent("import 'pkg' as m"));
  });

  describe('type aliases', () => {
    it('is idempotent for a simple type alias', () => idempotent('type Id = number'));

    it('is idempotent for a multiline type alias', () =>
      idempotent('type Config = {\nhost: string,\nport: number\n}'));
  });

  describe('comments', () => {
    it('is idempotent for a standalone comment', () =>
      idempotent('// a comment\nx = 1'));

    it('is idempotent for a block comment', () =>
      idempotent('/* header */\nx = 1'));

    it('is idempotent for a comment inside a function', () =>
      idempotent('def f() {\n// init\nx = 0\nreturn x\n}'));
  });

  describe('blank lines', () => {
    it('is idempotent for a single blank line (does not add/remove)', () =>
      idempotent('x = 1\n\ny = 2'));

    it('is idempotent after collapsing multiple blank lines', () => {
      const src = 'x = 1\n\n\n\ny = 2';
      const first = format(src);
      // After first pass multiple blanks → one blank line
      expect(first).toBe('x = 1\n\ny = 2\n');
      // Second pass of already-formatted code is stable
      expect(format(first)).toBe(first);
    });
  });

  describe('already-formatted code is stable', () => {
    it('does not change already-formatted simple code', () => {
      const src = 'x = 1\n';
      expect(format(src)).toBe(src);
    });

    it('does not change already-formatted function', () => {
      const src = 'def greet(name) {\n  return name\n}\n';
      expect(format(src)).toBe(src);
    });

    it('does not change already-formatted nested structure', () => {
      const src = 'def f() {\n  if x > 0 {\n    return x\n  } else {\n    return 0\n  }\n}\n';
      expect(format(src)).toBe(src);
    });
  });
});
