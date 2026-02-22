# Testing with Vitest

Guide to testing Blop applications using Vitest.

## Table of Contents

- [Setup](#setup)
- [Writing Tests](#writing-tests)
- [Testing Components](#testing-components)
- [Mocking](#mocking)
- [Coverage](#coverage)
- [Best Practices](#best-practices)

## Setup

### Install Dependencies

```bash
npm install -D vitest jsdom @vitest/ui
```

### Configure Vitest

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';
import { blopPlugin } from 'blop-language/src/vitest';

export default defineConfig({
  plugins: [blopPlugin()],
  test: {
    include: ['**/*.test.blop'],
    globals: true,
    environment: 'jsdom',
  },
});
```

### Add Test Scripts

In `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Writing Tests

### Basic Test

Create a file ending with `.test.blop`:

```typescript
// math.test.blop
import { describe, it, expect } from 'vitest'

def add(a, b) {
  return a + b
}

def multiply(a, b) {
  return a * b
}

describe('Math utilities', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5)
    expect(add(-1, 1)).toBe(0)
  })

  it('multiplies two numbers', () => {
    expect(multiply(2, 3)).toBe(6)
    expect(multiply(-2, 3)).toBe(-6)
  })
})
```

### Running Tests

```bash
# Run tests once
npm test

# Watch mode
npm test -- --watch

# Run specific file
npm test -- math.test.blop

# UI mode
npm run test:ui
```

## Testing Components

### Component Test Example

```typescript
// Counter.test.blop
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from 'blop'

Counter = (ctx: Component) => {
  { value, setState } = ctx.useState('count', ctx.attributes.initial || 0)
  
  <div>
    <span data-testid="count">value</span>
    <button
      data-testid="increment"
      on={ click: () => setState(value + 1) }
    >'+'</button>
    <button
      data-testid="decrement"
      on={ click: () => setState(value - 1) }
    >'-'</button>
  </div>
}

describe('Counter component', () => {
  containerEl = null
  
  beforeEach(() => {
    // Create fresh container for each test
    containerEl = document.createElement('div')
    document.body.appendChild(containerEl)
  })
  
  afterEach(() => {
    // Cleanup
    if containerEl {
      document.body.removeChild(containerEl)
    }
  })
  
  it('renders initial count', () => {
    { init } = mount(containerEl, () => <Counter initial=5 />)
    init()
    
    countEl = containerEl.querySelector('[data-testid="count"]')
    expect(countEl.textContent).toBe('5')
  })
  
  it('increments count', () => {
    { init } = mount(containerEl, () => <Counter initial=0 />)
    init()
    
    button = containerEl.querySelector('[data-testid="increment"]')
    button.click()
    
    countEl = containerEl.querySelector('[data-testid="count"]')
    expect(countEl.textContent).toBe('1')
  })
  
  it('decrements count', () => {
    { init } = mount(containerEl, () => <Counter initial=5 />)
    init()
    
    button = containerEl.querySelector('[data-testid="decrement"]')
    button.click()
    
    countEl = containerEl.querySelector('[data-testid="count"]')
    expect(countEl.textContent).toBe('4')
  })
})
```

### Testing with State

```typescript
// TodoList.test.blop
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from 'blop'
import { createState } from './lib/state.blop'

TodoList = (state) => {
  addTodo = () => {
    newTodo = { id: Date.now(), text: 'New todo', done: false }
    state.todos := [...state.todos, newTodo]
  }
  
  <div>
    <button data-testid="add" on={ click: addTodo }>'Add'</button>
    <ul data-testid="list">
      for todo in state.todos {
        <li data-testid="todo">todo.text</li>
      }
    </ul>
  </div>
}

describe('TodoList', () => {
  state = null
  containerEl = null
  
  beforeEach(() => {
    state = createState({ todos: [] })
    containerEl = document.createElement('div')
    document.body.appendChild(containerEl)
  })
  
  afterEach(() => {
    if containerEl {
      document.body.removeChild(containerEl)
    }
  })
  
  it('starts with empty list', () => {
    { init } = mount(containerEl, () => <TodoList state=state />)
    init()
    
    items = containerEl.querySelectorAll('[data-testid="todo"]')
    expect(items.length).toBe(0)
  })
  
  it('adds todos', () => {
    { init, refresh } = mount(containerEl, () => <TodoList state=state />)
    init()
    
    state.$.listen(() => refresh())
    
    button = containerEl.querySelector('[data-testid="add"]')
    button.click()
    
    items = containerEl.querySelectorAll('[data-testid="todo"]')
    expect(items.length).toBe(1)
  })
})
```

## Mocking

### Mocking Functions

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('API calls', () => {
  it('fetches data', async () => {
    // Mock fetch
    mockFetch = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ data: 'test' })
    }))
    global.fetch = mockFetch
    
    // Your async function
    async def getData() {
      response = await fetch('/api/data')
      return response.json()
    }
    
    result = await getData()
    
    expect(mockFetch).toHaveBeenCalledWith('/api/data')
    expect(result).toEqual({ data: 'test' })
  })
})
```

### Mocking Modules

```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock a module
vi.mock('./api.blop', () => ({
  fetchUser: vi.fn(() => Promise.resolve({ id: 1, name: 'Test' }))
}))

import { fetchUser } from './api.blop'

describe('User profile', () => {
  it('loads user data', async () => {
    user = await fetchUser(1)
    expect(user.name).toBe('Test')
  })
})
```

## Coverage

### Enable Coverage

Install coverage tool:

```bash
npm install -D @vitest/coverage-v8
```

Update `vitest.config.js`:

```javascript
export default defineConfig({
  plugins: [blopPlugin()],
  test: {
    include: ['**/*.test.blop'],
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.blop'],
      exclude: ['**/*.test.blop']
    }
  },
});
```

### Run with Coverage

```bash
npm run test:coverage
```

View HTML report in `coverage/index.html`.

## Best Practices

### 1. Use data-testid Attributes

```typescript
// ✅ Good - testable
<button data-testid="submit-button">'Submit'</button>

