const fs = require('fs');
const path = require('path');

const builtin = {
  Infinity: { type: 'Value' },
  NaN: { type: 'Value' },
  undefined: { type: 'Value' },
  null: { type: 'Value' },
  true: { type: 'Value' },
  false: { type: 'Value' },
  eval: { type: 'Function' },
  uneval: { type: 'Function' },
  isFinite: { type: 'Function' },
  isNaN: { type: 'Function' },
  parseFloat: { type: 'Function' },
  parseInt: {
    type: 'Function',
    documentation: 'The parseInt() function parses a string argument and returns an integer of the specified radix (the base in mathematical numeral systems).',
    detail: 'parseInt(string, radix);',
  },
  decodeURI: { type: 'Function' },
  decodeURIComponent: { type: 'Function' },
  encodeURI: { type: 'Function' },
  encodeURIComponent: { type: 'Function' },
  escape: { type: 'Function' },
  unescape: { type: 'Function' },
  Object: { type: 'Object' },
  Function: { type: 'Object' },
  Boolean: { type: 'Object' },
  Symbol: { type: 'Object' },
  Error: { type: 'Object' },
  EvalError: { type: 'Object' },
  InternalError: { type: 'Object' },
  RangeError: { type: 'Object' },
  ReferenceError: { type: 'Object' },
  SyntaxError: { type: 'Object' },
  TypeError: { type: 'Object' },
  URIError: { type: 'Object' },
  Number: { type: 'Object' },
  Math: { type: 'Object' },
  Date: { type: 'Object' },
  String: { type: 'Object' },
  RegExp: { type: 'Object' },
  Array: { type: 'Object' },
  Int8Array: { type: 'Object' },
  Uint8Array: { type: 'Object' },
  Uint8ClampedArray: { type: 'Object' },
  Int16Array: { type: 'Object' },
  Uint16Array: { type: 'Object' },
  Int32Array: { type: 'Object' },
  Uint32Array: { type: 'Object' },
  Float32Array: { type: 'Object' },
  Float64Array: { type: 'Object' },
  Map: { type: 'Object' },
  Set: { type: 'Object' },
  WeakMap: { type: 'Object' },
  WeakSet: { type: 'Object' },
  Promise: { type: 'Object' },
  Generator: { type: 'Object' },
  GeneratorFunction: { type: 'Object' },
  AsyncFunction: { type: 'Object' },
  Reflect: { type: 'Object' },
  Proxy: { type: 'Object' },
  arguments: { type: 'Object' },
  this: { type: 'Reference' },
  ArrayBuffer: { type: 'Object' },
  SharedArrayBuffer: { type: 'Object' },
  Atomics: { type: 'Object' },
  DataView: { type: 'Object' },
  JSON: { type: 'Object' },
};

const webapi = {
  setTimeout: { type: 'Function' },
  setInterval: { type: 'Function' },
  alert: { type: 'Function' },
  prompt: { type: 'Function' },
  fetch: { type: 'Function' },
  document: { type: 'Object' },
  console: { type: 'Object' },
  window: { type: 'Object' },
  history: { type: 'Object' },
};

const jestapi = {
  test: { type: 'Function', detail: 'test(description, Function) { ... }' },
  expect: { type: 'Function', detail: 'expect(expression).toBe(value)', documentation: 'https://jestjs.io/docs/en/expect' },
};

function generateAutoCompleteFile() {
  const all = {
    ...builtin, ...this, ...webapi, ...jestapi,
  };
  const keys = Object.keys(all);
  const output = ['module.exports = {'];
  keys.forEach((key) => {
    if (!this[key]) {
      return;
    }
    const properties = JSON.stringify(Object.getOwnPropertyNames(this[key]))
      .replace(/",/g, '", ')
      .replace(/'/g, "\\'")
      .replace(/"/g, "'");
    output.push(`  '${key}': ${properties},`);
  });
  const filename = path.resolve(__dirname, '../vscode/blop-linter/server/src/properties.js');
  output.push('};\n');
  fs.writeFileSync(filename, output.join('\n'), (err) => {
    if (err) {
      console.log(err);
    }
  });
}

module.exports = {
  generateAutoCompleteFile,
  builtin,
  webapi,
  jestapi,
};
