# TypeScript Parity — Gap Analysis

Concise snapshot of TypeScript type-system parity for Blop.

Purpose:
- Track what is implemented.
- Keep the next priorities clear.
- Avoid deep implementation history in this file.

---

## Implemented

| Feature | Status |
|---|---|
| Core primitives, literals, arrays, objects, unions, intersections | Done |
| Generics with inference | Done |
| Function types + arity/argument checking | Done |
| Type aliases + type member access (`T['k']`) | Done |
| Structural compatibility + excess property checking | Done |
| Type narrowing (`typeof`, equality, truthiness, predicates) | Done |
| Two-phase inference (inference -> checking) | Done |
| Dead-code warning after unconditional `return` / `throw` | Done |
| Tuple types | Done (basic) |
| `as` assertions | Done |
| `satisfies` operator | Done |
| `as const` | Done |
| `readonly` modifier | Done |
| User-defined type predicates (`x is T`) | Done |
| `keyof` operator | Done |
| Class member type annotations + `new` constructor expressions | Done |
| Index signatures | Done |
| Exhaustiveness checking (current scope) | Done for early-exit literal-union guard chains (`if` / `elseif`) |

---

## Missing (Priority)

### Tier 1 — Next

| Feature | Why it matters |
|---|---|
| Mapped types (`{ [K in keyof T]: T[K] }`) | Unlocks `Partial`, `Required`, `Pick`, `Omit` |

### Tier 2 — Medium complexity

| Feature | Why it matters |
|---|---|
| Conditional types (`T extends U ? X : Y`) | Foundation for many utility types |
| `infer` keyword | Needed for `ReturnType`, `Parameters` |
| Function overloads | Better API typing ergonomics |
| Template literal types | Stronger string-level typing |
| Stdlib utility aliases (`Partial`, `Pick`, `Omit`, `Required`, `ReturnType`, `Parameters`) | Practical TS parity surface |

### Tier 3 — Advanced

| Feature | Notes |
|---|---|
| `typeof x` in type position | Type query support |
| `implements` checking | Cross-check class shape against interface/object type |
| Generic constraints (`K extends keyof T`) | Important for generic utility patterns |
| Assertion functions (`asserts ...`) | Additional narrowing mechanism |
| Deeper discriminated-union exhaustiveness | Extend beyond current early-exit chain support |
| Declaration/interface merging | Symbol table merge behavior |
| Variance annotations (`in` / `out`) | Advanced generic compatibility control |

---

## Recommended Next Order

1. Mapped types
2. Utility aliases based on mapped types (`Partial`, `Pick`, `Omit`, `Required`)
3. Conditional types + `infer`
4. Utility aliases based on conditional types (`ReturnType`, `Parameters`)

---

## Known Gaps Snapshot

- Tuple contextual typing is still limited for some array literals.
- `keyof` over unions/intersections is not fully supported.
- Generic constraints syntax is not implemented yet.
- Index-signature key-type enforcement at bracket access is still partial.

---

## Evidence

- `satisfies` tests: `src/tests/typeSystem/satisfies.test.js`
- Exhaustiveness tests: `src/tests/typeSystem/exhaustivenessChecking.test.js`
- Predicate tests: `src/tests/typeSystem/typePredicates.test.js`
- Keyof tests: `src/tests/typeSystem/keyofType.test.js`
- Index signature tests: `src/tests/typeSystem/indexSignatures.test.js`
