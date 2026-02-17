/**
 * Tests for impossible literal comparison detection
 */

import { describe, it, expect } from 'vitest';
import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { inference } from '../inference/index.js';

describe('Impossible Comparison Detection', () => {
  it('should warn when comparing string literal type to non-member value', () => {
    const code = `type Status = "pending" | "approved" | "rejected"

def checkStatus(s: Status) {
  if s == "invalid" {
    return true
  }
  return false
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('will always be false');
    expect(warnings[0].message).toContain('"invalid"');
  });

  it('should not warn when comparing to valid union member', () => {
    const code = `type Status = "pending" | "approved" | "rejected"

def checkStatus(s: Status) {
  if s == "approved" {
    return true
  }
  return false
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings).toHaveLength(0);
  });

  it('should warn for number literal types', () => {
    const code = `type ErrorCode = 404 | 500 | 503

def handleError(code: ErrorCode) {
  if code == 200 {
    return "OK"
  }
  return "Error"
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('will always be false');
  });

  it('should work with imported types', () => {
    const code = `import { choices } from "./types.blop"

def testChoice(c: choices) {
  if c == "invalid" {
    return true
  }
  return false
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream, 'src/tests/test.blop');
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('will always be false');
  });

  it('should handle multiple valid values', () => {
    const code = `type Direction = "north" | "south" | "east" | "west"

def move(dir: Direction) {
  if dir == "north" {
    return "Going north"
  }
  if dir == "up" {
    return "Going up"
  }
  return "Going somewhere"
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    // Should not warn about "north" but should warn about "up"
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toContain('"up"');
  });

  it('should warn for property access with literal union type', () => {
    const code = `import User from "./types.blop"

def hello(u: User) {
  if u.userType == "Blop" {
    return "User type does not exist"
  }
  return "Valid user"
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream, 'src/tests/test.blop');
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('will always be false');
    expect(warnings[0].message).toContain('u.userType');
    expect(warnings[0].message).toContain('"Blop"');
  });
});
