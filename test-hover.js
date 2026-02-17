// Real test of what hover sees
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

// Find prof in the function body (not parameter)
const names = findAll(tree, 'name');
console.log('=== Looking for prof in function body ===');
let inBody = false;
names.forEach(n => {
  if (n.value === 'profile') inBody = true;
  if (inBody && n.value === 'prof') {
    console.log(`prof: ${n.inferredType}`);
    console.log(`  Has 'verified'? ${n.inferredType && n.inferredType.includes('verified')}`);
    console.log(`  Has 'userType'? ${n.inferredType && n.inferredType.includes('userType')}`);
  }
  if (inBody && n.value === 'user') {
    console.log(`user: ${n.inferredType}`);
    console.log(`  Has 'verified'? ${n.inferredType && n.inferredType.includes('verified')}`);
    console.log(`  Has 'userType'? ${n.inferredType && n.inferredType.includes('userType')}`);
  }
});
