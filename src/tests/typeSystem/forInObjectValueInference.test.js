import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { expectCompilationError } from '../testHelpers.js';

/**
 * Find all for_loop nodes in the AST.
 */
function findForLoops(tree) {
  const loops = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'for_loop') loops.push(node);
    if (node.children) node.children.forEach(walk);
  }
  walk(tree);
  return loops;
}

describe('for-in object value type inference', () => {
  it('infers number for value when all object properties are number', () => {
    const code = `obj: { a: number, b: number } = { a: 1, b: 2 }
for key, val in obj {
    x = val
}`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const [loop] = findForLoops(tree);
    expect(loop).toBeDefined();
    const valNode = loop.named?.value;
    expect(valNode).toBeDefined();
    expect(valNode.inferredType?.toString()).toBe('number');
  });

  it('infers string|number union for mixed-type object properties', () => {
    const code = `obj: { a: number, b: string } = { a: 1, b: 'hello' }
for key, val in obj {
    x = val
}`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const [loop] = findForLoops(tree);
    const valNode = loop.named?.value;
    expect(valNode?.inferredType?.toString()).toMatch(/number|string/);
  });

  it('warns when for-in value returned as wrong type', () => {
    expectCompilationError(
      `def test(obj: { a: number, b: number }): string {
    for key, val in obj {
        return val
    }
}`,
      /returns number but declared as string/
    );
  });

  it('does not warn about type mismatch when for-in value matches declared return type', () => {
    // The function may warn about `number | undefined` (loop might not run),
    // but it must NOT warn about an incompatible type like "number vs string".
    const code = `def test(obj: { a: number, b: number }): number {
    for key, val in obj {
        return val
    }
}`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    // No warning should say "returns number but declared as string" (type mismatch)
    const mismatchWarnings = warnings.filter(w => w.message?.includes('number but declared as string'));
    expect(mismatchWarnings).toHaveLength(0);
  });
});
