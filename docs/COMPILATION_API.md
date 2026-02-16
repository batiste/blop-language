# Compilation API

The Blop compiler has been simplified and now provides clean, ESM-only compilation with no webpack or source map support.

## Node.js Compilation

For Node.js environments (CLI, tests, etc.):

```javascript
import { compileSource } from 'blop-language/src/compile.js';

const result = compileSource(
  source,       // string: Blop source code
  filename,     // string: optional filename for error reporting (default: false)
  enableInference // boolean: enable type inference checking (default: false)
);

// Result object:
// {
//   code: string,         // Compiled JavaScript code
//   success: boolean,     // Whether compilation succeeded
//   errors: Array,        // Compilation errors
//   warnings: Array,      // Compilation warnings
//   dependencies: Array   // File dependencies (imports)
// }
```

## Browser Compilation

For browser environments (no Node.js dependencies):

```javascript
import { compileBrowser } from 'blop-language/src/compile-browser.js';

const result = compileBrowser(source, {
  inference: false,        // Enable type inference (default: false)
  filename: 'source.blop'  // Optional filename for errors (default: 'source.blop')
});

// Returns same result object as compileSource
```

## Runtime Import

The compiled code expects the Blop runtime to be available. The Vite and Vitest plugins automatically inject:

```javascript
import * as blop from '/path/to/runtime.js';
```

For manual usage, you need to ensure the runtime is imported or available globally.

## Changes from Previous Version

- ❌ Removed webpack support
- ❌ Removed source map support  
- ❌ Removed `env` parameter (always uses ESM now)
- ❌ Removed `useSourceMap` parameter
- ❌ Removed `resolve` parameter
- ✅ Simplified to 3 parameters: `(source, filename, enableInference)`
- ✅ Always generates ESM (no CommonJS)
- ✅ Clean error handling with structured result object
- ✅ Browser-compatible version available

## Vite Plugin Usage

The Vite and Vitest plugins have been updated to use the new API:

```javascript
// vite.config.js
import { blopPlugin } from 'blop-language/src/vite.js';

export default {
  plugins: [
    blopPlugin({
      inference: true,  // Enable type checking
      debug: false      // Debug mode
    })
  ]
};
```

The plugin automatically:
- Compiles .blop files to JavaScript
- Injects the runtime import
- Handles hot module replacement
- Reports compilation errors to Vite
