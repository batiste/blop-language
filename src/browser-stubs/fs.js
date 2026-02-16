// Browser stub for Node.js 'fs' module
export function existsSync() { return false; }
export function readFileSync() { return ''; }
export function writeFileSync() {}
export function statSync() { return { isDirectory: () => false }; }

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync
};
