import { describe, test } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeSystemFile = (name) => join(__dirname, name);

describe('Function type annotations', () => {
  test('parses a single-param function type in a type alias', () => {
    expectCompiles(`
      type Handler = (x: number) => string
      h: Handler = (x) => 'hello'
    `);
  });

  test('parses a no-param function type', () => {
    expectCompiles(`
      type Callback = () => undefined
      cb: Callback = () => {}
    `);
  });

  test('parses a multi-param function type', () => {
    expectCompiles(`
      type Reducer = (state: number, action: string) => number
      r: Reducer = (state, action) => state
    `);
  });

  test('parses function type as an object property', () => {
    expectCompiles(`
      type Route = {
        path: string,
        handler?: (params: string, state: string) => void
      }
      r: Route = { path: '/home' }
    `);
  });

  test('parses function type as a variable annotation', () => {
    expectCompiles(`
      fn: (x: number) => boolean = (x) => x > 0
    `);
  });

  test('parses nested function type', () => {
    expectCompiles(`
      type Wrap = (cb: (n: number) => void) => boolean
      w: Wrap = (cb) => true
    `);
  });

  test('parses function type in a union', () => {
    expectCompiles(`
      type MaybeHandler = (x: string) => void | null
    `);
  });

  test('rejects assigning a string where a function type is expected', () => {
    expectCompilationError(`
      fn: (x: number) => boolean = 'notAFunction'
    `, '(x: number) => boolean');
  });
});

describe('Cross-file type alias resolution for class methods', () => {
  // Regression test: when a class is imported from another file, the type
  // aliases referenced by its method signatures must be available in the
  // importing file so that argument validation works correctly.

  test('accepts correct type passed to imported class method', () => {
    expectCompiles(`
      import { Store } from './classWithTypeAlias.blop'
      s = new Store()
      s.add({ id: 1, label: 'foo' })
    `, typeSystemFile('crossFileImport.blop'));
  });

  test('rejects wrong type passed to imported class method', () => {
    expectCompilationError(`
      import { Store } from './classWithTypeAlias.blop'
      s = new Store()
      s.add(42)
    `, 'add', typeSystemFile('crossFileImport.blop'));
  });
});
