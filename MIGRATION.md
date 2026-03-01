# Migration Guide

This document describes breaking changes between Blop releases and how to update your code.

---

## Migrating to 1.2.0

### Build tooling: Webpack → Vite

The build toolchain has been migrated from Webpack to Vite. If you had a custom
`webpack.config.js`, replace it with a `vite.config.js`. The Blop Vite plugin is
exported from `blop-language/vite`.

```typescript
// vite.config.js
import { defineConfig } from 'vite'
import { blopPlugin } from 'blop-language/vite'

export default defineConfig({
  plugins: [blopPlugin()],
})
```

### Test runner: Jest → Vitest

Tests now run under Vitest. Replace any `jest.config.*` file with a `vitest.config.js`
and update imports:

```typescript
// before
import { describe, it, expect } from '@jest/globals'

// after  — Vitest is API-compatible with Jest
import { describe, it, expect } from 'vitest'
```

### ESM-only modules

All Blop source files (including user code processed by the compiler) must use ESM
syntax. `require()` calls are no longer supported.

```typescript
// before
const lib = require('./lib')

// after
import lib from './lib'
```

### `for` loop syntax

The `for…in` loop iterating over an index has changed. Use `for…of` for iterables:

```typescript
// before
for i in items
  console.log(items[i])

// after
for item of items
  console.log(item)
```

Index-based `for` loops remain available when you need explicit indices.

### Type system: structured objects replace strings

The internal type representation moved from plain strings to structured objects.
This is mostly transparent, but custom tooling or code that inspected `inferredType`
string values directly will need to use the new object API.

### `type` is a reserved keyword

The identifier `type` can no longer be used as a variable name. Rename any variable
called `type` to something more specific.

### Strict string concatenation

Mixing a `string` with a non-string operand via `+` is now a compile-time error.
Explicit coercion is required:

```typescript
// before — silently compiled
let msg = "Count: " + count

// after
// or use string interpolation
let msg = "Count: "count.toString()
```

### Removed `use` prefix on hook-like helpers

Helpers that were previously prefixed with `use` (following a React convention) have
been renamed. Since Blop is not React, the prefix was misleading. Update any such
call sites in your code.

### Component signature

The `Component` type signature was fully refactored for 1.2.0. If you were relying on
the exact shape of the `Component` built-in type in your own type annotations, review
[docs/COMPONENTS.md](docs/COMPONENTS.md) for the new signature.

---

## Unreleased (next release)

### State and router libraries moved to built-in module specifiers

The `state`, `router`, and `navigation` libraries have been promoted from example
files inside your project to first-class built-in modules shipped with the runtime.
Update your imports accordingly:

```typescript
// before
import create from './lib/state.blop'
import { Router, Test } from './lib/router.blop'
import { go } from './lib/navigation.blop'

// after
import create from 'blop/state'
import { Router, Test } from 'blop/router'
import { go } from 'blop/navigation'
```

You can now remove `example/lib/state.blop`, `example/lib/router.blop`, and
`example/lib/navigation.blop` (or `src/lib/…`) from your project entirely.