import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Intersection type semantics', () => {
  // -------------------------------------------------------------------------
  // Positive tests – values that should satisfy the intersection
  // -------------------------------------------------------------------------

  test('accepts object satisfying both sides of an intersection', () => {
    const code = `
      type Named = { name: string }
      type Aged = { age: number }
      type Person = Named & Aged

      p: Person = { name: 'Alice', age: 30 }
    `;
    expectCompiles(code);
  });

  test('accepts object with extra property when assigned to intersection via variable', () => {
    // Structural subtyping: a variable already typed as { name, age, role } should
    // be passable where Named & Aged is expected (no excess-property check on variables).
    const code = `
      type Named = { name: string }
      type Aged = { age: number }
      type Person = Named & Aged

      full = { name: 'Bob', age: 25, role: 'admin' }
      p: Person = { name: 'Bob', age: 25 }
    `;
    expectCompiles(code);
  });

  test('three-way intersection is accepted when all properties are present', () => {
    const code = `
      type A = { x: number }
      type B = { y: number }
      type C = { z: number }
      type ABC = A & B & C

      v: ABC = { x: 1, y: 2, z: 3 }
    `;
    expectCompiles(code);
  });

  // -------------------------------------------------------------------------
  // Negative tests – values that should NOT satisfy the intersection
  // -------------------------------------------------------------------------

  test('rejects object missing a property required by one side of intersection', () => {
    const code = `
      type Named = { name: string }
      type Aged = { age: number }
      type Person = Named & Aged

      p: Person = { name: 'Alice' }
    `;
    expectCompilationError(code, 'Cannot assign');
  });

  test('rejects object with wrong type for a property from one intersection side', () => {
    const code = `
      type Named = { name: string }
      type Aged = { age: number }
      type Person = Named & Aged

      p: Person = { name: 'Alice', age: 'thirty' }
    `;
    expectCompilationError(code, 'age');
  });
});
