# Installation Guide

Complete guide to installing and setting up Blop.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installing Blop](#installing-blop)
- [Setting Up a New Project](#setting-up-a-new-project)
- [Setting Up Vite](#setting-up-vite)
- [Setting Up Vitest](#setting-up-vitest)
- [VSCode Extensions](#vscode-extensions)
- [Development Setup](#development-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js** 20 or higher
- **npm** or **yarn**
- A code editor (VSCode recommended)

## Installing Blop

### From npm

```bash
npm install blop-language
```

### From Source

If you want to contribute or use the latest development version:

```bash
git clone https://github.com/batiste/blop-language.git
cd blop-language
npm install
```

## Setting Up a New Project

### 1. Create Project Directory

```bash
mkdir my-blop-app
cd my-blop-app
npm init -y
```

### 2. Install Dependencies

```bash
npm install blop-language vite
```

### 3. Create Project Structure

```bash
mkdir src
touch src/main.blop
touch index.html
touch vite.config.js
```

### 4. Configure Vite

Create `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { blopPlugin } from 'blop-language/src/vite';

export default defineConfig({
  plugins: [blopPlugin()],
});
```

### 5. Create Entry Point

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Blop App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.blop"></script>
  </body>
</html>
```

### 6. Create Your First Component

Create `src/main.blop`:

```blop
import { mount } from 'blop'

def App() {
  <div>
    <h1>'Welcome to Blop!'</h1>
    <p>'Your app is running.'</p>
  </div>
}

// Mount the app
{ init } = mount(document.getElementById('app'), () => App())
init()
```

### 7. Add Scripts to package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 8. Run the Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser!

## Setting Up Vite

Vite provides fast development and optimized builds.

### Basic Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { blopPlugin } from 'blop-language/src/vite';

export default defineConfig({
  plugins: [blopPlugin()],
});
```

### Advanced Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { blopPlugin } from 'blop-language/src/vite';

export default defineConfig({
  plugins: [blopPlugin()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

## Setting Up Vitest

Vitest is the recommended testing framework for Blop.

### 1. Install Vitest

```bash
npm install -D vitest jsdom
```

### 2. Configure Vitest

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

### 3. Add Test Script

Update `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### 4. Create a Test

Create `src/App.test.blop`:

```blop
import { describe, it, expect } from 'vitest'

def add(a, b) {
  return a + b
}

describe('Math', () => {
  it('adds numbers', () => {
    expect(add(1, 2)).toBe(3)
  })
})
```

### 5. Run Tests

```bash
npm test
```

## VSCode Extensions

Get the best development experience with VSCode extensions.

### Option 1: Install from Marketplace

1. Open VSCode
2. Go to Extensions (Cmd/Ctrl + Shift + X)
3. Search for "Blop"
4. Install both extensions:
   - **Blop Language** - Syntax highlighting
   - **Blop Linter** - Error checking and diagnostics

### Option 2: Install from Repository

If you cloned the repository:

```bash
cd blop-language
npm run link-extensions
```

Then reload VSCode (Cmd/Ctrl + Shift + P → "Developer: Reload Window").

### Extension Features

- **Syntax Highlighting** - Beautiful code coloring
- **Error Detection** - Real-time error checking
- **Autocomplete** - Smart code completion
- **Go to Definition** - Jump to declarations
- **Formatting** - Code formatting support

## Development Setup

### For Contributing to Blop

If you want to contribute to Blop itself:

#### 1. Clone and Install

```bash
git clone https://github.com/batiste/blop-language.git
cd blop-language
npm install
```

#### 2. Build Parser

```bash
npm run parser
```

#### 3. Run Tests

```bash
npm test
```

#### 4. Run Example App

```bash
npm start
```

Open http://localhost:3000

#### 5. Build Linter Extension

After modifying the linter:

```bash
npm run linter
```

Then reload VSCode.

### Project Structure

```
blop-language/
├── src/                    # Core language source
│   ├── compile.js         # Compiler
│   ├── grammar.js         # Grammar definition
│   ├── runtime.js         # Runtime library
│   └── vite.js            # Vite plugin
├── docs/                  # Documentation
├── example/               # Example application
├── vscode/                # VSCode extensions
│   ├── blop-linter/
│   └── blop-syntax-highlighter/
└── vitest.config.js       # Test configuration
```

## Troubleshooting

### Vite not recognizing .blop files

**Solution:** Make sure `blopPlugin()` is in your `vite.config.js`:

```javascript
import { blopPlugin } from 'blop-language/src/vite';

export default defineConfig({
  plugins: [blopPlugin()],
});
```

### VSCode extensions not working

**Solutions:**

1. Make sure extensions are enabled
2. Reload VSCode (Cmd/Ctrl + Shift + P → "Developer: Reload Window")
3. Check Output panel for errors (View → Output → select "Blop Linter")
4. Try reinstalling extensions

### Import errors

**Solution:** Blop uses ES6 module syntax. Make sure files have proper import/export statements:

```blop
// Export
export def myFunction() { ... }

// Import
import { myFunction } from './file.blop'
```

### Build errors

**Solution:** Check that all files are saved and there are no syntax errors. Run:

```bash
npm run build 2>&1 | head -50
```

### Tests not running

**Solution:** Make sure:

1. Test files end with `.test.blop`
2. `vitest.config.js` includes `blopPlugin()`
3. `jsdom` is installed: `npm install -D jsdom`

### Hot Module Reload not working

**Solution:** Vite's HMR should work automatically. If not:

1. Check browser console for errors
2. Try hard refresh (Cmd/Ctrl + Shift + R)
3. Restart dev server

## Next Steps

- Follow the [Quick Start Guide](./QUICK_START.md)
- Read the [Syntax Reference](./SYNTAX_REFERENCE.md)
- Explore [Components](./COMPONENTS.md)
- Check out [Example Projects](../example/)

## Getting Help

- [GitHub Issues](https://github.com/batiste/blop-language/issues)
- [Documentation](./README.md)
- [Example Application](../example/)
