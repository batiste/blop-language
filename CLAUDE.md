# Blop Language Compiler Guide

## Quick Commands

- **Build linter**: `npm run linter` (regenerates `vscode/blop-linter/blop-linter/server/src`)
- **Run tests**: `npm test` or `npm run test:watch`
- **Debug AST**: `node --experimental-vm-modules src/tests/yourDebugFile.js`

## Development Principles

### Code Quality
- Write tests first to capture expected behavior and edge cases
- Prefer clean solutions over quick hacks; ask for review when uncertain
- Use tests to clarify complex logic rather than inferring from code
- Execute tests frequently to validate assumptions
- Check for refactoring opportunities to reduce complexity

### Naming & Format
- Use camelCase for filenames
- Always use ESM imports, even in test files
- Avoid excessive emoticons in docs; use `typescript` code block language

## Code Structure

### Files & Directories
- **Auto-generated**: `vscode/blop-linter/blop-linter/server/src/` — do not modify except `server.ts`
- Grammar definition: `src/grammar.js`
- Type system: `src/inference/` and `src/backend/`
- Debug utilities: `src/tests/debugUtils.js`

### Testing Strategy

**Positive tests**: Write real `.blop` test files compiled by the test suite.

**Negative tests**: Use `expectCompilationError()` from `src/tests/testHelpers.js`.

## Type System Architecture

### Two-Phase Inference

1. **Inference Phase**: Silently propagates types; warnings suppressed to avoid false positives during partial traversal
2. **Checking Phase**: Re-walks the AST with same handlers, emits warnings

Both phases run with fresh scopes initialized from the binding phase symbol table. A bug manifesting in only one phase indicates a handler logic error—check `inferencePhase === 'checking'` guards.

### LiteralType vs PrimitiveType

Variables without type annotations receive a `LiteralType` (e.g., `x = 5` → `LiteralType(5, NumberType)`), not a bare `PrimitiveType`.

**Critical**: `instanceof PrimitiveType` checks will miss inferred literals. Always normalize using `getBaseTypeOfLiteral(type)` from `typeSystem.js` before comparing types. This applies in:
- `checkMathOperation`
- Property access guards
- Any code consuming inferred variable types

## Grammar & AST Structure

Grammar is defined in `src/grammar.js`. AST node keys match grammar rule labels: `type_arguments:type_args` stores at `.named.type_args`, not `.named.type_arguments`.

**Recursive nesting example**: `node.useState<number>('count', 0)` produces:

```
access_or_operation
  named.access → object_access (OUTER: '.' + name="useState")
    child object_access (INNER: type_arguments + func_call)
      named.type_args → type_arguments
        named.args → type_argument_list
          named.arg → type_expression
```

## AST Debugging

Use reusable utilities from `src/tests/debugUtils.js` instead of throwaway scripts:
- `findNodes()` — locate AST nodes
- `analyzeOperations()` — inspect operations
- `printInferenceTree()` — visualize type inference

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