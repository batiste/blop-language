# Routing

Client-side routing for Blop applications.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Defining Routes](#defining-routes)
- [Route Handlers](#route-handlers)
- [Navigation](#navigation)
- [URL Parameters](#url-parameters)
- [Integration with State](#integration-with-state)
- [Full Example](#full-example)

## Overview

Blop includes a lightweight client-side router in the example project. The router:

- Handles browser navigation
- Parses URL parameters
- Integrates with state management
- Supports history API
- Provides programmatic navigation

## Installation

The router is located at `example/lib/router.blop`. Copy it to your project:

```typescript
import { Router } from 'blop/router'
```

## Basic Setup

### 1. Create Router Instance

```typescript
import { Router } from 'blop/router'
import { createState } from 'blop/state'

// State includes a route slice that the router keeps up to date
state = createState({
  route: { name: '', params: {} },
  user: null
})

// Creating the Router automatically registers itself as the global navigator
router = new Router(state)
```

> The router registers a `go()` function into `blop/navigation` on construction.
> Components import `go` directly from there — no need to thread the router through state.

### 2. Define Route Handlers

Route handlers are functions responsible for loading data. The router sets `state.route.name` automatically before calling the handler.

`loading` is also managed by the router: it is set to `true` before the handler runs and `false`
after it resolves.

```typescript
// Minimal handler — nothing to load
def indexHandler(_params, _state) {
}

// Data-loading handler
async def userHandler(params, state) {
  response = await fetch(`/api/users/`params.id``)  
  state.currentUser = await response.json()
}
```

### 3. Register Routes

```typescript
def createRouter(state, window) {
  router = new Router(state)
  
  // Add routes
  router.add({
    path: '/',
    name: 'home',
    handler: indexHandler
  })
  
  router.add({
    path: '/users/:id',
    name: 'user',
    handler: userHandler
  })
  
  router.add({
    path: '/posts/:postId/comments/:commentId',
    name: 'comment',
    // handlers are optional
  })
  
  // Initialize router (calls handler for current URL)
  router.init()
  
  return router
}
```

### 4. Integrate with App

```typescript
// client.blop
import { mount } from 'blop'
import { createState } from 'blop/state'
import { createRouter } from './routing.blop'
import { App } from './App.blop'

state = createState({ route: { name: '', params: {} } })
router = createRouter(state, window)  // registers the global navigator automatically

render = () => {
  state.$.flush()
  return App(state)
}

{ refresh, init } = mount(document.getElementById('app'), render)
init()

pending = false
state.$.listen(() => {
  if pending { return }
  pending := true
  Promise.resolve().then(() => {
    pending := false
    refresh()
  })
})
```

## Defining Routes

### Route Configuration

```typescript
router.add({
  path: '/path/to/route',      // URL pattern
  name: 'routeName',            // Unique identifier
  handler: handlerFunction      // Function to call
})
```

### Static Routes

```typescript
router.add({ path: '/', name: 'home', handler: homeHandler })
router.add({ path: '/about', name: 'about', handler: aboutHandler })
router.add({ path: '/contact', name: 'contact', handler: contactHandler })
```

### Dynamic Routes

Use `:paramName` for dynamic segments:

```typescript
// Single parameter
router.add({
  path: '/users/:id',
  name: 'user',
  handler: (params, state) => {
    console.log(params.id)  // Access the ID
    state.userId := params.id
  }
})

// Multiple parameters
router.add({
  path: '/posts/:postId/comments/:commentId',
  name: 'comment',
  handler: (params, state) => {
    console.log(params.postId, params.commentId)
  }
})
```

## Route Handlers

Handlers receive two arguments:

1. **`params`** - Object containing URL parameters parsed from the URL
2. **`state`** - Application state object

The router sets the following automatically **before** calling the handler:
- `state.route.name` — the `name` field of the matched route
- `state.route.params` — same as `params`
- `state.route.loading = true` — cleared to `false` after the handler resolves

Handlers should therefore only do data-loading work:

### Synchronous Handler (no data to load)

```typescript
def aboutHandler(_params, _state) {
  // nothing to do
}
```

### Asynchronous Handler

```typescript
async def productHandler(params, state) {
  response = await fetch(`/api/products/`params.id``)
  state.product = await response.json()
}
```

### Error Handling

The router does not catch handler errors, so wrap async work if needed:

```typescript
async def productHandler(params, state) {
  try {
    response = await fetch(`/api/products/`params.id``)
    state.product = await response.json()
  } catch error {
    state.error = error.message
  }
}
```

## Navigation

### Programmatic Navigation

Access the router through state:

```typescript
def NavigationMenu(state) {
  goHome = (e) => {
    e.preventDefault()
    state.$.router.go('/')
  }
  
  goToUser = (userId) => (e) => {
    e.preventDefault()
    state.$.router.go(`/users/`userId``)
  }
  
  <nav>
    <a href="/" on={ click: goHome }>'Home'</a>
    <a href="/users/123" on={ click: goToUser(123) }>'User 123'</a>
  </nav>
}
``` 

### Using Links

For proper handling with `preventDefault`:

```typescript
import { go } from 'blop/navigation'

def Links() {
  def navigateTo(path) {
    return (e) => {
      e.preventDefault()
      go(path)
    }
  }
  
  <div>
    <p><a href="/" on={ click: navigateTo('/') }>'Home'</a></p>
    <p><a href="/about" on={ click: navigateTo('/about') }>'About'</a></p>
    <p><a href="/contact" on={ click: navigateTo('/contact') }>'Contact'</a></p>
  </div>
}
```

### Router Methods

```typescript
router.go(path)    // Navigate to path (also available as go() from navigation.blop)
router.init()      // Navigate to the current URL without pushing a history entry
```

## URL Parameters

### Reading Parameters

Parameters are automatically parsed and passed to handlers:

```typescript
router.add({
  path: '/users/:userId/posts/:postId',
  name: 'userPost',
  handler: (params, state) => {
    // params = { userId: '123', postId: '456' }
    userId = params.userId
    postId = params.postId
    
    state.viewing := { userId, postId }
  }
})
```

### Using Parameters in Components

```typescript
def UserProfile(state) {
  userId = state.userId  // Set by route handler
  user = state.users.find(u => u.id == userId)
  
  <div>
    if user {
      <div>
        <h1>user.name</h1>
        <p>user.email</p>
      </div>
    } else {
      <p>'User not found'</p>
    }
  </div>
}
```

## Integration with State

The router integrates seamlessly with state management. After each navigation `state.route` is updated
before the handler runs, so a single `state.route.name` check is enough to pick the right component:

```typescript
// routing.blop
def indexHandler(_params, _state) {
  // no data to load for the index
}

async def dogsHandler(_params, state) {
  response = await fetch('https://dog.ceo/api/breeds/image/random')
  data = await response.json()
  state.dogs.current = data
}

def createRouter(state) {
  router = new Router(state)
  
  router.add({ path: '/', name: 'root', handler: indexHandler })
  router.add({ path: '/dogs', name: 'dogs', handler: dogsHandler })
  router.add({ path: '/dogs/:breed/:image', name: 'dogDetail', handler: dogDetailHandler })
  
  router.init()
  return router
}
```

```typescript
// client.blop
import { createState } from 'blop/state'
import { createRouter } from './routing.blop'

state = createState({
  route: { name: '', params: {} },
  dogs: { loading: false, current: null }
})

router = createRouter(state, window)
state.$.router = router  // assign after creation so components can navigate
```

```typescript
// App.blop — derive active page from state.route.name
App = (state) => {
  <main>
    if state.route.name == 'dogs' || state.route.name == 'dogDetail' {
      <DogsPage state=state />
    } else {
      <HomePage state=state />
    }
  </main>
}
```

## Full Example

```typescript
// routing.blop
import { Router } from 'blop/router'

// Route handlers only do data loading — no state.page mutations needed
def homeHandler(_params, _state) {
}

def aboutHandler(_params, _state) {
}

async def blogPostHandler(params, state) {
  try {
    response = await fetch(`/api/posts/`params.postId``)
    state.currentPost = await response.json()
  } catch error {
    state.error = 'Failed to load post'
  }
}

export def createRouter(state) {
  router = new Router(state)
  
  router.add({ path: '/', name: 'home', handler: homeHandler })
  router.add({ path: '/about', name: 'about', handler: aboutHandler })
  router.add({ path: '/blog/:postId', name: 'blogPost', handler: blogPostHandler })
  
  router.init()
  return router
}
```

```typescript
// App.blop — use state.route.name to pick the active component
import { HomePage } from './pages/HomePage.blop'
import { AboutPage } from './pages/AboutPage.blop'
import { BlogPostPage } from './pages/BlogPostPage.blop'
import { Navigation } from './components/Navigation.blop'

export def App(state) {
  <div>
    <Navigation state=state />
    
    <main>
      if state.route.name == 'home' {
        <HomePage state=state />
      } elseif state.route.name == 'about' {
        <AboutPage state=state />
      } elseif state.route.name == 'blogPost' {
        <BlogPostPage state=state />
      } else {
        <HomePage state=state />
      }
    </main>
  </div>
}
```

```typescript
// components/Navigation.blop
import { go } from 'blop/navigation'

export def Navigation(state) {
  def navigate(path) {
    return (e) => {
      e.preventDefault()
      go(path)
    }
  }
  
  isActive = (name) => state.route.name == name ? 'active' : ''
  
  <nav>
    <ul>
      <li class=isActive('home')>
        <a href="/" on={ click: navigate('/') }>'Home'</a>
      </li>
      <li class=isActive('about')>
        <a href="/about" on={ click: navigate('/about') }>'About'</a>
      </li>
      <li>
        <a href="/blog/1" on={ click: navigate('/blog/1') }>'Blog Post 1'</a>
      </li>
    </ul>
  </nav>
}
```

```typescript
// client.blop
import { mount } from 'blop'
import { createState } from 'blop/state'
import { createRouter } from './routing.blop'
import { App } from './App.blop'

// route slice is required — the router writes into it on every navigation
state = createState({
  route: { name: '', params: {} },
  loading: false,
  currentPost: null,
  error: null
})

// Router registers go() into navigation.blop automatically
router = createRouter(state, window)

render = () => {
  state.$.flush()
  return App(state)
}

{ refresh, init } = mount(document.getElementById('app'), render)
init()

pending = false
state.$.listen(() => {
  if pending { return }
  pending := true
  Promise.resolve().then(() => {
    pending := false
    refresh()
  })
})
```

## Best Practices

### 1. Centralize Route Definitions

Keep all routes in one place for easy maintenance:

```typescript
// routes.blop
export routes = [
  { path: '/', name: 'home', handler: homeHandler },
  { path: '/about', name: 'about', handler: aboutHandler },
  { path: '/contact', name: 'contact', handler: contactHandler }
]

export def setupRoutes(router) {
  for route in routes {
    router.add(route)
  }
}
```

### 2. Use Named Routes

Give routes meaningful names for easier refactoring:

```typescript
router.add({ path: '/users/:id', name: 'userProfile', handler: userHandler })

// Later, you can reference by name if needed
```

### 3. Handle Loading States

The router automatically sets `state.route.loading = true` before calling an async handler and
`state.route.loading = false` after it resolves. Simply include `loading` in your state and check it
in your component — no extra boilerplate needed:

```typescript
// In your app component
if state.route.loading {
  <Spinner />
} else {
  // render active page
}
```

### 4. Always Prevent Default

Prevent full page reloads by calling `preventDefault`:

```typescript
handleClick = (e) => {
  e.preventDefault()  // Important!
  state.$.router.go('/path')
}
```

## See Also

- [State Management](./STATE_MANAGEMENT.md) - Managing application state
- [Components](./COMPONENTS.md) - Building components
- [Examples](../example/) - Full application examples
