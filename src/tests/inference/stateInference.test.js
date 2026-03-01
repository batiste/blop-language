import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';

function find(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  if (Array.isArray(node.children)) node.children.forEach(c => find(c, pred, out));
  return out;
}

describe('ctx.state type inference from initial value', () => {
  it('infers boolean from false initial value', () => {
    const src = `
def TestStateInfer(ctx: Component): VNode {
  { value as done, setState } = ctx.state('done', false)
  <div>done</div>
}
`;
    const stream = parser.tokenize(tokensDefinition, src);
    const ast = parser.parse(stream);
    inference(ast, stream, 'test.blop');

    const doneNodes = find(ast, n => n.type === 'name' && n.value === 'done' && n.inferredType);
    expect(doneNodes.length).toBeGreaterThan(0);
    expect(doneNodes[0].inferredType.toString()).toBe('boolean');
  });

  it('infers number from 0 initial value', () => {
    const src = `
def TestStateInfer(ctx: Component): VNode {
  { value as count, setState } = ctx.state('count', 0)
  <div>count</div>
}
`;
    const stream = parser.tokenize(tokensDefinition, src);
    const ast = parser.parse(stream);
    inference(ast, stream, 'test.blop');

    const countNodes = find(ast, n => n.type === 'name' && n.value === 'count' && n.inferredType);
    expect(countNodes.length).toBeGreaterThan(0);
    expect(countNodes[0].inferredType.toString()).toBe('number');
  });

  it('infers string from string initial value', () => {
    const src = `
def TestStateInfer(ctx: Component): VNode {
  { value as name, setState } = ctx.state('name', 'hello')
  <div>name</div>
}
`;
    const stream = parser.tokenize(tokensDefinition, src);
    const ast = parser.parse(stream);
    inference(ast, stream, 'test.blop');

    const nameNodes = find(ast, n => n.type === 'name' && n.value === 'name' && n.inferredType);
    expect(nameNodes.length).toBeGreaterThan(0);
    expect(nameNodes[0].inferredType.toString()).toBe('string');
  });
});
