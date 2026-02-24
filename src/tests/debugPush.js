import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { inference } from '../inference/index.js';

const code = `nums: number[] = []
nums.push("hello")`;

const stream = parser.tokenize(tokensDefinition, code);
const tree = parser.parse(stream);
const warnings = inference(tree, stream);
console.log('Warnings:', warnings.map(w => w.message));

function findNodes(node, type, results = []) {
  if (node?.type === type) results.push(node);
  node?.children?.forEach(c => findNodes(c, type, results));
  return results;
}

const accessNodes = findNodes(tree, 'object_access');
console.log('object_access nodes:', accessNodes.length);
accessNodes.forEach((n, i) => {
  const childTypes = n.children?.map(c => c.type + '(' + (c.value || '') + ')').join(', ');
  console.log(i, 'children:', childTypes);
  console.log(i, '__funcType:', n.__funcType ? n.__funcType.toString() : 'undefined');
  console.log(i, '__funcCallNode inference:', n.__funcCallNode?.inference);
  console.log(i, 'inference:', n.inference);
});
