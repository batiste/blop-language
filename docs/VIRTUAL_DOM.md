# Virtual DOM in Blop

## Overview

Blop uses a **Virtual DOM** (VDOM) architecture for efficient UI rendering. Instead of directly manipulating the browser's DOM, Blop creates a lightweight JavaScript representation of the UI tree, compares it with the previous version, and only updates what has changed.

Blop leverages [Snabbdom](https://github.com/snabbdom/snabbdom), a fast and modular Virtual DOM library (~200 LOC core), to handle the diffing and patching operations.

## Why Virtual DOM?

### Benefits

1. **Performance** - Only real changes are applied to the DOM, avoiding expensive full re-renders
2. **Declarative** - You describe what the UI should look like, not how to change it
3. **Predictable** - State changes lead to predictable UI updates
4. **Efficient** - Batches multiple updates using `requestAnimationFrame`
5. **Small Bundle** - Snabbdom + Blop runtime = ~15KB gzipped

### Architecture

```text
Blop Syntax → JavaScript Code → Virtual DOM Tree → Snabbdom Patch → Real DOM
```

## Snabbdom Integration

### Initialization

Blop initializes Snabbdom with several modules in [runtime.js](../src/runtime.js):

```javascript
import { init, h as snabbdomh, toVNode, 
         attributesModule, styleModule, classModule, 
         eventListenersModule, propsModule } from 'snabbdom';

const patch = init([
  attributesModule,   // Handle attributes (id, data-*, etc.)
  styleModule,        // Handle inline styles
  eventListenersModule, // Handle event handlers
  classModule,        // Handle CSS classes
  propsModule,        // Handle form element props (value, checked, etc.)
]);
```

### Modules Used

| Module | Purpose | Example |
|--------|---------|---------|
| `attributesModule` | HTML attributes | `<div id="app" data-value="123">` |
| `styleModule` | Inline styles | `<div style={ color: 'red' }>` |
| `classModule` | CSS classes (object/string) | `<div class={ active: true }>` |
| `eventListenersModule` | Event handlers | `<button on={ click: handler }>` |
| `propsModule` | DOM properties | `<input value="text">` |

## Compilation Process

### From Blop to JavaScript

Blop's Virtual DOM syntax is **compiled** into JavaScript function calls. The compiler transforms readable markup into efficient code.

#### Example: Simple Element

**Blop code:**
```typescript
def Greeting(attributes) {
  <div class="greeting">
    'Hello, ' attributes.name '!'
  </div>
}
```

**Compiled JavaScript (simplified):**
```javascript
function Greeting(attributes) {
  const _v1c = [];
  const _v1a = {};
  
  _v1a['class'] = "greeting";
  _v1c.push('Hello, ');
  _v1c.push(attributes.name);
  _v1c.push('!');
  
  const _v1 = blop.h('div', _v1a, _v1c);
  return _v1;
}
```

### Virtual Node Creation Functions

Blop exposes two core functions from the runtime:

#### `blop.h(tag, attributes, children)` - HTML Elements

Creates a virtual node for native HTML elements:

```javascript
blop.h('div', { class: 'container' }, ['Hello'])
```

This wraps Snabbdom's `h()` function with additional processing:
- Normalizes event handlers into the `on` object
- Handles style objects
- Manages hooks for lifecycle events
- Separates props from attributes for form elements

#### `blop.c(Component, attributes, children, uid)` - Components

Creates a virtual node for custom Blop components:

```javascript
blop.c(MyButton, { label: 'Click me' }, [], '_v2')
```

This manages:
- Component instantiation and caching
- Component lifecycle (mount/unmount)
- State management
- Context propagation

### Code Generation

The compiler generates unique identifiers for each virtual node to avoid naming conflicts:

```javascript
// Multiple nested elements get unique IDs
const _v1c = [];  // children array for first node
const _v1a = {};  // attributes object for first node
const _v2c = [];  // children array for second node
const _v2a = {};  // attributes object for second node
```

## The `h()` Function - Creating VNodes

The [h() function](../src/runtime.js#L242-L282) is Blop's wrapper around Snabbdom's hyperscript function:

```javascript
function h(name, attributes, children) {
  const attrs = {};
  let on, style, sclass, hook, key, props;
  
  // Process different attribute types
  Object.entries(attributes).forEach(([index, value]) => {
    if (index === 'on') {
      on = value;  // Event handlers
    } else if (index === 'style') {
      style = value;  // Inline styles
    } else if (index === 'key') {
      key = value;  // List reconciliation key
    } else if (index === 'hooks') {
      hook = { ...hook, ...value };  // Lifecycle hooks
    } else if (index === 'class') {
      if (typeof value === 'string') {
        attrs[index] = value;  // String classes
      } else {
        sclass = value;  // Object classes
      }
    } else if (index === 'value' && 
               (name === 'input' || name === 'textarea' || name === 'select')) {
      if (!props) props = {};
      props[index] = value;  // Form element values
    } else {
      attrs[index] = value;  // Regular attributes
    }
  });
  
  return snabbdomh(name, {
    on, style, attrs, hook, class: sclass, key, props
  }, children);
}
```

### VNode Structure

A Snabbdom virtual node has this structure:

```javascript
{
  sel: 'div',              // CSS selector (tag.class#id)
  data: {                  // Node data
    attrs: { ... },        // HTML attributes
    on: { ... },           // Event handlers
    style: { ... },        // Inline styles
    class: { ... },        // CSS classes
    hook: { ... },         // Lifecycle hooks
    key: '...',            // Unique key for lists
    props: { ... }         // DOM properties
  },
  children: [...],         // Child vnodes or text
  text: '...',            // Text content (for text nodes)
  elm: DOMElement,        // Reference to real DOM element (after patch)
  key: '...'              // Unique identifier
}
```

## Rendering and Patching

### Full Render Cycle

The [mount() function](../src/runtime.js#L323-L378) manages the full application render cycle:

```javascript
function mount(dom, render) {
  let vnode, requested;
  cache = {}, nextCache = {};
  
  function init() {
    // Initial render
    const target = document.createElement('div');
    dom.innerHTML = '';
    dom.appendChild(target);
    newRoot();
    vnode = render();
    vnode = patch(toVNode(target), vnode);  // Convert real DOM to vnode
    requested = false;
    return vnode;
  }
  
  function refresh(callback) {
    if (requested) return;
    requested = true;
    renderPipeline = [];
    
    const rerender = () => {
      nextCache = {};
      const now = Date.now();
      
      try {
        const newVnode = render();
        if (!newVnode) {
          requested = false;
          callback && callback(Date.now() - now);
          return;
        }
        
        newRoot();
        patch(vnode, newVnode);  // Snabbdom patches the DOM
      } catch (error) {
        requested = false;
        throw error;
      }
      
      const after = Date.now();
      vnode = newVnode;
      destroyUnreferencedComponents();  // Cleanup
      cache = nextCache;
      requested = false;
      callback && callback(after - now);
    };
    
    window.requestAnimationFrame(rerender);  // Batch updates
  }
  
  return { refresh, init };
}
```

### The Patch Algorithm

Snabbdom's `patch()` function efficiently updates the DOM:

1. **Compare** old and new virtual trees
2. **Calculate** differences (diffing algorithm)
3. **Apply** minimal changes to real DOM

```javascript
const oldVnode = h('div', {}, ['Hello']);
const newVnode = h('div', {}, ['Hello World']);

// Snabbdom only updates the text node, not the whole div
patch(oldVnode, newVnode);
```

### Partial Renders

Components can trigger partial re-renders without affecting the entire tree:

```javascript
class Component {
  partialRender() {
    if (!this.vnode) return;
    
    const parentNode = currentNode;
    currentNode = this;
    this._resetForRender();
    
    const newVnode = this.renderComponent();
    const thunk = patch(this.vnode, newVnode);  // Patch just this component
    copyToThunk(thunk, this.vnode);
    
    currentNode = parentNode;
  }
  
  refresh() {
    if (this.destroyed) return;
    scheduleRender(this);  // Schedule update
  }
}
```

### Batched Updates

Blop batches component updates using `requestAnimationFrame`:

```javascript
let renderPipeline = [];
let animationRequest = false;

function scheduleRender(node) {
  renderPipeline.push(node);
  
  if (!animationRequest) {
    animationRequest = true;
    window.requestAnimationFrame(() => {
      renderPipeline.forEach(node => node.partialRender());
      animationRequest = false;
      renderPipeline = [];
    });
  }
}
```

This means multiple state changes in the same frame result in a single render pass.

## Component System

### Component Lifecycle

Blop components integrate with Virtual DOM rendering:

```javascript
class Component {
  constructor(componentFct, attributes, children, name) {
    this.componentFct = componentFct;
    this.attributes = attributes;
    this.children = children;
    this.path = componentPath(name);  // Unique path in tree
    this.vnode = null;                // Current virtual node
    this.state = {};                  // Component state
    this.mounted = false;
    cache[this.path] = this;          // Cache for re-use
  }
  
  _render(attributes, children) {
    this.attributes = attributes;
    this.children = children;
    this._resetForRender();
    
    const newVnode = this.renderComponent();
    
    if (!this.mounted) {
      this._mount();  // First render: call mount hooks
    }
    
    nextCache[this.path] = this;
    this.vnode = newVnode;
    return this.vnode;
  }
  
  renderComponent() {
    try {
      return this.componentFct(this.attributes, this.children, this);
    } catch (e) {
      console.error(e);
      return h('span', {}, [e.message]);
    }
  }
}
```

### Component Caching

Blop uses a **path-based caching system** to preserve component instances:

```javascript
function createComponent(ComponentFct, attributes, children, name) {
  const path = componentPath(name);  // e.g., "root.0.MyButton"
  
  if (cache[path]) {
    // Re-use existing component
    return cache[path]._render(attributes, children);
  }
  
  // Create new component
  const component = new Component(ComponentFct, attributes, children, name);
  return component._render(attributes, children);
}
```

This preserves:
- Component state between renders
- DOM element references
- Event listeners

### Component Cleanup

After each full render, unused components are destroyed:

```javascript
function destroyUnreferencedComponents() {
  const keysCache = Object.keys(cache);
  const keysNextCache = Object.keys(nextCache);
  
  // Find components that weren't in new render
  const difference = keysCache.filter(x => !keysNextCache.includes(x));
  
  // Clean them up
  difference.forEach(path => cache[path]._destroy());
}
```

## Performance Optimizations

### 1. Conditional Rendering with `needRender`

Blop provides a special `needRender` attribute to skip rendering children:

**Blop code:**
```typescript
def ExpensiveComponent(attributes) {
  <div needRender=attributes.shouldUpdate>
    = computeExpensiveValue()
  </div>
}
```

**Compiled code:**
```javascript
_v1a['needRender'] = attributes.shouldUpdate;
if (attributes.shouldUpdate !== false) {
  // Children only evaluated if needRender is true
  _v1c.push(computeExpensiveValue());
}
```

This optimization is handled by the [prepatch hook](../src/runtime.js#L236-L240):

```javascript
function prepatch(oldVnode, newNode) {
  if (newNode.data.attrs.needRender === false) {
    copyToThunk(oldVnode, newNode);  // Reuse old vnode completely
  }
}
```

### 2. Keys for List Reconciliation

Use `key` attributes to help Snabbdom efficiently update lists:

```typescript
def TodoList(attributes) {
  <ul>
    for item in attributes.todos {
      <li key=item.id>item.text</li>
    }
  </ul>
}
```

Without keys, Snabbdom uses index-based comparison. With keys, it matches elements by identity, enabling efficient insertions and deletions.

### 3. Virtual Node Assignment Operator

The `=` operator efficiently inserts content:

```typescript
<div>
  = items.map(item => <span>item</span>)
</div>
```

**Compiled:**
```javascript
_v1 = items.map(item => blop.h('span', {}, [item]));
Array.isArray(_v1) ? _v2c.push(..._v1) : _v2c.push(_v1);
```

This flattens arrays automatically.

## Lifecycle Hooks

Blop exposes Snabbdom's lifecycle hooks for fine-grained control:

### Available Hooks

| Hook | When Called | Use Case |
|------|-------------|----------|
| `pre` | Before patch process | Prepare for updates |
| `init` | VNode created | Initialize data structures |
| `create` | Element added to vnode | Setup before DOM insertion |
| `insert` | Element inserted into DOM | Focus, animations, 3rd party libs |
| `prepatch` | Before element patched | Optimization decisions |
| `update` | Element updated | React to DOM changes |
| `postpatch` | After element patched | Post-update operations |
| `destroy` | Element removed from parent | Cleanup listeners |
| `remove` | Element being removed | Animations before removal |
| `post` | After patch complete | Finalization |

### Example Usage

```typescript
def AutoFocusInput(attributes) {
  hooks = {
    insert: (vnode) => {
      vnode.elm.focus()  // Focus when inserted into DOM
    },
    destroy: (vnode) => {
      console.log('Input destroyed')
    }
  }
  
  <input hooks type="text" value=attributes.value />
}
```

**How it works:**
1. Blop sees the `hooks` attribute
2. Merges user hooks with built-in prepatch hook
3. Passes to Snabbdom via the `hook` data property

```javascript
hook = { prepatch, ...userHooks };
```

## Examples

### Basic Virtual DOM

```typescript
def Greeting(attributes) {
  <div class="greeting">
    <h1>'Hello, ' attributes.name</h1>
    <p>'Welcome to Blop!'</p>
  </div>
}
```

### With Events

```typescript
def Counter(attributes) {
  def increment() {
    attributes.count := attributes.count + 1
  }
  
  <button on={ click: increment }>
    'Count: ' attributes.count
  </button>
}
```

### With Conditionals

```typescript
def LoadingView(attributes) {
  if attributes.loading {
    <div class="spinner">'Loading...'</div>
  } else if attributes.error {
    <div class="error">attributes.error</div>
  } else {
    <div class="content">attributes.data</div>
  }
}
```

### With Loops

```typescript
def TodoList(attributes) {
  <ul class="todo-list">
    for todo in attributes.todos {
      <li key=todo.id class={ completed: todo.done }>
        <span>todo.text</span>
      </li>
    }
  </ul>
}
```

### With Hooks

```typescript
def ChartComponent(attributes) {
  hooks = {
    insert: (vnode) => {
      // Initialize chart library
      window.Chart.create(vnode.elm, attributes.data)
    },
    update: (oldVnode, vnode) => {
      // Update chart when data changes
      window.Chart.update(vnode.elm, attributes.data)
    },
    destroy: (vnode) => {
      // Clean up chart instance
      window.Chart.destroy(vnode.elm)
    }
  }
  
  <canvas hooks id="chart" width="400" height="400"></canvas>
}
```

### Component with State

```typescript
class TodoApp extends blop.Component {

  def render(attributes, _children, component) {
    { value, setState } = component.useState('input', '')
    { value: todos, setState: setTodos } = component.useState('todos', [])
    
    def addTodo() {
      if value.trim() {
        newTodo = { id: Date.now(), text: value, done: false }
        setTodos([...todos, newTodo])
        setState('')
      }
    }
    
    <div class="todo-app">
      <input 
        value=value 
        on={ input: (e) => setState(e.target.value) }
      />
      <button on={ click: addTodo }>'Add'</button>
      <ul>
        for todo in todos {
          <li key=todo.id>todo.text</li>
        }
      </ul>
    </div>
  }
}
```

## Comparison with Other Frameworks

### Blop + Snabbdom vs React

| Feature | Blop + Snabbdom | React |
|---------|-----------------|-------|
| Bundle Size | ~15KB gzipped | ~45KB gzipped (min) |
| Syntax | Native-like HTML | JSX (requires transform) |
| Loops/Conditionals | Native statements | Map/ternaries |
| Virtual DOM | Snabbdom | Custom implementation |
| Hooks | Snabbdom lifecycle | React hooks |

### Blop + Snabbdom vs Vue

| Feature | Blop + Snabbdom | Vue |
|---------|-----------------|-----|
| Bundle Size | ~15KB gzipped | ~35KB gzipped |
| Templates | Compiled to JS | Compiled to render fn |
| Reactivity | Manual updates | Reactive proxies |
| Virtual DOM | Snabbdom | Custom (inspired by Snabbdom) |

## Technical Details

### Why Snabbdom?

1. **Small** - Core is ~200 lines, total with modules ~600 lines
2. **Fast** - One of the fastest Virtual DOM implementations
3. **Modular** - Only include features you need
4. **Extensible** - Easy to add custom modules
5. **Battle-tested** - Used by Cycle.js and other frameworks
6. **Well-designed** - Clean API, good documentation

### Module Architecture

Snabbdom's modular design allows Blop to choose which features to include:

```javascript
// Only include necessary modules
init([
  attributesModule,
  styleModule,
  eventListenersModule,
  classModule,
  propsModule,
  // Could add: datasetModule, heroModule, etc.
])
```

### Performance Characteristics

- **Diffing**: O(n) algorithm (linear time)
- **Patching**: Only touches changed DOM nodes
- **Memory**: Lightweight vnodes (~100 bytes each)
- **Batching**: Uses `requestAnimationFrame` (60fps)

## See Also

- [Syntax Reference](SYNTAX_REFERENCE.md) - Virtual DOM syntax in detail
- [Components Guide](COMPONENTS.md) - Building components with Virtual DOM
- [FAQ](FAQ.md) - Common Virtual DOM questions
- [Snabbdom Documentation](https://github.com/snabbdom/snabbdom) - Underlying library
