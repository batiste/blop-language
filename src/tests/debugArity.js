import { compileSource } from '../compile.js';

function check(label, code, expectError) {
  const result = compileSource(code.trim(), 'test.blop', true);
  const errors = result.errors?.map(e => e.message) || [];
  const matched = errors.some(e => e.includes(expectError));
  console.log(matched ? '✓' : '✗', label);
  if (!matched) console.log('  got:', errors);
}

check('too many args',
  `def add(a: number, b: number): number { return a + b }  add(1, 2, 3)`,
  'takes 2 arguments but got 3'
);

check('too few args',
  `def add(a: number, b: number): number { return a + b }  add(1)`,
  'takes 2 arguments but got 1'
);

check('zero args to 2-param fn',
  `def add(a: number, b: number): number { return a + b }  add()`,
  'takes 2 arguments but got 0'
);

check('exact args OK - no error',
  `def add(a: number, b: number): number { return a + b }  add(1, 2)`,
  'takes'  // should NOT appear -> we'll invert this
);

// invert: should compile fine
const okResult = compileSource(`def add(a: number, b: number): number { return a + b }  add(1, 2)`.trim(), 'test.blop', true);
console.log(okResult.success ? '✓ exact args compiles ok' : '✗ exact args failed: ' + okResult.errors?.map(e => e.message));
