// Tests for typed destructuring: { attributes: DogGameProps, children } = ctx
import { describe, test, expect } from 'vitest';
import { expectCompiles, expectCompilationError, findNodesWithValue } from '../testHelpers.js';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';

describe('typed destructuring', () => {
  test('annotation stamps the binding name node with the declared type alias', () => {
    // Use ctx: Component so Component.attributes = Record<string, any> — the real conflict
    const code = `
type DogGameProps = {
  score: number,
  attempt: number,
}
def DogGame(ctx: Component) {
  { attributes: DogGameProps, children } = ctx
}
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const nodes = findNodesWithValue(tree, ['attributes']);
    // The binding site node must be stamped DogGameProps, not Record<string, any>
    const stamped = nodes.find(n => n.inferredType?.toString() === 'DogGameProps');
    expect(stamped).toBeDefined();
    expect(stamped.inferredType.toString()).toBe('DogGameProps');
  });

  test('annotation type propagates to chained destructuring (the core use case)', () => {
    // Mirrors: def DogGame(ctx: Component) {
    //   { attributes: DogGameProps, children } = ctx
    //   { page, state } = attributes  ← attributes must resolve to DogGameProps
    const code = `
type DogGameProps = {
  page: { score: number, attempt: number },
  state: { counter: number },
}
def DogGame(ctx: Component) {
  { attributes: DogGameProps, children } = ctx
  { page, state } = attributes
}
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // The 'attributes' name in '{ page, state } = attributes' must NOT be Record<string, any>
    const attributesNodes = findNodesWithValue(tree, ['attributes']);
    const badNode = attributesNodes.find(n => n.inferredType?.toString() === 'Record<string, any>');
    expect(badNode).toBeUndefined();

    // 'page' binding must be typed as the DogGameProps.page type, not 'any'
    const pageNodes = findNodesWithValue(tree, ['page']);
    const anyPage = pageNodes.find(n => n.inferredType?.toString() === 'any');
    expect(anyPage).toBeUndefined();

    const typedPage = pageNodes.find(n => n.inferredType?.toString().includes('score'));
    expect(typedPage).toBeDefined();
  });

  test('unannotated bindings still infer from rhs', () => {
    const code = `
ctx = { score: 0, name: "hello" }
{ score, name } = ctx
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const scoreNode = findNodesWithValue(tree, ['score']).find(n => n.inferredType?.toString() === 'number');
    expect(scoreNode).toBeDefined();

    const nameNode = findNodesWithValue(tree, ['name']).find(n => n.inferredType?.toString() === 'string');
    expect(nameNode).toBeDefined();
  });

  test('annotation does not appear in compiled JS output', () => {
    expectCompiles(`
      type Props = { value: number }
      ctx = { attributes: { value: 1 }, rest: "ok" }
      { attributes: Props, rest } = ctx
    `);
  });

  test('type error when using annotated variable with wrong type', () => {
    expectCompilationError(`
      type DogGameProps = {
        score: number,
      }
      ctx = { attributes: { score: 0 }, children: [] }
      { attributes: DogGameProps, children } = ctx
      x: string = attributes.score
    `);
  });

  test('chained destructuring: type error on property of annotation-typed variable', () => {
    expectCompilationError(`
      type DogGameProps = {
        page: { score: number },
      }
      def check(ctx: Component) {
        { attributes: DogGameProps, children } = ctx
        { page } = attributes
        x: string = page.score
      }
    `);
  });
});
