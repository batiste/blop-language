import { describe, it } from 'vitest';
import { expectCompilationError, expectCompiles } from '../testHelpers.js';

describe('Operator Type Validation for Function Call Returns', () => {
  it('rejects number + string', () => {
    const code = `
      def num(n: number): number {
        return n
      }
      result = num(5) + "10"
    `;
    expectCompilationError(code, "Cannot apply '+' operator");
  });

  it('rejects string + number', () => {
    const code = `
      def num(n: number): number {
        return n
      }
      result = "5" + num(10)
    `;
    expectCompilationError(code, "Cannot apply '+' operator");
  });

  it('rejects generic function number + string', () => {
    const code = `
      def identity<T>(arg: T): T {
        return arg
      }
      result = identity<number>(5) + "10"
    `;
    expectCompilationError(code, "Cannot apply '+' operator");
  });

  it('rejects string + generic function number', () => {
    const code = `
      def identity<T>(arg: T): T {
        return arg
      }
      result = "5" + identity<number>(10)
    `;
    expectCompilationError(code, "Cannot apply '+' operator");
  });

  it('allows string concatenation from function calls', () => {
    const code = `
      def text(t: string): string {
        return t
      }
      result = text("hello") + text("world")
    `;
    expectCompiles(code);
  });

  it('allows number addition from function calls', () => {
    const code = `
      def num(n: number): number {
        return n
      }
      result = num(5) + num(10)
    `;
    expectCompiles(code);
  });
});
