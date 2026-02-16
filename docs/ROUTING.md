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

```blop
import { Router } from './lib/router.blop'
```

## Basic Setup

### 1. Create Router Instance

```blop
import { Router } from './lib/router.blop'
import { createState } from './lib/state.blop'

// Create state
state = createState({
  page: 'home',
  user: null
})

// Create router
router = new Router(null, state, window)
```

### 2. Define Route Handlers

Route handlers are functions that update your application state:

```blop
// Simple handler
def indexHandler(params, state) {
  state.page := 'index'
  console.log('Index page loaded')
}

// Async handler
async def userHandler(params, state) {
  state.page := 'user'
  state.loading := true
  
  try {
    response = await fetch(`/api/users/`params.id``)
    state.currentUser := await response.json()
  } finally {
    state.loading := false
  }
}
```

### 3. Register Routes

```blop
def createRouter(state, window) {
  router = new Router(null, state, window)
  
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
    handler: commentHandler
  })
  
  // Initialize router (calls handler for current URL)
  router.init()
  
  return router
}
```

### 4. Integrate with App

```blop
// client.blop
import { mount } from 'blop'
import { createState } from './lib/state.blop'
import { createRouter } from './routing.blop'
import { App } from './App.blop'

state = createState({ page: 'home' })
router = createRouter(state, window)

render = () => {
  state.$.flush()
  return App(state)
}

{ refresh, init } = mount(document.getElementById('app'), render)
init()

state.$.listen((path) => {
  refresh()
})
```

## Defining Routes

### Route Configuration

```blop
router.add({
  path: '/path/to/route',      // URL pattern
  name: 'routeName',            // Unique identifier
  handler: handlerFunction      // Function to call
})
```

### Static Routes

```blop
router.add({ path: '/', name: 'home', handler: homeHandler })
router.add({ path: '/about', name: 'about', handler: aboutHandler })
router.add({ path: '/contact', name: 'contact', handler: contactHandler })
```

### Dynamic Routes

Use `:paramName` for dynamic segments:

```blop
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

1. **`params`** - Object containing URL parameters
2. **`state`** - Application state object

### Synchronous Handler

```blop
def aboutHandler(params, state) {
  state.page := 'about'
  state.title := 'About Us'
}
```

### Asynchronous Handler

```blop
async def productHandler(params, state) {
  state.page := 'product'
  state.loading := true
  
  try {
    response = await fetch(`/api/products/`params.id``)
    state.product := await response.json()
  } catch error {
    state.error := error.message
  } finally {
    state.loading := false
  }
}
```

### Handler with Logic

```blop
def dogBreedHandler(params, state) {
  state.page := 'dog'
  
  // Parse parameters
  breed = params.breed
  image = params.image
  
  // Update state
  state.dogPage.choice := { breed, image }
  
  // Log navigation
  console.log(`Navigated to dog breed: `breed``)
}
```

## Navigation

### Programmatic Navigation

Access the router through state:

```blop
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

```blop
def Links(state) {
  def navigateTo(path) {
    return (e) => {
      e.preventDefault()
      state.$.router.go(path)
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

```blop
state.$.router.go(path)           // Navigate to path
state.$.router.back()             // Go back in history
state.$.router.forward()          // Go forward in history
state.$.router.init()             // Initialize router
```

## URL Parameters

### Reading Parameters

Parameters are automatically parsed and passed to handlers:

```blop
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

```blop
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

The router integrates seamlessly with state management:

```blop
// routing.blop
def indexHandler(params, state) {
  state.page := 'index'
}

async def dogsHandler(params, state) {
  state.page := 'dogs'
  state.dogs.loading := true
  
  try {
    response = await fetch('https://dog.ceo/api/breeds/image/random')
    data = await response.json()
    state.dogs.current := data
  } finally {
    state.dogs.loading := false
  }
}

