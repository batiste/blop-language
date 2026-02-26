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
| **`as` type assertion** | Grammar reuses the `as` keyword; inference stamps asserted type; backend erases the annotation |

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
| 2 | ~~`as` type assertion~~ | `expr as SomeType` | — |
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

## `as` Type Assertion — Design Notes

### Keyword reuse

`as` is already used in destructuring rename (`{ x as y } = obj`). The grammar can distinguish the two uses unambiguously: the rename form only appears inside `destructuring_values`, while the assertion form is an `exp`-level alternative. There is no syntactic ambiguity.

### Syntax

```typescript
expr as SomeType
```

### Semantics

- Pure escape hatch — no compatibility check between the expression type and the asserted type (same as TypeScript's unchecked `as`). The user is responsible for correctness.
- The expression value is unchanged at runtime; the `as T` annotation is fully erased during code generation.
- Downstream nodes see the asserted type as the expression's inferred type, suppressing any type mismatch that would otherwise be emitted.
- Chaining is supported: `expr as any as string` is parsed as `(expr as any) as string` (left-associative, consistent with TS).

### Implementation

- New `exp` alternative in `src/grammar.js`: `['exp:exp', 'w', 'as', 'type_expression:type_cast']`
- Inference handler in `src/inference/handlers/expressions.js`: detects `node.named.type_cast`, calls `parseTypeExpression`, stamps the asserted type, and short-circuits the rest of the handler
- Backend generator in `src/backend/generators/expressions.js`: if `node.named.type_cast` is present, emits only the inner expression
- Tests: `src/tests/typeSystem/typeAssertion.test.js` (10 unit tests) + `src/tests/typeSystem/typeAssertion.test.blop` (5 runtime tests)

### Known limitations

- No double-check: `42 as string` produces no warning. This matches TypeScript's `as` (not `satisfies`). A stricter operator (`satisfies`) is tracked separately as item #12.
- `as const` is tracked separately as item #14 since it requires a different mechanism (literal freezing, not just type stamping).

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
