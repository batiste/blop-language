# Quick Start Guide

Get started with Blop in 5 minutes!

## Prerequisites

- Node.js 20+ and npm
- A code editor (VSCode recommended)

## Installation

```bash
npm install blop-language
```

## Create Your First Blop File

Create a file called `hello.blop`:

```typescript
def Hello(ctx: Component) {
  name = attributes.name || 'World'
  <div>
    <h1>'Hello 'name'!'</h1>
  </div>
}

def App() {
  <div>
    <Hello name="Blop"></Hello>
  </div>
}
```

## Setup Vite

Create `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { blopPlugin } from 'blop-language/src/vite';

export default defineConfig({
  plugins: [blopPlugin()],
});
```

Create `index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Blop App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/hello.blop"></script>
  </body>
</html>
```

Update your `hello.blop` to mount the app:

```typescript
import { mount } from 'blop'

def Hello(ctx: Component) {
  name = ctx.attributes.name || 'World'
  <div>
    <h1>'Hello 'name'!'</h1>
  </div>
}

def App(ctx: Component) {
  <div>
    <Hello name="Blop"></Hello>
  </div>
}

// Mount the app
{ init } = mount(document.getElementById('app'), () => App())
init()
```

## Run It

```bash
npx vite
```

Open http://localhost:5173 in your browser!

## Install VSCode Extensions

For the best development experience, install the Blop VSCode extensions:

1. Open VSCode
2. Search for "Blop" in the Extensions marketplace
3. Install both:
   - **Blop Language** (syntax highlighting)
   - **Blop Linter** (error checking)

## Next Steps

- Read the [Language Syntax Reference](./SYNTAX_REFERENCE.md)
- Learn about [Components](./COMPONENTS.md)
- Explore [State Management](./STATE_MANAGEMENT.md)
- Check out the [Example Project](../example/)

## Common Commands

```bash
# Development server
npm start  # or npx vite

# Build for production
npm run build

# Run tests
npm test

# Compile a single file
npx blop -i input.blop -o output.js
```
