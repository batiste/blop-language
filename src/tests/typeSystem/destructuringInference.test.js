import { describe, it, expect } from 'vitest';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import { inference } from '../../inference/index.js';
import { findNodesWithValue } from '../testHelpers.js';

describe('Destructuring type inference', () => {
  it('should infer destructured variable types from typed parameter', () => {
    const code = `
type Config = {
  total: number,
  text: string
}

def process(attributes: Config) {
  { total, text } = attributes
  return total
}
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find the destructured 'total' variable and check its inferred type
    const totalNodes = findNodesWithValue(tree, ['total']);
    const destructuredTotal = totalNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'number'
    );
    
    expect(destructuredTotal).toBeDefined();
    expect(destructuredTotal.inferredType.toString()).toBe('number');

    // Find the destructured 'text' variable and check its inferred type
    const textNodes = findNodesWithValue(tree, ['text']);
    const destructuredText = textNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'string'
    );
    
    expect(destructuredText).toBeDefined();
    expect(destructuredText.inferredType.toString()).toBe('string');
  });

  it('should infer destructured variable types from object literal', () => {
    const code = `
config = { count: 42, name: "test" }
{ count, name } = config
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find destructured 'count' and check it's inferred as number
    const countNodes = findNodesWithValue(tree, ['count']);
    const destructuredCount = countNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'number'
    );
    
    expect(destructuredCount).toBeDefined();
    expect(destructuredCount.inferredType.toString()).toBe('number');

    // Find destructured 'name' and check it's inferred as string
    const nameNodes = findNodesWithValue(tree, ['name']);
    const destructuredName = nameNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'string'
    );
    
    expect(destructuredName).toBeDefined();
    expect(destructuredName.inferredType.toString()).toBe('string');
  });

  it('should infer fat arrow function destructured parameters', () => {
    const code = `
type Stats = {
  total: number,
  average: number
}

computeStats = (data: Stats) => {
  { total, average } = data
  percentOfTotal = average / total
  return percentOfTotal
}
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find destructured 'total' in the assignment
    const totalNodes = findNodesWithValue(tree, ['total']);
    const destructuredTotal = totalNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'number'
    );
    
    expect(destructuredTotal).toBeDefined();
    expect(destructuredTotal.inferredType.toString()).toBe('number');

    // Find destructured 'average' in the assignment
    const avgNodes = findNodesWithValue(tree, ['average']);
    const destructuredAvg = avgNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'number'
    );
    
    expect(destructuredAvg).toBeDefined();
    expect(destructuredAvg.inferredType.toString()).toBe('number');
  });

  it('should infer optional properties in destructured assignment', () => {
    const code = `
type Options = {
  required: string,
  optional?: number
}

def configure(opts: Options) {
  { required, optional } = opts
  return required
}
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find destructured 'required' - should be string
    const requiredNodes = findNodesWithValue(tree, ['required']);
    const destructuredRequired = requiredNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'string'
    );
    
    expect(destructuredRequired).toBeDefined();
    expect(destructuredRequired.inferredType.toString()).toBe('string');

    // Find destructured 'optional' - should be number | undefined
    const optionalNodes = findNodesWithValue(tree, ['optional']);
    const destructuredOptional = optionalNodes.find(n => 
      n.inferredType && 
      (n.inferredType.toString() === 'number | undefined' || 
       n.inferredType.toString() === 'undefined | number')
    );
    
    expect(destructuredOptional).toBeDefined();
  });

  it('should infer complex object types in destructuring', () => {
    const code = `
type User = {
  name: string,
  id: number
}

type Response = {
  user: User,
  status: number
}

processResponse = (resp: Response) => {
  { user, status } = resp
  return user.name
}
    `.trim();

    const stream = parser.tokenize(tokensDefinition, code);
    const tree = parser.parse(stream);
    inference(tree, stream);

    // Find destructured 'user' - should be the User object type
    const userNodes = findNodesWithValue(tree, ['user']);
    const destructuredUser = userNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString().includes('name') &&
      n.inferredType.toString().includes('id')
    );
    
    expect(destructuredUser).toBeDefined();
    expect(destructuredUser.inferredType.toString()).toContain('name: string');
    expect(destructuredUser.inferredType.toString()).toContain('id: number');

    // Find destructured 'status' - should be number
    const statusNodes = findNodesWithValue(tree, ['status']);
    const destructuredStatus = statusNodes.find(n => 
      n.inferredType && 
      n.inferredType.toString() === 'number'
    );
    
    expect(destructuredStatus).toBeDefined();
    expect(destructuredStatus.inferredType.toString()).toBe('number');
  });
});
