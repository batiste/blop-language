/**
 * Broad fuzz tests: small targeted snippets across all language areas.
 * Goal: surface grammar, inference or codegen bugs before they reach users.
 */
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

// ─── 1. STRING INTERPOLATION ────────────────────────────────────────────────
describe('String interpolation', () => {
  test('bare name prefix', () => expectCompiles(`
    name = 'Alice'
    label = 'Hello 'name
  `));

  test('member access prefix (fixed bug)', () => expectCompiles(`
    type U = { name: string }
    def f(u: U): string {
      return u.name' here'
    }
  `));

  test('call result prefix', () => expectCompiles(`
    def f(s: string): string {
      return s.toUpperCase()' !'
    }
  `));

  test('multi-segment compound interpolation (fixed bug)', () => expectCompiles(`
    type U = { name: string, age: number }
    def f(u: U): string {
      return u.name' (age: 'u.age')'
    }
  `));

  test('deeply chained member prefix', () => expectCompiles(`
    type A = { b: { c: string } }
    def f(a: A): string {
      return a.b.c' done'
    }
  `));

  test('number variable in interpolation', () => expectCompiles(`
    n = 42
    result = 'value: 'n
  `));

  test('boolean variable in interpolation', () => expectCompiles(`
    b = true
    result = 'flag: 'b
  `));

  test('multi-part interpolation chain', () => expectCompiles(`
    a = 'foo'
    b = 'bar'
    result = 'a='a', b='b
  `));

  test('array index in prefix position', () => expectCompiles(`
    arr: string[] = ['x', 'y']
    result = 'first: 'arr[0]
  `));

  test('interpolation in if body returns string', () => expectCompiles(`
    def f(x: string): string {
      if x {
        return x' is truthy'
      }
      return 'empty'
    }
  `));

  test('arithmetic result in interpolation', () => expectCompiles(`
    def f(x: number, y: number): string {
      sum = x + y
      return 'sum='sum
    }
  `));

  test('compound interp infers string return type', () => expectCompiles(`
    def f(s: string): string {
      return s.toUpperCase()' done'
    }
  `));
});

// ─── 2. OBJECT TYPE COMPATIBILITY ───────────────────────────────────────────
describe('Object types', () => {
  test('string literal union field compiles (fixed bug)', () => expectCompiles(`
    type U = { role: 'admin' | 'viewer' }
    def f(u: U) {
      u
    }
    f({ role: 'admin' })
  `));

  test('wrong string literal rejected', () => expectCompilationError(`
    type U = { role: 'admin' | 'viewer' }
    def f(u: U) {
      u
    }
    f({ role: 'superuser' })
  `, 'role'));

  test('nested object match', () => expectCompiles(`
    type S = { info: { score: number } }
    def f(s: S) {
      s
    }
    f({ info: { score: 5 } })
  `));

  test('nested wrong type rejected', () => expectCompilationError(`
    type S = { info: { score: number } }
    def f(s: S) {
      s
    }
    f({ info: { score: 'bad' } })
  `, 'score'));

  test('extra property allowed (structural subtyping in call args)', () => expectCompiles(`
    type U = { name: string }
    def f(u: U) {
      u
    }
    f({ name: 'Alice', extra: 1 })
  `));

  test('missing property rejected', () => expectCompilationError(`
    type U = { name: string, id: number }
    def f(u: U) {
      u
    }
    f({ name: 'Alice' })
  `, ''));

  test('null property value allowed', () => expectCompiles(`
    type U = { name: string | null }
    def f(u: U) {
      u
    }
    f({ name: null })
  `));

  test('object with multiple string literal fields', () => expectCompiles(`
    type Config = { env: 'dev' | 'prod', level: 'low' | 'med' | 'high' }
    def f(c: Config) {
      c
    }
    f({ env: 'dev', level: 'high' })
  `));

  test('string literal in nested object', () => expectCompiles(`
    type A = { inner: { mode: 'x' | 'y' } }
    def f(a: A) {
      a
    }
    f({ inner: { mode: 'x' } })
  `));

  test('wrong string in nested object rejected', () => expectCompilationError(`
    type A = { inner: { mode: 'x' | 'y' } }
    def f(a: A) {
      a
    }
    f({ inner: { mode: 'z' } })
  `, 'mode'));

  test('numeric property arithmetic still works (no widening regression)', () => expectCompiles(`
    def f() {
      obj = { a: 1, b: 2, c: 3 }
      result = 0
      for k, v in obj {
        result := result + v
      }
      return result
    }
  `));

  test('full typed object with literal union passed as union nullable param', () => expectCompiles(`
    type U = { name: string, age: number, role: 'admin' | 'viewer' }
    def f(u: U | null) {
      u
    }
    f({ name: 'A', age: 30, role: 'admin' })
  `));

  test('object type with optional field accepts missing optional', () => expectCompiles(`
    type U = { name: string, age?: number }
    def f(u: U) {
      u
    }
    f({ name: 'Alice' })
  `));
});

