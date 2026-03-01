# Blop Generics - Quick Reference Guide

## Syntax Overview

### Generic Functions

```typescript
// Single type parameter
def functionName<T>(param: T): T {
  // implementation
}

// Multiple type parameters
def functionName<T, U>(first: T, second: U): object {
  // implementation
}

// With arrays
def functionName<T>(items: T[]): T[] {
  // implementation
}
```

### Generic Type Aliases

```typescript
// Single type parameter
type TypeName<T> = {
  property: T
}

// Multiple type parameters
type TypeName<T, U> = {
  first: T,
  second: U
}

// With arrays
type TypeName<T> = {
  items: T[]
}

// With optional properties
type TypeName<T> = {
  required: T,
  optional?: T
}
```

### Type Instantiation

```typescript
// In annotations
value: Box<number> = { value: 42 }
pair: Pair<string, boolean> = { first: 'yes', second: true }

// Arrays of generic types
boxes: Box<number>[] = [{ value: 1 }, { value: 2 }]
```

## Common Patterns

### Identity Function
```typescript
def identity<T>(value: T): T {
  return value
}

n = identity(42)        // number
s = identity('hello')   // string
```

### Array Operations
```typescript
def first<T>(arr: T[]): T | undefined {
  if arr.length > 0 {
    return arr[0]
  }
  return undefined
}

def last<T>(arr: T[]): T | undefined {
  if arr.length > 0 {
    return arr[arr.length - 1]
  }
  return undefined
}
```

### Container Types
```typescript
type Box<T> = {
  value: T,
  isEmpty: boolean
}

def createBox<T>(value: T): Box<T> {
  return { value, isEmpty: false }
}

def emptyBox<T>(): Box<T> {
  // Note: Can't use full Box<T> return type with undefined value yet
  return { value: undefined, isEmpty: true }
}
```

### Pair/Tuple Pattern
```typescript
type Pair<T, U> = {
  first: T,
  second: U
}

def makePair<T, U>(a: T, b: U): Pair<T, U> {
  return { first: a, second: b }
}

coords: Pair<number, number> = makePair(10, 20)
keyValue: Pair<string, any> = makePair('name', 'Alice')
```

### Result/Either Pattern
```typescript
type Result<T> = {
  success: boolean,
  value?: T,
  error?: string
}

def success<T>(value: T): object {
  return { success: true, value }
}

def failure<T>(error: string): object {
  return { success: false, error }
}
```

### Nullable Wrappers
```typescript
def orDefault<T>(value: T | null, defaultVal: T): T {
  return value ?? defaultVal
}

def wrapIfNotNull<T>(value: T | null): T[] {
  if value == null {
    return []
  }
  return [value]
}
```

### Map/Transform Operations
```typescript
def map<T, U>(arr: T[], fn: object): U[] {
  result: U[] = []
  for item in arr {
    result.push(fn(item))
  }
  return result
}

numbers = [1, 2, 3]
strings = map(numbers, (n) => n.toString())
```

### Filter Operations
```typescript
def filter<T>(arr: T[], predicate: object): T[] {
  result: T[] = []
  for item in arr {
    if predicate(item) {
      result.push(item)
    }
  }
  return result
}

numbers = [1, 2, 3, 4, 5]
evens = filter(numbers, (n) => n % 2 == 0)
```

## Type Parameter Naming Conventions

- `T` - Type (most common, used for single type parameter)
- `U` - Second type parameter
- `V` - Third type parameter  
- `K` - Key type
- `E` - Element type
- `R` - Return type or Result type

## Tips & Best Practices

### ✅ Do This

```typescript
// Use descriptive function names
def firstElement<T>(arr: T[]): T | undefined { ... }

// Use generics for reusable utilities
def clone<T>(obj: T): T { ... }

// Combine with unions for flexibility
def orNull<T>(value: T | undefined): T | null { ... }
```

### ❌ Avoid This

```typescript
// Don't use generics when concrete types work fine
def addNumbers<T>(a: T, b: T): T {  // ❌ Should be: (a: number, b: number): number
  return a + b
}

// Don't over-complicate with too many type parameters
def complex<T, U, V, W, X>(a: T, b: U, c: V, d: W, e: X) { ... }  // ❌ Too many!
```

## Current Limitations

4. **No variadic generics** - Can't use `...T` for variable length type parameters

## See Also

- [Full Implementation Guide](GENERICS_IMPLEMENTATION.md)
- [Complete Test Suite](../src/tests/generics.test.blop)
- [Phase 1 Summary](GENERICS_PHASE1_COMPLETE.md)
