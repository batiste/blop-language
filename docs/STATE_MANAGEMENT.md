# State Management

Learn how to manage application state in Blop using the built-in Proxy-based state management system.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Creating State](#creating-state)
- [Reading State](#reading-state)
- [Updating State](#updating-state)
- [Listening to Changes](#listening-to-changes)
- [Full Application Example](#full-application-example)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)

## Overview

Blop includes a lightweight state management library based on the [Proxy API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). This library:

- Automatically tracks state changes
- Triggers re-renders when state changes
- Provides fine-grained reactivity
- Is completely optional (you can use any state management solution)

## Getting Started

The state management library is located in the example project at `example/lib/state.blop`. You can copy it to your project or implement your own.

### Installation

```typescript
import { createState } from './lib/state.blop'
```

## Creating State

Create a proxied state object with initial data:

```typescript
import { createState } from './lib/state.blop'

// Create state with initial values
state = createState({
  user: null,
  posts: [],
  loading: false,
  route: { name: '', params: {} }  // current route, populated by the router
})
```

> The `route` slice is a convention: the router writes `state.route.name` and `state.route.params` on every
> navigation so components can derive the active page without any extra handler boilerplate.

## Reading State

Read from state like a normal object - no side effects:

```typescript
def Header(state) {
  // Reading state is transparent
  username = state.user?.name || 'Guest'
  pageTitle = state.currentPage
  
  <header>
    <h1>pageTitle</h1>
    <div>'Welcome, 'username</div>
  </header>
}
```

## Updating State

Updating state is also transparent, but triggers change listeners:

```typescript
def LoginForm(state) {
  handleLogin = async (e) => {
    e.preventDefault()
    
    // Update state - this will trigger a re-render
    state.loading := true
    
    try {
      response = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })
      
      // Update user - triggers re-render
      state.user := await response.json()
      state.currentPage := 'dashboard'
    } catch error {
      console.error(error)
    } finally {
      state.loading := false
    }
  }
  
  <form on={ submit: handleLogin }>
    // Form fields...
  </form>
}
```

## Listening to Changes

Set up a listener to react to any state changes. Multiple mutations that happen synchronously
(e.g. inside an async route handler) are automatically coalesced into a single render via a
`Promise.resolve()` microtask:

```typescript
import { mount } from 'blop'
import { createState } from './lib/state.blop'

state = createState({ count: 0 })

render = () => {
  state.$.flush()  // Clear change tracking before each render
  tree = App(state)
  return tree
}

{ refresh, init } = mount(document.getElementById('app'), render)
init()

pending = false

// Batch rapid mutations into one render via microtask
state.$.listen(() => {
  if pending { return }
  pending := true
  Promise.resolve().then(() => {
    pending := false
    refresh((time) => {
      if time > 50 { console.warn(`Slow render: `time`ms`) }
    })
  })
})
```

### Tracking specific paths

`hasChanged` accepts an optional dot-separated path. Paths use the same format as `modifications` entries
(no leading dot):

```typescript
// re-render only if the route or loading flag changed
if state.hasChanged('route') || state.hasChanged('loading') {
  // ...
}
```

## Full Application Example

Here's a complete example of a Blop application with state management:

```typescript
// client.blop
import { mount } from 'blop'
import { createState } from './lib/state.blop'
import { Index } from './index.blop'
import { createRouter } from './routing.blop'

// Create state with initial data — route is populated by the router automatically
state = createState({
  route: { name: '', params: {} },
  todos: [],
  user: null,
  loading: false
})

// Set up router — registers the global navigator automatically
router = createRouter(state, window)

// Render function
render = () => {
  state.$.flush()  // Clear tracked changes before each render
  tree = Index(state)
  return tree
}

// Mount app
{ refresh, init } = mount(document.getElementById('app'), render)
init()

pending = false

// Batch rapid mutations into one render
state.$.listen(() => {
  if pending { return }
  pending := true
  Promise.resolve().then(() => {
    pending := false
    refresh((time) => {
      if time > 50 { console.warn(`Slow render: `time`ms`) }
    })
  })
})
```

```typescript
// index.blop
import { TodoList } from './TodoList.blop'
import { UserProfile } from './UserProfile.blop'

Index = (state) => {
  <div>
    <h1>'My App'</h1>
    
    if state.loading {
      <div class='spinner'>'Loading...'</div>
    } elseif state.route.name == 'todos' {
      <TodoList state=state />
    } elseif state.route.name == 'profile' {
      <UserProfile state=state />
    } else {
      <div>'Home Page'</div>
    }
  </div>
}
```

Note that `state.route.name` matches the `name` field given when registering a route. Handlers only need
to perform data loading — they no longer need to set a `page` property.

## Advanced Patterns

### Nested State Updates

```typescript
// Initialize nested state
state = createState({
  user: {
    profile: {
      name: 'Alice',
      email: 'alice@example.com'
    },
    settings: {
      theme: 'light',
      notifications: true
    }
  }
})

// Update nested properties
def updateEmail(state, newEmail) {
  // This triggers a re-render
  state.user.profile.email := newEmail
}

// Update multiple nested properties
def updateSettings(state, settings) {
  state.user.settings.theme := settings.theme
  state.user.settings.notifications := settings.notifications
}
```

### Array Operations

```typescript
state = createState({
  items: [1, 2, 3]
})

// Add item
def addItem(state, item) {
  state.items := [...state.items, item]
}

// Remove item
def removeItem(state, index) {
  state.items := state.items.filter((_, i) => i != index)
}

// Update item
def updateItem(state, index, newValue) {
  newItems = [...state.items]
  newItems[index] = newValue
  state.items := newItems
}

// Clear all
def clearItems(state) {
  state.items := []
}
```

### Computed Values

```typescript
state = createState({
  todos: [
    { id: 1, text: 'Learn Blop', done: false },
    { id: 2, text: 'Build app', done: false },
    { id: 3, text: 'Deploy', done: true }
  ]
})

// Computed in component
TodoStats = (state) => {
  total = state.todos.length
  completed = state.todos.filter(t => t.done).length
  remaining = total - completed
  
  <div class='stats'>
    <div>'Total: 'total''</div>
    <div>'Completed: 'completed''</div>
    <div>'Remaining: 'remaining''</div>
  </div>
}
```

### Actions Pattern

Organize state updates into action functions:

```typescript
// actions.blop
export def loadPosts(state) {
  state.loading := true
  
  try {
    response = await fetch('/api/posts')
    posts = await response.json()
    state.posts := posts
  } catch error {
    state.error := error.message
  } finally {
    state.loading := false
  }
}

export def createPost(state, post) {
  state.loading := true
  
  try {
    response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post)
    })
    newPost = await response.json()
    state.posts := [...state.posts, newPost]
  } catch error {
    state.error := error.message
  } finally {
    state.loading := false
  }
}

export def deletePost(state, postId) {
  state.posts := state.posts.filter(p => p.id != postId)
}
```

```typescript
// Usage in components
import { loadPosts, createPost } from './actions.blop'

PostList = (ctx: Component) => {
  { attributes } = ctx
  { init } = mount(document.getElementById('app'), render)
  
  // Load on mount
  ctx.mount(() => loadPosts(state))
  
  handleCreate = () => {
    post = { title: 'New Post', content: 'Content here' }
    createPost(state, post)
  }
  
  <div>
    <button on={ click: handleCreate }>'Create Post'</button>
    <ul>
      for post in state.posts {
        <li>post.title</li>
      }
    </ul>
  </div>
}
```

## Best Practices

### 1. Don't Update State During Render

```typescript
// ❌ BAD - Creates infinite loop
BadComponent = (state) => {
  state.count := state.count + 1  // ❌ Don't do this!
  <div>state.count</div>
}

// ✅ GOOD - Update in event handlers
GoodComponent = (state) => {
  increment = () => {
    state.count := state.count + 1
  }
  
  <div>
    <button on={ click: increment }>'Increment'</button>
    <div>state.count</div>
  </div>
}
```

### 2. Use flush() in Render Function

```typescript
render = () => {
  // Clear change tracking for clean renders
  state.$.flush()
  tree = App(state)
  return tree
}
```

### 3. Prevent Infinite Loops

Never mutate state inside the render function. The microtask batching in `$.listen` naturally prevents
cascade loops — if state is mutated during rendering, the next microtask will fire one additional render,
but it cannot stack infinitely because the flush at the start of each render clears `modifications`.

### 4. Group Related State

```typescript
// ❌ Flat structure
state = createState({
  userName: '',
  userEmail: '',
  userAge: 0,
  postTitle: '',
  postContent: '',
  postAuthor: ''
})

// ✅ Grouped structure
state = createState({
  user: {
    name: '',
    email: '',
    age: 0
  },
  post: {
    title: '',
    content: '',
    author: ''
  }
})
```

### 5. Use Immutable Updates for Arrays/Objects

```typescript
// ❌ Mutating - may not trigger updates correctly
state.items.push(newItem)

// ✅ Immutable - always triggers updates
state.items := [...state.items, newItem]

// ❌ Mutating object
state.user.name = 'Alice'

// ✅ Reassigning (use := operator)
state.user.name := 'Alice'
```

## State API Reference

The proxied state object includes a special `$` property with utilities:

```typescript
state.$.listen(callback)     // Subscribe to any state change
state.$.flush()              // Clear recorded modifications (call before each render)
state.$.modifications        // Array of { path, action, value } since last flush
state.$.raw                  // The underlying plain object (unproxied)
```

`hasChanged` is available on every (nested) proxy node:

```typescript
state.hasChanged()            // true if anything changed since last flush
state.hasChanged('route')     // true if route or any sub-path changed
state.user.hasChanged('name') // true if user.name changed
```

Paths are dot-separated with no leading dot, matching the keys as written in state.

## See Also

- [Components](./COMPONENTS.md) - Component-level state with `useState`
- [Routing](./ROUTING.md) - Integrate routing with state
- [Examples](../example/) - Full application examples
- [Syntax Reference](./SYNTAX_REFERENCE.md) - Language basics
