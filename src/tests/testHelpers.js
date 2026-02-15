const { compileSource } = require('../compile');

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
 * Test that code compiles successfully
 */
function expectCompiles(source, filename = 'test.blop') {
  const code = dedent(source);
  try {
    compileSource(code, 'node', filename, false, false, true); // Enable inference
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
    compileSource(code, 'node', filename, false, false, true); // Enable inference
    throw new Error('Expected compilation to fail but it succeeded');
  } catch (error) {
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

module.exports = {
  expectCompiles,
  expectCompilationError,
};
