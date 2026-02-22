# Blop Language Syntax Reference

A practical reference for writing Blop code. Each section explains the syntax, shows examples, and calls out any gotchas.

## Table of Contents

- [Imports](#imports)
- [Variables](#variables)
- [Functions](#functions)
- [Loops](#loops)
- [Conditionals](#conditionals)
- [Strings](#strings)
- [Objects and Arrays](#objects-and-arrays)
- [Classes](#classes)
- [Type Aliases](#type-aliases)
- [try / catch / throw](#try--catch--throw)
- [Compound Assignment](#compound-assignment)
- [Virtual DOM](#virtual-dom)
- [Modern Features](#modern-features)

---

## Imports

Blop supports four import forms:

```typescript
// Named import
import Index from './index.blop'

// Named imports with optional aliasing
import { createRouter, createRoute as something } from './routing.blop'

// Import a module and bind it to a name
import 'webpack-dev-middleware' as middleware

// Side-effect import
import 'express'
```

---

## Variables

Variables are declared Python-style — no `let`, `const`, or `var`.
They are hoisted to the top of the current block scope and compiled as `let`.

```typescript
// Declare a variable
index = 1
name = 'Alice'

// Destructuring
{ x, y, z as depth } = { x: 1, y: 2, z: 100.0 }

// Type annotation
count: number = 0
```

**Reassignment** requires the `:=` operator. Using `=` on an already-declared variable is an error:

```typescript
depth = index       // ERROR: variable already declared
depth := index + 1  // OK: explicit reassignment
```

---

## Functions

Functions can be declared with `def` or as arrow functions. Both support `async` and optional type annotations.

```typescript
// Named function with a default parameter and return type annotation
def greet(name='John Doe'): string {
  return `Hello `name``
}

// Async function
async def fetchData(url) {
  response = await fetch(url)
  return response.json()
}

// Arrow functions — single-expression or block body
add      = (a, b): number => a + b
square   = (a) => a * a
multiply = (a, b) => {
  return a * b
}
```

> Anonymous functions (no name after `def`) are also valid and useful for callbacks or IIFEs.

---

## Loops

### `for … in`, `for … of`

Iterate over arrays or objects. You can optionally capture the index/key as a first variable.

```typescript
petList = ['cat', 'dog', 'goldfish']

// Iterate over values only
for pet in petList {
  console.log(pet)
}

// Get a numerical index for arrays with `for … of`
for index, pet of petList { 
  console.log(index, pet)
}

// Iterate over object keys and values
user = { name: 'Alice', age: 30 }
for key, value in user {
  console.log(key, value)
}
```

### `while`

```typescript
count = 0
while count < 10 {
  console.log(count)
  count := count + 1
}
```

---

## Conditionals

### `if / elseif / else`

```typescript
def renderPage(state) {
  if state.page == 'dog' {
    <DogPage state=state></DogPage>
  } elseif state.page == 'meme' {
    <MemePage state=state></MemePage>
  } else {
    <span>'No page found'</span>
  }
}
```

### Ternary

```typescript
result = if condition => 'yes' else 'no'
```

---

## Strings

Strings can be delimited with `"`, `'`, or `` ` `` — all three are equivalent.

### Concatenation

Place a string and expression **immediately adjacent** (no spaces) to concatenate:

```typescript
name = 'World'

// string + variable + string
message  = 'Hello, 'name'!'   // "Hello, World!"

// variable + string + variable
greeting = 'hello'
result   = greeting' 'name    // "hello world"

// Mix any quote style
mixed    = "Hello, "name`!`   // "Hello, World!"
```

### Inline expressions

Put the expression directly against the string without whitespace:

```typescript
count   = 42
message = 'The answer is 'count     // "The answer is 42"
url     = `https://api.example.com/`id

// Computed expressions in-line
text = 'Result: '(a + b)''           // "Result: 3"
```

---

## Objects and Arrays

Blop uses ES6-style object and array literals, destructuring, and spread.

```typescript
// Object literal
person = {
  name: 'Alice',
  age:  30,
  city: 'Paris'
}

// Array literal
numbers = [1, 2, 3, 4, 5]
mixed   = [1, 'two', { three: 3 }]

// Object destructuring
{ name, age } = person

// Object spread — later keys override earlier ones
defaults = { timeout: 5000, retries: 3 }
options  = { ...defaults, timeout: 10000 }

// Array spread
arr1 = [1, 2, 3]
arr2 = [...arr1, 4, 5, 6]
```

---

## Classes

Classes follow the ES6 pattern. Use `def` for methods and `this` for instance properties.

```typescript
class ExampleClass {
  routes: number[]

  def constructor(something=false) {
    this.routes = [1, 2, 3]
    this.state  = { hello: 1, world: 2 }
  }

  async def fetchData(id) {
    try {
      response = await fetch(`https://api.example.com/`id``)
      return response.json()
    } catch e {
      console.log(e)
      throw new Error('API failure')
    }
  }

  def processData(data) {
    return data.map((item) => item.value)
  }
}

instance = new ExampleClass(true)
```

---

## Type Aliases

Use `type` to name a type for reuse across annotations.

```typescript
// Primitive alias
type UserId   = number
type Username = string

// Object type
type User = {
  id:       number,
  name:     string,
  role?:    'Admin' | 'User'
}

// Union alias
type StringOrNumber = string | number

// Generic alias
type Pair<A, B> = { first: A, second: B }
```

Annotate variables and function parameters with a type alias:

```typescript
user: User = { id: 1, name: 'Alice', role: 'Admin' }

def greet(u: User): string {
  return 'Hello, 'u.name
}
```

---

## try / catch / throw

```typescript
try {
  response = await fetch('/api/data')
  data     = await response.json()
} catch error {
  console.log('Request failed:', error)
}

// Throw an error
throw new Error('Something went wrong')
```

> `catch` binds the error to the name you provide — there is no optional binding.

---

## Compound Assignment

Shorthand operators update a variable in place.

```typescript
count  = 0
count += 1    // 1
count -= 1    // 0
count *= 4    // 0  (0 * 4)
count  = 10
count /= 2    // 5

// Works on properties too
obj = { value: 10 }
obj.value += 5   // 15
```

---

## Virtual DOM

Blop has a built-in JSX-like syntax for building UIs, compiled with [Snabbdom](https://github.com/snabbdom/snabbdom).

### Element syntax

```typescript
// Self-closing
<input type="text" />

// With children
<div class="card">
  <h2>title</h2>
</div>
```

Attributes accept expressions or bare names (treated as boolean `true`):

```typescript
<button disabled class=buttonClass>label</button>
```

### Returning elements from a list with `=`

Use the `=` operator to yield elements inside a loop:

```typescript
def List(attributes) {
  items = attributes.items
  <ul>
    for item in items {
      = <li>item</li>
    }
  </ul>
}
```

### Rules to keep in mind

1. **Must be inside a function** — a Virtual DOM expression compiles into a `return` statement.
2. **One root element per branch** — each `if`/`else` branch should produce a single root.
3. **Code after the root is unreachable** — nothing placed after the root element will run.

```typescript
def Example(state) {
  if state.loading {
    <div>'Loading...'</div>
  } else {
    <div>'Content'</div>
  }

  // Unreachable — the Virtual DOM root already returned
  console.log('This will never run')
}
```

### Events

Attach event listeners with the `on` attribute, passing an object of handler functions:

```typescript
def ClickableButton(attributes) {
  handleClick = (event) => {
    console.log('clicked', event)
    attributes.onClick?.()
  }

  <button on={ click: handleClick }>
    'Click me'
  </button>
}

// Multiple events on the same element
def Input(attributes) {
  <input
    type="text"
    value=attributes.value
    on={
      input: (e) => attributes.onInput(e.target.value),
      focus: () => console.log('focused'),
      blur:  () => console.log('blurred')
    }
  />
}
```

### Lifecycle hooks

Blop uses [Snabbdom hooks](https://github.com/snabbdom/snabbdom#hooks) for element lifecycle events. Pass a `hooks` object as an attribute:

```typescript
def FocusedInput(attributes) {
  hooks = {
    insert:  (vnode) => { vnode.elm.focus(); vnode.elm.select() },
    destroy: (vnode) => { console.log('removed') }
  }

  <input hooks type="text" value=attributes.value />
}
```

Available hooks: `pre`, `init`, `create`, `insert`, `prepatch`, `update`, `postpatch`, `destroy`, `remove`, `post`.

---

## Modern Features

### Optional chaining

Safely access a property that may not exist — returns `undefined` instead of throwing:

```typescript
name  = user?.profile?.name
first = list?.[0]
value = obj?.['key']
```

### Nullish coalescing

Use a fallback only when a value is `null` or `undefined`.
Unlike `||`, it does **not** fall back on `0`, `''`, or `false`:

```typescript
count  = value   ?? 0
text   = message ?? 'No message'
result = a ?? b ?? c ?? 'default'
```

### Spread

```typescript
// Merge objects (later keys win)
config = { ...defaults, timeout: 10000 }

// Combine arrays
all = [...array1, ...array2]
```

---

## See Also

- [Components](./COMPONENTS.md) — Component system
- [Virtual DOM](./VIRTUAL_DOM.md) — Deep dive into Virtual DOM
- [Modern Features](./MODERN_FEATURES.md) — Modern JS features in detail
- [Generics](./GENERICS_QUICK_REFERENCE.md) — Generic types
