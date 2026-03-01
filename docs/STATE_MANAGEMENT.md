# State Management

Learn how to manage application state in Blop using the built-in Proxy-based state management system.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Creating State](#creating-state)
- [Reading State](#reading-state)
- [Updating State](#updating-state)
- [Listening to Changes](#listening-to-changes)
- [Reactive Subscriptions](#reactive-subscriptions)
- [Full Application Example](#full-application-example)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)

## Overview

Blop includes a lightweight state management library based on the [Proxy API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). This library:

- Automatically tracks state changes
- Triggers re-renders when state changes
- Provides fine-grained, automatic reactivity — components re-render only when data they actually read changes
- Is completely optional (you can use any state management solution)

## Getting Started

The state management library is located in the example project at `example/lib/state.blop`. You can copy it to your project or implement your own.

### Installation

```typescript
import { createState } from 'blop/state'
```

## Creating State

Create a proxied state object with initial data:

```typescript
import { createState } from 'blop/state'

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
`Promise.resolve()` microtask.

For most mutations you will **not** need a global listener at all — Components re-render
automatically via the [reactive subscription system](#reactive-subscriptions). A global
listener is only necessary when structural changes (such as route navigation) require
re-rendering the whole application tree:

```typescript
import { mount } from 'blop'
import { createState } from 'blop/state'

state = createState({ count: 0 })

render = () => {
  state.$.flush()  // Clear change tracking before each render
  tree = App(state)
  return tree
}

{ refresh, init } = mount(document.getElementById('app'), render)
init()

pending = false

// Only do a full refresh for structural/route changes.
// Component-level state mutations are handled by reactive subscriptions.
state.$.listen((path) => {
  if !path.startsWith('route') { return }
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

## Reactive Subscriptions

Blop's runtime implements **automatic reactive subscriptions**: every Component instance
automatically tracks which state paths it reads during its render, and re-renders itself
(via an efficient `partialRender`) when any of those paths change.

This means **you do not need to manually subscribe components to state changes** — the
bookkeeping is handled entirely by the runtime and the state proxy.

### How it works

1. When a Component renders, the runtime sets itself as the currently-active component.
2. Every read through the state proxy (e.g. `state.todos.length`, `state.user.name`)
   calls `trackRead(path)`, which records `{component → path}` in a subscription map.
3. When a value is written (e.g. `state.user.name = 'Alice'`), the proxy calls
   `notifyWrite(path)`, which finds all subscribed components and calls
   `scheduleRender` on each of them.
4. Before the next render, the component clears its previous subscriptions and
   re-establishes them from scratch, so the subscription set is always accurate.
5. Subscriptions are cleaned up when a component is destroyed.

### Subscription scope

Subscriptions follow a prefix rule: writing to `user` will notify subscribers of `user`,
`user.name`, `user.address.city`, etc. Writing to `user.name` will also notify subscribers
of `user` (the parent). This matches the semantics of `hasChanged`.

### The open hook contract

The runtime exports two plain functions:

```typescript
import { trackRead, notifyWrite } from 'blop'
```

- `trackRead(key: string)` — call inside any getter
- `notifyWrite(key: string)` — call inside any setter or delete handler

The runtime is completely decoupled from the specific proxy or store implementation.
Any reactive source — a Proxy, a Signal, a WebSocket store — can call these two
functions and get automatic, targeted component re-renders for free.

The built-in `state.blop` library already calls both hooks.

### Example

```typescript
// TodoListPage reads todo.todoList, todo.filter, todo.editItemIndex during render.
// Writing any of those paths will re-render only TodoListPage, not the whole app.

TodoListPage = (ctx: Component): VNode => {
  { attributes } = ctx
  { todo } = attributes   // todo is a sub-proxy of proxiedState

  todoList = todo.todoList            // ← trackRead('todoList') fires
  currentFilter = todo.filter         // ← trackRead('filter') fires

  setFilter = (f) => {
    todo.filter = f                   // ← notifyWrite('filter') → only TodoListPage re-renders
  }

  <div>
    <FilterTabs currentFilter setFilter />
    // ...
  </div>
}
```

> **Plain functions vs Components** — Only Component instances (called with `<TagSyntax />`) participate
> in reactive subscriptions. A plain function called directly (e.g. `navigation(state)`) runs during the
> parent's render so its reads are attributed to the parent component. Top-level functions like `Index`
> that run during `refresh()` are not Components and do not subscribe.

## Full Application Example

Here's a complete example of a Blop application with state management:

```typescript
// client.blop
import { mount } from 'blop'
import { createState } from 'blop/state'
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

// Only trigger a full refresh for route changes.
// All other mutations are handled automatically by reactive subscriptions —
// only the Components that read the changed path will re-render.
state.$.listen((path) => {
  if !path.startsWith('route') { return }
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

### 6. Prefer passing sub-proxies to Components

Reactive subscriptions only fire when a read passes *through the proxy*. If you extract a
plain value before passing it to a Component, the subscription is lost:

```typescript
// ❌ Plain value — Component cannot subscribe; changes won't trigger partial re-render
<TodoList todos=state.todos.slice() />

// ✅ Sub-proxy — Component reads through the proxy and subscribes automatically
<TodoList todos=state.todos />

// ✅ Full proxy slice — Component can traverse state.todo.* reactively
<TodoListPage todo=state />
```

## State API Reference

The proxied state object includes a special `$` property with utilities:

```typescript
state.$.listen(callback)     // Subscribe to any state change; callback receives the changed path
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

### Reactive hooks (advanced)

The runtime exports two hooks used internally by the state proxy:

```typescript
import { trackRead, notifyWrite } from 'blop'

trackRead(key: string)   // Record that the current component depends on `key`
notifyWrite(key: string) // Schedule re-render for all components subscribed to `key`
```

These are called automatically by `state.blop`. You only need them if you build a custom
reactive source (e.g. a WebSocket-backed store or a Signal primitive) and want it to
participate in the same component subscription system.

## See Also

- [Components](./COMPONENTS.md) - Component-level state with `ctx.state`
- [Routing](./ROUTING.md) - Integrate routing with state
- [Examples](../example/) - Full application examples
- [Syntax Reference](./SYNTAX_REFERENCE.md) - Language basics
