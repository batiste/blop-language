import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
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

function getConfig(filename) {
  // In browser environments, config files aren't supported
  // Check early to avoid any Node.js module operations
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    return {};
  }
  
  if (!filename) {
    return {};
  }
  
  try {
    const dirname = path.dirname(filename) || process.cwd();
    const config = lookUp(dirname, PATHS.CONFIG_FILE);
    if (!config) {
      return {};
    }
    
    // Use createRequire to dynamically load the config file
    const requireFn = createRequire(import.meta.url);
    return requireFn(config);
  } catch (e) {
    // If require fails (browser or other error), return empty config
    return {};
  }
}

export {
  getConfig,
  lookUp,
  printTree,
};

export default {
  getConfig,
  lookUp,
  printTree,
};
