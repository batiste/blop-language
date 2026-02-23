# Components

Learn how to build and use components in Blop.

## Table of Contents

- [What are Blop Components?](#what-are-blop-components)
- [Function Components](#function-components)
- [Class Components](#class-components)
- [Component State](#component-state)
- [Component Context](#component-context)
- [Lifecycle Methods](#lifecycle-methods)
- [Reacting to Attribute Changes](#reacting-to-attribute-changes)

## What are Blop Components?

Components are reusable building blocks for your UI. In Blop, a component can be either a **Function** or a **Class**. To be recognized as a component, the name must be **capitalized**.

### Function Components

The simplest way to create a component:

```typescript
Input = (ctx: Component) => {
  { attributes } = ctx
  <label>
    = attributes.label
    <input
      name=attributes.name
      value=attributes.value
      type=attributes.type || "text"
    />
  </label>
}

LoginForm = (ctx: Component) => {
  <form>
    <Input label='Username' name='username' value='' />
    <Input label='Password' name='password' type='password' value='' />
  </form>
}
```

### Component Parameters

Every component is a function that receives a single parameter: a **Component class instance** (conventionally named `ctx`). This instance holds:

**Data:**
- **`attributes`** - object with all HTML attributes passed to that component instance:
  ```typescript
  <Card title="Hello" class="primary" />
  // → this instance's attributes = { title: 'Hello', class: 'primary' }
  ```
- **`children`** - array of child VNodes for that instance (empty if none):
  ```typescript
  <Card><span>'child 1'</span><span>'child 2'</span></Card>
  // → this instance's children = [VNode, VNode]
  ```

**Instance Methods** (called on `ctx`):
- `ctx.state(name, initial)` - Create local state for this instance
- `ctx.mount(callback)` - Run code when this instance mounts
- `ctx.unmount(callback)` - Run code before this instance unmounts
- `ctx.onChange(attrName, callback)` - React to attribute changes on this instance (class components only)
- `ctx.context(name, initial)` - Hierarchical context for this instance

**Accessing data:**

The idiomatic way is to destructure at the top of the function body:

```typescript
def Card(ctx: Component) {
  { attributes, children } = ctx
  
  <div class=attributes.class>
    <h2>attributes.title</h2>
    = children
  </div>
}

// Multiple instances on same page - each has separate state/lifecycle
<Card title="First" />
<Card title="Second" />
// → Two separate Component instances with different attributes
```

#### Inline Parameter Destructuring

For pure display components that don't need an handle on the instance of the Component, you can destructure directly in the parameter list:

```typescript
def Badge({ attributes }: Component) {
  <span class=attributes.variant>attributes.text</span>
}

def Layout({ attributes, children }: Component) {
  <div class=attributes.layout>
    = children
  </div>
}
```

> **Note:** When using inline destructuring, the `ctx` binding is not available inside the function body. This means component methods such as `state`, `mount`, `unmount`, and `onChange` cannot be called. Use the `def Foo(ctx: Component)` form for any stateful or lifecycle-aware component.

### Using Components

**Components are just functions.** The difference is how you call them:

- **HTML tag syntax** `<Component ... />` — Blop creates a **Component instance** and passes it as the first parameter. This activates state, lifecycle, and context machinery.
- **Direct function call** `Component({ ... })` — Calls the function directly without creating a Component instance.

```typescript
// ✅ Using HTML tag syntax - creates Component instance with state, lifecycle, etc.
<Input label='Email' name='email' type='email' />

// ✅ With children
<Button class='primary'>
  'Click me!'
</Button>

// ⚠️ Calling as a regular function - no Component instance created
// (State, lifecycle, context won't work if you do this)
= Input({ attributes: { label: 'Email', name: 'email', type: 'email' } })
```

**Best practice:** Use HTML tag syntax for Capitalized functions so you get the full component experience.

### Helper Functions vs Components

**There is no technical distinction** — they're all just functions. The difference is purely **how you use them**:

**Capitalized functions:**
- Designed to be called with `<Component ... />` tag syntax
- When called this way, they receive a Component instance as the first parameter
- This gives them access to state, lifecycle methods, and context
- Blop automatically manages mounting/unmounting

**Lowercase functions:**
- Designed to be called directly as expressions: `helper(args)`
- Are regular function calls with no special machinery
- Return a VNode

```typescript
// Capitalized - designed for HTML tag usage
def Card(ctx: Component) {
  { attributes, children } = ctx
  <div class=attributes.class>
    = children
  </div>
}

// Use with HTML syntax - creates a Component instance
<Card class="primary"><h1>'Title'</h1></Card>

// Lowercase - designed for direct function calls
def link(url, text) {
  <a href=url>text</a>
}

// Called directly
<div>link('/home', 'Home')</div>

// or with assignment
<div>
  homeLink = link('/home', 'Home')
  = homeLink
</div>
```

**The key rule:** Use Capitalized functions when you need state, lifecycle, or context. Use lowercase for simple VNode-generating utilities. At the end of the day, they're both just functions — the usage pattern is what makes them what they are.

## Function Components

Function components are the simplest form:

```typescript
// Simple display component — inline destructuring
Greeting = ({ attributes }: Component) => {
  <h1>'Hello 'attributes.name'!'</h1>
}

// With children
Card = ({ attributes, children }) => {
  <div class=attributes.class>
    <h2>attributes.title</h2>
    <div class='card-body'>
      = children
    </div>
  </div>
}

// Stateful component — needs ctx
Counter = (ctx: Component) => {
  { value, setState } = ctx.state<number>('count', 0)
  
  <div>
    <button on={ click: () => setState(value - 1) }>'-'</button>
    <span>' 'value' '</span>
    <button on={ click: () => setState(value + 1) }>'+'</button>
  </div>
}
```

## Class Components

For more complex components, extend the `Component` class:

```typescript
import { Component } from 'blop'

class MouseTracker extends Component {
  def render() {
    { text } = this.attributes
    <div>
      <p>'Hello 'text''</p>
      <p>JSON.stringify(this.pos)</p>
    </div>
  }

  def mouseMove(e) {
    // Store state on the component
    this.pos = { x: e.x, y: e.y }
    // Trigger re-render
    this.refresh()
  }

  def onMount() {
    this.mouseMoveHandler = (e) => this.mouseMove(e)
    document.addEventListener('mousemove', this.mouseMoveHandler)
  }

  def onUnmount() {
    document.removeEventListener('mousemove', this.mouseMoveHandler)
  }
}
```

### Using Class Components

```typescript
<MouseTracker text="world" />
```

### Component Class Methods

The `Component` class provides these methods:

```typescript
class MyComponent extends Component {
  // Required: render the component
  render(attributes, children) : VNode { 
    // Return a VNode tree. In blop, your simply write HTML in the render method, and it gets compiled to VNodes.
    <div>
      = children
    </div>
  }

  // Schedule a re-render
  this.refresh()

  // Lifecycle methods
  onMount() { ... }
  onUnmount() { ... }

  // State management
  state(name, initialValue) { ... }
  
  // Context management
  context(name, initialValue) { ... }

  // React to attribute changes
  onChange(attribute, callback) { ... }
}
```

## Component State

Use `ctx.state` to maintain component-local state:

```typescript
Counter = (ctx: Component) => {
  // Initialize state with name and initial value
  { value as counter, setState } = ctx.state('counter', 0)
  
  increase = () => setState(counter + 1)
  decrease = () => setState(counter - 1)
  
  <div>
    <button on={ click: increase }>'+'</button>
    <button on={ click: decrease }>'-'</button>
    <b style={ 'font-size': '20px' }>' 'counter' '</b>
  </div>
}
```

### How ctx.state Works

**Signature:** `ctx.state(name: string, initial: any): { value: any, setState: Function }`

- State is stored internally on the component instance
- Calling `setState` triggers a re-render of the component
- State persists as long as the component is mounted
- When component unmounts, state is lost

### Multiple State Values

```typescript
TodoList = (ctx: Component) => {
  { value as items, setState as setItems } = ctx.state('items', [])
  { value as input, setState as setInput } = ctx.state('input', '')
  
  addItem = () => {
    setItems([...items, input])
    setInput('')
  }
  
  <div>
    <input
      value=input
      on={ input: (e) => setInput(e.target.value) }
    />
    <button on={ click: addItem }>'Add'</button>
    <ul>
      for item in items {
        <li>item</li>
      }
    </ul>
  </div>
}
```

## Component Context

Context allows parent components to pass data to deeply nested children without prop drilling.

**Signature:** `ctx.context(name: string, initial: any): { value: any, setContext: Function }`

```typescript
// Child component - consumes context
ContextConsumer = (ctx: Component) => {
  { value } = ctx.context('specialNumber')
  <p>'Value from context: 'value''</p>
}

// Parent component - provides context
ContextHolder = (ctx: Component) => {
  { setContext } = ctx.context('specialNumber', Math.random())
  
  changeValue = () => setContext(Math.random())
  
  <div>
    <ContextConsumer />
    <button on={ click: changeValue }>'Change value'</button>
  </div>
}
```

### How Context Works

- Context is hierarchical - child components look up the parent chain for a context value
- When a child calls `ctx.context(name)`, it automatically registers as a **listener** to that context
- When the parent calls `setContext(newValue)`, all listening children are re-rendered automatically
- **Important:** Children passed as props won't have access to the parent's context (they're rendered in their original scope)

### Example: Theme Context

```typescript
ThemeButton = (ctx: Component) => {
  { value as theme } = ctx.context('theme')
  className = theme == 'dark' ? 'btn-dark' : 'btn-light'
  
  <button class=className>
    = children
  </button>
}

App = (ctx: Component) => {
  { value as theme, setContext as setTheme } = ctx.context('theme', 'light')
  
  toggleTheme = () => {
    setTheme(theme == 'light' ? 'dark' : 'light')
  }
  
  <div>
    <button on={ click: toggleTheme }>'Toggle Theme'</button>
    <ThemeButton>'Themed Button'</ThemeButton>
  </div>
}
```

## Lifecycle Methods

Components have mount and unmount methods for registering side effects.

**Signature:**
- `ctx.mount(callback: Function)`
- `ctx.unmount(callback: Function)`

```typescript
// Reusable helper function
def useWindowWidth(ctx) {
  { value as width, setState as setWidth } = ctx.state('width', window.innerWidth)
  
  handleResize = () => setWidth(window.innerWidth)
  
  ctx.mount(() => {
    console.log('Listening to window resize')
    window.addEventListener('resize', handleResize)
  })
  
  ctx.unmount(() => {
    console.log('Cleanup resize listener')
    window.removeEventListener('resize', handleResize)
  })
  
  return width
}

// Using the helper
WidthReactive = (ctx: Component) => {
  width = useWindowWidth(ctx)
  <p>'Window width: 'width'px'</p>
}
```

### Common Patterns

#### Interval/Timer

```typescript
Timer = (ctx: Component) => {
  { value as seconds, setState as setSeconds } = ctx.state('seconds', 0)
  
  ctx.mount(() => {
    intervalId = setInterval(() => {
      setSeconds(seconds + 1)
    }, 1000)
    
    // Return cleanup function
    return () => clearInterval(intervalId)
  })
  
  <div>'Elapsed: 'seconds's'</div>
}
```

#### Fetch on Mount

```typescript
DataLoader = (ctx: Component) => {
  { value as data, setState as setData } = ctx.state('data', null)
  { value as loading, setState as setLoading } = ctx.state('loading', true)
  
  ctx.mount(async () => {
    response = await fetch(attributes.url)
    json = await response.json()
    setData(json)
    setLoading(false)
  })
  
  <div>
    if loading {
      <p>'Loading...'</p>
    } else {
      <pre>JSON.stringify(data, null, 2)</pre>
    }
  </div>
}
```

## Reacting to Attribute Changes

When attributes change, the component re-renders, but lifecycle methods don't run again. Use `onChange` to react to attribute changes:

```typescript
class FetchOnURLChange extends Component {
  def render() {
    <div>
      if this.list {
        <ul>
          for item in this.list {
            <li>item.name</li>
          }
        </ul>
      } else {
        <p>'Loading...'</p>
      }
    </div>
  }

  async def fetchData() {
    response = await fetch(this.attributes.url)
    this.list = (await response.json()).results
    this.refresh()
  }

  def onMount() {
    this.fetchData()
    // Re-fetch when URL changes
    this.onChange('url', () => this.fetchData())
  }
}

// Usage
DataDisplay = (ctx: Component) => {
  { value as counter, setState } = ctx.state('counter', 0)
  
  ctx.mount(() => {
    setInterval(() => setState(counter + 1), 5000)
  })
  
  <div>
    <FetchOnURLChange url="https://api.example.com?page="counter"" />
  </div>
}
```

### onChange Signature

**`this.onChange(attributeName: string, callback: Function)`**

- Only works in Class Components
- Must be set up in `onMount`
- Callback is called whenever the attribute value changes
- Useful for triggering side effects

## Best Practices

### 1. Keep Components Small

```typescript
// ❌ Too large
BigComponent = (ctx: Component) => {
  // 300 lines of code...
}

// ✅ Break into smaller pieces
Header = ({ attributes }: Component) => { ... }
Sidebar = ({ attributes }: Component) => { ... }
Content = ({ attributes }: Component) => { ... }

Page = ({ attributes }: Component) => {
  <div>
    <Header />
    <Sidebar />
    <Content />
  </div>
}
```

### 2. Use Reusable Helpers

```typescript
// Reusable helper function
def useFetch(ctx, url) {
  { value as data, setState as setData } = ctx.state('data', null)
  { value as error, setState as setError } = ctx.state('error', null)
  
  ctx.mount(async () => {
    try {
      response = await fetch(url)
      setData(await response.json())
    } catch err {
      setError(err)
    }
  })
  
  return { data, error }
}

// Use in components
UserProfile = (ctx: Component) => {
  { data, error } = useFetch(ctx, `/api/users/`ctx.attributes.userId``)
  
  <div>
    if error {
      <p>'Error: 'error.message''</p>
    } elseif data {
      <div>'User: 'data.name''</div>
    } else {
      <p>'Loading...'</p>
    }
  </div>
}
```

### 3. Avoid State in Render

```typescript
// ❌ Don't do this - creates infinite loop
BadCounter = (ctx: Component) => {
  { value, setState } = ctx.state('count', 0)
  setState(value + 1)  // ❌ Called every render!
  
  <div>value</div>
}

// ✅ Update state in event handlers
GoodCounter = (ctx: Component) => {
  { value, setState } = ctx.state('count', 0)
  
  <div>
    <button on={ click: () => setState(value + 1) }>'Increment'</button>
    <div>value</div>
  </div>
}
```

## See Also

- [Syntax Reference](./SYNTAX_REFERENCE.md) - Language basics
- [State Management](./STATE_MANAGEMENT.md) - Application-level state
- [Virtual DOM](./VIRTUAL_DOM.md) - How rendering works
- [Examples](../example/) - Real-world examples
