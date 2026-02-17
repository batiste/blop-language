# Built-in Object Types

This document describes how built-in JavaScript object types are defined in the Blop type system.

## Overview

The Blop type checker needs to understand the structure of built-in JavaScript objects like `Math`, `console`, `JSON`, etc. to validate property access at compile time.

Instead of hardcoding these definitions in the type checking logic, we use a centralized registry of built-in types defined in [src/inference/builtinTypes.js](../src/inference/builtinTypes.js).

## Architecture

### Files

- **`src/inference/builtinTypes.js`** - Registry of all built-in object types and their properties
- **`src/inference/typeSystem.js`** - Type system that uses the registry via `getPropertyType()`

### How It Works

1. When the type checker encounters property access like `Math.random`, it calls `getPropertyType('Math', 'random')`
2. `getPropertyType()` checks if `Math` is a built-in type using `isBuiltinObjectType()`
3. If it is, it looks up the property definition in `builtinObjectTypes`
4. Returns the property type (e.g., `'function'`) or `null` if the property doesn't exist

## Adding New Built-in Types

To add a new built-in object type, edit `src/inference/builtinTypes.js`:

```javascript
export const builtinObjectTypes = {
  // ... existing types ...
  
  // Add your new type
  MyObject: {
    property1: 'string',
    property2: 'number',
    method1: 'function',
    // Use union types for complex types
    optional: 'string | undefined',
  },
};
```

Then run:
```bash
npm run linter  # Sync changes to VSCode extension
```

## Currently Supported Built-in Types

- **VNode** - Snabbdom virtual DOM nodes (elm, data, children, etc.)
- **Math** - Math constants and functions (PI, random, floor, sqrt, etc.)
- **console** - Console logging methods (log, warn, error, table, etc.)
- **JSON** - JSON parsing and serialization (parse, stringify)
- **Object** - Object constructor static methods (keys, values, entries, assign, etc.)
- **Array** - Array constructor static methods (isArray, from)
- **Date** - Date constructor static methods (now, parse, UTC)
- **Number** - Number constructor static methods and constants (isNaN, MAX_VALUE, etc.)
- **String** - String constructor static methods (fromCharCode, fromCodePoint)
- **Promise** - Promise constructor static methods (all, resolve, reject, etc.)
- **window** - Browser window object (document, alert, fetch, etc.)
- **document** - Browser document object (getElementById, querySelector, etc.)

## Type Annotations

Property types in `builtinObjectTypes` use Blop type annotation syntax:

- **`'string'`** - String type
- **`'number'`** - Number type
- **`'boolean'`** - Boolean type
- **`'function'`** - Function type
- **`'any'`** - Any type (allows any value)
- **`'string | undefined'`** - Union type (can be string or undefined)
- **`'{name: string, age: number}'`** - Object structure type

## Testing

Built-in types should be tested in two ways:

1. **JavaScript tests** (`src/tests/builtin-object-types.test.js`) - Fast tests that verify compile-time type checking
2. **Blop tests** (`src/tests/builtin-objects.test.blop`) - Integration tests that verify runtime behavior

Example test:
```javascript
test('allows access to Math.random', () => {
  const code = `
    def test() {
      val = Math.random()
    }
  `;
  expectCompiles(code);
});
```

## Benefits of This Approach

1. **Centralized** - All built-in type definitions in one place
2. **Maintainable** - Easy to add new types without modifying type system logic
3. **Scalable** - Can handle unlimited built-in types
4. **Consistent** - Same pattern for all built-in types (VNode, Math, etc.)
5. **Type-safe** - Property access is validated at compile time

## Future Enhancements

Possible improvements:

- Auto-generate definitions from TypeScript `.d.ts` files
- Support for method signatures (parameters and return types)
- Instance property types (e.g., array methods like `.map()`, `.filter()`)
- Generic built-in types (e.g., `Array<T>`, `Promise<T>`)
