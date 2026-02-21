import { describe, test, expect } from 'vitest';
import { compileSource } from '../../compile.js';

describe('new constructor expressions', () => {
  test('new RegExp() returns RegExp type', () => {
    const code = `type Route = { pattern: RegExp, handler: any }
a: Route = { pattern: new RegExp(''), handler: (m) => m }`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('new Date() returns appropriate type', () => {
    const code = `d = new Date()`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('multiple RegExp uses in type', () => {
    const code = `type Route = {
  path: string,
  name: string,
  handler?: any,
  reg?: RegExp,
  params?: string[]
}
a: Route = { path: '/users/:id', name: 'user', reg: new RegExp('') }`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });
});
