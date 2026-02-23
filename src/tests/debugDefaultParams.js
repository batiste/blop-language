import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { findNodes } from './debugUtils.js';

const src = `def f(x: number=5, y: number) { return x + y }`;
const stream = parser.tokenize(tokensDefinition, src);
const ast = parser.parse(stream);

const params = findNodes(ast, 'func_def_params');
for (const p of params) {
  const hasDefault = p.children?.some(c => c.type === 'exp');
  console.log('param:', p.named?.name?.value, 'hasDefault:', hasDefault, 'children types:', p.children?.map(c => c.type));
}
