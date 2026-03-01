/**
 * Tests for dynamic import() expression support
 */

import { describe, test, expect } from 'vitest';
import { compileSource } from '../compile.js';
import { expectCompiles } from './testHelpers.js';

describe('dynamic import()', () => {
  test('compiles import() as a standalone expression statement', () => {
    const result = compileSource(`import('./foo.blop')`, 'test.blop', true);
    expect(result.success).toBe(true);
    expect(result.code).toContain("import('./foo.blop')");
  });

  test('compiles import() assigned to a variable', () => {
    const result = compileSource(`mod = import('./foo.blop')`, 'test.blop', true);
    expect(result.success).toBe(true);
    expect(result.code).toContain("import('./foo.blop')");
  });

  test('compiles await import() inside an async function', () => {
    const result = compileSource(
      `async def load() {\n  mod = await import('./foo.blop')\n}`,
      'test.blop',
      true
    );
    expect(result.success).toBe(true);
    expect(result.code).toContain("import('./foo.blop')");
  });

  test('compiles import() inside a conditional branch', () => {
    const result = compileSource(
      `if true {\n  import('./foo.blop')\n}`,
      'test.blop',
      true
    );
    expect(result.success).toBe(true);
    expect(result.code).toContain("import('./foo.blop')");
  });

  test('registers import path as a dependency', () => {
    const result = compileSource(`import('./foo.blop')`, 'test.blop', true);
    expect(result.success).toBe(true);
    expect(result.dependencies).toContain("'./foo.blop'");
  });

  test('works with non-blop module paths', () => {
    expectCompiles(`import('./myModule.js')`);
  });

  test('works with package paths', () => {
    expectCompiles(`import('some-package')`);
  });
});
