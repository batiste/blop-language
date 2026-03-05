/**
 * Negative tests for bare import type inference.
 * These tests verify the inference engine properly rejects invalid type assignments.
 */
import { describe, test } from 'vitest';
import { expectCompilationError } from '../testHelpers.js';
import path from 'path';

const testDir = path.dirname(new URL(import.meta.url).pathname);

describe('bare import type inference — negative tests', () => {
  test('inference rejects type mismatch in bare-imported type', () => {
    expectCompilationError(`
      import './types.blop'
      
      user: User = {
        name: 123,
        id: 1
      }
    `, 'Cannot assign', path.join(testDir, 'bareImportTest.blop'));
  });

  test('inference rejects missing required property in bare-imported type', () => {
    expectCompilationError(`
      import './types.blop'
      
      user: User = {
        name: "Alice"
      }
    `, 'Cannot assign', path.join(testDir, 'bareImportTest.blop'));
  });

  test('inference rejects invalid literal in bare-imported union type', () => {
    expectCompilationError(`
      import './types.blop'
      
      choice: choices = "invalid"
    `, 'Cannot assign', path.join(testDir, 'bareImportTest.blop'));
  });

  test('inference rejects wrong type in nested bare-imported type', () => {
    expectCompilationError(`
      import './types.blop'
      
      profile: Profile = {
        user: {
          name: "Alice",
          id: "not a number"
        },
        verified: true
      }
    `, 'Cannot assign', path.join(testDir, 'bareImportTest.blop'));
  });

  test('inference rejects wrong boolean in bare-imported type', () => {
    expectCompilationError(`
      import './types.blop'
      
      profile: Profile = {
        user: {
          name: "Alice",
          id: 1
        },
        verified: "yes"
      }
    `, 'Cannot assign', path.join(testDir, 'bareImportTest.blop'));
  });
});