// ─── 3. UNION TYPES & NARROWING ─────────────────────────────────────────────
describe('Union types & narrowing', () => {
  test('null guard narrows string|null to string', () => expectCompiles(`
    def f(x: string | null): string {
      if x {
        return x
      }
      return ''
    }
  `));

  test('literal union annotation', () => expectCompiles(`
    x: 'a' | 'b' = 'a'
  `));

  test('literal union wrong value rejected', () => expectCompilationError(`
    x: 'a' | 'b' = 'c'
  `, ''));

  test('type alias with string literal union', () => expectCompiles(`
    type S = 'on' | 'off'
    def f(s: S) {
      s
    }
    f('on')
  `));

  test('type alias wrong value rejected', () => expectCompilationError(`
    type S = 'on' | 'off'
    def f(s: S) {
      s
    }
    f('maybe')
  `, ''));

  test('typeof narrowing string branch', () => expectCompiles(`
    def f(x: string | number): string {
      if typeof x == 'string' {
        return x
      }
      return 'not a string'
    }
  `));
});

// ─── 4. GENERICS ────────────────────────────────────────────────────────────
describe('Generics', () => {
  test('generic array function', () => expectCompiles(`
    def first<T>(arr: T[]): T | null {
      if arr.length {
        return arr[0]
      }
      return null
    }
  `));

  test('wrong concrete type for generic param rejected', () => expectCompilationError(`
    def id<T>(x: T): T {
      return x
    }
    result: number = id('hello')
  `, ''));
});

// ─── 5. FOR LOOPS ───────────────────────────────────────────────────────────
describe('For loops', () => {
  test('array of loop accumulate numbers', () => expectCompiles(`
    def f(): number {
      items: number[] = [1, 2, 3]
      r = 0
      for item of items {
        r := r + item
      }
      return r
    }
  `));

  test('object for-in loop', () => expectCompiles(`
    def f(): number {
      obj = { a: 1, b: 2 }
      r = 0
      for k, v in obj {
        r := r + v
      }
      return r
    }
  `));

  test('string array loop', () => expectCompiles(`
    def f(): string {
      items: string[] = ['a', 'b']
      r = ''
      for item of items {
        r := r + item
      }
      return r
    }
  `));
});

// ─── 6. FUNCTIONS ───────────────────────────────────────────────────────────
describe('Functions', () => {
  test('explicit return type match', () => expectCompiles(`
    def f(): number {
      return 42
    }
  `));

  test('explicit return type mismatch rejected', () => expectCompilationError(`
    def f(): number {
      return 'hello'
    }
  `, ''));

  test('multi-path return types agree', () => expectCompiles(`
    def f(x: boolean): string {
      if x {
        return 'yes'
      }
      return 'no'
    }
  `));

  test('nullable return type', () => expectCompiles(`
    def f(x: boolean): number | null {
      if x {
        return 1
      }
      return null
    }
  `));

  test('higher-order function param', () => expectCompiles(`
    def apply(fn: (x: number) => number, val: number): number {
      return fn(val)
    }
  `));

  test('void function no annotation', () => expectCompiles(`
    def f() {
      x = 1
    }
  `));

  test('function returning lambda', () => expectCompiles(`
    def makeAdder(n: number): (x: number) => number {
      return (x) => x + n
    }
  `));

  test('immediately called lambda', () => expectCompiles(`
    result = ((x) => x * 2)(5)
  `));
});

// ─── 7. OPTIONAL CHAINING & NULLISH ─────────────────────────────────────────
describe('Optional chaining & nullish coalescing', () => {
  test('nested optional property chain', () => expectCompiles(`
    type U = { addr: { city: string } | null }
    def f(u: U): string {
      return u.addr?.city ?? 'unknown'
    }
  `));

  test('optional method call on nullable', () => expectCompiles(`
    def f(s: string | null): string {
      return s?.toUpperCase() ?? ''
    }
  `));

  test('nullish coalesce string', () => expectCompiles(`
    def f(x: string | null): string {
      return x ?? 'default'
    }
  `));

  test('nullish coalesce number', () => expectCompiles(`
    def f(x: number | null): number {
      return x ?? 0
    }
  `));
});

