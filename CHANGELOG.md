# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-25

This release focuses heavily on making the language more solid: the inference engine
was substantially overhauled, a code formatter was added, arity checking arrived, and
the grammar was simplified and made more consistent.

### Added

**Inference engine**
- Two-phase inference architecture: a silent propagation phase followed by a separate
  checking phase that emits diagnostics. Fixes false-positive warnings that appeared
  during partial AST traversal (#75).
- Generics: type parameters on functions and type aliases with explicit type arguments
  at call sites (#72).
- Complex type annotations: object shapes, optional properties, and type assignments
  with full inference (#71).
- Literal types: string, number, and boolean literal values as types (`"ok" | "error"`).
- Union type inference and intersection type checks.
- `Record<K, V>` built-in type.
- Type aliases (`type Alias = ...`) treated as a proper keyword-statement pair.
- Type import / export across files; cross-file alias resolution.
- Function return-type checking: compiler now catches when a function does not return
  what its annotation declares.
- Arity checks: wrong number of arguments at a call site is reported as an error (#81, #82).
- Dead code detection after unconditional `return` / `throw` statements.
- Type narrowing in `if / else` branches and `while` loop bodies.
- Impossible comparison detection (e.g. `string === number` is always `false`).
- `typeof` operator inference.
- Improved `async / await` inference: `await` unwraps `Promise<T>` to `T`.
- Scope isolation for `try / catch` blocks.
- `for...of` syntax for any iterable (in addition to the existing index-based `for`).
- `for...in` inference and tests.
- Annotated destructuring: type annotations on destructured bindings.
- Function parameter destructuring.
- Type member access in destructured patterns.
- Negation operator (`!`) type inference.
- Nullish coalescing (`??`) and optional chaining bug fixes.
- Strict string concatenation: mixing `string` and non-string operands is now an error.
- Expanded Web API built-in types (fetch, AbortController, DOM events, …).
- Improved `VNode` built-in type and `Component` type signatures.
- Imported functions carry their full inferred signature into the importing file.
- `import` statement now shows the function signature on hover in the editor.

**Code formatter** (#80)
- New `blop format` / formatter pipeline that pretty-prints `.blop` source files.
- Preserves intentional multi-line element layouts.
- 120-character line-length limit.

**VSCode extension / language server**
- Hover: display the inferred type and value of any symbol under the cursor.
- Function signature completion: shows parameter names and types in the completion
  pop-up.
- Auto-completion improvements for array members and type names.
- Quick-fix actions for common errors (#67, #68).
- Go-to-definition follows `import` statements across files.
- In-browser playground: the compiler now runs fully in the browser.

### Changed

- Grammar refactored: `object_access` alternatives inlined directly into `exp`,
  and the separate `operation` rule merged into `exp` via structural dispatch (#83).
  Produces cleaner JS output and simplifies the inference handlers.
- Type system migrated from string-based representation to a structured object model,
  enabling richer error messages and easier programmatic manipulation (#76).
- Built-in types converted from ad-hoc strings to the new object-based type system.
- Component signature fully refactored for cleaner usage.
- `for` loop syntax updated: `for value of iterable` is now the idiomatic form for
  iterables; index-based `for` remains available.
- Migrated test runner from Jest to **Vitest** (#73).
- Migrated build tooling from Webpack to **Vite** (#73).
- All source files converted to ESM (`import` / `export`); `require()` removed.
- Generated JavaScript for `string` type no longer emits unnecessary `isArray` guards.
- Naming convention: removed React-style `use` prefix from hook-like helpers
  (this is not React).

### Fixed

- `||` operator was incorrectly widening operand types to `boolean`; now preserves
  the union of both operand types.
- `delete` expression return type corrected to `boolean`.
- Multi-array inference edge cases.
- Destructuring with built-in `Component` type.
- Math and binary operation inference for mixed numeric types.
- `string[].push()` was accepting wrong argument types.
- Odd `return` edge case in the inference engine.
- Type narrowing on guard expressions.
- Source maps re-established after ESM migration.
- Array spread operator fixed when used with `Component`.
- Various hover display issues in the VSCode extension.

---

## [1.1.0]

### Added

- `null` and `undefined` as first-class citizens in the type system.
- Type aliases (`type Foo = Bar`).
- Union type inference (`string | number`).
- Type narrowing in `if / else` conditionals.
- Negative test infrastructure: `expectCompilationError()` helper for asserting that
  invalid programs are correctly rejected.
- Quick-fix support in the VSCode language server.
- Smarter quick fixes that suggest contextually relevant corrections.

### Changed

- Improved error messages across the compiler and language server.
- Better diagnostic positioning (correct line numbers in all cases).

### Fixed

- Various inference edge cases exposed by the new negative test suite.

---

## [1.0.1]

### Fixed

- Minor bug fixes and stability improvements after the initial release.

---

## [1.0.0]

Initial public release of the Blop language compiler and VSCode extension.

### Features at launch

- PEG parser with Packrat memoisation and direct left-recursion support.
- Virtual DOM code generation targeting [Snabbdom](https://github.com/snabbdom/snabbdom).
- Basic type inference engine.
- `async / await`, classes, destructuring, spread operator, template strings.
- `import` / `export` with compile-time export validation.
- Source maps.
- Hot Module Replacement via Webpack / Vite dev server.
- VSCode extension: syntax highlighting, basic diagnostics, auto-completion.
- CLI tool (`blop`).
- Built-in routing and state management libraries.
