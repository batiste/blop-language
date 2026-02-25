/**
 * Tests for string interpolation (str_expression / inner_str_expression) type inference.
 *
 * Before the fix, str_expression had no inference handler so all child types
 * (embedded expression types, raw string tokens, etc.) were pushed individually
 * onto the parent exp's .inference array.  This caused the return-type checker
 * to bail out silently whenever a return expression was a string interpolation.
 */

import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { findFunctionDefs, expectCompilationError } from '../testHelpers.js';

describe('String interpolation type inference', () => {
  it('infers str_expression as string type', () => {
    const code = `name = 'Alice'
def greet() {
    return 'Hello 'name'!'
}`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const funcDefs = findFunctionDefs(tree);
    const greet = funcDefs.find(f => f.named?.name?.value === 'greet');
    expect(greet).toBeDefined();
    // Return type should be string, not some composite of child types
    expect(greet.named.name.inferredType?.toString()).toBe('() => string');
  });

  it('infers inner_str_expression (multi-interpolation) as string type', () => {
    const code = `first = 'John'
last = 'Doe'
def fullName() {
    return 'Hello 'first', 'last'!'
}`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const funcDefs = findFunctionDefs(tree);
    const f = funcDefs.find(fn => fn.named?.name?.value === 'fullName');
    expect(f).toBeDefined();
    expect(f.named.name.inferredType?.toString()).toBe('() => string');
  });

  it('warns when a function declared as number returns a string interpolation', () => {
    expectCompilationError(
      `def getName(): number {
    name = 'Alice'
    return 'Hello 'name'!'
}`,
      /returns string but declared as number/
    );
  });

  it('does not warn when a function declared as string returns a string interpolation', () => {
    const code = `def greet(): string {
    name = 'world'
    return 'Hello 'name'!'
}`;
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    expect(warnings.filter(w => w.message?.includes('returns'))).toHaveLength(0);
  });
});
