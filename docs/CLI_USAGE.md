# Blop CLI Usage Guide

The Blop CLI (`src/blop.js`) is a command-line tool for compiling, validating, and executing Blop language files.

## Installation

```bash
npm install blop-language
```

For development:

```bash
git clone <repository>
npm install
```

## Basic Usage

```bash
node src/blop.js [options]
```

Or if installed globally:

```bash
blop [options]
```

## Command-Line Options

### `-i, --input <file>`
**Required.** Specifies the input Blop file to process.

```bash
node src/blop.js -i example/index.blop
```

### `-o, --output <file>`
Writes the compiled JavaScript output to the specified file.

```bash
node src/blop.js -i input.blop -o output.js
```

If no output file is specified, the compiled code is printed to stdout.

### `-e, --execute`
Executes the compiled code immediately using Node.js VM. Useful for testing scripts.

```bash
node src/blop.js -i script.blop -e
```

### `-r, --resolve`
Resolves and bundles import statements in the output. Useful for creating standalone files.

```bash
node src/blop.js -i app.blop -o bundle.js -r
```

### `-s, --sourceMap`
Generates inline source maps for debugging. The source map is embedded as a base64-encoded data URI in the output.

```bash
node src/blop.js -i app.blop -o app.js -s
```

### `-f, --inference`
Enables type inference checking. The compiler will analyze types and report mismatches between declared and inferred return types.

```bash
node src/blop.js -i app.blop -f
```

Type errors will be displayed but compilation will continue unless combined with `--validate`.

### `-v, --validate`
Validation-only mode. Checks the file for syntax and type errors without generating output. Exits with code 0 if valid, code 1 if errors are found.

```bash
node src/blop.js -i app.blop --validate
```

When combined with `--inference`, performs both syntax and type validation:

```bash
node src/blop.js -i app.blop --inference --validate
```

## Common Usage Patterns

### Compile a single file

```bash
node src/blop.js -i input.blop -o output.js
```

### Compile with source maps

```bash
node src/blop.js -i app.blop -o app.js -s
```

### Run a Blop script

```bash
node src/blop.js -i script.blop -e
```

### Validate with type checking

```bash
node src/blop.js -i component.blop --inference --validate
```

### Bundle with imports resolved

```bash
node src/blop.js -i app.blop -o bundle.js -r
```

### Development workflow (compile + check types)

```bash
node src/blop.js -i app.blop -o app.js -s -f
```

## Type Inference

The `--inference` flag enables the Phase 1 & Phase 2 type inference system, which validates:

- **VNode return types**: Functions declared with `: VNode` must return virtual DOM nodes
- **Implicit returns**: Arrow functions with expression bodies are validated
- **Conditional branches**: Functions with if/else branches check all paths return correct types
- **Return type mismatches**: Warns when inferred types don't match declarations

### Example Type Errors

```blop
// Error: returns number but declared as VNode
def Test(): VNode {
  return 1
}

// Error: returns VNode | undefined but declared as VNode
def Conditional(): VNode {
  if someCondition {
    <div>'Hello'</div>
  }
  // Missing else branch - undefined is possible
}

// Valid
def Valid(): VNode {
  if someCondition {
    <div>'Hello'</div>
  } else {
    <span>'World'</span>
  }
}
```

Type errors are displayed with helpful context including file name, line number, and suggested fixes.

## Error Handling

The CLI provides enhanced error messages with:

- Line numbers and column positions
- Syntax error suggestions
- Type mismatch details
- Quick fix recommendations

When validation fails in `--validate` mode, the CLI exits with code 1, making it suitable for CI/CD pipelines.

## Configuration File

While the CLI provides flags for all options, you can also use a `blop.config.js` file in your project root:

```javascript
module.exports = {
  inference: true,        // Enable type inference
  strictness: 'perfect',  // Type checking strictness
  // Other configuration options...
}
```

CLI flags override configuration file settings. For example, using `--inference` enables type checking even if not set in the config file.

## Integration with Build Tools

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "build": "node src/blop.js -i src/app.blop -o dist/app.js -s -r",
    "validate": "node src/blop.js -i src/app.blop --inference --validate",
    "test": "jest"
  }
}
```

### CI/CD Validation

```bash
# In your CI pipeline
node src/blop.js -i src/app.blop --inference --validate || exit 1
```

### Watch Mode

For development, combine with a file watcher:

```bash
# Using nodemon
nodemon --watch src --ext blop --exec "node src/blop.js -i src/app.blop -o dist/app.js -s"
```

## Version

```bash
node src/blop.js --version
```

Current version: 0.1.0

## Help

Display all available options:

```bash
node src/blop.js --help
```

## See Also

- [Blop Language Syntax Reference](https://github.com/batiste/blop-language/wiki/Blop-language-syntax-reference)
- [Modern Features](MODERN_FEATURES.md) - Enhanced error messages and type inference
- [Statistical Error Prioritization](STATISTICAL_ERROR_PRIORITIZATION.md)
- [How Components Work](https://github.com/batiste/blop-language/wiki/Components)
