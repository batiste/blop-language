import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { PATHS } from './constants.js';


function printTree(node, sp) {
  if (node.type) {
    console.log(`${sp}r ${node.type}(${node.sub_rule_index})`);
  } else {
    console.log(`${sp}t ${node.type} ${node.value}`);
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      printTree(node.children[i], `${sp}  `);
    }
  }
}

function lookUp(dir, name) {
  const up = [];
  let currentDir = dir;
  while (fs.existsSync(currentDir) && currentDir.length > 1) {
    const filename = path.join(dir, ...up, name);
    if (fs.existsSync(filename)) {
      return filename;
    }
    up.push('..');
    currentDir = path.join(dir, ...up);
  }
}

/**
 * Asynchronously load blop.config.js by walking up from the given filename's
 * directory. Uses dynamic import() so ESM config files work correctly.
 * Returns {} when no config file is found or loading fails.
 *
 * @param {string} filename - absolute path to a .blop file (used as start dir)
 * @returns {Promise<object>}
 */
async function loadConfig(filename) {
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    return {};
  }
  if (!filename) {
    return {};
  }
  try {
    const dirname = path.dirname(filename) || process.cwd();
    const configPath = lookUp(dirname, PATHS.CONFIG_FILE);
    if (!configPath) {
      return {};
    }
    const { default: config } = await import(pathToFileURL(configPath).href);
    return config ?? {};
  } catch {
    return {};
  }
}

export {
  loadConfig,
  lookUp,
  printTree,
};

export default {
  loadConfig,
  lookUp,
  printTree,
};
