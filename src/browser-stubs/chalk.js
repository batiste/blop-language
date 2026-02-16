// Browser stub for 'chalk' module
// Just returns the text without colors
const identity = (text) => String(text);

const chalk = new Proxy({}, {
  get() {
    return identity;
  }
});

export default chalk;
