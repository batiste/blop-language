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
| **User-defined type predicates (`x is T`)** | `PredicateType` — implemented, see below |
| **`keyof` operator** | `KeyofType` — implemented, see below |

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
| 3 | ~~User-defined type predicates~~ | `x is string` in return | — |
| 4 | ~~`keyof` operator~~ | `keyof T` | — |
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

## Type Predicates — Design Notes

### Syntax

```typescript
def isString(x: any): x is string {
  return typeof x == 'string'
}

def isPoint(v: any): v is Point {
  return typeof v == 'object'
}
```

### Semantics

- A function annotated `paramName is T` is a **type predicate** (type guard function).
- The function body must return `boolean`; the annotation is erased at runtime.
- At call sites used as an `if` condition, the compiler narrows the predicate argument to `T` in the true branch and excludes `T` in the false branch.
- Chained guards (`else if isNumber(x)`) also apply narrowing.
- The **early-exit** pattern works: after `if !isString(x) { return }`, subsequent statements see `x` narrowed to `string`.

### Implementation

- `is` token added to `src/tokensDefinition.js` (trailing space, same pattern as `as`)
- Annotation grammar extended in `src/grammar.js`: first alternative `['colon', 'w', 'name:predicate_param', 'w', 'is', 'type_expression:predicate_type']` (no extra `w` after `is` — the token already consumes the trailing space)
- `PredicateType` class in `src/inference/Type.js` with `paramName` and `guardType` fields
- `parseAnnotation()` in `src/inference/typeParser.js` detects `predicate_param` and returns `PredicateType`
- `setupDeclaredReturnType()` in `src/inference/handlers/functions.js` stores `BooleanType` for body return-checking and the original `PredicateType` in `scope.__annotationReturnType` for error messages
- `handleFuncCallAccess()` in `src/inference/handlers/expressions.js` stamps `expNode.__predicateArg` with the guarded variable name when the function's return type is `PredicateType`
- `detectPredicateGuard()` in `src/inference/typeGuards.js` reads `__predicateArg` from stamped call nodes (requires inference phase to have visited the expression first)
- `condition` handler in `src/inference/handlers/statements.js` visits the condition expression **before** detecting the type guard (syntax guards detect from raw AST; predicate guards need `inferredType` stamped first)
- `typeof x == 'string'` fix in `exp` handler: when the grammar parses `['operand', 'exp']` with `typeof` and the inner exp is a boolean comparison, the outer exp is correctly typed as `BooleanType` (not `StringType`)
- Tests: `src/tests/typeSystem/typePredicates.test.js` (19 unit/integration tests) + `src/tests/typeSystem/typePredicates.test.blop` (5 runtime tests)

### Known limitations

- Only simple variable references as predicate arguments get narrowed. `isString(obj.prop)` or `isString(arr[0])` will compile but the inner expression will not be narrowed (because `getSimpleVarName()` only handles `name_exp` children).
- The predicate parameter must be the first parameter (or any named parameter) that `paramNames.indexOf(returnType.paramName)` resolves.

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

---

## `keyof` Operator — Design Notes

### Syntax

```typescript
// Annotation: variable whose type is the union of property keys
k: keyof State = 'counter'

// Return type
def getKey(): keyof Config {
  return 'host'
}

// As part of a union
x: keyof State | null
```

### Semantics

- `keyof ObjectType` → a string literal union of all declared property names, e.g. `keyof { a: string, b: number }` → `"a" | "b"`.
- `keyof RecordType<K, V>` → the record's key type `K`.
- `keyof any` → `string | number`.
- Empty object `keyof {}` → `never`.
- Unresolvable subjects fall back to `string` (no hard error).
- The operator is erased at runtime (pure type annotation, same as TypeScript).

### Implementation

- `'keyof'` token added to `src/tokensDefinition.js` (`str: 'keyof '`)
- `['keyof', 'type_primary:subject', 'array_suffix?']` alternative added to `type_primary` in `src/grammar.js`; parser regenerated
- `KeyofType` class added to `src/inference/Type.js` with `subjectType`, `toString()`, `equals()`, `resolve(aliases)`, and `isCompatibleWith(target, aliases)`
- `TypeAliasMap.resolveKeyof(type)` added: resolves the subject via `resolve()` then builds the key union from the resolved type
- `TypeAliasMap.resolve()` dispatches on `KeyofType` so that `aliases.resolve(keyofT)` eagerly produces the union
- All `isCompatibleWith` overrides in `Type.js` that check `TypeAlias || TypeMemberAccess` extended with `|| KeyofType` so any type can be assigned to a `keyof T` target correctly
- `substituteTypeParams()` handles `KeyofType` (recursively substitutes through the subject type)
- `Types.keyof(subjectType)` factory helper added
- Tests: `src/tests/typeSystem/keyofType.test.js` (19 tests)

### Known limitations

- `keyof` only operates directly on type aliases or inline object/record types. Expressions like `keyof (A & B)` or `keyof Array<T>` are not yet handled — the subject must resolve to an `ObjectType` or `RecordType`.
- No generic constraint syntax (`K extends keyof T`) yet — that requires mapped types / conditional-type infrastructure.
- `keyof` of a union or intersection type is not supported (TypeScript computes the union of keys for intersections and the intersection of keys for unions).

