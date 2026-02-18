# Statistical Error Prioritization - Integration Guide

## Overview

This document describes how to integrate statistical analysis into meta-parser-generator to provide better error messages based on real-world code patterns.

## Current Implementation (blop-language side)

### 1. Statistics Collection (`src/analyzeTokenStatistics.js`)

Analyzes all `.blop` files in the project and generates `tokenStatistics.json` containing:
- **Position-based probabilities**: For each `rule_name:sub_rule_index:token_index` position, tracks what tokens/rules appear and how often
- **Example**: At position `func_call:0:2`, we might see `)` 90% of the time and `func_call_params` 10% of the time

### 2. Best Failure Selection (`src/selectBestFailure.js`)

After parsing fails, selects the most helpful error from `best_failure_array` by:
- Looking up statistics for each failure position
- Prioritizing failures at positions where tokens have high probability
- Falling back to the default if no statistics exist

### 3. Integration (`src/compile.js` and `vscode/blop-linter/server/src/server.ts`)

Updated to:
```javascript
const { selectBestFailure } = require('./selectBestFailure');

// After parsing fails:
if (!tree.success) {
  const bestFailure = tree.best_failure_array 
    ? selectBestFailure(tree.best_failure_array, tree.best_failure || tree)
    : (tree.best_failure || tree);
  utils.displayError(stream, tokensDefinition, grammar, bestFailure);
}
```

**Note**: Both the CLI compiler and VSCode extension use the same selection logic.

## Required Changes in meta-parser-generator

### Option 1: Minimal Change (Recommended)

Just export the `best_failure_array` in the failure object:

**Current code:**
```javascript
module.exports = {
  parse: (stream) => {
    best_failure = null;
    best_failure_index = 0;
    best_failure_array = [];
    cache = {};
    cacheR = {};
    const result = START(stream, 0);
    if (!result) {
      return best_failure;  // Only returns one failure
    }
    return result;
  },
  tokenize,
};
```

**New code:**
```javascript
module.exports = {
  parse: (stream) => {
    best_failure = null;
    best_failure_index = 0;
    best_failure_array = [];
    cache = {};
    cacheR = {};
    const result = START(stream, 0);
    if (!result) {
      // Return the failure with the full array included
      return {
        ...best_failure,
        best_failure_array,  // Add the array
      };
    }
    return result;
  },
  tokenize,
};
```

### Option 2: Pass Statistics to Generator (Future Enhancement)

Allow passing statistics when generating the parser:

```javascript
generateParser(grammar, tokensDefinition, outputPath, {
  // Optional: embed statistics into generated parser
  tokenStatistics: {
    positionProbabilities: { /* ... */ }
  }
});
```

This would let you embed the statistics directly into the generated parser code, but it's not necessary - the post-processing approach (Option 1) is cleaner and more flexible.

## Workflow

### Initial Setup (once):
```bash
# 1. Generate initial parser
node src/generateParser.js

# 2. Analyze code to generate statistics
node src/analyzeTokenStatistics.js

# 3. Copy files to VSCode extension
npm run linter

# 4. Use statistics automatically from now on (both CLI and VSCode extension)
```

### Development Cycle:
```bash
# When grammar changes:
node src/generateParser.js

# Periodically (or in CI), refresh statistics:
node src/analyzeTokenStatistics.js

# After updating statistics, sync to VSCode extension:
npm run linter
```

### Convenience script:
```bash
./scripts/regenerate-parser-with-stats.sh
```

## Benefits

1. **No parsing overhead**: Statistics are only used AFTER parsing fails
2. **Lazy loading**: Statistics file is only loaded when actually needed
6. **Single source of truth**: Files are copied to VSCode extension via `npm run linter`
3. **Graceful degradation**: Works fine without statistics file
4. **Easy to update**: Re-run analysis anytime to refresh statistics
5. **Separation of concerns**: Parser generation and statistics are independent

## Example Improvements

### Before (without statistics):
```text
Error: Expected '}' at line 10
```

### After (with statistics):
When multiple tokens are possible at a position, the error shows the most common one:
```text
Error: Expected ')' at line 10
```
(because function calls are more common than object literals in your codebase)

## Statistics Format

```json
{
  "positionProbabilities": {
    "func_call:0:0": {
      "(": 1.0
    },
    "func_call:0:1": {
      ")": 0.88,
      "func_call_params": 0.12
    },
    "exp:4:0": {
      "number": 0.53,
      "name": 0.30,
      "str": 0.17
    }
  }
}
```

The key `"rule_name:sub_rule_index:token_index"` matches the failure object structure:
- `failure.rule_name`
- `failure.sub_rule_index`  
- `failure.sub_rule_token_index`
