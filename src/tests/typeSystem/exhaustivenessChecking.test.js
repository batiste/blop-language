import { describe, test } from 'vitest';
import { compileSource } from '../../compile.js';
import { dedent, expectCompilationError } from '../testHelpers.js';

function compile(src) {
  return compileSource(dedent(src), 'test.blop', true);
}

function expectNoErrors(src) {
  const result = compile(src);
  if (!result.success) {
    throw new Error(`Expected no errors but got: ${JSON.stringify(result.errors)}`);
  }
}

describe('exhaustiveness checking for if/elseif chains', () => {
  test('flags use after exhaustive early-return chain on literal union', () => {
    expectCompilationError(
      `
        def parseKind(kind: 'a' | 'b'): string {
          if kind == 'a' {
            return 'A'
          } elseif kind == 'b' {
            return 'B'
          }
          return kind
        }
      `,
      "has been narrowed to 'never'"
    );
  });

  test('does not flag when chain is not exhaustive', () => {
    expectNoErrors(`
      def parseKind(kind: 'a' | 'b' | 'c'): string {
        if kind == 'a' {
          return 'A'
        } elseif kind == 'b' {
          return 'B'
        }
        return 'C'
      }
    `);
  });
});
