# The Blop Language

<img src="/img/blop.png" width="120">

**Blop is a modern language for the Web that natively generates Virtual DOM trees using familiar HTML-like syntax.**

The Blop language compiles to ES6-compliant JavaScript with minimal dependencies. Unlike JSX, Blop is not limited to expressions – you can mix statements, expressions, and HTML-like syntax within the same function, giving you the full power of the language to generate Virtual DOM trees.

Blop uses the [snabbdom](https://github.com/snabbdom/snabbdom/) library for Virtual DOM rendering and is built with the [Meta Parser Generator](https://github.com/batiste/meta-parser-generator).

<img src="/img/carbon.png" width="700">

## Quick Start

```bash
# Install Blop
npm install blop-language

# Or clone and run the example
git clone https://github.com/batiste/blop-language.git
cd blop-language
npm install
npm start
```

**[Quick Start Guide](docs/QUICK_START.md)** · **[Live Demo](https://batiste.github.io/blop/example/)**

## Example

```typescript
import { mount, Component } from 'blop'

// A simple counter component
Counter = (ctx: Component) => {
  { value, setState } = ctx.state<number>('count', 0)
  
  <div>
    <h2>'Counter: 'value</h2>
    <button on={ click: () => setState(value + 1) }>'Increment'</button>
    <button on={ click: () => setState(value - 1) }>'Decrement'</button>
  </div>
}

// Mount the app
{ init } = mount(document.getElementById('app'), () => <Counter />)
init()
```

## Documentation

### Getting Started
- **[Installation Guide](docs/INSTALLATION.md)** - Complete setup instructions
- **[Quick Start](docs/QUICK_START.md)** - Get running in 5 minutes
- **[Syntax Reference](docs/SYNTAX_REFERENCE.md)** - Complete language syntax

### Core Concepts
- **[Components](docs/COMPONENTS.md)** - Building blocks of Blop applications
- **[State Management](docs/STATE_MANAGEMENT.md)** - Proxy-based reactive state
- **[Routing](docs/ROUTING.md)** - Client-side navigation

### Advanced Topics
- **[CLI Usage](docs/CLI_USAGE.md)** - Command-line interface
- **[Modern JS Features](docs/MODERN_FEATURES.md)** - Spread, optional chaining, nullish coalescing, dynamic `import()`
- **[Lazy Loading](docs/MODERN_FEATURES.md#dynamic-import--lazy-loading)** - Code splitting and on-demand component loading
- **[Server-Side Rendering](docs/VIRTUAL_DOM.md#server-side-rendering)** - `renderComponentToString` API
- **[Generics](docs/GENERICS_QUICK_REFERENCE.md)** - Generic types and functions

**[Browse All Documentation](docs/README.md)**

## Key Features

### Language Features

- **Native HTML** - HTML-like syntax built into the language
- **Fast Compilation** - Process 30,000+ lines per second
- **Enhanced Error Messages** - Helpful suggestions and quick fixes
- **Integrated Linter and Formatter** - No configuration needed, no discussions about rules
- **VSCode Integration** - Syntax highlighting and real-time error checking
- **Source Maps** - Debug with original source code
- **Advanced Type Annotations and Inference** - Optional type checking with intelligent inference
- **Modern JavaScript** - ES6+ including optional chaining, nullish coalescing, spread, dynamic `import()`
- **Lazy Loading** - Dynamic `import()` for code splitting and on-demand component loading
- **Component System** - Built-in lifecycle and state management

### Tooling
- **SSR Support** - `renderComponentToString()` for server-side rendering
- **Hot Module Reloading (HMR)** - Instant updates during development
- **CLI Tool** - Compile, format, and manage Blop projects from the command line
- **Vite Compatibility** - Seamless integration with modern build tools
- **Vitest Integration** - Write and run tests with a modern testing framework
- **Small Bundle Size** - ~15KB gzipped (Snabbdom + Blop runtime)

### What's Missing
- Still in beta - API may change

## Setup

#### Installation

```bash
npm install blop-language
```

**[Full Installation Guide](docs/INSTALLATION.md)**

### Vite Configuration

Create or update `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { blopPlugin } from 'blop-language/vite';

export default defineConfig({
  plugins: [blopPlugin()],
});
```

**[More Vite Configuration Options](docs/INSTALLATION.md#setting-up-vite)**

### Vitest Configuration

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';
import { blopPlugin } from 'blop-language/vitest';

export default defineConfig({
  plugins: [blopPlugin()],
  test: {
    include: ['**/*.test.blop'],
    globals: true,
    environment: 'jsdom',
  },
});
```

**[Testing Guide](docs/INSTALLATION.md#setting-up-vitest)**

### VSCode Extensions

Install from the marketplace or via command:

```bash
# If you cloned the repo
npm run link-extensions
```

Search for "Blop" in VSCode Extensions for:
- **Blop Language** - Syntax highlighting
- **Blop Linter** - Real-time error checking

<img src="/img/extensions.png" width="600">

**[Extension Setup Guide](docs/INSTALLATION.md#vscode-extensions)**

## CLI Usage

Compile a single file:

```bash
npx blop -i input.blop -o output.js
```

**[Complete CLI Reference](docs/CLI_USAGE.md)**

## Development

### Running the Example App

```bash
git clone https://github.com/batiste/blop-language.git
cd blop-language
npm install
npm start  # Open http://localhost:3000
```

### Building and Testing

```bash
# Run tests
npm test

# Build parser
npm run parser

# Build linter extension
npm run linter
```

### Formatting

You can format your Blop source files in place using the CLI:

```
node src/blop.js --format -i project/path/TodoListItem.blop
```

If you want to automatically format all staged Blop files before each commit, you can set up a Git pre-commit hook:

```bash
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
git diff --cached --name-only --diff-filter=ACM | grep '\.blop$' | while read file; do
  node src/blop.js --format -i "$file"
done
EOF
chmod +x .git/hooks/pre-commit
```

**[Contributing Guide](docs/STYLE_GUIDE.md)**

## Example Project Structure

```text
my-blop-app/
├── src/
│   ├── main.blop          # Entry point
│   ├── App.blop           # Root component
│   ├── components/        # Reusable components
│   ├── lib/               # Utilities (state, router)
│   └── pages/             # Page components
├── index.html             # HTML entry
├── vite.config.js         # Vite configuration
├── vitest.config.js       # Test configuration
└── package.json
```

## Links

- **[Live Demo](https://batiste.github.io/blop/example/)** - See Blop in action
- **[GitHub Repository](https://github.com/batiste/blop-language)** - Source code
- **[NPM Package](https://www.npmjs.com/package/blop-language)** - Install package
- **[Documentation](docs/README.md)** - Complete guides
- **[Issues](https://github.com/batiste/blop-language/issues)** - Bug reports & features

## License

MIT License - see [LICENSE.txt](LICENSE.txt)

