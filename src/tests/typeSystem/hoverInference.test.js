/**
 * Tests for AST hover information (inferredType stamping)
 */

import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { findNodesWithValue, findFunctionDefs } from '../testHelpers.js';

describe('AST Hover Information (inferredType)', () => {
  
  it('should stamp function name with its function type', () => {
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
    // Should show the full function type, not just the return type
    expect(funcName.inferredType?.toString()).toBe('() => number');
  });

  it('should stamp function name with undefined return type when no explicit return', () => {
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
    // Should show the full function type with undefined return
    expect(funcName.inferredType?.toString()).toBe('() => undefined');
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

  it('should stamp function name with return type from property access', () => {
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
    
    // The function name "profile" should have the return type of User
    // (because the function returns prof.user which is type User)
    const funcDefs = findFunctionDefs(tree);
    const profileFunc = funcDefs.find(f => f.named?.name?.value === 'profile');
    
    expect(profileFunc).toBeDefined();
    const funcName = profileFunc.named?.name;
    expect(funcName).toBeDefined();
    expect(funcName.value).toBe('profile');
    
    // The inferred type should be the User type with name, id, userType
    expect(funcName.inferredType).toBeDefined();
    const typeStr = funcName.inferredType.toString();
    expect(typeStr).toContain('name');
    expect(typeStr).toContain('id');
    expect(typeStr).toContain('userType');
    // Should NOT contain Profile-specific fields like verified or bio
    expect(typeStr).not.toContain('verified');
    expect(typeStr).not.toContain('bio');
  });

  const USER_TYPES = `type User = {
    name: string,
    id: number,
    userType?: "Admin" | "User"
}
`;

  it('should stamp type alias name in annotation with its resolved type (not "undefined")', () => {
    const code = USER_TYPES + `userAssignmentTest: User = { id: 1, name: "Alice" }`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // The 'User' token inside the annotation should resolve — not "undefined" or "any"
    const userNodes = findNodesWithValue(tree, ['User']);
    const annotationToken = userNodes.find(n => n.inferredType !== undefined);
    expect(annotationToken).toBeDefined();
    expect(annotationToken.inferredType.toString()).not.toBe('undefined');
    expect(annotationToken.inferredType.toString()).not.toBe('any');
  });

  it('should stamp variable name at definition site (not show raw node type "name")', () => {
    const code = USER_TYPES + `userAssignmentTest: User = { id: 1, name: "Alice" }`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    const varNodes = findNodesWithValue(tree, ['userAssignmentTest']);
    const defNode = varNodes.find(n => n.inferredType !== undefined);
    expect(defNode).toBeDefined();
    expect(defNode.inferredType).toBeDefined();
    expect(defNode.inferredType.toString()).not.toBe('name');
    expect(defNode.inferredType.toString()).not.toBe('undefined');
  });

  it('should stamp variable name at usage site inside function call argument', () => {
    const code = USER_TYPES + `userAssignmentTest: User = { id: 1, name: "Alice" }
console.log(userAssignmentTest)`;

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    // console.log('AST before inference:', JSON.stringify(tree, null, 2));
    inference(tree, stream);

    const varNodes = findNodesWithValue(tree, ['userAssignmentTest']);

    // There should be at least 2 nodes: one at definition, one at usage
    expect(varNodes.length).toBeGreaterThanOrEqual(2);

    expect(varNodes[0].inferredType).toBeDefined();
    // After tree inspection, we get func_call_params -> name_exp -> name,
    expect(varNodes[1].inferredType).toBeDefined();
    // Definition site shows the type alias name, usage site shows expanded type
    expect(varNodes[0].inferredType.toString()).toBe('User');
    expect(varNodes[1].inferredType.toString()).toBe('{id: number, name: string}');
  });

  it('should infer the correct type for arrow function returning VNode', () => {
    const code = `Test = (): VNode => {
    <p>'hello'</p>
}`
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find the 'Test' variable node and check its inferred type
    const testNodes = findNodesWithValue(tree, ['Test']);
    expect(testNodes.length).toBeGreaterThan(0);
    
    // The first 'Test' is the variable definition (assignment left side)
    const testVar = testNodes[0];
    expect(testVar.value).toBe('Test');
    expect(testVar.inferredType).toBeDefined();
    
    // Should resolve to a function type with VNode return type
    expect(testVar.inferredType.toString()).toBe('() => VNode');
  });

  it('should infer the correct type for function returning VNode', () => {
    const code = `def test1(): VNode {
    <p>'hello'</p>
}
result_1 = test1()`
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find the 'Test' variable node and check its inferred type
    const testNodes = findNodesWithValue(tree, ['result_1']);
    expect(testNodes.length).toBeGreaterThan(0);
    
    // The first 'Test' is the variable definition (assignment left side)
    const testVar = testNodes[0];
    expect(testVar.value).toBe('result_1');
    expect(testVar.inferredType).toBeDefined();
    
    // Should resolve to a function type with VNode return type
    const kindStr = testVar.inferredType.kind.toString();
    expect(kindStr).toBe('alias');
    expect(testVar.inferredType.name).toBe('VNode');
  });

  it('should infer the correct type when calling arrow function stored in variable', () => {
    const code = `Test = (): VNode => {
    <p>'hello'</p>
}
result_2 = Test()`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find result_2 variable and check it gets the return type VNode
    const resultNodes = findNodesWithValue(tree, ['result_2']);
    expect(resultNodes.length).toBeGreaterThan(0);
    
    const resultVar = resultNodes[0];
    expect(resultVar.value).toBe('result_2');
    expect(resultVar.inferredType).toBeDefined();
    
    // Should resolve to VNode (the return type of Test)
    expect(resultVar.inferredType.kind).toBe('alias');
    expect(resultVar.inferredType.name).toBe('VNode');
  });

  it('should stamp Test name with function type when arrow function is called', () => {
    const code = `Test = (): VNode => {
    <p>'hello'</p>
}
result_2 = Test()`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find all Test name nodes
    const testNodes = findNodesWithValue(tree, ['Test']);
    expect(testNodes.length).toBeGreaterThan(1); // At least definition and usage
    
    // The Test in Test() call should be stamped with the function type
    const testInCall = testNodes.find(n => 
      n.inferredType &&
      n.inferredType.kind === 'function'
    );
    expect(testInCall).toBeDefined();
    expect(testInCall.inferredType.returnType.name).toBe('VNode');
  });

  it('should stamp variable with its type when used in method call expression', () => {
    // Regression test for: hovering over variable in expressions like text.toUpperCase() should show type
    const code = `def test(text: string) {
  text
  text.toUpperCase()
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find all 'text' name nodes (should be 3: parameter + standalone + in method call)
    const textNodes = findNodesWithValue(tree, ['text']);
    expect(textNodes.length).toBe(3);
    
    // All text nodes should have their type stamped
    textNodes.forEach((node, i) => {
      expect(node.inferredType).toBeDefined(`text node ${i} should have inferredType`);
      expect(node.inferredType.toString()).toBe('string', `text node ${i} should be string type`);
    });
    
    // Specifically, the text in text.toUpperCase() (last one) should have type
    const textInMethodCall = textNodes[2];
    expect(textInMethodCall.value).toBe('text');
    expect(textInMethodCall.inferredType.toString()).toBe('string');
  });

  it('should stamp assignment result variable with method call return type', () => {
    // Regression test for: variable assigned from method call result should have correct type
    const code = `def test(vt: number) {
  result = vt.toString()
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find 'result' variable - should have string type from toString() return
    const resultNodes = findNodesWithValue(tree, ['result']);
    expect(resultNodes.length).toBeGreaterThan(0);
    
    const resultVar = resultNodes[0];
    expect(resultVar.inferredType).toBeDefined();
    expect(resultVar.inferredType.toString()).toBe('string');
  });

  it('should handle literal number variable in method call and show abstract type', () => {
    // Regression test for: literal-typed variables (e.g., vt = 5) should show number type in method calls
    const code = `def test() {
  vt: number = 5
  result = vt.toString()
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find 'vt' name nodes in method call
    const vtNodes = findNodesWithValue(tree, ['vt']);
    expect(vtNodes.length).toBeGreaterThan(0);
    
    // The vt variable should show type 'number', not the literal '5'
    vtNodes.forEach(node => {
      if (node.inferredType) {
        expect(node.inferredType.toString()).toBe('number');
      }
    });

    // Result should be string from toString()
    const resultNodes = findNodesWithValue(tree, ['result']);
    expect(resultNodes.length).toBeGreaterThan(0);
    const resultVar = resultNodes[0];
    expect(resultVar.inferredType.toString()).toBe('string');
  });

  it('should normalize object literal property types to abstract types', () => {
    // Regression test for: object property with literal value should infer abstract type
    const code = `type Attempt = { attempt: number, count: number }
obj: Attempt = { attempt: 1, count: 2 }`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find 'attempt' property nodes in the object literal
    const attemptNodes = findNodesWithValue(tree, ['attempt']);
    expect(attemptNodes.length).toBeGreaterThan(0);
    
    // The property should resolve to the type annotation, not literal
    const typeAnnotNodes = attemptNodes.filter(n => n.inferredType && n.inferredType.toString().includes('number'));
    expect(typeAnnotNodes.length).toBeGreaterThan(0);
  });

  it('should handle chained method calls with correct types', () => {
    // Additional regression test: ensure type tracking through method chains
    const code = `def test(text: string) {
  upper = text.toUpperCase()
  lower = upper.toLowerCase()
}`;
    
    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find variable assignments
    const upperNodes = findNodesWithValue(tree, ['upper']);
    const lowerNodes = findNodesWithValue(tree, ['lower']);
    
    expect(upperNodes.length).toBeGreaterThan(0);
    expect(lowerNodes.length).toBeGreaterThan(0);
    
    // Both should be string type from their respective method calls
    expect(upperNodes[0].inferredType.toString()).toBe('string');
    expect(lowerNodes[0].inferredType.toString()).toBe('string');
  });
});
