import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import parser from '../parser.js';
import { tokensDefinition } from '../tokensDefinition.js';
import { getGlobalNames, builtinContextuals } from '../inference/builtinTypes.js';
import { ERROR_MESSAGES, SCOPE_TYPES, SCOPE_DEPTH } from '../constants.js';
import { streamContext } from '../errorMessages.js';

function createValidators(context) {
  const { scopes, stream, input, checkFilename, config, keysCache, errors, warnings } = context;
  const configGlobals = config.globals || {};
  const globalNames = getGlobalNames();

  function generateError(node, message, warning = false) {
    const token = stream[node.stream_index];
    const sourceContext = streamContext(input, token, token, stream);
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
        const sourceContext = streamContext(input, token, token, stream);
        const redefineContext = streamContext(input, redefinedBy, redefinedBy, stream);
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
    if (globalNames.has(name) || configGlobals[name]) {
      return;
    }

    // Context-scoped built-ins: only valid in specific scope types
    const contextual = builtinContextuals[name];
    if (contextual) {
      const fnScopes = scopes.filter(SCOPE_TYPES.FUNCTION);
      const insideFunction = fnScopes.length > SCOPE_DEPTH.MIN_FUNCTION_DEPTH;
      if (contextual.context === 'function' && insideFunction) return;
      if (contextual.context === 'class' && fnScopes.some(s => s._isClassMethod)) return;
      generateError(node, ERROR_MESSAGES.INVALID_CONTEXT(name, contextual.context));
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
        if (globalNames.has(name) || configGlobals[name] || name.startsWith('_')) {
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
      // Use backend compiler from context to avoid circular dependency
      const result = context.backendCompiler(tree, tokenStream, source, filename);
      keysCache[filename] = {
        keys: result.exportKeys,
        objects: result.exportObjects,
        typeAliases: result.typeAliases || {}, // Include type definitions
        mtime: stats.mtime,
      };
      return keysCache[filename];
    }
    return { keys: [], objects: {}, typeAliases: {} };
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
      // Create require function for module resolution
      const requireFn = createRequire(checkFilename);
      if (name.startsWith('.')) {
        filename = requireFn.resolve(name, { paths: [path.dirname(checkFilename)] });
      } else {
        filename = requireFn.resolve(name, { paths: [path.dirname(checkFilename)] });
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

export {
  createValidators,
};
