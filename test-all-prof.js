// Find all prof nodes
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

function findAll(node, value, results = []) {
  if (!node) return results;
  
  if (node.type === 'name' && node.value === value) {
    results.push(node);
  }
  
  if (node.children) {
    node.children.forEach(child => findAll(child, value, results));
  }
  
  if (node.named) {
    Object.values(node.named).forEach(child => {
      if (child && typeof child === 'object') {
        findAll(child, value, results);
      }
    });
  }
  
  return results;
}

// Find all prof nodes
const profs = findAll(tree, 'prof');
console.log(`Found ${profs.length} prof nodes`);
profs.forEach((p, i) => {
  console.log(`\n=== prof node ${i} ===`);
  console.log(`inferredType: ${p.inferredType}`);
  console.log(`Has 'verified'? ${p.inferredType && p.inferredType.includes('verified')}`);
  console.log(`Has 'userType'? ${p.inferredType && p.inferredType.includes('userType')}`);
});
