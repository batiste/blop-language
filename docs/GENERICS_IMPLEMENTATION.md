# Generics Implementation Plan

**Status:** In Progress  
**Started:** February 15, 2026

## Overview

This document outlines the step-by-step implementation of generic types in Blop language.

## Phase 1: Basic Generic Functions ✓ (Current Focus)

### Syntax to Support

```blop
// Basic generic function
def identity<T>(value: T): T {
  return value
}

// Multiple type parameters
def pair<T, U>(first: T, second: U): [T, U] {
  return [first, second]
}

// Generic function usage (type inference)
result = identity(42)        // T inferred as number
text = identity('hello')     // T inferred as string
```

### Grammar Changes Needed

1. Add `generic_params` rule for `<T, U, ...>`
2. Modify `func_def` to accept optional generic parameters
3. Modify `type_expression` to support generic instantiation

```javascript
// New grammar rules:
'generic_params': [
  ['<', 'generic_param_list:params', '>'],
],
'generic_param_list': [
  ['name:param', ',', 'w', 'generic_param_list:rest'],
  ['name:param'],
],
```

### Type System Changes

1. **Type Parameter Binding**: Track generic parameters in scope
   - When entering generic function, bind type params to 'generic' kind
   - During instantiation, substitute concrete types

2. **Type Variable Representation**: `T`, `U` stored as type variables
   - Distinguish from concrete types
   - Track constraints (Phase 2)

3. **Type Substitution**: Replace type variables with concrete types
   ```javascript
   substituteType(type, substitutions)
   // e.g., substituteType('T[]', {T: 'number'}) => 'number[]'
   ```

### Inference Changes

1. **Generic Function Definition Handler**
   - Parse generic params
   - Store function with generic signature
   - Track type parameters in scope

2. **Generic Function Call Handler**
   - Infer type arguments from call-site arguments
   - Validate inferred types match constraints
   - Substitute types in return type

### Files to Modify

- `src/grammar.js` - Add generic syntax rules
- `src/inference/typeSystem.js` - Add substitution logic
- `src/inference/handlers/functions.js` - Handle generic functions
- `src/inference/visitor.js` - Track generic type parameters in scope

## Phase 2: Generic Type Aliases

```blop
type Box<T> = {
  value: T,
  unwrap: () => T
}

type Pair<T, U> = {
  first: T,
  second: U
}

// Usage
myBox: Box<number> = { value: 42, unwrap: () => 42 }
```

### Changes Needed

1. Modify `type_alias` grammar to accept generic params
2. Store generic type aliases with parameters
3. Handle type instantiation: `Box<number>` => `{ value: number, ... }`

## Phase 3: Generic Constraints

```blop
// Constrain T to be a specific type
def getLength<T extends { length: number }>(value: T): number {
  return value.length
}

// Constrain to union
def process<T extends string | number>(value: T): T {
  return value
}
```

### Changes Needed

1. Add `extends` keyword and constraint syntax to grammar
2. Store constraints with type parameters
3. Validate constraints during instantiation

## Phase 4: Advanced Features

### keyof Operator
```blop
def getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
```

### Mapped Types
```blop
type Partial<T> = {
  [K in keyof T]?: T[K]
}
```

## Implementation Order

### Step 1: Grammar (Day 1)
- [ ] Add `generic_params` rule
- [ ] Add `generic_param_list` rule  
- [ ] Modify `func_def` to include optional `generic_params`
- [ ] Modify `type_alias` to include optional `generic_params`
- [ ] Add `type_instantiation` for `Type<Args>`
- [ ] Regenerate parser

### Step 2: Type System Basics (Day 1-2)
- [ ] Add `isGenericTypeParameter(type)` function
- [ ] Add `substituteType(type, substitutions)` function
- [ ] Add `parseGenericParams(node)` function
- [ ] Add `inferGenericArguments(params, args)` function

### Step 3: Function Generics (Day 2-3)
- [ ] Update `func_def` handler to parse generic params
- [ ] Store generic function signatures with type parameters
- [ ] Update `named_func_call` handler to infer generic arguments
- [ ] Update `named_func_call` handler to substitute types

### Step 4: Type Alias Generics (Day 3-4)
- [ ] Update `type_alias` handler to parse generic params
- [ ] Store generic type aliases
- [ ] Add type instantiation logic for `Box<number>`
- [ ] Update type compatibility checking

### Step 5: Testing (Day 4-5)
- [ ] Basic generic function tests
- [ ] Multiple type parameter tests
- [ ] Generic type alias tests
- [ ] Type inference tests
- [ ] Error case tests

## Example Test Cases

```blop
// Test 1: Basic generic function
def identity<T>(value: T): T {
  return value
}

test('generic identity function', () => {
  expect(identity(42)).toBe(42)
  expect(identity('hello')).toBe('hello')
})

// Test 2: Generic with array
def first<T>(arr: T[]): T | undefined {
  if arr.length > 0 {
    return arr[0]
  }
  return undefined
}

test('generic array function', () => {
  expect(first([1, 2, 3])).toBe(1)
  expect(first(['a', 'b'])).toBe('a')
})

// Test 3: Multiple type parameters
def pair<T, U>(a: T, b: U): object {
  return { first: a, second: b }
}

test('multiple type parameters', () => {
  p = pair(1, 'hello')
  expect(p.first).toBe(1)
  expect(p.second).toBe('hello')
})

// Test 4: Generic type alias
type Box<T> = { value: T }

def createBox<T>(value: T): Box<T> {
  return { value }
}

test('generic type alias', () => {
  box = createBox(42)
  expect(box.value).toBe(42)
})
```

## Technical Considerations

### Type Variable Naming
- Use single uppercase letters: T, U, V, K, etc.
- Reserved names: avoid conflict with real types
- Scope: type parameters shadow outer type names

### Type Inference Algorithm
1. Collect constraints from argument positions
2. Unify constraints to find consistent substitution
3. Fall back to `any` if inference fails
4. Validate against explicit type arguments if provided

### Error Messages
- "Cannot infer type parameter T from usage"
- "Type argument 'string' does not satisfy constraint 'number'"
- "Expected 2 type arguments but got 1"
- "Type parameter 'T' is not defined"

## Resources & References

- TypeScript Generics: https://www.typescriptlang.org/docs/handbook/2/generics.html
- Type Inference Algorithm: Hindley-Milner basics
- Current Blop type system: `src/inference/typeSystem.js`

## Questions & Decisions

**Q: Should we support default type parameters?**
```blop
def create<T = string>(value: T): T { ... }
```
**A:** Phase 4 - not critical for MVP

**Q: Should we support explicit type arguments?**
```blop
identity<string>('hello')
```
**A:** Yes, include in Phase 1 for testing

**Q: How to handle recursive generic types?**
```blop
type Tree<T> = { value: T, children: Tree<T>[] }
```
**A:** Phase 4 - complex but valuable

## Success Metrics

- [ ] Can define generic functions with 1+ type parameters
- [ ] Type arguments inferred from function calls
- [ ] Generic type aliases work with instantiation
- [ ] Type errors caught for incompatible types
- [ ] All test cases pass
- [ ] VSCode extension shows proper types in hover info

---

## Progress Log

### 2026-02-15
- Created implementation plan
- Identified grammar changes needed
- Outlined test cases
