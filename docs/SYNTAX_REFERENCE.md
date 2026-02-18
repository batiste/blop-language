# Blop Language Syntax Reference

Complete reference for the Blop language syntax.

## Table of Contents

- [Import Syntax](#import-syntax)
- [Variables](#variables)
- [Functions](#functions)
- [Loops](#loops)
- [Conditionals](#conditionals)
- [Strings](#strings)
- [Objects and Arrays](#objects-and-arrays)
- [Classes](#classes)
- [Virtual DOM](#virtual-dom)
- [Modern Features](#modern-features)

## Import Syntax

### Grammar

```
import %name% from %file%
import { %name%[ as %rename%]?[, %name%[ as %rename%]?]* } from %file%
import %file% as %name%
import %file%
```

### Examples

```blop
import Index from './index.blop'
import { createRouter, createRoute as something } from './routing.blop'
import 'webpack-dev-middleware' as middleware
import 'express'
```

## Variables

Variables are declared Python-style. Variables are hoisted to the top of the current block scope and compiled as `let` variables.

```blop
// Simple assignment
index = 1
name = 'Alice'
count = 42

// Destructuring
{ x, y, z as depth } = { x: 1, y: 2, z: 100.0 }

// Reassignment requires explicit operator
depth = index       // ERROR: reassigning will trigger an error
depth := index + 1  // CORRECT: use := for reassignment
```

## Functions

### Grammar

```
async? def %name%? (%parameters%)[:%annotation%]? { %statements% }
async? (%parameters%)[:%annotation%]? => { %statements% }
async? (%parameters%)[:%annotation%]? => %expression%
```

### Examples

```blop
// Function declaration with type annotation
def greet(name='John Doe'): string {
  return `Hello `name``
}

// Async function
async def fetchData(url) {
  response = await fetch(url)
  return response.json()
}

// Arrow functions
add = (a, b): number => a + b
square = (a) => a * a
multiply = (a, b) => {
  return a * b
}
```

## Loops

### Syntax

```
for %value% in %expression%[:%annotation%]? { %statements% }
for %key%, %value% in %expression%[:%annotation%]? { %statements% }
while %expression% { %statements% }
```

### Examples

```blop
// For-in loop
petList = ['cat', 'dog', 'goldfish']

for pet in petList {
  console.log(pet)
}

for index, pet in petList {
  console.log(index, pet)
}

// For-in over object keys
user = { name: 'Alice', age: 30 }
for key, value in user {
  console.log(key, value)
}

// While loop
count = 0
while count < 10 {
  console.log(count)
  count := count + 1
}
```

## Conditionals

### Grammar

```
if %expression% { %statements% }
if %expression% { %statements% } else { %statements% }
if %expression% { %statements% } elseif %expression% { %statements% }
if %expression% { %statements% } elseif %expression% { %statements% } else { %statements% }
```

### Examples

```blop
def renderPage(state) {
  if state.page == 'dog' {
    <DogPage state=state></DogPage>
  } elseif state.page == 'meme' {
    <MemePage state=state></MemePage>
  } else {
    <span>'No page found'</span>
  }
}

// Ternary operator
result = condition ? 'yes' : 'no'
```

## Strings

Strings can be delimited with `"`, `'`, or `` ` `` and are all functionally equivalent.

String concatenation is achieved by placing strings and expressions adjacent to each other:

```blop
whitespace = " "
greeting = 'hello'
name = 'world'

// String concatenation
message = greeting whitespace name  // "hello world"
console.log('hello' whitespace `world`)  // hello world

// Template-like syntax
count = 42
message = 'The answer is 'count''  // "The answer is 42"
```

## Objects and Arrays

Blop supports ES6-style objects and arrays:

```blop
// Object literal
person = {
  name: 'Alice',
  age: 30,
  city: 'Paris'
}

// Array literal
numbers = [1, 2, 3, 4, 5]
mixed = [1, 'two', { three: 3 }]

// Destructuring
{ name, age } = person
[first, second, ...rest] = numbers

// Object spread
defaults = { timeout: 5000, retries: 3 }
options = { ...defaults, timeout: 10000 }

// Array spread
arr1 = [1, 2, 3]
arr2 = [...arr1, 4, 5, 6]
```

## Classes

Similar to ES6 classes:

```blop
class ExampleClass {
  def constructor(something=false) {
    this.routes = [1, 2, 3]
    this.state = { hello: 1, world: 2 }
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
    // Process data
    return data.map((item) => item.value)
  }
}

// Instantiation
instance = new ExampleClass(true)
```

## Virtual DOM

### Basic Syntax

```
<name[%attributes%]*/>
<name[%attributes%]*>%statements%</name>
<name[%attributes%]*>%expression%</name>
```

Attributes:
```
%whitespace% %name%=%expression%
%whitespace% %name%  // boolean attribute
```

### Examples

```blop
// Simple element
def Button(attributes) {
  <button class="btn">attributes.label</button>
}

// Nested elements
def Card(attributes) {
  <div class="card">
    <h2>attributes.title</h2>
    <p>attributes.description</p>
  </div>
}

// Using assignment operator (=)
def List(attributes) {
  items = attributes.items
  <ul>
    for item in items {
      = <li>item</li>
    }
  </ul>
}
```

### Rules for Virtual DOM

1. **Must be inside a function** - Virtual DOM statements create return statements
2. **Single root per branch** - Each conditional branch should have one root element
3. **Code after root is unreachable** - The root generates a return statement

```blop
def Example(state) {
  // This is OK - single root with conditionals
  if state.loading {
    <div>'Loading...'</div>
  } else {
    <div>'Content'</div>
  }

  // This code will never execute (after virtual DOM root)
  console.log('This won't run!')
}
```

### Events

Events are attached using the `on` attribute with an object:

```blop
def ClickableButton(attributes) {
  handleClick = (event) => {
    console.log('Button clicked!', event)
    attributes.onClick?.()
  }

  <button on={ click: handleClick }>
    'Click me'
  </button>
}

// Multiple events
def Input(attributes) {
  <input
    type="text"
    value=attributes.value
    on={
      input: (e) => attributes.onInput(e.target.value),
      focus: () => console.log('focused'),
      blur: () => console.log('blurred')
    }
  />
}
```

### Hooks

Blop uses [Snabbdom hooks](https://github.com/snabbdom/snabbdom#hooks) for lifecycle management:

```blop
def FocusedInput(attributes) {
  hooks = {
    insert: (vnode) => {
      vnode.elm.focus()
      vnode.elm.select()
    },
    destroy: (vnode) => {
      console.log('Input destroyed')
    }
  }

  <input
    hooks
    type="text"
    value=attributes.value
  />
}
```

Available hooks:
- `pre` - Before patch
- `init` - Element created
- `create` - Element added to DOM
- `insert` - Element inserted into parent
- `prepatch` - Before element patched
- `update` - Element updated
- `postpatch` - After element patched
- `destroy` - Element removed from parent
- `remove` - Element being removed
- `post` - After patch

## Modern Features

### Optional Chaining

```blop
// Safely access nested properties
name = user?.profile?.name
age = user?.profile?.age

// With arrays
first = list?.[0]
item = obj?.['property']
```

### Nullish Coalescing

```blop
// Use default only for null/undefined (not for 0, '', false)
count = value ?? 0
text = message ?? 'No message'

// Chaining
result = value1 ?? value2 ?? value3 ?? 'default'
```

### Object Spread

```blop
// Clone and merge objects
defaults = { timeout: 5000, retries: 3 }
config = { ...defaults, timeout: 10000 }

// Spreading arrays
arr = [...array1, ...array2]
```

## See Also

- [Components](./COMPONENTS.md) - Component system
- [Modern Features](./MODERN_FEATURES.md) - Detailed modern JS features
- [Generics](./GENERICS_QUICK_REFERENCE.md) - Generic types
- [Virtual DOM](./VIRTUAL_DOM.md) - Deep dive into Virtual DOM
