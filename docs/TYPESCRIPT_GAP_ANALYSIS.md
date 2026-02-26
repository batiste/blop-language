# TypeScript Parity — Gap Analysis

This document tracks which TypeScript type-system features are present in Blop and which are still missing. It is meant as a living reference: tick off items as they land, add notes when a design decision is made.

---

## Already implemented

| Feature | Notes |
|---|---|
| Primitives (`string`, `number`, `boolean`, `null`, `undefined`, `any`, `never`, `void`) | Singletons in `Type.js` |
| Literal types (`"foo"`, `42`, `true`) | `LiteralType` |
| Array types (`T[]`) | `ArrayType` |
| Object types (`{ name: string, age?: number }`) | `ObjectType` with optional properties |
| Union types (`A \| B`) | `UnionType` with normalization |
| Intersection types (`A & B`) | `IntersectionType` with object merge |
| Generics with type-parameter inference | `GenericType` + `substituteTypeParams` |
| Function types with contra/covariant checking | `FunctionType` |
| `Record<K, V>` | `RecordType` |
| Type aliases (`type X = ...`) | `TypeAliasMap` |
| Type member access (`State['key']`) | `TypeMemberAccess` |
| Structural subtyping + excess property checking | `excessPropertiesAgainst()` |
| Type narrowing (`typeof`, equality, truthiness) | `typeGuards.js` |
| Arity + argument-type checking | `typeChecker.js` |
| Return-type inference + declared-return checking | `statements.js` |
| Two-phase inference (inference → checking) | `visitor.js` |
| **Tuple types (`[string, number]`)** | `TupleType` — implemented, see below |

### Limitations of the current tuple implementation

- **No contextual typing for array literals.** Writing `f(['hello', 42])` where `f` expects `[string, number]` will produce a type warning because the array literal is inferred as `(string | number)[]`. The value is valid at runtime but the static type doesn't match. Fix: implement contextual type propagation so that an array literal whose target type is a `TupleType` is directly typed as that tuple.
- **Rest/optional elements not supported.** `[string, ...number[]]` and `[string, number?]` are future work.
- **Numeric-index dot-access not supported.** Access via a variable index (`t[i]` where `i: number`) returns the union of all element types; refining to a specific position would require flow-sensitive index analysis.

---

## Missing (priority order)

### High impact

| # | Feature | TS example | Blocked by |
|---|---|---|---|
| 1 | ~~Tuple types~~ | `[string, number]` | — |
| 2 | `as` type assertion | `expr as SomeType` | Grammar rule needed |
| 3 | User-defined type predicates | `x is string` in return | Grammar + narrowing |
| 4 | `keyof` operator | `keyof T` | Grammar rule needed |
| 5 | Mapped types | `{ [K in keyof T]: T[K] }` | `keyof` + new `MappedType` |
| 6 | Conditional types | `T extends U ? X : Y` | New `ConditionalType` |

### Medium impact

| # | Feature | TS example | Notes |
|---|---|---|---|
| 7 | Index signatures | `{ [key: string]: number }` | `Record<K,V>` partially covers this |
| 8 | `readonly` modifier | `readonly T[]` | New wrapper type or flag |
| 9 | `Partial<T>`, `Required<T>`, `Pick<T>`, `Omit<T>` | — | Need mapped types |
| 10 | `ReturnType<F>`, `Parameters<F>` | — | Need conditional + `infer` |
| 11 | Function overloads | Multiple call signatures | `FunctionType[]` per symbol |
| 12 | `satisfies` operator | `expr satisfies T` | Grammar + new check |
| 13 | Template literal types | `` `prefix-${string}` `` | New `TemplateLiteralType` |
| 14 | `as const` / const assertions | `{ x: 1 } as const` | Literal freezing |

### Lower impact / advanced

| # | Feature | TS example | Notes |
|---|---|---|---|
| 15 | Class structural types | `implements Foo` | Class analysis |
| 16 | `typeof x` in annotation position | `type T = typeof someVar` | Type query |
| 17 | `infer` keyword | `T extends Array<infer E>` | Conditional types first |
| 18 | Assertion functions | `asserts cond` | Grammar + narrowing |
| 19 | Exhaustiveness checking | Unreachable `never` warning | Control-flow analysis |
| 20 | Declaration/interface merging | Same-name type aliases | Symbol table change |
| 21 | Variance annotations | `in`/`out` on generics | New flag on `GenericType` |

---

## Tuple Types — Design Notes

### Syntax

```typescript
// Type annotation
x: [string, number]
x: [string, number, boolean]

// As part of a union or intersection
x: [string, number] | null

// Array of tuples
x: [string, number][]
```

### Semantics

- Fixed-length: `tuple.length` is the literal number type.
- Positional element types: index `0` returns element type `0`, etc.
- Out-of-bounds index access returns `never` (or `undefined` in loose mode — TBD).
- Compatibility: a tuple `[A, B]` is assignable to `[A, B]` only; **not** to `A[]` (structural mismatch on length) — *same as TypeScript*. Assignable to `(A | B)[]` only if every element is compatiblelooser-than-strict (TBD).
- Rest elements (`[string, ...number[]]`) are **not** in scope for the initial implementation.
- Optional elements (`[string, number?]`) are **not** in scope for the initial implementation.

### Implementation

- `TupleType` class added to `src/inference/Type.js`
- `tuple_type` and `tuple_type_elements` rules added to `src/grammar.js`
- `parseTypePrimary()` in `src/inference/typeParser.js` handles the new `tuple_type` child node
- `getArrayMemberType()` in `src/inference/builtinTypes.js` extended to return positional types for `TupleType`
- Tests: `src/tests/typeSystem/tupleTypes.test.js`
