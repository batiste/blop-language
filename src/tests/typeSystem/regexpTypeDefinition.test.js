import { describe, test, expect } from 'vitest';
import { compileSource } from '../../compile.js';

describe('RegExp type definition - improved built-in type', () => {
  test('allows accessing RegExp properties', () => {
    const code = `pattern = /test/gi
source = pattern.source
flags = pattern.flags
global = pattern.global
ignoreCase = pattern.ignoreCase`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('allows calling RegExp.test method', () => {
    const code = `pattern = /test/
result = pattern.test('test string')`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('allows calling RegExp.exec method', () => {
    const code = `pattern = /test/
matches = pattern.exec('test string')`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('allows calling RegExp.toString method', () => {
    const code = `pattern = /test/
str = pattern.toString()`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('allows setting RegExp.lastIndex property', () => {
    const code = `pattern = /test/g
pattern.lastIndex = 5`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });

  test('RegExp in Type definitions works correctly', () => {
    const code = `type Route = { pattern: RegExp, handler: any }
route = { pattern: /users(.*)/, handler: (match) => match }`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });
});
