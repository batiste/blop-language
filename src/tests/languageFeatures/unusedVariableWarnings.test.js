import { describe, test, expect } from 'vitest';
import { compileSource } from '../../compile.js';

function getWarnings(source) {
  const result = compileSource(source.trim(), 'test.blop', false);
  return result.warnings.map(w => w.message);
}

describe('Unused variable warnings', () => {
  test('variable used only via := in a nested closure is not flagged as unused', () => {
    const warnings = getWarnings(`
      def create2() {
        hello = false
        def flush() {
          hello := true
        }
      }
    `);
    const unusedHello = warnings.some(w => w.includes('Unused variable "hello"'));
    expect(unusedHello).toBe(false);
  });

  test('genuinely unused variable is still flagged', () => {
    const warnings = getWarnings(`
      def foo() {
        unused = 42
      }
    `);
    const hasWarning = warnings.some(w => w.includes('Unused variable "unused"'));
    expect(hasWarning).toBe(true);
  });

  test('variable used via := and later read is not flagged as unused', () => {
    const warnings = getWarnings(`
      def outer() {
        count = 0
        def increment() {
          count := count + 1
        }
        increment()
        result = count
      }
    `);
    const unusedCount = warnings.some(w => w.includes('Unused variable "count"'));
    expect(unusedCount).toBe(false);
  });
});
