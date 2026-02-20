/**
 * Tests for primitive type method/property inference
 */

import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('Primitive type method inference', () => {
  describe('string methods', () => {
    test('string.toLowerCase() is allowed', () => {
      expectCompiles(`
        def test(s: string) {
          result: string = s.toLowerCase()
        }
      `);
    });

    test('string.toUpperCase() is allowed', () => {
      expectCompiles(`
        def test(s: string) {
          result: string = s.toUpperCase()
        }
      `);
    });

    test('string.trim() is allowed', () => {
      expectCompiles(`
        def test(s: string) {
          result: string = s.trim()
        }
      `);
    });

    test('string.length is a number', () => {
      expectCompiles(`
        def test(s: string) {
          result: number = s.length
        }
      `);
    });

    test('string.includes() returns boolean', () => {
      expectCompiles(`
        def test(s: string) {
          result: boolean = s.includes('x')
        }
      `);
    });

    test('accessing non-existent string method errors', () => {
      expectCompilationError(
        `
          def test(s: string) {
            result = s.notAMethod
          }
        `,
        'does not exist'
      );
    });
  });

  describe('Math methods', () => {
    test('Math.cos() result can be assigned to number', () => {
      expectCompiles(`
        def test() {
          result: number = Math.cos(0)
        }
      `);
    });

    test('Math.cos() result cannot be assigned to string', () => {
      expectCompilationError(
        `
          def test() {
            result: string = Math.cos(0)
          }
        `,
        'Cannot assign number to string'
      );
    });

    test('Math.PI can be assigned to number', () => {
      expectCompiles(`
        def test() {
          result: number = Math.PI
        }
      `);
    });

    test('Number.isNaN() returns boolean', () => {
      expectCompiles(`
        def test(x: number) {
          result: boolean = Number.isNaN(x)
        }
      `);
    });

    test('Number.isInteger() returns boolean', () => {
      expectCompiles(`
        def test(x: any) {
          result: boolean = Number.isInteger(x)
        }
      `);
    });

    test('Number.isFinite() returns boolean', () => {
      expectCompiles(`
        def test(x: any) {
          result: boolean = Number.isFinite(x)
        }
      `);
    });

    test('Number.isSafeInteger() returns boolean', () => {
      expectCompiles(`
        def test(x: any) {
          result: boolean = Number.isSafeInteger(x)
        }
      `);
    });

    test('Number.isNaN() result cannot be assigned to number', () => {
      expectCompilationError(
        `
          def test(x: number) {
            result: number = Number.isNaN(x)
          }
        `,
        'Cannot assign boolean to number'
      );
    });
  });

  describe('number methods', () => {
    test('number.toFixed() returns string', () => {
      expectCompiles(`
        def test(n: number) {
          result: string = n.toFixed(2)
        }
      `);
    });

    test('number.toString() returns string', () => {
      expectCompiles(`
        def test(n: number) {
          result: string = n.toString()
        }
      `);
    });

    test('accessing non-existent number method errors', () => {
      expectCompilationError(
        `
          def test(n: number) {
            result = n.notAMethod
          }
        `,
        'does not exist'
      );
    });
  });

  describe('console methods', () => {
    test('console.log() returns undefined', () => {
      expectCompiles(`
        def test() {
          result: undefined = console.log('message')
        }
      `);
    });

    test('console.error() returns undefined', () => {
      expectCompiles(`
        def test() {
          result: undefined = console.error('error')
        }
      `);
    });

    test('console.warn() returns undefined', () => {
      expectCompiles(`
        def test() {
          result: undefined = console.warn('warning')
        }
      `);
    });
  });

  describe('global functions', () => {
    test('isFinite() returns boolean', () => {
      expectCompiles(`
        def test(x: any) {
          result: boolean = isFinite(x)
        }
      `);
    });

    test('isNaN() returns boolean', () => {
      expectCompiles(`
        def test(x: any) {
          result: boolean = isNaN(x)
        }
      `);
    });

    test('parseInt() returns number', () => {
      expectCompiles(`
        def test(s: string) {
          result: number = parseInt(s, 10)
        }
      `);
    });

    test('parseFloat() returns number', () => {
      expectCompiles(`
        def test(s: string) {
          result: number = parseFloat(s)
        }
      `);
    });
  });

  describe('browser APIs', () => {
    test('setTimeout() returns number (timer id)', () => {
      expectCompiles(`
        def test(fn: any) {
          result: number = setTimeout(fn, 1000)
        }
      `);
    });

    test('setInterval() returns number (timer id)', () => {
      expectCompiles(`
        def test(fn: any) {
          result: number = setInterval(fn, 1000)
        }
      `);
    });

    test('clearTimeout() returns undefined', () => {
      expectCompiles(`
        def test(id: number) {
          result: undefined = clearTimeout(id)
        }
      `);
    });

    test('clearInterval() returns undefined', () => {
      expectCompiles(`
        def test(id: number) {
          result: undefined = clearInterval(id)
        }
      `);
    });

    test('alert() returns undefined', () => {
      expectCompiles(`
        def test() {
          result: undefined = alert('message')
        }
      `);
    });

    test('confirm() returns boolean', () => {
      expectCompiles(`
        def test() {
          result: boolean = confirm('Are you sure?')
        }
      `);
    });

    test('prompt() returns string | null', () => {
      expectCompiles(`
        def test() {
          result: string | null = prompt('Enter text')
        }
      `);
    });

    test('requestAnimationFrame() returns number', () => {
      expectCompiles(`
        def test(fn: any) {
          result: number = requestAnimationFrame(fn)
        }
      `);
    });

    test('cancelAnimationFrame() returns undefined', () => {
      expectCompiles(`
        def test(id: number) {
          result: undefined = cancelAnimationFrame(id)
        }
      `);
    });
  });
});
