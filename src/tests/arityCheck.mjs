import { compileSource } from '../compile.js';

function errors(code) {
  const r = compileSource(code.trim(), 'test.blop', true);
  return (r.errors || []).map(e => e.message);
}

const e1 = errors(`
def add(a: number, b: number): number {
  return a + b
}
add(1, 2, 3)
`);
console.log('too many:', e1.find(m => m.includes('takes 2 arguments but got 3')) ? 'PASS' : 'FAIL: ' + JSON.stringify(e1));

const e2 = errors(`
def add(a: number, b: number): number {
  return a + b
}
add(1)
`);
console.log('too few:', e2.find(m => m.includes('takes 2 arguments but got 1')) ? 'PASS' : 'FAIL: ' + JSON.stringify(e2));

const e3 = errors(`
def add(a: number, b: number): number {
  return a + b
}
add()
`);
console.log('zero args:', e3.find(m => m.includes('takes 2 arguments but got 0')) ? 'PASS' : 'FAIL: ' + JSON.stringify(e3));

const e4 = errors(`
def add(a: number, b: number): number {
  return a + b
}
add(1, 2)
`);
console.log('exact:', e4.length === 0 ? 'PASS' : 'FAIL: ' + JSON.stringify(e4));

const e5 = errors(`
def greet(name: string='World') {
  return name
}
greet()
`);
console.log('default param 0 args:', e5.length > 0 ? 'gets error (default params not handled): ' + e5[0] : 'ok (no error)');

const e6 = errors(`
def multiDefault(a: number, b: number=10) {
  return a + b
}
multiDefault(5)
`);
console.log('1 of 2 args (2nd default):', e6.length > 0 ? 'gets error: ' + e6[0] : 'ok (no error)');