# Blop vs TypeScript: Syntax Differences

This document covers the biggest surprises for TypeScript developers picking up Blop. It focuses on the changes that will trip you up first, not minor style details.

---

## Functions: `def` instead of `function`

In TypeScript you reach for `function` or a `const` arrow. In Blop, named functions use `def`.

**TypeScript**
```typescript
function greet(name: string): string {
  return `Hello ${name}`;
}

const greet = (name: string): string => `Hello ${name}`;
```

**Blop**
```typescript
def greet(name: string): string {
  return 'Hello 'name
}

greet = (name: string): string => 'Hello 'name
```

`def` is not just a keyword alias — it is the only way to declare a named function. Arrow functions assigned to a variable work as you would expect.

---

## Variables: no `let`, `const`, or `var`

Blop uses Python-style bare assignment. There is no declaration keyword.

**TypeScript**
```typescript
let count = 0;
const name = 'Alice';
```

**Blop**
```typescript
count = 0
name = 'Alice'
```

All variables are block-scoped (compiled to `let`). Re-using `=` on an already-declared name is a **compile error**. To update a variable you must use `:=`.

**TypeScript**
```typescript
let depth = 10;
depth = 20; // fine
```

**Blop**
```typescript
depth = 10
depth := 20  // must use := for reassignment
depth = 20   // ERROR: variable already declared
```

This distinction exists intentionally: `=` always means "introduce a new binding here", and `:=` always means "mutate an existing one".

---

## `if` / `elseif`: no parentheses, no `else if`

Condition parentheses are dropped, and the ladder keyword is `elseif` (one word).

**TypeScript**
```typescript
if (page === 'dog') {
  // ...
} else if (page === 'cat') {
  // ...
} else {
  // ...
}
```

**Blop**
```typescript
if page == 'dog' {
  // ...
} elseif page == 'cat' {
  // ...
} else {
  // ...
}
```

`else if` (two words) is not valid syntax. Always write `elseif`.

---

## Significant whitespace in string concatenation

This is the most disorienting change. Blop has no `+` for strings and no template literal syntax. Instead, **adjacency without whitespace** concatenates. A space between two tokens means "separate expression items"; no space means "join them into one string".

**TypeScript**
```typescript
const message = `Hello, ${name}!`;
const url = `https://api.example.com/${id}`;
```

**Blop**
```typescript
message = 'Hello, 'name'!'
url = `https://api.example.com/`id
```

A gap anywhere breaks the concatenation:

```typescript
message = 'Hello, ' name '!'  // NOT a single string — parse error or wrong result
message = 'Hello, 'name'!'    // correct
```

You can mix quote styles freely (`'`, `"`, `` ` `` are all equivalent), and you can inline computed expressions by wrapping them in parentheses:

```typescript
text = 'Result: '(a + b)''
```

> **Safe rule:** always use a single space between tokens that are not being concatenated. Multi-space alignment (e.g. `url     = ...`) is invalid in Blop because the parser uses whitespace to determine expression boundaries. Stick to one space everywhere unless you know the grammar allows more.

---

## Ternary: `if … => … else …`

Blop has no `? :` operator. The ternary form reuses `if` with a fat arrow.

**TypeScript**
```typescript
const label = count > 1 ? 'items' : 'item';
```

**Blop**
```typescript
label = if count > 1 => 'items' else 'item'
```

---

## `for` loops: `in` uses JS `for…in`, `of` uses a numeric counter

In JavaScript, `for…of` iterates values and `for…in` iterates keys. Blop keeps `for…in` with its JavaScript meaning (string keys, good for objects) but adds `for…of` as a way to get a **zero-based integer index** alongside the value — it does not simply iterate values like JS `for…of`.

| Loop form | What you get |
|-----------|--------------|
| `for x in list` | values only — `x` is each element |
| `for k, v in obj` | string key + value (JS `for…in`) |
| `for i, x of list` | integer index + value (manual counter) |

**Blop**
```typescript
for pet in petList {
  console.log(pet)        // value
}

for index, pet of petList {
  console.log(index, pet) // 0-based integer index + value
}

for key, value in user {
  console.log(key, value) // string key + value (JS for…in)
}
```

The `of` form compiles to a manual `for(; i < arr.length; i++)` loop, so `index` is always a proper integer. The `in` form compiles to JS `for…in`, which means keys are strings — this is the right choice for plain objects but works on arrays too (keys become `"0"`, `"1"`, etc., and the value is still resolved correctly).

---

## Imports: three distinct forms

Blop imports look similar to ES modules but have one extra form and different aliasing syntax.

**TypeScript**
```typescript
import Index from './index';
import { createRouter, createRoute as something } from './routing';
import * as middleware from 'webpack-dev-middleware';
import 'express';
```

**Blop**
```typescript
import Index from './index.blop'
import { createRouter, createRoute as something } from './routing.blop'
import 'webpack-dev-middleware' as middleware   // note: string first, name last
import 'express'
```

The namespace import flips the order: the module string comes first, the binding name comes last with `as`.

---

## No semicolons

Blop has no statement terminators. Newlines delimit statements. This is consistent — do not add semicolons.

---

## Summary table

| Feature | TypeScript | Blop |
|---------|-----------|------|
| Named function | `function foo() {}` | `def foo() {}` |
| Variable declaration | `let x = 1` | `x = 1` |
| Variable reassignment | `x = 2` | `x := 2` |
| String interpolation | `` `Hello ${name}` `` | `'Hello 'name` |
| Ternary | `cond ? a : b` | `if cond => a else b` |
| `else if` | `else if` | `elseif` |
| Condition parens | required | none |
| Namespace import | `import * as m from 'pkg'` | `import 'pkg' as m` |
| Semicolons | optional but common | not used |
