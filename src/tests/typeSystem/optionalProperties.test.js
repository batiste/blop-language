import { expectCompilationError } from '../testHelpers.js';

describe('Optional Properties - Error Cases', () => {
  test('optional property with wrong type should fail', () => {
    const code = `
      type User = { name: string, email?: string }
      user: User = { name: "Alice", email: 123 }
    `;
    expectCompilationError(code, "but expected string");
  });

  test('required property cannot be omitted', () => {
    const code = `
      type User = { name: string, email?: string }
      user: User = { email: "alice@example.com" }
    `;
    expectCompilationError(code, "Missing property 'name'");
  });

  test('optional property in nested object with wrong type should fail', () => {
    const code = `
      type Address = { street: string, city?: string }
      type UserWithAddress = { name: string, address?: Address }
      user: UserWithAddress = { name: "Alice", address: { street: 123 } }
    `;
    expectCompilationError(code, "Property 'address' has type");
  });

  test('optional nested object can have wrong structure when provided', () => {
    const code = `
      type Address = { street: string, city?: string }
      type UserWithAddress = { name: string, address?: Address }
      user: UserWithAddress = { name: "Alice", address: { street: "123 Main St", city: 123 } }
    `;
    expectCompilationError(code, "Property 'address' has type");
  });
});
