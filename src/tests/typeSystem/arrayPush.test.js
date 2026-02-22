import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';

describe('Array push type checking', () => {
  it('warns when pushing a wrong type into a typed array', () => {
    const code = `type Route = { path: string }
r: Route[] = []
r.push(1)`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    expect(warnings.some(w => w.message.includes('push'))).toBe(true);
  });

  it('does not warn when pushing the correct type', () => {
    const code = `type Route = { path: string }
r: Route[] = []
r.push({ path: "/home" })`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    expect(warnings.some(w => w.message.includes('push'))).toBe(false);
  });

  it('warns when pushing a string into number[]', () => {
    const code = `nums: number[] = []
nums.push("hello")`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    expect(warnings.some(w => w.message.includes('push'))).toBe(true);
  });

  it('does not warn when pushing correct type into number[]', () => {
    const code = `nums: number[] = []
nums.push(42)`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    expect(warnings.some(w => w.message.includes('push'))).toBe(false);
  });
});
