// Browser stub for 'chalk' module
// Just returns the text without colors
const identity = (text) => String(text);

// need to answer to chalk.red.bold('x') calls
const chalk = new Proxy(() => chalkMock, {
  get: () => chalk,
  apply: (target, thisArg, args) => args[0] // Returns the first argument when called
});

export default chalk;
