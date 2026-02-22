/**
 * Tests for property access validation
 */

import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';

describe('Property Access Validation', () => {
  it('should error when accessing non-existent property', () => {
    const code = `type User = {
    name: string,
    id: number
}

def test(u: User) {
    return u.wrong
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Property');
    expect(warnings[0].message).toContain('wrong');
    expect(warnings[0].message).toContain('does not exist');
  });

  it('should not error when accessing existing property', () => {
    const code = `type User = {
    name: string,
    id: number
}

def test(u: User) {
    return u.name
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings).toHaveLength(0);
  });

  it('should error when passing non-existent property to function', () => {
    const code = `type Profile = {
    user: User,
    verified: boolean
}

type User = {
    name: string
}

def user(u: User) {
    return u.name
}

def profile(p: Profile) {
    user(p.wrong)
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Property');
    expect(warnings[0].message).toContain('wrong');
  });

  it('should validate nested property access', () => {
    const code = `type User = {
    name: string
}

type Profile = {
    user: User
}

def test(p: Profile) {
    return p.user.wrong
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Property');
    expect(warnings[0].message).toContain('wrong');
  });

  it('should error on chain through a class instance referenced via a type alias', () => {
    const code = `class Type2 {
  test: string[]
}

class User {
  route: { test: Type2 }
  def show() {
    this.route.test.asfsadfdsa
  }
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('asfsadfdsa');
    expect(warnings[0].message).toContain('does not exist');
  });

  it('should error on deeply nested chain through class instance fields', () => {
    const code = `class User {
  route: { test: string[] }
  def show() {
    this.route.test.asdfasdfds
  }
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('asdfasdfds');
    expect(warnings[0].message).toContain('does not exist');
  });

  it('should error when accessing non-existent property on class instance array field', () => {
    const code = `class User {
  route: string[]
  def constructor(route: string[]) {
    this.route = route
  }
  def show() {
    this.route.asdfsda
  }
}`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('asdfsda');
    expect(warnings[0].message).toContain('does not exist');
  });

  it('should error when accessing non-existent property on array type', () => {
    const code = `route: string[] = ['home', 'about', 'contact']
route.asdf`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('asdf');
    expect(warnings[0].message).toContain('does not exist');
  });

  it('should not error when accessing known array property', () => {
    const code = `route: string[] = ['home', 'about', 'contact']
route.length`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream);

    expect(warnings).toHaveLength(0);
  });

  it('should work with imported types', () => {
    const code = `import User from "./types.blop"

def test(u: User) {
    return u.nonExistent
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    const warnings = inference(tree, stream, 'src/tests/typeSystem/test.blop');
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Property');
    expect(warnings[0].message).toContain('nonExistent');
  });
});
