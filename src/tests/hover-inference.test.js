/**
 * Tests for AST hover information (inferredType stamping)
 */

import { describe, it, expect } from 'vitest';
import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { inference } from '../inference/index.js';
import { findNodesWithValue, findFunctionDefs } from './testHelpers.js';

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
    expect(funcName.inferredType).toBe('number');
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
    expect(funcName.inferredType).toBe('undefined');
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
    const profInReturn = profNodes.find(n => 
      n.inferredType && 
      n.inferredType.includes('user') && 
      n.inferredType.includes('verified')
    );
    
    expect(profInReturn).toBeDefined();
    // Should contain the Profile structure, not User structure
    expect(profInReturn.inferredType).toContain('user');
    expect(profInReturn.inferredType).toContain('verified');
    expect(profInReturn.inferredType).toContain('bio');
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
      n.inferredType.includes('verified')
    );
    
    if (profNode) {
      // prof should have Profile type, NOT User type
      expect(profNode.inferredType).toContain('verified');
      expect(profNode.inferredType).not.toContain('userType');
    }
    
    // prof.user should show User type (with name, id, userType)
    const userNodes = findNodesWithValue(tree, ['user']);
    const userPropertyNode = userNodes.find(n => 
      n.inferredType && 
      n.inferredType.includes('userType')
    );
    
    expect(userPropertyNode).toBeDefined();
    expect(userPropertyNode.inferredType).toContain('name');
    expect(userPropertyNode.inferredType).toContain('id');
    expect(userPropertyNode.inferredType).toContain('userType');
    // Should NOT contain Profile-specific fields
    expect(userPropertyNode.inferredType).not.toContain('verified');
  });

});
