import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('this type inference inside class methods', () => {

  // ---------------------------------------------------------------------------
  // Basic: this.method() return type is inferred from annotation
  // ---------------------------------------------------------------------------

  test('this.method() resolves when method has annotated return type', () => {
    expectCompiles(`
      class Calc {
        def double(x: number): number {
          return x * 2
        }
        def run(x: number): number {
          return this.double(x)
        }
      }
    `);
  });

  test('this.method() return type flows into assignment', () => {
    expectCompiles(`
      class Greeter {
        def name(): string {
          return 'hello'
        }
        def greet(): string {
          result: string = this.name()
          return result
        }
      }
    `);
  });

  // ---------------------------------------------------------------------------
  // this.method() type mismatch is caught when method is annotated
  // ---------------------------------------------------------------------------

  test('assigning this.method() to wrong type produces a warning', () => {
    expectCompilationError(
      `
        class Calc {
          def double(x: number): number {
            return x * 2
          }
          def run(x: number) {
            result: string = this.double(x)
            return result
          }
        }
      `,
      /cannot assign|string.*number|number.*string/i,
    );
  });

  // ---------------------------------------------------------------------------
  // this.method() with unannotated method falls back to any (no false error)
  // ---------------------------------------------------------------------------

  test('this.method() on unannotated method compiles without error', () => {
    expectCompiles(`
      class Foo {
        def helper() {
          return 42
        }
        def run() {
          v = this.helper()
          return v
        }
      }
    `);
  });

  // ---------------------------------------------------------------------------
  // method declared return type is validated against actual body
  // ---------------------------------------------------------------------------

  test('method body return type is validated against declared type', () => {
    expectCompilationError(
      `
        class Foo {
          def greet(): number {
            return 'hello'
          }
        }
      `,
      /returns|number|string/i,
    );
  });

  // ---------------------------------------------------------------------------
  // this inside a plain function does NOT give class member access
  // ---------------------------------------------------------------------------

  test('this inside a plain function (not a class) still compiles', () => {
    // this inside a plain function resolves to AnyType - no inference, no error
    expectCompiles(`
      def standalone() {
        x = this
        return x
      }
    `);
  });

  // ---------------------------------------------------------------------------
  // Constructor-assigned properties (this.x = ...) must not produce false
  // "property does not exist" warnings — they are not tracked in the class type
  // ---------------------------------------------------------------------------

  test('constructor-assigned property accessed in another method does not warn', () => {
    expectCompiles(`
      class Counter {
        def constructor() {
          this.count = 0
          this.label = 'hits'
        }
        def increment() {
          this.count = this.count + 1
        }
        def getLabel() {
          return this.label
        }
      }
    `);
  });

  test('constructor-assigned property accessed on instance does not warn', () => {
    expectCompiles(`
      class Box {
        def constructor(value) {
          this.value = value
        }
        def get() {
          return this.value
        }
      }
      b = new Box(42)
      x = b.get()
    `);
  });

  // ---------------------------------------------------------------------------
  // Array methods called on declared class member arrays (this.arr.find etc.)
  // ---------------------------------------------------------------------------

  test('this.arr.find() inside a class method compiles without error', () => {
    expectCompiles(`
      type Item = { id: number, name: string }
      class Store {
        items: Item[]
        def constructor() {
          this.items = []
        }
        def findById(id: number) {
          return this.items.find((item) => item.id == id)
        }
      }
    `);
  });

  test('this.arr.filter() inside a class method compiles without error', () => {
    expectCompiles(`
      type Item = { id: number, name: string }
      class Store {
        items: Item[]
        def constructor() {
          this.items = []
        }
        def getAll() {
          return this.items.filter((item) => item.id > 0)
        }
      }
    `);
  });

  test('this.arr.push() inside a class method compiles without error', () => {
    expectCompiles(`
      type Route = { path: string, name: string }
      class Router {
        routes: Route[]
        def constructor() {
          this.routes = []
        }
        def add(route: Route) {
          this.routes.push(route)
        }
      }
    `);
  });

});
