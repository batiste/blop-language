# Components

Learn how to build and use components in Blop.

## Table of Contents

- [What are Blop Components?](#what-are-blop-components)
- [Function Components](#function-components)
- [Class Components](#class-components)
- [Component State](#component-state)
- [Component Context](#component-context)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Reacting to Attribute Changes](#reacting-to-attribute-changes)

## What are Blop Components?

Components are reusable building blocks for your UI. In Blop, a component can be either a **Function** or a **Class**. To be recognized as a component, the name must be **capitalized**.

### Function Components

The simplest way to create a component:

```typescript
Input = (attributes, children, node) => {
  <label>
    = attributes.label
    <input
      name=attributes.name
      value=attributes.value
      type=attributes.type || "text"
    />
  </label>
}

LoginForm = (attributes, children, node) => {
  <form>
    <Input label='Username' name='username' value='' />
    <Input label='Password' name='password' type='password' value='' />
  </form>
}
```

### Component Parameters

Every component function receives 3 parameters:

1. **`attributes`** - Object containing all element attributes
2. **`children`** - Array of child elements (empty if none)
3. **`node`** - Component instance (provides hooks and state management)

### Using Components

Components are used like HTML elements:

```typescript
<Input label='Email' name='email' type='email' />

// With children
<Button class='primary'>
  'Click me!'
</Button>

// Components are just functions, so this is equivalent:
= Input({ label: 'Email', name: 'email', type: 'email' }, [])
```

## Function Components

Function components are the simplest form:

```typescript
// Simple component
Greeting = (attributes) => {
  <h1>'Hello 'attributes.name'!'</h1>
}

// With children
Card = (attributes, children) => {
  <div class=attributes.class>
    <h2>attributes.title</h2>
    <div class='card-body'>
      = children
    </div>
  </div>
}

// With node for state/lifecycle
Counter = (attributes, children, node) => {
  { value, setState } = node.useState('count', 0)
  
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
  render(attributes, children, this) { ... }

  // Schedule a re-render
  this.refresh()

  // Lifecycle hooks
  onMount() { ... }
  onUnmount() { ... }

  // State management
  useState(name, initialValue) { ... }
  
  // Context management
  useContext(name, initialValue) { ... }

  // React to attribute changes
  onChange(attribute, callback) { ... }
}
```

## Component State

Use `useState` to maintain component-local state:

```typescript
Counter = (attributes, children, node) => {
  // Initialize state with name and initial value
  { value as counter, setState } = node.useState('counter', 0)
  
  increase = () => setState(counter + 1)
  decrease = () => setState(counter - 1)
  
  <div>
    <button on={ click: increase }>'+'</button>
    <button on={ click: decrease }>'-'</button>
    <b style={ 'font-size': '20px' }>' 'counter' '</b>
  </div>
}
```

### How useState Works

**Signature:** `node.useState(name: string, initial: any): { value: any, setState: Function }`

- State is stored internally on `node.state`
- Calling `setState` triggers a re-render of the component
- State persists as long as the component is mounted
- When component unmounts, state is lost

### Multiple State Values

```typescript
TodoList = (attributes, children, node) => {
  { value as items, setState as setItems } = node.useState('items', [])
  { value as input, setState as setInput } = node.useState('input', '')
  
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

**Signature:** `node.useContext(name: string, initial: any): { value: any, setContext: Function }`

```typescript
// Child component - consumes context
ContextConsumer = (attributes, children, node) => {
  { value } = node.useContext('specialNumber')
  <p>'Value from context: 'value''</p>
}

// Parent component - provides context
ContextHolder = (attributes, children, node) => {
  { setContext } = node.useContext('specialNumber', Math.random())
  
  changeValue = () => setContext(Math.random())
  
  <div>
    <ContextConsumer />
    <button on={ click: changeValue }>'Change value'</button>
  </div>
}
```

### How Context Works

- Context is hierarchical - children inherit from parents
- Changing context triggers re-render in all listening children
- **Important:** Children passed as props won't have access to the parent's context (they're rendered in their original scope)

### Example: Theme Context

```typescript
ThemeButton = (attributes, children, node) => {
  { value as theme } = node.useContext('theme')
  className = theme == 'dark' ? 'btn-dark' : 'btn-light'
  
  <button class=className>
    = children
  </button>
}

App = (attributes, children, node) => {
  { value as theme, setContext as setTheme } = node.useContext('theme', 'light')
  
  toggleTheme = () => {
    setTheme(theme == 'light' ? 'dark' : 'light')
  }
  
  <div>
    <button on={ click: toggleTheme }>'Toggle Theme'</button>
    <ThemeButton>'Themed Button'</ThemeButton>
  </div>
}
```

## Lifecycle Hooks

Components have mount and unmount hooks for side effects.

**Signature:**
- `node.mount(callback: Function)`
- `node.unmount(callback: Function)`

```typescript
// Custom hook pattern
def useWindowWidth(node) {
  { value as width, setState as setWidth } = node.useState('width', window.innerWidth)
  
  handleResize = () => setWidth(window.innerWidth)
  
  node.mount(() => {
    console.log('Listening to window resize')
    window.addEventListener('resize', handleResize)
  })
  
  node.unmount(() => {
    console.log('Cleanup resize listener')
    window.removeEventListener('resize', handleResize)
  })
  
  return width
}

// Using the custom hook
WidthReactive = (attributes, children, node) => {
  width = useWindowWidth(node)
  <p>'Window width: 'width'px'</p>
}
```

### Common Patterns

#### Interval/Timer

```typescript
Timer = (attributes, children, node) => {
  { value as seconds, setState as setSeconds } = node.useState('seconds', 0)
  
  node.mount(() => {
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
DataLoader = (attributes, children, node) => {
  { value as data, setState as setData } = node.useState('data', null)
  { value as loading, setState as setLoading } = node.useState('loading', true)
  
  node.mount(async () => {
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
DataDisplay = (attributes, children, node) => {
  { value as counter, setState } = node.useState('counter', 0)
  
  node.mount(() => {
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
BigComponent = (attributes) => {
  // 300 lines of code...
}

// ✅ Break into smaller pieces
Header = (attributes) => { ... }
Sidebar = (attributes) => { ... }
Content = (attributes) => { ... }

Page = (attributes) => {
  <div>
    <Header />
    <Sidebar />
    <Content />
  </div>
}
```

### 2. Use Custom Hooks

```typescript
// Reusable hook
def useFetch(node, url) {
  { value as data, setState as setData } = node.useState('data', null)
  { value as error, setState as setError } = node.useState('error', null)
  
  node.mount(async () => {
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
UserProfile = (attributes, children, node) => {
  { data, error } = useFetch(node, `/api/users/`attributes.userId``)
  
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
BadCounter = (attributes, children, node) => {
  { value, setState } = node.useState('count', 0)
  setState(value + 1)  // ❌ Called every render!
  
  <div>value</div>
}

// ✅ Update state in event handlers
GoodCounter = (attributes, children, node) => {
  { value, setState } = node.useState('count', 0)
  
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