// ─── 8. ARRAYS ──────────────────────────────────────────────────────────────
describe('Arrays', () => {
  test('push to typed array', () => expectCompiles(`
    def f(): number[] {
      arr: number[] = []
      arr.push(1)
      return arr
    }
  `));

  test('typed empty array literal', () => expectCompiles(`
    arr: string[] = []
  `));

  test('nested 2D array', () => expectCompiles(`
    mat: number[][] = [[1, 2], [3, 4]]
  `));

  test('map lambda', () => expectCompiles(`
    nums: number[] = [1, 2, 3]
    doubled = nums.map((n) => n * 2)
  `));

  test('filter lambda', () => expectCompiles(`
    nums: number[] = [1, 2, 3]
    big = nums.filter((n) => n > 1)
  `));

  test('wrong push type rejected', () => expectCompilationError(`
    arr: number[] = []
    arr.push('hello')
  `, ''));

  test('typed array index access', () => expectCompiles(`
    arr: string[] = ['a', 'b']
    x: string = arr[0]
  `));
});

// ─── 9. KEYOF & TYPE ALIASES ────────────────────────────────────────────────
describe('keyof & type aliases', () => {
  test('valid keyof annotation', () => expectCompiles(`
    type U = { name: string, age: number }
    k: keyof U = 'name'
  `));

  test('invalid keyof value rejected', () => expectCompilationError(`
    type U = { name: string, age: number }
    k: keyof U = 'email'
  `, ''));

  test('chained type aliases resolve through', () => expectCompiles(`
    type A = string
    type B = A
    x: B = 'hello'
  `));

  test('union alias usage', () => expectCompiles(`
    type Dir = 'left' | 'right'
    def f(d: Dir) {
      d
    }
    f('left')
  `));
});

// ─── 10. ARITHMETIC & OPERATORS ─────────────────────────────────────────────
describe('Arithmetic & operators', () => {
  test('number arithmetic', () => expectCompiles(`
    def f(): number {
      return 1 + 2 * 3
    }
  `));

  test('comparison returns boolean', () => expectCompiles(`
    def f(x: number): boolean {
      return x > 5
    }
  `));

  test('string + number rejects', () => expectCompilationError(`
    def f(): number {
      return 1 + 'hello'
    }
  `, ''));

  test('string concatenation', () => expectCompiles(`
    result = 'a' + 'b'
  `));
});

// ─── 11. TYPE CASTING ───────────────────────────────────────────────────────
describe('Type casting (as)', () => {
  test('any as string', () => expectCompiles(`
    x: any = 'hi'
    y = x as string
  `));

  test('any as number', () => expectCompiles(`
    x: any = 1
    y = x as number
  `));
});

// ─── 12. DESTRUCTURING ──────────────────────────────────────────────────────
describe('Destructuring', () => {
  test('object destructuring pattern', () => expectCompiles(`
    type U = { name: string, age: number }
    u: U = { name: 'Alice', age: 30 }
    { name, age } = u
  `));

  test('nested object destructuring', () => expectCompiles(`
    type U = { info: { score: number } }
    u: U = { info: { score: 9 } }
    { info: { score } } = u
  `));
});

// ─── 13. EDGE CASES ─────────────────────────────────────────────────────────
describe('Edge cases', () => {
  test('chained method calls on string', () => expectCompiles(`
    def f(s: string): string {
      return s.trim().toUpperCase()
    }
  `));

  test('empty object literal', () => expectCompiles(`
    x = {}
  `));

  test('object literal with lambda value', () => expectCompiles(`
    obj = { greet: (name: string): string => 'Hi 'name }
  `));

  test('any variable reassigned to different type', () => expectCompiles(`
    x: any = 1
    x := 'hello'
  `));

  test('function returning function type annotation', () => expectCompiles(`
    def makeAdder(n: number): (x: number) => number {
      return (x) => x + n
    }
  `));

  test('null check before member access', () => expectCompiles(`
    type Node = { val: number, next: Node | null }
    def f(n: Node | null): number {
      if n {
        return n.val
      }
      return 0
    }
  `));

  test('multiple assignments in sequence', () => expectCompiles(`
    a = 1
    b = a + 2
    c = b * 3
  `));

  test('string method chain then interpolation', () => expectCompiles(`
    def shout(s: string): string {
      upper = s.trim().toUpperCase()
      return upper'!'
    }
  `));
});
