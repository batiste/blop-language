/**
 * Tests for return type inference with arithmetic expressions
 */

import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { findFunctionDefs } from '../testHelpers.js';

describe('Return type arithmetic expression inference', () => {
  
  it('should infer return type of 1 + 2 as number, not 1', () => {
    const code = `def test() {
    return 1 + 2
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    const funcDefs = findFunctionDefs(tree);
    expect(funcDefs.length).toBe(1);
    
    const funcName = funcDefs[0].named?.name;
    expect(funcName).toBeDefined();
    expect(funcName.value).toBe('test');
    // The function should be () => number, not () => 1
    expect(funcName.inferredType?.toString()).toBe('() => number');
  });

  it('should infer return type of literal arithmetic', () => {
    const code = `def add() {
    return 5 + 3
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    const funcDefs = findFunctionDefs(tree);
    expect(funcDefs.length).toBe(1);
    
    const funcName = funcDefs[0].named?.name;
    expect(funcName).toBeDefined();
    expect(funcName.value).toBe('add');
    // The return type of adding two literal numbers should be number
    expect(funcName.inferredType?.toString()).toBe('() => number');
  });

  it('should infer return type of multiplication', () => {
    const code = `def multiply() {
    return 3 * 4
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    const funcDefs = findFunctionDefs(tree);
    expect(funcDefs.length).toBe(1);
    
    const funcName = funcDefs[0].named?.name;
    expect(funcName).toBeDefined();
    expect(funcName.value).toBe('multiply');
    expect(funcName.inferredType?.toString()).toBe('() => number');
  });

});
