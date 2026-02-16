const { expectCompilationError, expectCompiles } = require('./testHelpers');

describe('For-loop type inference - :array annotation warnings', () => {
  test('warns when iterating array without :array annotation', () => {
    const code = `
      def test() {
        items: string[] = ['a', 'b', 'c']
        result = ''
        
        for index, item in items {
          result := result + item
        }
        
        return result
      }
    `;
    expectCompilationError(
      code, 
      /Iterating array without ':array' annotation.*will be string/
    );
  });

  test('warns when iterating inferred array type without :array', () => {
    const code = `
      def test() {
        items = ['x', 'y', 'z']
        
        for index, item in items {
          console.log(index)
        }
      }
    `;
    expectCompilationError(
      code,
      /Iterating array without ':array' annotation/
    );
  });

  test('warns when iterating function returning array without :array', () => {
    const code = `
      def getItems(): string[] {
        return ['a', 'b', 'c']
      }
      
      def test() {
        items = getItems()
        
        for index, item in items {
          console.log(index)
        }
      }
    `;
    expectCompilationError(
      code,
      /Iterating array without ':array' annotation/
    );
  });

  test('no warning with :array annotation', () => {
    const code = `
      def test() {
        items: string[] = ['a', 'b', 'c']
        result = ''
        
        for index, item in items: array {
          result := result + item
        }
        
        return result
      }
    `;
    expectCompiles(code);
  });

  test('no warning for object iteration without :array', () => {
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
      /Iterating array without ':array' annotation/
    );
  });

  test('no warning when function call with :array annotation', () => {
    const code = `
      def getItems(): string[] {
        return ['a', 'b']
      }
      
      def test() {
        for index, item in getItems(): array {
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
        
        for index, item in items: array {
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
        
        for index, item in items: array {
          doubled: number = item * 2
        }
      }
    `;
    expectCompiles(code);
  });
});
