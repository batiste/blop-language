// Test parameter stamping
import parser from './src/parser.js';
import { tokensDefinition } from './src/tokensDefinition.js';
import { inference } from './src/inference/index.js';

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
    prof.user
}`;

const stream = parser.tokenize(tokensDefinition, code);
const tree = parser.parse(stream);
inference(tree, stream);

function findAll(node, type, results = []) {
  if (!node) return results;
  
  if (node.type === type) {
    results.push(node);
  }
  
  if (node.children) {
    node.children.forEach(child => findAll(child, type, results));
  }
  
  if (node.named) {
    Object.values(node.named).forEach(child => {
      if (child && typeof child === 'object') {
        findAll(child, type, results);
      }
    });
  }
  
  return results;
}

// Find the parameter def named prof
const params = findAll(tree, 'parameter');
console.log('=== Parameters ===');
params.forEach(p => {
  if (p.named && p.named.name) {
    const paramName = p.named.name.value;
    const paramType = p.named.name.inferredType;
    console.log(`Parameter: ${paramName}, inferredType: ${paramType}`);
    console.log(`  Stringified:`, JSON.stringify(paramType, null, 2));
  }
});
