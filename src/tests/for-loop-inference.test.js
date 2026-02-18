const { expectCompilationError, expectCompiles } = require('./testHelpers');

describe('For-loop type inference - of keyword warnings', () => {
  test('warns when iterating array without of keyword', () => {
    const code = `
      def test() {
        items: string[] = ['a', 'b', 'c']
        result = ''
        
        for index, item of items {
          result := result + item
        }
        
        return result
      }
    `;
    expectCompilationError(
      code, 
      /Iterating array without 'of' keyword.*will be string/
    );
  });

  test("warns when iterating inferred array type without 'of'", () => {
    const code = `
      def test() {
        items = ['x', 'y', 'z']
        
        for index, item of items {
          console.log(index)
        }
      }
    `;
    expectCompilationError(
      code,
      /Iterating array without 'of' keyword/
    );
  });

  test("warns when iterating function returning array without 'of'", () => {
    const code = `
      def getItems(): string[] {
        return ['a', 'b', 'c']
      }
      
      def test() {
        items = getItems()
        
        for index, item of items {
          console.log(index)
        }
      }
    `;
    expectCompilationError(
      code,
      /Iterating array without 'of' keyword/
    );
  });

  test("no warning with 'of' keyword", () => {
    const code = `
      def test() {
        items: string[] = ['a', 'b', 'c']
        result = ''
        
        for index, item of items {
          result := result + item
        }
        
        return result
      }
    `;
    expectCompiles(code);
  });

  test("no warning for object iteration with 'in'", () => {
    const code = `
      def test() {
        obj = { a: 1, b: 2, c: 3 }
        result = 0
        
        for key, value in obj {
          result := result + value
        }
        
        return result
      }
    `;
    expectCompiles(code);
  });

  test('no warning when iterating without index variable', () => {
    const code = `
      def test() {
        items: number[] = [1, 2, 3]
        result = 0
        
        for item in items {
          result := result + item
        }
        
        return result
      }
    `;
    expectCompiles(code);
  });

  test('no warning for non-array types', () => {
    const code = `
      def test() {
        str = 'hello'
        
        for index, char in str {
          console.log(char)
        }
      }
    `;
    expectCompiles(code);
  });

  test('warns for function returning array type', () => {
    const code = `
      def getItems(): string[] {
        return ['a', 'b']
      }
      
      def test() {
        for index, item in getItems() {
          console.log(item)
        }
      }
    `;
    expectCompilationError(
      code,
      /Iterating array without 'of' keyword/
    );
  });

  test("no warning when function call with 'of' keyword", () => {
    const code = `
      def getItems(): string[] {
        return ['a', 'b']
      }
      
      def test() {
        for index, item of getItems() {
          console.log(item)
        }
      }
    `;
    expectCompiles(code);
  });
});

describe('For-loop variable type inference', () => {
  test('infers element type from array type', () => {
    const code = `
      def test() {
        items: string[] = ['a', 'b', 'c']
        
        for index, item of items {
          upper: string = item.toUpperCase()
        }
      }
    `;
    expectCompiles(code);
  });

  test('infers element type from typed array', () => {
    const code = `
      def test() {
        items: number[] = [1, 2, 3]
        
        for index, item of items {
          doubled: number = item * 2
        }
      }
    `;
    expectCompiles(code);
  });
});
