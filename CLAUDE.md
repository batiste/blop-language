# Blop Language Compiler Guide

Blop is a typed language for the Web that generates Virtual DOM. It has a grammar defined in `src/grammar.js` and type inference system in `src/inference/`. The code generation lies in `src/backend/`. The linter extension for VSCode uses the same inference engine to provide real-time feedback. This is not React, so no mention of JSX unless you are specifically comparing concepts.

## Parser Characteristics

`src/parser.js` is a PEG parser with ordered choice, Packrat parsing with memoization, and direct left recursion support using Guido van Rossum's algorithm. Can be regenerated from `src/grammar.js` using `npm run parser`.

## Quick Commands

- **Run tests**: `npx vitest run`
- **Debug AST**: `node --experimental-vm-modules src/tests/yourDebugFile.js`
- **Build linter for VSCode**: `npm run linter` (regenerates `vscode/blop-linter/blop-linter/server/src`). The user will decide when to do it not you.

## Development Principles

### Code Quality
- Write tests first to capture expected behavior and edge cases
- Prefer clean solutions over quick hacks; ask for review when uncertain
- Use tests to clarify complex logic rather than inferring from code
- Execute tests frequently to validate assumptions
- Check for refactoring opportunities to reduce complexity
- When you finally fix a bug, ALWAYS write a test to prevent regressions

### Naming & Format
- Use camelCase for filenames
- Always use ESM imports, even in test files
- Avoid excessive emoticons in docs; use `typescript` code block language

## Code Structure

### Files & Directories
- **Auto-generated**: `vscode/blop-linter/blop-linter/server/src/`: do not modify except `server.ts`. DO NOT mirror changes from `src/`.
- Grammar definition: `src/grammar.js`
- Type system: `src/inference/`
- Code generation (and some type checks): `src/backend/`
- Debug utilities: `src/tests/debugUtils.js`

### Testing Strategy

**Positive tests**: Write real `.blop` test files compiled by the test suite.
**Negative tests**: Use `expectCompilationError()` from `src/tests/testHelpers.js`.

## Type System Architecture

### Two-Phase Inference

1. **Inference Phase**: Silently propagates types; warnings suppressed to avoid false positives during partial traversal
2. **Checking Phase**: Re-walks the AST with same handlers, emits warnings

Both phases run with fresh scopes initialized from the binding phase symbol table. A bug manifesting in only one phase indicates a handler logic error—check `inferencePhase === 'checking'` guards.

## Grammar & AST Structure

Grammar is defined in `src/grammar.js`. AST node keys match grammar rule labels: `type_arguments:type_args` stores at `.named.type_args`, not `.named.type_arguments`. Only certain tokens have `.named` properties, depending on the grammar rule. However `node.children` always contains all children. At the end of the tree every final token has a `node.value` property that contain the raw string from the tokeniser defined in `src/tokensDefinition.js`.

## AST Debugging

Use reusable utilities from `src/tests/debugUtils.js` instead of throwaway scripts:
- `findNodes()` — locate AST nodes
- `analyzeOperations()` — inspect operations
- `printInferenceTree()` — visualize type inference

Update and improve those utilities as you discover new debugging needs.

### Inspecting the AST

`compileSource` does not expose the AST. Use `parser` and `inference` directly:

```typescript
import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { inference } from '../inference/index.js';
import { findNodes, printNode } from './debugUtils.js';

const stream = parser.tokenize(tokensDefinition, src);
const ast = parser.parse(stream);
inference(ast, stream, 'debug.blop');
// now ast nodes have .inferredType stamped on them
```

