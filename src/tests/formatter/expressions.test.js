import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('expression and operator formatting', () => {
  describe('assignment operators', () => {
    it('formats plain assignment', () => {
      expect(format('x = 1')).toBe('x = 1\n');
    });

    it('formats explicit reassignment (:=)', () => {
      expect(format('def f() {\nx := 2\n}')).toBe('def f() {\n  x := 2\n}\n');
    });

    it('formats += operator', () => {
      expect(format('def f() {\nx += 1\n}')).toBe('def f() {\n  x += 1\n}\n');
    });

    it('formats -= operator', () => {
      expect(format('def f() {\nx -= 1\n}')).toBe('def f() {\n  x -= 1\n}\n');
    });

    it('formats *= operator', () => {
      expect(format('def f() {\nx *= 2\n}')).toBe('def f() {\n  x *= 2\n}\n');
    });
  });

  describe('typed variable declarations', () => {
    it('formats a typed string variable', () => {
      expect(format('x: string = "hello"')).toBe('x: string = "hello"\n');
    });

    it('formats a typed number variable', () => {
      expect(format('count: number = 0')).toBe('count: number = 0\n');
    });

    it('formats a typed boolean variable', () => {
      expect(format('flag: boolean = true')).toBe('flag: boolean = true\n');
    });

    it('formats a typed array variable', () => {
      expect(format('items: number[] = []')).toBe('items: number[] = []\n');
    });
  });

  describe('type aliases', () => {
    it('formats a simple type alias', () => {
      expect(format('type Id = number')).toBe('type Id = number\n');
    });

    it('formats an object type alias on one line', () => {
      expect(format('type Point = { x: number, y: number }')).toBe('type Point = { x: number, y: number }\n');
    });

    it('formats a multiline object type alias', () => {
      const src = 'type Config = {\nhost: string,\nport: number\n}';
      expect(format(src)).toBe('type Config = {\n  host: string,\n  port: number\n}\n');
    });

    it('formats a union type alias', () => {
      expect(format('type Status = "active" | "inactive" | "pending"')).toBe(
        'type Status = "active" | "inactive" | "pending"\n',
      );
    });

    it('formats a generic type alias', () => {
      expect(format('type Maybe<T> = T | null')).toBe('type Maybe<T> = T | null\n');
    });
  });

  describe('binary operators', () => {
    it('preserves spaces around comparison operators', () => {
      expect(format('x = a > b')).toBe('x = a > b\n');
      expect(format('x = a < b')).toBe('x = a < b\n');
      expect(format('x = a == b')).toBe('x = a == b\n');
      expect(format('x = a != b')).toBe('x = a != b\n');
    });

    it('preserves spaces around arithmetic operators', () => {
      expect(format('x = a + b')).toBe('x = a + b\n');
      expect(format('x = a - b')).toBe('x = a - b\n');
      expect(format('x = a * b')).toBe('x = a * b\n');
    });

    it('preserves spaces around logical operators', () => {
      expect(format('x = a && b')).toBe('x = a && b\n');
      expect(format('x = a || b')).toBe('x = a || b\n');
    });
  });

  describe('nullish coalescing and optional chaining', () => {
    it('formats nullish coalescing', () => {
      expect(format('name = user.name ?? "unknown"')).toBe('name = user.name ?? "unknown"\n');
    });

    it('formats optional chaining', () => {
      expect(format('x = obj?.prop')).toBe('x = obj?.prop\n');
    });

    it('formats chained optional access', () => {
      expect(format('x = user?.profile?.name')).toBe('x = user?.profile?.name\n');
    });

    it('formats optional chaining with nullish fallback', () => {
      expect(format('x = user?.name ?? "guest"')).toBe('x = user?.name ?? "guest"\n');
    });
  });

  describe('spread operator', () => {
    it('formats spread in function call', () => {
      expect(format('result = foo(...args)')).toBe('result = foo(...args)\n');
    });

    it('formats spread in array literal', () => {
      expect(format('all = [...a, ...b]')).toBe('all = [...a, ...b]\n');
    });
  });

  describe('unary operators', () => {
    it('formats logical negation', () => {
      expect(format('x = !flag')).toBe('x = !flag\n');
    });

    it('formats negation in condition', () => {
      expect(format('def f() {\nif !done {\nreturn\n}\n}')).toBe('def f() {\n  if !done {\n    return\n  }\n}\n');
    });
  });

  describe('object literals', () => {
    it('formats an inline object literal', () => {
      expect(format('x = { a: 1, b: 2 }')).toBe('x = { a: 1, b: 2 }\n');
    });

    it('formats a multiline object literal', () => {
      const src = 'x = {\na: 1,\nb: 2\n}';
      expect(format(src)).toBe('x = {\n  a: 1,\n  b: 2\n}\n');
    });

    it('formats an empty object literal', () => {
      expect(format('x = {}')).toBe('x = {}\n');
    });

    it('formats object with spread', () => {
      expect(format('merged = { ...base, extra: 1 }')).toBe('merged = { ...base, extra: 1 }\n');
    });

    it('formats object with string keys', () => {
      expect(format('x = { "key": 1 }')).toBe('x = { "key": 1 }\n');
    });
  });

  describe('array literals', () => {
    it('formats an inline array literal', () => {
      expect(format('x = [1, 2, 3]')).toBe('x = [1, 2, 3]\n');
    });

    it('formats an empty array literal', () => {
      expect(format('x = []')).toBe('x = []\n');
    });

    it('formats a multiline array literal', () => {
      const src = 'x = [\n1,\n2,\n3\n]';
      const result = format(src);
      expect(result.trim().includes('\n')).toBe(true);
      expect(result).toContain('1,');
    });
  });

  describe('destructuring', () => {
    it('formats simple object destructuring', () => {
      expect(format('{ x, y } = point')).toBe('{ x, y } = point\n');
    });

    it('formats destructuring with rename', () => {
      expect(format('{ name as alias } = obj')).toBe('{ name as alias } = obj\n');
    });

    it('formats destructuring with type annotation', () => {
      expect(format('{ count: number } = state')).toBe('{ count: number } = state\n');
    });
  });

  describe('template strings', () => {
    it('formats a template string', () => {
      expect(format('x = `hello ${name}`')).toBe('x = `hello ${name}`\n');
    });
  });

  describe('string interpolation (Blop-specific)', () => {
    it('formats Blop string interpolation', () => {
      expect(format("x = 'hello 'name")).toBe("x = 'hello 'name\n");
    });

    it('formats multi-part string interpolation', () => {
      expect(format("msg = 'count: 'count' items'")).toBe("msg = 'count: 'count' items'\n");
    });
  });

  describe('function calls', () => {
    it('formats a simple function call', () => {
      expect(format('foo()')).toBe('foo()\n');
    });

    it('formats a function call with arguments', () => {
      expect(format('result = foo(a, b, c)')).toBe('result = foo(a, b, c)\n');
    });

    it('formats a method call', () => {
      expect(format('result = arr.map(fn)')).toBe('result = arr.map(fn)\n');
    });

    it('formats nested function calls', () => {
      expect(format('result = outer(inner(x))')).toBe('result = outer(inner(x))\n');
    });

    it('breaks a very long function call across lines', () => {
      const longArg = 'a'.repeat(45);
      const src = `result = foo(${longArg}, ${longArg}, ${longArg})`;
      const result = format(src);
      expect(result.includes('\n')).toBe(true);
    });
  });

  describe('await expressions', () => {
    it('formats await inside an async function', () => {
      expect(format('async def f() {\nx = await load()\nreturn x\n}')).toBe(
        'async def f() {\n  x = await load()\n  return x\n}\n',
      );
    });
  });

  describe('new expressions', () => {
    it('formats new expression', () => {
      expect(format('err = new Error("oops")')).toBe('err = new Error("oops")\n');
    });
  });

  describe('delete expression', () => {
    it('formats delete expression', () => {
      expect(format('def f() {\ndelete obj.key\n}')).toBe('def f() {\n  delete obj.key\n}\n');
    });
  });
});
