/**
 * Tests for property-path type narrowing.
 *
 * When a guard of the form `if obj.prop == undefined { return }` (early-exit) or
 * `if obj.prop != undefined { ... } else { ... }` is used, the type of obj.prop
 * should be narrowed inside the relevant branch/continuation.
 */
import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

// ---------------------------------------------------------------------------
// Early-return guard: `if obj.prop == undefined { return }` → narrowed after
// ---------------------------------------------------------------------------

describe('property path narrowing — early-return guard', () => {
  test('property narrowed to non-undefined after early-return guard', () => {
    // cfg.host is string | undefined; after the guard it should be string
    expectCompiles(`
      type Config = { host: string | undefined, port: number }
      def getHost(cfg: Config): string {
        if cfg.host == undefined {
          return 'localhost'
        }
        return cfg.host
      }
    `);
  });

  test('property narrowed to non-null after early-return guard', () => {
    expectCompiles(`
      type Node = { value: number | null }
      def getValue(n: Node): number {
        if n.value == null {
          return 0
        }
        return n.value
      }
    `);
  });

  test('returning narrowed property satisfies declared return type', () => {
    expectCompiles(`
      type Wrapper = { data: string | undefined }
      def unwrap(w: Wrapper): string {
        if w.data == undefined {
          return ''
        }
        return w.data
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// If-branch: inside `if obj.prop == undefined { }`, prop is narrowed there
// ---------------------------------------------------------------------------

describe('property path narrowing — if-branch', () => {
  test('property is narrowed to undefined inside the equality branch', () => {
    // Inside the if body, obj.name == undefined is satisfied, so early return
    // is correct — no error expected for the whole program
    expectCompiles(`
      type User = { name: string | undefined }
      u: User = { name: undefined }
      if u.name == undefined {
        x = 'no name'
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// Negated guard: `if obj.prop != undefined { ... }`
// ---------------------------------------------------------------------------

describe('property path narrowing — negated guard', () => {
  test('property narrowed inside negated-inequality if-branch', () => {
    expectCompiles(`
      type Config = { host: string | undefined }
      def formatHost(cfg: Config): string {
        result = 'none'
        if cfg.host != undefined {
          result := cfg.host
        }
        return result
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// No narrowing for unguarded access (control: previous behavior intact)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Builtin types (VNode, etc.)
// ---------------------------------------------------------------------------

describe('property path narrowing — builtin types', () => {
  test('vnode.elm is narrowed to DOMElement after early-return guard', () => {
    // `if vnode.elm == undefined { return }` → elm narrowed to DOMElement after guard
    expectCompiles(`
      def insert(vnode: VNode) {
        if vnode.elm == undefined {
          return
        }
        vnode.elm.focus()
      }
    `);
  });

  test('vnode.elm narrowed via typeof guard', () => {
    // `if typeof vnode.elm == 'undefined' { return }` → same narrowing via typeof path
    expectCompiles(`
      def insert(vnode: VNode) {
        if typeof vnode.elm == 'undefined' {
          return
        }
        vnode.elm.focus()
        vnode.elm.select()
      }
    `);
  });

  test('vnode.elm narrowed in arrow-function hook', () => {
    expectCompiles(`
      hooks = {
        insert: (vnode: VNode) => {
          if vnode.elm == undefined {
            return
          }
          vnode.elm.focus()
        }
      }
    `);
  });

  test('vnode.elm narrowed via negated truthiness guard (!vnode.elm)', () => {
    expectCompiles(`
      def insert(vnode: VNode) {
        if !vnode.elm {
          return
        }
        vnode.elm.focus()
        vnode.elm.select()
      }
    `);
  });

  test('vnode.elm narrowed via negated truthiness in arrow-function hook', () => {
    expectCompiles(`
      hooks = {
        insert: (vnode: VNode) => {
          if !vnode.elm {
            return
          }
          vnode.elm.focus()
          vnode.elm.select()
        }
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// No narrowing for unguarded access (control: previous behavior intact)
// ---------------------------------------------------------------------------

describe('property path narrowing — no false narrowing', () => {
  test('assigning string property to number variable still errors without a guard', () => {
    // Sanity check: unrelated type errors are still caught.
    // cfg.host is string but n is declared number — should always fail.
    expectCompilationError(`
      type Config = { host: string }
      def test(cfg: Config) {
        n: number = cfg.host
      }
    `, 'number');
  });
});

// ---------------------------------------------------------------------------
// Warn on unguarded nullable property access
// ---------------------------------------------------------------------------

describe('property path narrowing — unguarded nullable access', () => {
  test('warns when accessing property on DOMElement | undefined without guard', () => {
    expectCompilationError(`
      def insert(vnode: VNode) {
        vnode.elm.focus()
      }
    `, 'possibly undefined');
  });

  test('no warning when accessing property after elm guard', () => {
    expectCompiles(`
      def insert(vnode: VNode) {
        if vnode.elm {
          vnode.elm.focus()
        }
      }
    `);
  });

  test('no warning when using optional chaining on nullish property', () => {
    expectCompiles(`
      def insert(vnode: VNode) {
        vnode.elm?.focus()
      }
    `);
  });

  test('warns when accessing named property on null | object without guard', () => {
    expectCompilationError(`
      def findUser(id: number): object | null {
        if id == 0 {
          return null
        }
        return { name: 'User', id }
      }
      def test() {
        user = findUser(1)
        name = user.name
      }
    `, 'possibly null');
  });
});
