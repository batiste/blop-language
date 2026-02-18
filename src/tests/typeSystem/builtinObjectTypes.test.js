import { expectCompilationError, expectCompiles } from '../testHelpers.js';
import { describe, test } from 'vitest';

describe('Built-in object type properties', () => {
  describe('Math object', () => {
    test('allows access to Math.random', () => {
      const code = `
        def test() {
          val = Math.random()
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Math.floor', () => {
      const code = `
        def test() {
          val = Math.floor(3.7)
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Math.PI', () => {
      const code = `
        def test() {
          val = Math.PI
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Math.max', () => {
      const code = `
        def test() {
          val = Math.max(1, 2, 3)
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Math.sqrt', () => {
      const code = `
        def test() {
          val = Math.sqrt(16)
        }
      `;
      expectCompiles(code);
    });
  });

  describe('console object', () => {
    test('allows access to console.log', () => {
      const code = `
        def test() {
          console.log('hello')
        }
      `;
      expectCompiles(code);
    });

    test('allows access to console.error', () => {
      const code = `
        def test() {
          console.error('error message')
        }
      `;
      expectCompiles(code);
    });

    test('allows access to console.warn', () => {
      const code = `
        def test() {
          console.warn('warning')
        }
      `;
      expectCompiles(code);
    });

    test('allows access to console.table', () => {
      const code = `
        def test() {
          console.table([1, 2, 3])
        }
      `;
      expectCompiles(code);
    });
  });

  describe('JSON object', () => {
    test('allows access to JSON.parse', () => {
      const code = `
        def test() {
          obj = JSON.parse('{"key": "value"}')
        }
      `;
      expectCompiles(code);
    });

    test('allows access to JSON.stringify', () => {
      const code = `
        def test() {
          str = JSON.stringify({ key: 'value' })
        }
      `;
      expectCompiles(code);
    });
  });

  describe('Object constructor', () => {
    test('allows access to Object.keys', () => {
      const code = `
        def test() {
          keys = Object.keys({ a: 1, b: 2 })
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Object.values', () => {
      const code = `
        def test() {
          vals = Object.values({ a: 1, b: 2 })
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Object.entries', () => {
      const code = `
        def test() {
          entries = Object.entries({ a: 1, b: 2 })
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Object.assign', () => {
      const code = `
        def test() {
          result = Object.assign({}, { a: 1 }, { b: 2 })
        }
      `;
      expectCompiles(code);
    });
  });

  describe('Array constructor', () => {
    test('allows access to Array.isArray', () => {
      const code = `
        def test() {
          result = Array.isArray([1, 2, 3])
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Array.from', () => {
      const code = `
        def test() {
          result = Array.from('hello')
        }
      `;
      expectCompiles(code);
    });
  });

  describe('Number constructor', () => {
    test('allows access to Number.isNaN', () => {
      const code = `
        def test() {
          result = Number.isNaN(NaN)
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Number.MAX_VALUE', () => {
      const code = `
        def test() {
          val = Number.MAX_VALUE
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Number.parseInt', () => {
      const code = `
        def test() {
          val = Number.parseInt('42')
        }
      `;
      expectCompiles(code);
    });
  });

  describe('Promise constructor', () => {
    test('allows access to Promise.resolve', () => {
      const code = `
        def test() {
          p = Promise.resolve(42)
        }
      `;
      expectCompiles(code);
    });

    test('allows access to Promise.all', () => {
      const code = `
        def test() {
          p = Promise.all([Promise.resolve(1), Promise.resolve(2)])
        }
      `;
      expectCompiles(code);
    });
  });
});
