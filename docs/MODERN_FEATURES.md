# Modern JavaScript Features in Blop

This document describes the modern JavaScript features now supported in Blop language (v1.2.0+).

## Object Spread Operator

Spread syntax allows you to expand objects in places where multiple key-value pairs are expected.

### Syntax

```typescript
obj1 = { a: 1, b: 2 }
obj2 = { c: 3, ...obj1 }  // { c: 3, a: 1, b: 2 }
```

### Merging Objects

```typescript
defaults = { timeout: 5000, retries: 3 }
options = { timeout: 10000 }
config = { ...defaults, ...options }  // { timeout: 10000, retries: 3 }
```

### Use Cases

- Cloning objects
- Merging configuration objects
- Adding properties to existing objects
- Default parameter patterns

## Optional Chaining (?.)

Optional chaining allows you to safely access deeply nested properties without manually checking each level.

### Syntax

```typescript
// Property access
value = obj?.property?.nested?.deep

// Array/computed access
value = obj?.array?.[0]
value = obj?.['property']
```

### Examples

```typescript
user = { profile: { name: 'Alice' } }
name = user?.profile?.name  // 'Alice'
age = user?.profile?.age    // undefined (no error)

nullUser = null
name = nullUser?.profile?.name  // undefined (no error)
```

### Use Cases

- API responses with optional fields
- Accessing properties on potentially null objects
- Defensive programming
- Reducing null checks

## Nullish Coalescing (??)

The nullish coalescing operator returns the right-hand value when the left-hand value is `null` or `undefined`.

### Syntax

```typescript
result = value ?? defaultValue
```

### Behavior

Unlike `||`, the `??` operator only considers `null` and `undefined` as "nullish":

```typescript
// With ?? operator
count1 = 0 ?? 42        // 0 (not nullish)
count2 = '' ?? 'text'   // '' (not nullish)
count3 = false ?? true  // false (not nullish)
count4 = null ?? 42     // 42 (nullish)
count5 = undefined ?? 42  // 42 (nullish)

// Compare with || operator
count1 = 0 || 42        // 42 (0 is falsy)
count2 = '' || 'text'   // 'text' ('' is falsy)
```

### Chaining

```typescript
result = value1 ?? value2 ?? value3 ?? 'default'
```

### Use Cases

- Default values for configuration
- Handling API responses
- Form input defaults
- Safe fallbacks

## Union and Intersection Types

Enhanced type annotation support for union (`|`) and intersection (`&`) types.

### Union Types

Union types allow a value to be one of several types:

```typescript
def processValue(val): string | number {
  if typeof val == 'string' => val.toUpperCase()
  else val * 2
}
```

### Intersection Types

Intersection types combine multiple types:

```typescript
def mergeObjects(obj1: object & {id: number}, obj2: object): object {
  return { ...obj1, ...obj2 }
}
```

### Array Types

Specify array types using bracket notation:

```typescript
def getNumbers(): number[] {
  return [1, 2, 3, 4, 5]
}

def processStrings(items: string[]): number {
  return items.length
}
```

## Combined Examples

### API Data Fetching

```typescript
async def fetchUserData(userId): object | null {
  response = await fetch(`/api/users/'userId'`)
  data = await response.json()
  
  // Safe optional chaining with nullish coalescing
  username = data?.user?.name ?? 'Anonymous'
  settings = { ...defaultSettings, ...data?.user?.settings }
  
  return {
    username,
    settings,
    premium: data?.user?.premium ?? false
  }
}
```

### Configuration Merging

```typescript
def createConfig(userConfig): object {
  defaultConfig = {
    timeout: 5000,
    retries: 3,
    debug: false
  }
  
  // Merge with spread, use nullish coalescing for specific values
  return {
    ...defaultConfig,
    ...userConfig,
    apiKey: userConfig?.apiKey ?? process.env.API_KEY
  }
}
```

### Safe Navigation

```typescript
def displayUserInfo(data): string {
  // Chain optional access with nullish coalescing
  name = data?.user?.profile?.name ?? 'Unknown'
  email = data?.user?.contact?.email ?? 'no-email'
  phone = data?.user?.contact?.phone?.primary ?? 'no-phone'
  
  return 'Name: 'name', Email: 'email', Phone: 'phone''
}
```

## Type Inference

The type inference system understands the new operators:

```typescript
// Nullish coalescing infers type from operands
def getValue(input): number {
  value = input ?? 0  // Infers number
  return value
}

// Optional chaining returns any by default
data = obj?.nested?.value  //Type: any
```

## Compatibility

All modern features compile to ES2020+ JavaScript. Make sure your target environment supports:

- Object spread: ES2018+
- Optional chaining: ES2020+
- Nullish coalescing: ES2020+

## Migration Guide

### From logical OR to nullish coalescing

Replace `||` with `??` when you want to distinguish between falsy and nullish:

```typescript
// Before
count = userInput || 0  // Problem: 0 becomes 0

// After
count = userInput ?? 0  // Better: only null/undefined become 0
```

### From manual null checks to optional chaining

```typescript
// Before
name = null
if data {
  if data.user {
    if data.user.profile {
      name = data.user.profile.name
    }
  }
}

// After
name = data?.user?.profile?.name
```

## Dynamic Import / Lazy Loading

Blop supports native dynamic `import()` expressions, which enable code splitting and on-demand loading of modules.

### Syntax

```typescript
mod = await import('./MyPage.blop')
```

The `import()` call is compiled directly to a native ES dynamic import, so the bundler (Vite) automatically splits it into a separate chunk that is only downloaded when first needed.

### Lazy-loading a Page Component

The recommended pattern is to store the loaded component function in `ctx.state` and use a guarded `if` to either render it or trigger the load:

```typescript
Index = (ctx: Component) => {
  { state } = ctx.attributes
  { value as DogPage, setState: setDogPage } = ctx.state('dogPage', null)

  async def loadDogPage() {
    mod = await import('./DogPage/DogBreedGame.blop')
    setDogPage(mod.DogGame)
  }

  <div>
    if state.route.name == 'dog' {
      if DogPage {
        <DogPage state=state />
      } else {
        loadDogPage()
        <p>'Loading...'</p>
      }
    }
  </div>
}
```

Key points:
- The first time the `dog` route is rendered, `DogPage` is `null` so `loadDogPage()` is called.
- `setDogPage()` schedules a re-render of `Index`; on the next frame `DogPage` is set and the real component is rendered.
- Subsequent renders re-use the cached instance — `loadDogPage()` is never called again.

### Annotated Destructuring After Import

Use `{ value as Mod }: MyType = ctx.state(...)` to give the lazily-loaded component a declared type:

```typescript
type DogPageModule = { DogGame: any }
{ value as mod, setState: setMod }: DogPageModule = ctx.state('mod', null)
```

### Dependency Tracking

The compiler registers dynamic import paths in the module's dependency list, so Vite's module graph stays accurate and HMR works correctly with lazily loaded modules.

### Use Cases

- Route-level code splitting (load a page module only when the user navigates to it)
- Heavy components (rich-text editors, charts, WebGL canvases)
- Conditional features (load a debug panel only in development)
- Plugin systems

## Testing

Tests for modern features are in [src/tests/modern-features.test.blop](../src/tests/modern-features.test.blop).

Run tests:
```bash
npm test
```

Test coverage:
```bash
npm test -- --coverage
```
