/**
 * Tests for primitive type method/property inference
 */

import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from './testHelpers.js';

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
});
