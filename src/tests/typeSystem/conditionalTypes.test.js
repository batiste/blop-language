import { describe, test } from 'vitest';
import { compileSource } from '../../compile.js';
import { dedent, expectCompiles, expectCompilationError } from '../testHelpers.js';

function compile(src) {
  return compileSource(dedent(src), 'test.blop', true);
}

describe('conditional types', () => {
  test('generic conditional resolves true branch', () => {
    expectCompiles(`
      type IsString<T> = T extends string => true else false
      x: IsString<string> = true
    `);
  });

  test('generic conditional resolves false branch', () => {
    expectCompiles(`
      type IsString<T> = T extends string => true else false
      x: IsString<number> = false
    `);
  });

  test('mismatched branch assignment errors', () => {
    expectCompilationError(
      `
        type IsString<T> = T extends string => true else false
        x: IsString<number> = true
      `,
      'Cannot assign true to IsString<number>'
    );
  });

  test('conditional can return never in false branch', () => {
    expectCompiles(`
      type OnlyString<T> = T extends string => T else never
      x: OnlyString<string> = 'ok'
    `);
  });

  test('conditional never false branch rejects values', () => {
    expectCompilationError(
      `
        type OnlyString<T> = T extends string => T else never
        x: OnlyString<number> = 1
      `,
      'Cannot assign 1 to OnlyString<number>'
    );
  });

  test('conditional can be used inside mapped utility composition', () => {
    const result = compile(`
      type IsString<T> = T extends string => true else false
      x = 1
    `);
    if (!result.success) {
      throw new Error(`Expected no errors but got: ${JSON.stringify(result.errors)}`);
    }
  });
});
