import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { inference } from '../inference/index.js';

const code = `type Route = { path: string }
r: Route[] = []
r.push(1)`;

const stream = parser.tokenize(tokensDefinition, code);
const tree = parser.parse(stream);
const warnings = inference(tree, stream);
console.log('Warnings:', warnings.map(w => w.message));
console.log('Has push:', warnings.some(w => w.message.includes('push')));

// Also debug class method
const code2 = `class Stack {
  items: number[]
  def add(n: number) {
    this.items.push(n)
  }
}
s: Stack = new Stack()
s.add("hello")`;

const stream2 = parser.tokenize(tokensDefinition, code2);
const tree2 = parser.parse(stream2);
const warnings2 = inference(tree2, stream2);
console.log('Class method warnings:', warnings2.map(w => w.message));
