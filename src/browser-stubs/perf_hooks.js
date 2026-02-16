// Browser stub for Node.js 'perf_hooks' module
export const performance = {
  now() {
    return typeof window !== 'undefined' && window.performance
      ? window.performance.now()
      : Date.now();
  }
};

export default { performance };
