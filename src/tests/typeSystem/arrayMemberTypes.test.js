const { expectCompilationError, expectCompiles } = require('../testHelpers');

describe('Array member type tracking', () => {
  // -------------------------------------------------------------------------
  // .length
  // -------------------------------------------------------------------------

  test('arr.length infers as number', () => {
    const code = `
      nums: number[] = [1, 2, 3]
      n: number = nums.length
      n
    `;
    expectCompiles(code);
  });

  test('assigning arr.length to string is a type error', () => {
    const code = `
      nums: number[] = [1, 2, 3]
      s: string = nums.length
      s
    `;
    expectCompilationError(code, 'Cannot assign');
  });

  // -------------------------------------------------------------------------
  // Methods returning T | undefined (pop, shift, find, at)
  // -------------------------------------------------------------------------

  test('pop() returns element type (number | undefined)', () => {
    const code = `
      nums: number[] = [1, 2, 3]
      v = nums.pop()
      v
    `;
    expectCompiles(code);
  });

  // -------------------------------------------------------------------------
  // Methods returning T[] (filter, slice, reverse)
  // -------------------------------------------------------------------------

  test('filter() returns same array element type', () => {
    const code = `
      nums: number[] = [1, 2, 3]
      filtered: number[] = nums.filter((x) => x > 1)
      filtered
    `;
    expectCompiles(code);
  });

  test('slice() returns same array element type', () => {
    const code = `
      words: string[] = ['hello', 'world']
      sliced: string[] = words.slice(0, 1)
      sliced
    `;
    expectCompiles(code);
  });

  // -------------------------------------------------------------------------
  // Methods returning a fixed type (includes, indexOf, join)
  // -------------------------------------------------------------------------

  test('includes() returns boolean', () => {
    const code = `
      nums: number[] = [1, 2, 3]
      found: boolean = nums.includes(2)
      found
    `;
    expectCompiles(code);
  });

  test('indexOf() returns number', () => {
    const code = `
      nums: number[] = [1, 2, 3]
      idx: number = nums.indexOf(2)
      idx
    `;
    expectCompiles(code);
  });

  test('join() returns string', () => {
    const code = `
      words: string[] = ['a', 'b']
      s: string = words.join(', ')
      s
    `;
    expectCompiles(code);
  });

  // -------------------------------------------------------------------------
  // Type alias arrays resolve member types correctly (regression for issue #6)
  // -------------------------------------------------------------------------

  test('type alias of array[] resolves member types', () => {
    const code = `
      type Nums = number[]
      xs: Nums = [1, 2, 3]
      n: number = xs.length
      n
    `;
    expectCompiles(code);
  });
});
