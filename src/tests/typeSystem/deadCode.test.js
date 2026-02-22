/**
 * Tests for dead code detection
 */

import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';

describe('Dead Code Detection', () => {
  it('should warn about unreachable code after exhaustive if/else that always returns', () => {
    const code = `def variableType(x: number, _y=5) {
    if (x > 10) {
        return "Greater than 10"
    } else {
        return 10 + _y
    }
    return "Impossible"
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    const deadWarning = warnings.find(w => w.message.includes('unreachable'));
    expect(deadWarning).toBeDefined();
  });

  it('should warn about unreachable code after an unconditional return', () => {
    const code = `def earlyReturn(x: number) {
    return x * 2
    return x + 1
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    const deadWarning = warnings.find(w => w.message.includes('unreachable'));
    expect(deadWarning).toBeDefined();
  });

  it('should not warn when if has no else branch (code can fall through)', () => {
    const code = `def conditionalReturn(x: number) {
    if (x > 10) {
        return "Greater than 10"
    }
    return "Default"
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    const deadWarning = warnings.find(w => w.message.includes('unreachable'));
    expect(deadWarning).toBeUndefined();
  });

  it('should not warn when there is no dead code', () => {
    const code = `def safe(x: number) {
    if (x > 10) {
        return "big"
    }
    return "small"
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    const deadWarning = warnings.find(w => w.message.includes('unreachable'));
    expect(deadWarning).toBeUndefined();
  });

  it('should warn for dead code in class methods', () => {
    const code = `class Foo {
    def bar(x: number) {
        if (x > 0) {
            return "positive"
        } else {
            return "non-positive"
        }
        return "unreachable"
    }
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    const deadWarning = warnings.find(w => w.message.includes('unreachable'));
    expect(deadWarning).toBeDefined();
  });

  it('should warn for dead code after throw', () => {
    const code = `def throwsFirst(x: number) {
    throw "Error"
    return x
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    const deadWarning = warnings.find(w => w.message.includes('unreachable'));
    expect(deadWarning).toBeDefined();
  });
});
