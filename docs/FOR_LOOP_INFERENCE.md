# For-Loop Type Inference

## Overview

Blop now includes type inference for `for` loops that detects when you're iterating over arrays without the `:array` annotation. This helps prevent the common mistake where loop indices become strings instead of numbers.

## The Problem

In Blop, for loops can iterate in two ways:

### Without `:array` annotation (Object.keys iteration):
```blop
items = ['a', 'b', 'c']
for index, item in items {
  // index is "0", "1", "2" (STRING)
  console.log(typeof index) // "string"
}
```

Compiles to:
```javascript
let keys = Object.keys(items);
for(let i=0; i < keys.length; i++) { 
  index = keys[i];  // "0", "1", "2" as strings!
  let item = items[index];
}
```

### With `:array` annotation (numeric indexing):
```blop
items = ['a', 'b', 'c']
for index, item in items: array {
  // index is 0, 1, 2 (NUMBER)
  console.log(typeof index) // "number"
}
```

Compiles to:
```javascript
let index = 0;
for(; index < items.length; index++) { 
  let item = items[index];  // numeric indexing
}
```

## The Solution

The type inference system now:

1. **Detects array types** - Recognizes when you're iterating over a variable typed as `array[]` or `Array<T>`
2. **Warns about missing `:array`** - When you iterate an array with an index variable but no `:array` annotation
3. **Infers correct types** - Properly types loop variables:
   - With `:array`: index is `number`
   - Without `:array`: index is `string`
   - Value type is inferred from array element type

## Warning Message

When you iterate an array without `:array`, you'll see:

```
⚠️ Iterating array without ':array' annotation - variable 'index' will be 
   string ("0", "1", ...) instead of number. Add ': array' after the 
   expression to fix this.
```

## Examples

### ✅ Correct Usage

```blop
// Using :array for arrays
items: string[] = ['apple', 'banana']
for index, item in items: array {
  console.log(index + 1) // Works: 0 + 1 = 1
}

// No annotation needed for objects
obj = { a: 1, b: 2 }
for key, value in obj {
  // key is string (correct for objects)
}

// No warning when not using index
for item in items {
  console.log(item) // No index, no problem
}
```

### ⚠️ Will Generate Warning

```blop
items: string[] = ['apple', 'banana']
for index, item in items {
  // Warning: index is string, not number
  console.log(index + 1) // Bug: "0" + 1 = "01" (string concat!)
}
```

## Implementation

Added in:
- `/src/inference/handlers/statements.js` - Main implementation
- `/vscode/blop-linter/server/src/inference/handlers/statements.js` - VSCode extension

The `for_loop` handler:
- Creates a new scope for loop variables
- Infers index type based on `:array` annotation
- Checks expression type to detect arrays
- Generates warnings for likely mistakes
- Infers element type from array types

## Testing

Run the test suite:
```bash
npm test -- for-loop-inference
```

All existing tests continue to pass with this addition.
