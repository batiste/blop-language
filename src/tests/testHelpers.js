import { compileSource } from '../compile.js';

/**
 * Remove leading indentation from code string
 */
function dedent(code) {
  const lines = code.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  if (nonEmptyLines.length === 0) return '';
  
  const minIndent = Math.min(
    ...nonEmptyLines.map(line => line.match(/^\s*/)[0].length)
  );
  
  return lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim();
}

/**
 * Test that code compiles successfully,
 * This shouldn't be used, if you expect blop test code to compile,
 * you should just write it in a .blop file in the tests/ folder 
 * and it will be compiled as part of the test suite.
 */
function expectCompiles(source, filename = 'test.blop') {

  const code = dedent(source);
  try {
    const result = compileSource(code, filename, true); // Enable inference
    if (!result.success) {
      const errorMsg = result.errors.length > 0 
        ? result.errors[0].message || 'Compilation failed'
        : 'Compilation failed';
      throw new Error(`Expected code to compile but got error: ${errorMsg}`);
    }
    return true;
  } catch (error) {
    throw new Error(`Expected code to compile but got error: ${error.message}`);
  }
}

/**
 * Test that code fails compilation with expected error message
 */
function expectCompilationError(source, expectedErrorPattern, filename = 'test.blop') {
  const code = dedent(source);
  try {
    const result = compileSource(code, filename, true); // Enable inference
    if (result.success) {
      throw new Error('Expected compilation to fail but it succeeded');
    }
    // Check if error matches expected pattern
    const errorMsg = result.errors.length > 0 
      ? result.errors[0].message || ''
      : '';
    
    if (expectedErrorPattern) {
      if (typeof expectedErrorPattern === 'string') {
        if (!errorMsg.includes(expectedErrorPattern)) {
          throw new Error(
            `Expected error containing "${expectedErrorPattern}" but got: ${errorMsg}`
          );
        }
      } else if (expectedErrorPattern instanceof RegExp) {
        if (!expectedErrorPattern.test(errorMsg)) {
          throw new Error(
            `Expected error matching ${expectedErrorPattern} but got: ${errorMsg}`
          );
        }
      }
    }
    return errorMsg;
  } catch (error) {
    if (error.message.startsWith('Expected error') || error.message === 'Expected compilation to fail but it succeeded') {
      throw error;
    }
    // If we caught a compilation error, check if it matches
    if (expectedErrorPattern) {
      if (typeof expectedErrorPattern === 'string') {
        if (!error.message.includes(expectedErrorPattern)) {
          throw new Error(
            `Expected error containing "${expectedErrorPattern}" but got: ${error.message}`
          );
        }
      } else if (expectedErrorPattern instanceof RegExp) {
        if (!expectedErrorPattern.test(error.message)) {
          throw new Error(
            `Expected error matching ${expectedErrorPattern} but got: ${error.message}`
          );
        }
      }
    }
    return error.message;
  }
}

export {
  expectCompiles,
  expectCompilationError,
};
