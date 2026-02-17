/**
 * Tests for property assignment type checking
 */

import { describe, it, expect } from 'vitest';
import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { inference } from '../inference/index.js';

describe('Property Assignment Type Checking', () => {
  it('should error when assigning wrong type to object property', () => {
    const code = `type User = {
    name: string,
    id: number
}

def hello(u: User) {
    u.name = 1
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Cannot assign');
    expect(warnings[0].message).toContain('name');
  });

  it('should not error when assigning correct type to object property', () => {
    const code = `type User = {
    name: string,
    id: number
}

def hello(u: User) {
    u.name = "Alice"
    u.id = 42
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings).toHaveLength(0);
  });

  it('should error when assigning to union type property with wrong type', () => {
    const code = `type User = {
    name: string,
    userType?: "Admin" | "User"
}

def hello(u: User) {
    u.userType = "Blop"
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Cannot assign');
    expect(warnings[0].message).toContain('userType');
  });

  it('should work with imported types', () => {
    const code = `import User from "./types.blop"

def test(u: User) {
    u.name = 123
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream, 'src/tests/test.blop');
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Cannot assign');
  });

  it('should handle nested property assignments', () => {
    const code = `type User = {
    name: string,
    userType?: "Admin" | "User"
}

type Profile = {
    user: User,
    verified: boolean
}

def test(p: Profile) {
    p.user.userType = "Admin"
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    // Should not error - "Admin" is valid for userType
    expect(warnings).toHaveLength(0);
  });

  it('should error on nested property with wrong type', () => {
    const code = `type User = {
    name: string,
    userType?: "Admin" | "User"
}

type Profile = {
    user: User,
    verified: boolean
}

def test(p: Profile) {
    p.user.userType = "InvalidType"
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Cannot assign');
    expect(warnings[0].message).toContain('user.userType');
  });
});
