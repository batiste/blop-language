import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('control flow formatting', () => {
  describe('if / elseif / else', () => {
    it('formats a simple if block', () => {
      expect(format('if x > 0 {\nreturn 1\n}')).toBe('if x > 0 {\n  return 1\n}\n');
    });

    it('formats if/else', () => {
      expect(format('if x > 0 {\nreturn 1\n} else {\nreturn 0\n}')).toBe(
        'if x > 0 {\n  return 1\n} else {\n  return 0\n}\n',
      );
    });

    it('formats if/elseif/else chain', () => {
      const src = 'if x > 0 {\nreturn 1\n} elseif x == 0 {\nreturn 0\n} else {\nreturn -1\n}';
      expect(format(src)).toBe('if x > 0 {\n  return 1\n} elseif x == 0 {\n  return 0\n} else {\n  return -1\n}\n');
    });

    it('formats multiple elseif branches', () => {
      const src = [
        'if grade >= 90 {',
        'result = "A"',
        '} elseif grade >= 80 {',
        'result = "B"',
        '} elseif grade >= 70 {',
        'result = "C"',
        '} else {',
        'result = "F"',
        '}',
      ].join('\n');
      const result = format(src);
      const lines = result.split('\n');
      // All branch lines should be at level 0
      expect(lines[0]).toBe('if grade >= 90 {');
      expect(lines[2]).toMatch(/^} elseif grade >= 80/);
      expect(lines[4]).toMatch(/^} elseif grade >= 70/);
      expect(lines[6]).toBe('} else {');
      // Body lines should be indented
      expect(lines[1]).toMatch(/^  result/);
    });

    it('formats nested if blocks', () => {
      const src = 'def f() {\nif a {\nif b {\nreturn 1\n}\n}\n}';
      expect(format(src)).toBe('def f() {\n  if a {\n    if b {\n      return 1\n    }\n  }\n}\n');
    });

    it('formats if with comment inside', () => {
      const src = 'if x {\n// comment\nreturn x\n}';
      expect(format(src)).toBe('if x {\n  // comment\n  return x\n}\n');
    });

    it('formats short-if expression', () => {
      expect(format('result = if active => "on" else "off"')).toBe('result = if active => "on" else "off"\n');
    });

    it('formats short-if expression in function', () => {
      expect(format('def f(x) {\nreturn if x > 0 => x else 0\n}')).toBe(
        'def f(x) {\n  return if x > 0 => x else 0\n}\n',
      );
    });
  });

  describe('for loops', () => {
    it('formats for-in loop', () => {
      expect(format('for item in items {\nconsole.log(item)\n}')).toBe(
        'for item in items {\n  console.log(item)\n}\n',
      );
    });

    it('formats for-of loop', () => {
      expect(format('for item of items {\nconsole.log(item)\n}')).toBe(
        'for item of items {\n  console.log(item)\n}\n',
      );
    });

    it('formats for with key and value (in)', () => {
      expect(format('for k, v in obj {\nconsole.log(k, v)\n}')).toBe(
        'for k, v in obj {\n  console.log(k, v)\n}\n',
      );
    });

    it('formats for with key and value (of)', () => {
      expect(format('for i, item of arr {\nconsole.log(i, item)\n}')).toBe(
        'for i, item of arr {\n  console.log(i, item)\n}\n',
      );
    });

    it('formats nested for loops', () => {
      const src = 'for row in rows {\nfor cell in row {\nprocess(cell)\n}\n}';
      expect(format(src)).toBe('for row in rows {\n  for cell in row {\n    process(cell)\n  }\n}\n');
    });

    it('formats for loop with break', () => {
      const src = 'for item in items {\nif item == null {\nbreak\n}\nprocess(item)\n}';
      expect(format(src)).toBe('for item in items {\n  if item == null {\n    break\n  }\n  process(item)\n}\n');
    });

    it('formats for loop with continue', () => {
      const src = 'for item in items {\nif item == null {\ncontinue\n}\nprocess(item)\n}';
      expect(format(src)).toBe('for item in items {\n  if item == null {\n    continue\n  }\n  process(item)\n}\n');
    });
  });

  describe('while loops', () => {
    it('formats a while loop', () => {
      expect(format('while x > 0 {\nx := x - 1\n}')).toBe('while x > 0 {\n  x := x - 1\n}\n');
    });

    it('formats a while loop with complex condition', () => {
      expect(format('while !done && count < 10 {\ncount := count + 1\n}')).toBe(
        'while !done && count < 10 {\n  count := count + 1\n}\n',
      );
    });

    it('formats a while loop inside a function', () => {
      const src = 'def countdown(n) {\nwhile n > 0 {\nn := n - 1\n}\n}';
      expect(format(src)).toBe('def countdown(n) {\n  while n > 0 {\n    n := n - 1\n  }\n}\n');
    });
  });

  describe('try / catch', () => {
    it('formats a basic try/catch', () => {
      expect(format('try {\nfoo()\n} catch e {\nconsole.error(e)\n}')).toBe(
        'try {\n  foo()\n} catch e {\n  console.error(e)\n}\n',
      );
    });

    it('formats try/catch inside a function', () => {
      const src = 'def load() {\ntry {\nreturn fetch(url)\n} catch err {\nreturn null\n}\n}';
      expect(format(src)).toBe(
        'def load() {\n  try {\n    return fetch(url)\n  } catch err {\n    return null\n  }\n}\n',
      );
    });

    it('formats try/catch with multiple statements in each block', () => {
      const src = 'try {\na = 1\nb = 2\n} catch e {\nlog(e)\nreturn\n}';
      expect(format(src)).toBe('try {\n  a = 1\n  b = 2\n} catch e {\n  log(e)\n  return\n}\n');
    });

    it('formats nested try/catch', () => {
      const src = 'try {\ntry {\nrisky()\n} catch inner {\nrecover()\n}\n} catch outer {\nfail()\n}';
      const result = format(src);
      const lines = result.split('\n');
      expect(lines[0]).toBe('try {');
      expect(lines[1]).toBe('  try {');
      expect(lines[2]).toBe('    risky()');
    });
  });
});
