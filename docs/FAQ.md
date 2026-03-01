# FAQ - Frequently Asked Questions

Common questions about Blop language.

## General Questions

### What is Blop?

Blop is a programming language for building web applications. It compiles to JavaScript and has native support for Virtual DOM generation using HTML-like syntax. Think of it as a language that combines the best parts of React/JSX with a Python-inspired syntax and built-in component system.

### Why use Blop instead of React/Vue/Svelte?

Blop offers:
- **Native Virtual DOM syntax** - Not limited to expressions like JSX
- **Python-like syntax** - Clean and readable  
- **Built-in linter** - No configuration needed
- **Integrated tooling** - VSCode support out of the box
- **Small bundle size** - ~15KB gzipped
- **Fast compilation** - 30,000+ lines per second

### Is Blop production-ready?

Blop is in **beta**. It's stable enough for side projects and experimentation, but the API may change. Use caution for production applications.

### Who created Blop?

Blop was created by [Batiste Bieler](https://github.com/batiste) and is open source.

## Syntax Questions

### Why use `def` instead of `function`?

Blop uses Python-inspired syntax where `def` defines functions. It's shorter and more concise:

```typescript
def greet(name) {
  return 'Hello 'name
}
```

### Why do I need `:=` for reassignment?

Blop requires explicit reassignment to catch accidental overwrites:

```typescript
count = 0       // Declaration
count = 1       // ERROR: attempting to redefine
count := 1      // OK: explicit reassignment
```

This helps prevent bugs from accidental variable shadowing.

### How does string concatenation work?

In Blop, strings are concatenated by placing them next to each other (no space):

```typescript
name = 'Alice'
greeting = 'Hello 'name  // "Hello Alice"

count = 42
message = 'The answer is 'count // "The answer is 42"
```

### Can I use template literals?

Blop's string concatenation is more flexible than template literals. Any quote type works and are multiline by default:

```typescript
name = 'Alice'
message1 = 'Hello 'name
message2 = "Hello "name
message3 = `
    Hello  
    `name
```

## Components

### What's the difference between function and class components?

**Function components** are simpler:

```typescript
Counter = (ctx: Component) => {
  <button>ctx.attributes.label</button>
}
```

**Class components** give more control:

```typescript
class Counter extends Component {
  def render() {
    <button>this.attributes.label</button>
  }
  
  def onMount() {
    // Lifecycle control
  }
}
```

Use function components for most cases. Use class components when you need more control over lifecycle or want to organize complex logic.

### How do I pass data between components?

**Props (Attributes):**

```typescript
<ChildComponent message="Hello" count=42 />
```

**Component Context:**

```typescript
ParentComponent = (ctx: Component) => {
  { setContext } = ctx.context('theme', 'dark')
  <ChildComponent />
}

ChildComponent = (ctx: Component) => {
  { value as theme } = ctx.context('theme')
  <div>theme</div>
}
```

**Global State:**

```typescript
state = createState({ count: 0 })
<Component state=state />
```

### When should I use ctx.state vs global state?

**Use `ctx.state` for:**
- Component-local state (UI state, input values)
- State that doesn't need to persist
- Temporary data

**Use global state for:**
- Application-wide data
- Data shared across components
- Data that should persist

## Virtual DOM

### Can I use loops and conditionals in JSX... I mean Virtual DOM?

Yes! Unlike JSX, Blop supports full statements:

```typescript
def List(attributes) {
  <ul>
    for item in attributes.items {
      if item.visible {
        <li>item.name</li>
      }
    }
  </ul>
}
```

### How do I render arrays of elements?

Use loops or the assignment operator (`=`):

```typescript
// Using loops
<ul>
  for item in items {
    <li>item</li>
  }
</ul>

// Using map and =
<ul>
  = items.map((item) => <li>item</li>)
</ul>
```

### What's the `=` operator in Virtual DOM?

The assignment operator (`=`) inserts content into Virtual DOM:

```typescript
<div>
  "Welcome "name
  "Login :"
  = myVariable
  = someComponent()
  = items.map(i => <span>i</span>)
</div>
```

For strings and strings expression, you can omit the `=`:

## State Management

### Do I have to use the Proxy-based state?

No! The state management library is optional. You can use:
- Any state management library (Redux, MobX, Zustand)
- Component-local state with `ctx.state`
- Just pass props down

### How do I prevent infinite render loops?

**Don't update state during render:**

```typescript
// ❌ BAD
BadComponent = (state) => {
  state.count := state.count + 1  // Causes infinite loop!
  <div>state.count</div>
}

// ✅ GOOD
GoodComponent = (state) => {
  increment = () => state.count := state.count + 1
  <div>
    <button on={ click: increment }>'+'</button>
    <div>state.count</div>
  </div>
}
```

**Implement loop detection** (see [State Management guide](./STATE_MANAGEMENT.md#best-practices)).

## Build & Tooling

### Does Blop work with Vite?

Yes! Blop has first-class Vite support:

```javascript
// vite.config.js
import { blopPlugin } from 'blop-language/vite';

export default defineConfig({
  plugins: [blopPlugin()],
});
```

### Can I use Blop with Webpack?

Blop v1.1.0+ focuses on Vite. For Webpack, you'd need to create a custom loader (not officially supported).

### How do I debug Blop code?

Blop generates source maps automatically. In browser DevTools, you'll see the original `.blop` files.

### Can I use TypeScript with Blop?

Blop has its own type annotation system (similar to TypeScript):

```typescript
def add(a: number, b: number): number {
  return a + b
}

user: { name: string, age: number } = { name: 'Alice', age: 30 }
```

### Does Blop support Server-Side Rendering (SSR)?

Yes. Import `renderComponentToString` from `blop-language/ssr`:

```javascript
import { renderComponentToString } from 'blop-language/ssr'
const html = renderComponentToString(() => <MyApp state={state} />)
```

The runtime cache is reset on each call, so concurrent or repeated SSR calls do not bleed state. Lifecycle hooks (`ctx.mount`) are skipped during SSR since there is no DOM.

### Does Blop support lazy loading / code splitting?

Yes. Use the `import()` expression, which Blop compiles directly to a native dynamic import:

```typescript
// Load a component module on demand
MyPageModule = await import('./MyPage.blop')
setPage(MyPageModule.MyPage)
```

A typical pattern for lazy-loading a page component:

```typescript
Index = (ctx: Component) => {
  { value as Page, setState: setPage } = ctx.state('page', null)

  async def loadPage() {
    mod = await import('./HeavyPage.blop')
    setPage(mod.HeavyPage)
  }

  <div>
    if Page {
      <Page />
    } else {
      loadPage()
      <p>'Loading...'</p>
    }
  </div>
}
```

Vite automatically splits the dynamic import into a separate chunk, so the module is only downloaded when the user first visits that route.

## Performance

### How big is the bundle size?

Blop runtime + Snabbdom is ~15KB gzipped (~42KB parsed).

### Is Blop fast?

- **Compilation:** Very fast (30,000+ lines/second)
- **Runtime:** Similar to React (uses Snabbdom Virtual DOM)
- **Bundle size:** Smaller than React

### Should I use Blop for large apps?

Blop works well for medium-sized apps. For very large apps, consider:
- More mature ecosystems (React, Vue) have more libraries/tools
- Blop is still in beta
- Hot Module Reloading works great for development

## Errors & Debugging

### Why am I getting "reassignment" errors?

Blop prevents accidental variable redeclaration. Use `:=` for reassignment:

```typescript
count = 0
count := count + 1  // Use := not =
```

### The VSCode linter isn't working

**Solutions:**
1. Make sure extensions are installed
2. Reload VSCode (Cmd/Ctrl + Shift + P → "Developer: Reload Window")
3. Check the Output panel (View → Output → "Blop Linter")

### I'm seeing "Expected '}'" errors

Common causes:
- Missing closing brace
- Incorrect nesting
- Missing semicolons (though Blop doesn't require them)

Use the VSCode extension for real-time error checking.

## Migration & Compatibility

### Can I gradually adopt Blop in an existing project?

Not easily. Blop compiles to JavaScript modules, so you could:
1. Compile `.blop` files to `.js`
2. Import the generated `.js` files

But mixing Blop and React/Vue isn't recommended.

### Can I use npm packages with Blop?

Yes! Import any ES6 module:

```typescript
import axios from 'axios'
import { format } from 'date-fns'

async def fetchData() {
  response = await axios.get('/api/data')
  return response.data
}
```

### Can I use Blop components in React?

Not directly. You'd need to compile Blop to JavaScript and use it as vanilla JS.

## Contributing

### How can I contribute?

1. Check the [Style Guide](./STYLE_GUIDE.md)
2. Look at open [Issues](https://github.com/batiste/blop-language/issues)
3. Submit pull requests
4. Report bugs
5. Improve documentation

### Where can I get help?

- [GitHub Issues](https://github.com/batiste/blop-language/issues)
- [Documentation](./README.md)
- [Example Code](../example/)

## Still Have Questions?

Open an issue on [GitHub](https://github.com/batiste/blop-language/issues) with your question!
