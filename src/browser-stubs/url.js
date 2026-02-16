// Browser stub for Node.js 'url' module
export function fileURLToPath(url) {
  if (typeof url === 'string') {
    return url.replace(/^file:\/\//, '');
  }
  return url;
}

export function pathToFileURL(path) {
  return 'file://' + path;
}

export default {
  fileURLToPath,
  pathToFileURL
};