def createRouter(state, global) {
  router = new Router(null, state, global)
  
  router.add({ path: '/', name: 'root', handler: indexHandler })
  router.add({ path: '/dogs', name: 'dogs', handler: dogsHandler })
  router.add({ path: '/dogs/:breed/:image', name: 'dogDetail', handler: dogDetailHandler })
  
  router.init()
  return router
}
```

```blop
// client.blop
import { createState } from './lib/state.blop'
import { createRouter } from './routing.blop'

state = createState({
  page: 'index',
  dogs: {
    loading: false,
    current: null
  }
})

// Router is attached to state
router = createRouter(state, window)

// Now state.$.router is available in all components
```

## Full Example

```blop
// routing.blop
import { Router } from './lib/router.blop'

// Route handlers
def homeHandler(params, state) {
  state.page := 'home'
  state.title := 'Home'
}

def aboutHandler(params, state) {
  state.page := 'about'
  state.title := 'About Us'
}

async def blogPostHandler(params, state) {
  state.page := 'blogPost'
  state.loading := true
  
  try {
    response = await fetch(`/api/posts/`params.postId``)
    state.currentPost := await response.json()
    state.title := state.currentPost.title
  } catch error {
    state.error := 'Failed to load post'
  } finally {
    state.loading := false
  }
}

def notFoundHandler(params, state) {
  state.page := '404'
  state.title := 'Page Not Found'
}

// Create router
export def createRouter(state, global) {
  router = new Router(null, state, global)
  
  router.add({ path: '/', name: 'home', handler: homeHandler })
  router.add({ path: '/about', name: 'about', handler: aboutHandler })
  router.add({ path: '/blog/:postId', name: 'blogPost', handler: blogPostHandler })
  router.add({ path: '/404', name: 'notFound', handler: notFoundHandler })
  
  router.init()
  return router
}
```

```blop
// App.blop
import { HomePage } from './pages/HomePage.blop'
import { AboutPage } from './pages/AboutPage.blop'
import { BlogPostPage } from './pages/BlogPostPage.blop'
import { NotFoundPage } from './pages/NotFoundPage.blop'
import { Navigation } from './components/Navigation.blop'

export def App(state) {
  <div>
    <Navigation state=state />
    
    <main>
      if state.page == 'home' {
        <HomePage state=state />
      } elseif state.page == 'about' {
        <AboutPage state=state />
      } elseif state.page == 'blogPost' {
        <BlogPostPage state=state />
      } else {
        <NotFoundPage state=state />
      }
    </main>
  </div>
}
```

```blop
// components/Navigation.blop
export def Navigation(state) {
  def navigate(path) {
    return (e) => {
      e.preventDefault()
      state.$.router.go(path)
    }
  }
  
  isActive = (page) => state.page == page ? 'active' : ''
  
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

```blop
// client.blop
import { mount } from 'blop'
import { createState } from './lib/state.blop'
import { createRouter } from './routing.blop'
import { App } from './App.blop'

// Initialize state
state = createState({
  page: 'home',
  title: 'Home',
  loading: false,
  currentPost: null,
  error: null
})

// Initialize router
router = createRouter(state, window)

// Render function
render = () => {
  state.$.flush()
  return App(state)
}

// Mount app
{ refresh, init } = mount(document.getElementById('app'), render)
init()

// Listen to state changes
state.$.listen((path) => {
  refresh()
  document.title = state.title || 'My App'
})
```

## Best Practices

### 1. Centralize Route Definitions

Keep all routes in one place for easy maintenance:

```blop
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

```blop
router.add({ path: '/users/:id', name: 'userProfile', handler: userHandler })

// Later, you can reference by name if needed
```

### 3. Handle Loading States

Show loading indicators during async navigation:

```blop
async def pageHandler(params, state) {
  state.loading := true
  try {
    // Fetch data
  } finally {
    state.loading := false
  }
}
```

### 4. Always Prevent Default

Prevent full page reloads by calling `preventDefault`:

```blop
handleClick = (e) => {
  e.preventDefault()  // Important!
  state.$.router.go('/path')
}
```

## See Also

- [State Management](./STATE_MANAGEMENT.md) - Managing application state
- [Components](./COMPONENTS.md) - Building components
- [Examples](../example/) - Full application examples
