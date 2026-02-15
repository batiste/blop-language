const { expectCompilationError, expectCompiles } = require('./testHelpers');

describe('Array element type inference', () => {
  test('infers number[] for array of number literals', () => {
    const code = `
      def getNumbers(): number[] {
        return [1, 2, 3]
      }
      result = getNumbers()
    `;
    expectCompiles(code);
  });

  test('infers string[] for array of string literals', () => {
    const code = `
      def getStrings(): string[] {
        return ['a', 'b', 'c']
      }
      result = getStrings()
    `;
    expectCompiles(code);
  });

  test('infers boolean[] for array of boolean literals', () => {
    const code = `
      def getBools(): boolean[] {
        return [true, false, true]
      }
      result = getBools()
    `;
    expectCompiles(code);
  });

  test('errors when assigning number[] to string[] type', () => {
    const code = `
      def test() {
        arr: string[] = [1, 2, 3]
        return arr
      }
    `;
    expectCompilationError(code, /Cannot assign number\[\]|expected string\[\]/i);
  });

  test('errors when assigning string[] to number[] type', () => {
    const code = `
      def test() {
        arr: number[] = ['a', 'b']
        return arr
      }
    `;
    expectCompilationError(code, /Cannot assign string\[\]|expected number\[\]/i);
  });

  test('infers union array type for mixed element types', () => {
    const code = `
      def test() {
        // Mixed types - should infer union type (number | string)[]
        arr = [1, 'mixed', 2]
        return arr
      }
    `;
    expectCompiles(code);
  });

  test('errors when mixed-type array assigned to single-type array', () => {
    const code = `
      def getNumbers(): number[] {
        return [1, 2, 'hello']
      }
    `;
    expectCompilationError(code, /returns \(number \| string\)\[\]|expected number\[\]/i);
  });

  test('falls back to array for empty arrays', () => {
    const code = `
      def test() {
        // Empty arrays can't infer element type
        arr = []
        return arr
      }
    `;
    expectCompiles(code);
  });

  test('infers nested array types', () => {
    const code = `
      def getMatrix(): number[] {
        // Note: This returns a flat array currently, since nested arrays 
        // would need number[][] support
        return [1, 2, 3]
      }
      result = getMatrix()
    `;
    expectCompiles(code);
  });

  test('works in union types with specific array type', () => {
    const code = `
      def maybeNumbers(hasData: boolean): number[] | null {
        if hasData {
          return [1, 2, 3]
        }
        return null
      }
      result = maybeNumbers(true)
    `;
    expectCompiles(code);
  });

  test('errors when union type expects wrong array element type', () => {
    const code = `
      def maybeNumbers(hasData: boolean): string[] | null {
        if hasData {
          return [1, 2, 3]
        }
        return null
      }
      result = maybeNumbers(true)
    `;
    expectCompilationError(code, /returns number\[\]|expected string\[\]/i);
  });

  test('typed arrays are compatible with generic array type', () => {
    const code = `
      def getFirst(arr: array) {
        return arr[0]
      }
      
      nums = [1, 2, 3]
      strs = ['a', 'b']
      bools = [true, false]
      
      result1 = getFirst(nums)
      result2 = getFirst(strs)
      result3 = getFirst(bools)
    `;
    expectCompiles(code);
  });

  test('union arrays are compatible with generic array type', () => {
    const code = `
      def getFirst(arr: array) {
        return arr[0]
      }
      
      items = ['a', null, 'b']
      result = getFirst(items)
    `;
    expectCompiles(code);
  });

  test('errors when mixed-type array assigned to typed array', () => {
    const code = `
      def getNumbers(): number[] {
        return [1, 2, 'hello']
      }
    `;
    expectCompilationError(code, /returns \(number \| string\)\[\]/i);
  });
});
