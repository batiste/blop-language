import { describe, test, expect } from 'vitest';
import { compileSource } from '../../compile.js';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { ObjectType } from '../../inference/Type.js';

function findNode(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  for (const key of Object.keys(node.named ?? {})) {
    const found = findNode(node.named[key], predicate);
    if (found) return found;
  }
  return null;
}

describe('new constructor expressions', () => {

  test('new UserClass() infers class instance type on assigned variable, not {}', () => {
    const src =
`class Router {
  routes: string[]
  def size(): number {
    return this.routes.length
  }
}
router = new Router()`;
    const stream = parser.tokenize(tokensDefinition, src);
    const ast = parser.parse(stream);
    inference(ast, stream, 'test.blop');

    // Find the assign node for `router`
    const assignNode = findNode(ast, n => n.type === 'assign' && n.named?.name?.value === 'router');
    expect(assignNode).not.toBeNull();

    // The name node's inferredType should be the Router class instance type
    const nameNode = assignNode.named.name;
    expect(nameNode.inferredType).toBeInstanceOf(ObjectType);
    expect(nameNode.inferredType.isClassInstance).toBe(true);
    // Should display as the class name, not as a structural `{}` type
    expect(nameNode.inferredType.toString()).toBe('Router');
  });


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

  test('constructor with function | null param does not produce false "Cannot assign ClassName to ClassName"', () => {
    // Regression test: when a class constructor has a `function | null` parameter, calling
    // `new ClassName(...)` must not emit "Cannot assign X to X".
    // Root cause: UnionType.isCompatibleWith(UnionType) was falling through to check each
    // constituent against the *whole* union (instead of against individual members), causing
    // FunctionType.isCompatibleWith(UnionType) to return false and poisoning the result.
    const code = `class Handler {
  def constructor(state: object, cb: function | null) {
    console.log(state, cb)
  }
}
def hello() {
  h = new Handler({ a: 1 }, null)
  return h
}`;
    const result = compileSource(code, 'test.blop', true);
    expect(result.success).toBe(true);
  });
});
