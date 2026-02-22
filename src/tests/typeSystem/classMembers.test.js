import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('class member type annotations', () => {

  // ---------------------------------------------------------------------------
  // Basic: member declarations with types
  // ---------------------------------------------------------------------------

  test('class member with type annotation compiles', () => {
    expectCompiles(`
      class Router {
        routes: string[]
        
        def constructor() {
          this.routes = []
        }
      }
    `);
  });

  test('class member with primitive type compiles', () => {
    expectCompiles(`
      class Counter {
        count: number
        
        def increment() {
          this.count = this.count + 1
        }
      }
    `);
  });

  test('class member with object type compiles', () => {
    expectCompiles(`
      type Config = {
        name: string,
        value: number
      }
      
      class Store {
        config: Config
        
        def constructor(c: Config) {
          this.config = c
        }
      }
    `);
  });

  test('multiple class members compile', () => {
    expectCompiles(`
      class User {
        name: string
        age: number
        email: string
        
        def constructor(n: string, a: number, e: string) {
          this.name = n
          this.age = a
          this.email = e
        }
      }
    `);
  });

  // ---------------------------------------------------------------------------
  // Type checking: member assignments respect declared types
  // ---------------------------------------------------------------------------

  test('assigning wrong type to member produces warning', () => {
    expectCompilationError(
      `
        class Counter {
          count: number
          
          def increment() {
            this.count = 'not a number'
          }
        }
      `,
      /cannot assign|string.*number|number.*string/i,
    );
  });

  test('assigning correct type to member does not produce warning', () => {
    expectCompiles(`
      class Counter {
        count: number
        
        def increment() {
          this.count = 42
        }
      }
    `);
  });

  test('member type accessed via property access must match', () => {
    expectCompilationError(
      `
        class Logger {
          level: number
          
          def checkLevel() {
            msg: string = this.level
          }
        }
      `,
      /cannot assign|string.*number|number.*string/i,
    );
  });

  // ---------------------------------------------------------------------------
  // Members with Array types
  // ---------------------------------------------------------------------------

  test('array member type is respected', () => {
    expectCompiles(`
      class Router {
        routes: object[]
        
        def constructor() {
          this.routes = []
        }
      }
    `);
  });

  test('array member assignment type checking works', () => {
    expectCompilationError(
      `
        class Collection {
          items: number[]
          
          def create() {
            this.items = ['string', 'not', 'numbers']
          }
        }
      `,
      /cannot assign|string.*number|number.*string/i,
    );
  });

  // ---------------------------------------------------------------------------
  // Members work alongside methods
  // ---------------------------------------------------------------------------

  test('class with members and methods compiles', () => {
    expectCompiles(`
      class Router {
        routes: object[]
        
        def constructor(initial: object[]) {
          this.routes = initial
        }
        
        def add(route: object) {
          this.routes.push(route)
        }
        
        def getAll(): object[] {
          return this.routes
        }
      }
    `);
  });

  test('this access to member in method respects type', () => {
    expectCompiles(`
      class Store {
        value: string
        
        def constructor(v: string) {
          this.value = v
        }
        
        def getValue(): string {
          return this.value
        }
      }
    `);
  });

  // ---------------------------------------------------------------------------
  // Union and intersection types as members
  // ---------------------------------------------------------------------------

  test('member with union type compiles', () => {
    expectCompiles(`
      class Flexible {
        data: string | number
        
        def constructor(v: string | number) {
          this.data = v
        }
      }
    `);
  });

  test('member with generic array type compiles', () => {
    expectCompiles(`
      type Item = {
        id: number,
        name: string
      }
      
      class ItemList {
        items: Item[]
        
        def constructor() {
          this.items = []
        }
      }
    `);
  });

});

describe('class instance method call argument validation', () => {
  test('accepts a correctly typed argument to a class method', () => {
    expectCompiles(`
      type Item = { id: number }
      class Store {
        def add(item: Item) {
          item.id
        }
      }
      s = new Store()
      s.add({ id: 1 })
    `);
  });

  test('rejects a wrong type passed to a class method after new', () => {
    expectCompilationError(`
      type Item = { id: number }
      class Store {
        def add(item: Item) {
          item.id
        }
      }
      s = new Store()
      s.add(1)
    `, 'add');
  });

  test('rejects a string passed to a method expecting a number', () => {
    expectCompilationError(`
      class Counter {
        def increment(by: number) {
          by
        }
      }
      c = new Counter()
      c.increment('a lot')
    `, 'increment');
  });
});
