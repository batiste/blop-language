// Browser stub for Node.js 'path' module with basic functionality
export function join(...args) {
  return args.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function dirname(p) {
  const parts = p.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

export function basename(p, ext) {
  const base = p.split('/').pop() || '';
  if (ext && base.endsWith(ext)) {
    return base.slice(0, -ext.length);
  }
  return base;
}

export function resolve(...args) {
  return join(...args);
}

export function parse(p) {
  const base = basename(p);
  const ext = base.includes('.') ? '.' + base.split('.').pop() : '';
  const name = ext ? base.slice(0, -ext.length) : base;
  return { base, name, ext, dir: dirname(p) };
}

export default {
  join,
  dirname,
  basename,
  resolve,
  parse
};