// ❌ Avoid - fragile
<button class="btn submit primary">'Submit'</button>
```

### 2. Test User Behavior

```typescript
// ✅ Good - tests what users do
it('submits form on button click', () => {
  button = container.querySelector('[data-testid="submit"]')
  button.click()
  expect(mockSubmit).toHaveBeenCalled()
})

// ❌ Avoid - tests implementation
it('calls submitForm when state.submit is true', () => {
  state.submit := true
  expect(mockSubmit).toHaveBeenCalled()
})
```

### 3. Keep Tests Independent

```typescript
// ✅ Good - each test is independent
describe('Counter', () => {
  beforeEach(() => {
    state = createState({ count: 0 })
  })
  
  it('increments', () => {
    state.count := state.count + 1
    expect(state.count).toBe(1)
  })
  
  it('decrements', () => {
    state.count := state.count - 1
    expect(state.count).toBe(-1)
  })
})

// ❌ Avoid - tests depend on each other
describe('Counter', () => {
  state = createState({ count: 0 })
  
  it('increments', () => {
    state.count := state.count + 1
    expect(state.count).toBe(1)
  })
  
  it('increments again', () => {
    // Depends on previous test!
    state.count := state.count + 1
    expect(state.count).toBe(2)
  })
})
```

### 4. Test Edge Cases

```typescript
describe('divide', () => {
  it('divides positive numbers', () => {
    expect(divide(10, 2)).toBe(5)
  })
  
  it('divides negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5)
  })
  
  it('handles division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero')
  })
  
  it('handles decimals', () => {
    expect(divide(10, 3)).toBeCloseTo(3.333, 2)
  })
})
```

### 5. Use Descriptive Test Names

```typescript
// ✅ Good - clear what's being tested
it('shows error message when login fails', () => { ... })
it('disables submit button when form is invalid', () => { ... })

// ❌ Avoid - vague
it('works correctly', () => { ... })
it('test login', () => { ... })
```

## Common Patterns

### Testing Async Components

```typescript
import { describe, it, expect, waitFor } from 'vitest'

DataLoader = (attributes) => {
  { value as data, setState as setData } = node.useState('data', null)
  
  node.mount(async () => {
    response = await fetch(attributes.url)
    json = await response.json()
    setData(json)
  })
  
  <div>
    if data {
      <pre data-testid="data">JSON.stringify(data)</pre>
    } else {
      <div data-testid="loading">'Loading...'</div>
    }
  </div>
}

it('loads and displays data', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    json: () => Promise.resolve({ name: 'Test' })
  }))
  
  { init } = mount(container, () => <DataLoader url="/api/test" />)
  init()
  
  // Initially loading
  expect(container.querySelector('[data-testid="loading"]')).toBeTruthy()
  
  // Wait for data to load
  await waitFor(() => {
    dataEl = container.querySelector('[data-testid="data"]')
    return dataEl !== null
  })
  
  expect(container.textContent).toContain('Test')
})
```

### Snapshot Testing

```typescript
import { expect } from 'vitest'

it('matches snapshot', () => {
  { init } = mount(container, () => <MyComponent />)
  init()
  
  expect(container.innerHTML).toMatchSnapshot()
})
```

## See Also

- [Installation Guide](./INSTALLATION.md) - Setting up Vitest
- [Components](./COMPONENTS.md) - Component patterns
- [Example Tests](../example/TodoListPage/TodoListItem.test.blop) - Real examples
