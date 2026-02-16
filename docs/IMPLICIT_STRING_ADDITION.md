# Implicit String Addition to Virtual Nodes

## Overview

As of this update, Blop automatically adds string literals and string interpolations to virtual node children without requiring the explicit `=` operator. This makes the syntax cleaner and more intuitive for text content.

## Before and After

### Before (explicit `=` required)

```blop
def Greeting() {
  name = 'Alice'
  <div>
    = 'Hello, '
    = name
    = '!'
  </div>
}
```

### After (implicit for strings)

```blop
def Greeting() {
  name = 'Alice'
  <div>
    'Hello, '
    = name
    '!'
  </div>
}
```

Or even better with string interpolation:

```blop
def Greeting() {
  name = 'Alice'
  <div>
    'Hello, 'name'!'
  </div>
}
```

## What Gets Auto-Added

The following expressions are automatically added to virtual node children:

1. **String literals**: `'text'` or `"text"`
2. **String interpolation**: `'Hello 'name` or `name' says hello'`

## What Still Requires `=`

Non-string expressions still require explicit `=`:

```blop
def Counter() {
  count = 5
  <div>
    'Count: '  // implicit - no = needed
    = count    // explicit - = required for variables
  </div>
}
```

## Rationale

String literals and string interpolation have no side effects and their intent is clear - they're meant to be displayed. Variables and function calls, on the other hand, might have side effects or multiple purposes, so they continue to require explicit `=` for clarity.

## Backward Compatibility

This change is fully backward compatible. Code using explicit `=` for strings continues to work as before:

```blop
def OldStyle() {
  <div>
    = 'This still works!'
  </div>
}
```

## Examples

### Inline vs Multi-line

Both styles work:

```blop
// Inline (no = needed since before)
def Inline() {
  <span>'Hello'</span>
}

// Multi-line (now also no = needed!)
def MultiLine() {
  <span>
    'Hello'
  </span>
}
```

### Mixed Content

```blop
def MixedContent() {
  user = { name: 'Bob', age: 30 }
  <div>
    'User: '
    = user.name
    ' (age: '
    = user.age
    ')'
  </div>
}
```

### Nested Elements

```blop
def NestedElements() {
  <div>
    <h1>
      'Welcome!'
    </h1>
    <p>
      'This is a paragraph.'
    </p>
  </div>
}
```
