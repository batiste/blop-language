# Blop Language - Code Style Guide

**Version:** 1.0  
**Last Updated:** February 13, 2026

This document outlines the coding standards and best practices for contributing to the Blop programming language implementation.

---

## Table of Contents

1. [General Principles](#general-principles)
2. [Naming Conventions](#naming-conventions)
3. [Code Structure](#code-structure)
4. [Functions](#functions)
5. [Error Handling](#error-handling)
6. [Comments and Documentation](#comments-and-documentation)
7. [Testing](#testing)
8. [File Organization](#file-organization)

---

## 1. General Principles

### Readability First
- Code is read more often than written
- Favor explicit over implicit
- Avoid clever tricks; prefer clarity
- Keep cognitive complexity low

### Consistency
- Follow existing patterns in the codebase
- Use linting tools (ESLint) consistently
- When refactoring, maintain consistent style throughout

### Simplicity
- Functions should do one thing well
- Avoid deep nesting (max 3-4 levels)
- Extract complex logic into named functions

---

## 2. Naming Conventions

### Variables

**DO:**
```javascript
// Use descriptive, full words
const functionScope = addScope('function');
const expressionNode = parseExpression();
const statementList = [];

// Use camelCase for variables and functions
const currentNamespace = getCurrentNamespace();
const isValidToken = checkToken(token);

// Use meaningful loop variables
for (const statement of statements) { ... }
for (const [index, element] of array.entries()) { ... }
```

**DON'T:**
```javascript
// Avoid abbreviations
const fct = addScope('fct');  // ❌ Use 'functionScope'
const exp = parseExp();        // ❌ Use 'expressionNode'
const stats = [];              // ❌ Use 'statements'

// Avoid single-letter variables (except in very short scopes)
for (let i = 0; i < arr.length; i++) {  // ❌ Prefer forEach/map
  const v = arr[i];                       // ❌ Use descriptive name
}
```

### Exceptions for Short Variables
Single-letter variables are acceptable only in:
- Very short lambda functions: `array.map(x => x * 2)`
- Mathematical operations: `const area = w * h`
- Iteration over simple ranges (with descriptive context nearby)

### Constants

```javascript
// Use UPPER_SNAKE_CASE for true constants
const MAX_DEPTH = 100;
const DEFAULT_TIMEOUT = 5000;

// Use an object for grouped constants
const SCOPE_TYPES = {
  FUNCTION: 'fct',
  CONDITIONAL: 'cdt',
  LOOP: 'loop',
  VIRTUAL_NODE: 'vn'
};

const ERROR_MESSAGES = {
  UNDEFINED_TOKEN: 'Token is undefined in the current scope',
  REDEFINITION: 'Redefinition within this scope'
};
```

### Functions

```javascript
// Use verb-based names for functions
function parseExpression() { ... }
function validateToken() { ... }
function generateCode() { ... }

// Use question words for predicates (return boolean)
function isValidName() { ... }
function hasChildren() { ... }
function shouldHoist() { ... }

// Prefix with 'get' for accessors
function getCurrentScope() { ... }
function getErrorMessage() { ... }

// Prefix with 'set' for mutators
function setCurrentNode(node) { ... }
function updateScope(scope) { ... }
```

### Classes

```javascript
// Use PascalCase for classes
class ScopeManager { ... }
class CodeGenerator { ... }
class ASTNode { ... }

// Private methods/properties start with underscore
class Component {
  _resetForRender() { ... }
  _mount() { ... }
}
```

### Abbreviations to Avoid

| ❌ Avoid | ✅ Use Instead |
|---------|---------------|
| `fct` | `function` or `functionScope` |
| `exp` | `expression` |
| `ns` | `namespace` |
| `stats` | `statements` |
| `cdt` | `conditionalScope` or `conditional` |
| `vn` | `virtualNode` |
| `dest` | `destructured` |
| `attr` | `attribute` |
| `param` | `parameter` |

---

## 3. Code Structure

### Indentation and Spacing

```javascript
// Use 2 spaces for indentation
function example() {
  if (condition) {
    doSomething();
  }
}

// Space after keywords
if (condition) { ... }
for (const item of items) { ... }
while (isRunning) { ... }

// Space around operators
const sum = a + b;
const isValid = x === y;

// No space for unary operators
!isValid
-value
++counter
```

### Braces and Blocks

```javascript
// Always use braces, even for single-line blocks
if (condition) {
  doSomething();
}

// Opening brace on same line
function example() {
  // ...
}

// Closing brace on own line
if (condition) {
  doSomething();
} else {
  doSomethingElse();
}
```

### Line Length

- Maximum 100 characters per line
- Break long lines logically at operators or parameters

```javascript
// Break long function calls
const result = someVeryLongFunctionName(
  firstParameter,
  secondParameter,
  thirdParameter
);

// Break long conditions
if (
  condition1 &&
  condition2 &&
  condition3
) {
  // ...
}
```

### Early Returns

Prefer early returns to reduce nesting:

```javascript
// DO:
function validate(input) {
  if (!input) {
    return false;
  }
  
  if (input.length < 3) {
    return false;
  }
  
  return processInput(input);
}

// DON'T:
function validate(input) {
  if (input) {
    if (input.length >= 3) {
      return processInput(input);
    } else {
      return false;
    }
  } else {
    return false;
  }
}
```

---

## 4. Functions

### Function Size

- Keep functions under 50 lines when possible
- If a function exceeds 100 lines, consider breaking it down
- Each function should have a single, clear purpose

### Parameters

```javascript
// Maximum 4 parameters; use options object for more
function createNode(type, value, children, metadata) { ... }  // OK

// For many parameters, use an options object
function createNode({ type, value, children, metadata, sourceMap, annotations }) { ... }

// Use destructuring for options
function process({ input, output = 'default', verbose = false }) { ... }
```

### Return Values

```javascript
// Be consistent with return types
function findNode(name) {
  // Always return same type or null/undefined
  return foundNode || null;  // ✅
  // Don't mix return types
  // return foundNode || false;  // ❌
}

// Document return types with JSDoc
/**
 * @returns {ASTNode|null} The found node or null if not found
 */
function findNode(name) { ... }
```

---

## 5. Error Handling

### Error Messages

All error messages should:
1. Start with a verb or be a complete sentence
2. End with a period
3. Use consistent terminology
4. Be specific and actionable

```javascript
// DO:
generateError(node, 'Token is undefined in the current scope.');
generateError(node, 'Virtual node statement cannot be used outside a function scope.');
generateError(node, 'Return statement must be inside a function scope.');

// DON'T:
generateError(node, 'undefined token');  // ❌ Too vague
generateError(node, 'Virtual node statement cannot be used outside a function scope');  // ❌ Missing period
generateError(node, 'return outside function');  // ❌ Not a sentence
```

### Error Message Format

```javascript
// Use constants for error messages
const ERROR_MESSAGES = {
  UNDEFINED_TOKEN: (name) => `Token "${name}" is undefined in the current scope.`,
  OUTSIDE_FUNCTION_SCOPE: (statement) => `${statement} statement must be inside a function scope.`,
  REDEFINITION: (name) => `Variable "${name}" is already defined in this scope.`
};

// Usage
generateError(node, ERROR_MESSAGES.UNDEFINED_TOKEN(tokenName));
```

### Error Context

Always provide context:
```javascript
// Include what, where, and why
throw new Error(
  `Cannot assign ${actualType} to ${expectedType} at line ${lineNumber}. ` +
  `Expected type ${expectedType} but got ${actualType}.`
);
```

---

## 6. Comments and Documentation

### JSDoc Comments

Use JSDoc for all public functions, classes, and modules:

```javascript
/**
 * Generates JavaScript code from an AST node
 * @param {ASTNode} node - The AST node to process
 * @param {Stream} stream - The token stream
 * @param {string} source - The original source code
 * @param {string} [filename] - Optional filename for source maps
 * @returns {Object} Generated code with metadata
 * @returns {string} returns.code - The generated JavaScript code
 * @returns {boolean} returns.success - Whether generation succeeded
 * @returns {Array<Error>} returns.errors - Any errors encountered
 */
function generateCode(node, stream, source, filename) {
  // ...
}
```

### Inline Comments

```javascript
// DO: Explain WHY, not WHAT
// Calculate based on fibonacci sequence to optimize memory usage
const size = prev + current;

// DON'T: Repeat what code does
// Assign x to 5
const x = 5;
```

### Comment Style

```javascript
// Single-line comments with space after slashes
// This is a comment

// Multi-line comments for complex explanations
/**
 * This is a longer explanation that requires
 * multiple lines to fully describe the logic
 */

// TODO comments with owner and date
// TODO(username, 2026-02-13): Refactor this function to use Map instead of object
```

### Documentation Coverage

**Required JSDoc for:**
- All exported functions
- All class methods (public and protected)
- Complex internal functions
- Modules (at file level)

**Optional JSDoc for:**
- Simple, self-explanatory private methods
- Obvious getter/setter functions
- Local helper functions with clear names

---

## 7. Testing

### Test File Naming

```text
source-file.js       →  source-file.test.js
ComponentName.blop   →  ComponentName.test.blop
```

### Test Structure

```javascript
describe('FunctionName', () => {
  describe('when condition', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = createTestInput();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Test Naming

```javascript
// DO: Use descriptive test names
it('should throw error when token is undefined', () => { ... });
it('should generate source map when filename is provided', () => { ... });

// DON'T: Use vague test names
it('works', () => { ... });
it('test 1', () => { ... });
```

---

## 8. File Organization

### File Structure

```javascript
// 1. Imports
const path = require('path');
const { utility } = require('./utils');

// 2. Constants
const MAX_DEPTH = 100;
const SCOPE_TYPES = { ... };

// 3. Private helper functions
function privateHelper() { ... }

// 4. Classes
class MyClass { ... }

// 5. Public functions
function publicFunction() { ... }

// 6. Exports
module.exports = {
  publicFunction,
  MyClass
};
```

### Import Organization

```javascript
// Group imports by type with blank lines between groups

// 1. Node.js built-in modules
const path = require('path');
const fs = require('fs');

// 2. External dependencies
const chalk = require('chalk');
const sourceMap = require('source-map');

// 3. Internal modules
const utils = require('./utils');
const { grammar } = require('./grammar');
const { SCOPE_TYPES } = require('./constants');
```

### File Size

- Keep files under 500 lines when possible
- If a file exceeds 1000 lines, consider splitting it
- Group related functionality into modules

### Module Boundaries

Each module should have a clear, single responsibility:

```text
backend/
  ├── index.js              # Main entry point
  ├── scope-manager.js      # Scope tracking logic
  ├── code-generator.js     # Code generation
  ├── validator.js          # Validation rules
  └── import-resolver.js    # Import resolution
```

---

## ESLint Configuration

The project uses ESLint with the following key rules:

```javascript
{
  "rules": {
    "indent": ["error", 2],
    "linebreak-style": ["error", "unix"],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-unused-vars": ["warn"],
    "arrow-body-style": ["error", "as-needed"],
    "prefer-const": ["error"],
    "no-var": ["error"]
  }
}
```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add support for async/await syntax
fix: correct scope tracking in nested functions
docs: update API documentation for code generator
refactor: extract error messages to constants file
test: add tests for virtual node generation
chore: update dependencies
```

---

## Quick Checklist

Before submitting code, verify:

- [ ] Variable names are descriptive (no abbreviations)
- [ ] Functions are under 100 lines
- [ ] All public functions have JSDoc comments
- [ ] Error messages are clear and end with periods
- [ ] No commented-out code (unless documented why)
- [ ] Tests pass
- [ ] ESLint passes with no warnings
- [ ] Constants are used instead of magic strings
- [ ] Early returns reduce nesting
- [ ] Code is DRY (Don't Repeat Yourself)

---

## Resources

- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

---

**Questions or suggestions?** Open an issue or submit a PR to improve this guide.
