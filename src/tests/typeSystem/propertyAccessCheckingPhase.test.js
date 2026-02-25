/**
 * Regression tests for property/method access type-checking in the checking phase.
 *
 * Background: the checking phase must read the *object* type from the child
 * node's `inferredType` (stamped during the inference phase), NOT from
 * `node.inference[0]` which, after the inference phase, holds the *resolved
 * result type* rather than the object type.  If this is wrong, property
 * accesses on typed objects produce spurious "does not exist" warnings in the
 * checking phase.
 */
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Property access — checking phase uses correct object type', () => {
  test('valid property access on a typed object produces no warning', () => {
    const code = `
      type Point = { x: number, y: number }
      p: Point = { x: 1, y: 2 }
      _ = p.x
    `;
    expectCompiles(code);
  });

  test('invalid property access on a typed object produces a warning', () => {
    const code = `
      type Point = { x: number, y: number }
      p: Point = { x: 1, y: 2 }
      _ = p.z
    `;
    expectCompilationError(code, "Property 'z' does not exist");
  });

  test('chained property access is correctly resolved — no spurious warning', () => {
    const code = `
      type Inner = { val: number }
      type Outer = { inner: Inner }
      o: Outer = { inner: { val: 42 } }
      _ = o.inner.val
    `;
    expectCompiles(code);
  });

  test('Math.PI does not produce a spurious warning', () => {
    const code = `
      _ = Math.PI
    `;
    expectCompiles(code);
  });

  test('array .length access does not produce a spurious warning', () => {
    const code = `
      arr: string[] = ['a', 'b']
      _ = arr.length
    `;
    expectCompiles(code);
  });

  test('method call on a typed object does not produce a spurious warning', () => {
    const code = `
      type Counter = { count: number, inc: () => number }
      c: Counter = { count: 0, inc: () => 1 }
      _ = c.inc()
    `;
    expectCompiles(code);
  });
});
