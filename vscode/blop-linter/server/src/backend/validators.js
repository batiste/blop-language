const path = require('path');
const fs = require('fs');
const parser = require('../parser');
const { tokensDefinition } = require('../tokensDefinition');
const utils = require('../utils');
const { all } = require('../builtin');
const { ERROR_MESSAGES } = require('../constants');

function createValidators(context) {
  const { scopes, stream, input, checkFilename, config, keysCache, errors, warnings } = context;
  const configGlobals = config.globals || {};

  function generateError(node, message, warning = false) {
    const token = stream[node.stream_index];
    const sourceContext = utils.streamContext(input, token, token, stream);
    const error = new Error(`${message}
    ${sourceContext}
`);
    error.token = token;
    if (warning) {
      warnings.push(error);
    } else {
      errors.push(error);
    }
  }

  function registerName(name, node, options = {}) {
    checkRedefinition(name, node, !!options.explicit_assign);
    let token;
    if (!options.token) {
      token = node;
    }
    const scope = scopes.currentBlock();
    scope.names[name] = { node, token, hoist: !!options.hoist };
  }

  function checkRedefinition(name, node, explicit_assign = false) {
    if (explicit_assign) return;
    scopes.blocks().reverse().forEach((scope) => {
      const upperScopeNode = scope.names[name];
      if (upperScopeNode) {
        const { token } = upperScopeNode;
        const redefinedBy = stream[node.stream_index];
        const sourceContext = utils.streamContext(input, token, token, stream);
        const redefineContext = utils.streamContext(input, redefinedBy, redefinedBy, stream);
        const error = new Error(`Redefinition of ${name} within this scope. Use explicit := or rename ${name}
        ${sourceContext}

        Redefined by
        ${redefineContext}
        `);
        error.related = token;
        error.token = redefinedBy;
        errors.push(error);
      }
    });
  }

  function shouldBeDefined(name, node) {
    if (all[name] || configGlobals[name]) {
      return;
    }
    let defined = false;
    scopes.blocks().reverse().forEach((scope) => {
      if (scope.names[name]) {
        scope.names[name].used = true;
        defined = true;
      }
    });
    if (!defined) {
      generateError(node, ERROR_MESSAGES.UNDEFINED_TOKEN(name));
    }
  }

  function popScopeBlock(type) {
    const scope = scopes.pop(type);
    if (scope) {
      const { names } = scope;
      Object.keys(names).forEach((name) => {
        if (all[name] || configGlobals[name] || name.startsWith('_')) {
          return;
        }
        if (names[name].node && names[name].used !== true) {
          generateError(names[name].node, ERROR_MESSAGES.UNUSED_VARIABLE(name), true);
        }
      });
    }
  }

  function getExports(filename) {
    const stats = fs.statSync(filename);
    if (keysCache[filename] && keysCache[filename].mtime.getTime() === stats.mtime.getTime()) {
      return keysCache[filename];
    }
    const source = fs.readFileSync(filename).toString('utf8');
    const tokenStream = parser.tokenize(tokensDefinition, source);
    const tree = parser.parse(tokenStream);
    if (tree.success) {
      // Import backend dynamically to avoid circular dependency
      const backend = require('./index');
      const result = backend.generateCode(tree, tokenStream, source, filename);
      keysCache[filename] = {
        keys: result.exportKeys,
        objects: result.exportObjects,
        mtime: stats.mtime,
      };
      return keysCache[filename];
    }
    return [];
  }

  function checkImportKeys(filename, importedKeys) {
    const exports = getExports(filename);
    for (let i = 0; i < importedKeys.length; i++) {
      const { key, node } = importedKeys[i];
      if (!exports.objects[key]) {
        generateError(node, ERROR_MESSAGES.IMPORT_KEY_NOT_EXPORTED(key, filename));
      }
    }
  }

  function resolveImport(name, node, importedKeys, resolve) {
    if (!checkFilename || resolve !== true) {
      return;
    }
    let filename;
    try {
      if (name.startsWith('.')) {
        filename = require.resolve(name, { paths: [path.dirname(checkFilename)] });
      } else {
        filename = require.resolve(name, { paths: [path.dirname(checkFilename)] });
      }
      if (filename.endsWith('.blop')) {
        checkImportKeys(filename, importedKeys);
      }
    } catch (error) {
      generateError(node, error);
    }
  }

  return {
    generateError,
    registerName,
    checkRedefinition,
    shouldBeDefined,
    popScopeBlock,
    getExports,
    checkImportKeys,
    resolveImport,
  };
}

module.exports = {
  createValidators,
};
