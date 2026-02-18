/**
 * Tests for AST hover information (inferredType stamping)
 */

import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { findNodesWithValue, findFunctionDefs } from '../testHelpers.js';

describe('AST Hover Information (inferredType)', () => {
  
  it('should stamp function name with its return type', () => {
    const code = `def getValue(): number {
    return 42
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    const funcDefs = findFunctionDefs(tree);
    expect(funcDefs.length).toBe(1);
    
    const funcName = funcDefs[0].named?.name;
    expect(funcName).toBeDefined();
    expect(funcName.value).toBe('getValue');
    expect(funcName.inferredType?.toString()).toBe('number');
  });

  it('should stamp function name with undefined when no explicit return', () => {
    const code = `def doNothing() {
    x = 1
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    const funcDefs = findFunctionDefs(tree);
    expect(funcDefs.length).toBe(1);
    
    const funcName = funcDefs[0].named?.name;
    expect(funcName).toBeDefined();
    expect(funcName.value).toBe('doNothing');
    expect(funcName.inferredType?.toString()).toBe('undefined');
  });

  it('should stamp object parameter with resolved Profile type', () => {
    const code = `type User = {
    name: string,
    id: number,
    userType?: "Admin" | "User"
}

type Profile = {
    user: User,
    bio?: string,
    verified: boolean
}

def profile(prof: Profile) {
    return prof
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    // Find "prof" - should show the full Profile type definition
    const profNodes = findNodesWithValue(tree, ['prof']);
    expect(profNodes.length).toBe(2);
    const profInReturn = profNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString().includes('user') && 
      n.inferredType.toString().includes('verified')
    );
    
    expect(profInReturn).toBeDefined();
    // Should contain the Profile structure, not User structure
    expect(profInReturn.inferredType.toString()).toContain('user');
    expect(profInReturn.inferredType.toString()).toContain('verified');
    expect(profInReturn.inferredType.toString()).toContain('bio');
  });

  it('should stamp property access with correct resolved type', () => {
    const code = `type User = {
    name: string,
    id: number,
    userType?: "Admin" | "User"
}

type Profile = {
    user: User,
    bio?: string,
    verified: boolean
}

def profile(prof: Profile) {
    return prof.user
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);
    
    // prof should show Profile type (with user, verified, bio)
    const profNodes = findNodesWithValue(tree, ['prof']);
    const profNode = profNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString().includes('verified')
    );
    
    if (profNode) {
      // prof should have Profile type, NOT User type
      expect(profNode.inferredType.toString()).toContain('verified');
      expect(profNode.inferredType.toString()).not.toContain('userType');
    }
    
    // prof.user should show User type (with name, id, userType)
    const userNodes = findNodesWithValue(tree, ['user']);
    const userPropertyNode = userNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString().includes('userType')
    );
    
    expect(userPropertyNode).toBeDefined();
    expect(userPropertyNode.inferredType.toString()).toContain('name');
    expect(userPropertyNode.inferredType.toString()).toContain('id');
    expect(userPropertyNode.inferredType.toString()).toContain('userType');
    // Should NOT contain Profile-specific fields
    expect(userPropertyNode.inferredType.toString()).not.toContain('verified');
  });

});
