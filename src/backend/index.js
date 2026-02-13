const sourceMap = require('source-map');
const utils = require('../utils');
const { SCOPE_TYPES } = require('../constants');
const { ScopesStack } = require('./scopes');
const { createValidators } = require('./validators');
const { createBackendHandlers } = require('./generators');

function _backend(node, _stream, _input, _filename = false, rootSource, resolve = false) {
  let uid_i = 0;
  if (!_stream) {
    throw _stream;
  }
  const stream = _stream;
  const input = _input;
  const errors = [];
  const warnings = [];
  const checkFilename = _filename;

  const scopes = new ScopesStack();
  scopes.add(SCOPE_TYPES.VIRTUAL_NODE);
  scopes.add(SCOPE_TYPES.CONDITIONAL);
  scopes.add(SCOPE_TYPES.LOOP);
  scopes.add(SCOPE_TYPES.FUNCTION);

  const exportObjects = {};
  let exportKeys = [];
  const dependencies = [];

  const config = utils.getConfig(_filename);
  const keysCache = {};

  const uid = () => {
    uid_i++;
    return `__${uid_i}`;
  };

  // Create context object for all modules
  const context = {
    scopes,
    stream,
    input,
    checkFilename,
    config,
    keysCache,
    errors,
    warnings,
    dependencies,
    uid,
    resolve,
    generateCode: null, // Will be set after creation
  };

  // Create validators
  const validators = createValidators(context);
  context.validators = validators;

  // Main code generation function
  const _generateCode = function gen(node) {
    const output = [];
    if (backend[node.type]) {
      output.push(...backend[node.type](node));
    } else if (backend[node.rule_name]) {
      output.push(...backend[node.rule_name](node));
    } else {
      if (node.value) {
        output.push(node.value);
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          output.push(...generateCode(node.children[i]));
        }
      }
    }
    return output;
  };

  function sourceMapDecorator(func) {
    return function dec(node) {
      const output = func(node);
      if (node.lineStart !== undefined) {
        rootSource.add(new sourceMap.SourceNode(
          node.lineStart || 1,
          node.columnStart + 1,
          _filename,
          output.join(''),
        ));
      }
      return output;
    };
  }

  let generateCode;
  if (rootSource) {
    generateCode = sourceMapDecorator(_generateCode);
  } else {
    generateCode = _generateCode;
  }

  // Set generateCode in context
  context.generateCode = generateCode;

  // Create backend handlers
  const backendHandlers = createBackendHandlers(context);

  // Add START handler which needs special handling
  const backend = {
    ...backendHandlers,
    'START': (node) => {
      const final = [];
      const module = [];
      node.children.forEach(stats => module.push(...generateCode(stats)));
      const scope = scopes.type(SCOPE_TYPES.FUNCTION);
      exportKeys = Object.keys(scope.names).filter(key => scope.names[key].export !== false);
      exportKeys.reduce((acc, key) => {
        acc[key] = scope.names[key];
        return acc;
      }, exportObjects);
      const hoistKeys = Object.keys(scope.names).filter(key => scope.names[key].hoist !== false);
      if (hoistKeys.length > 0) {
        final.push(`let ${hoistKeys.join(', ')};\n`);
      }
      final.push(module.join(''));
      final.push('\nmodule.exports = { ');
      final.push(exportKeys.join(', '));
      final.push(' };\n');
      return final;
    },
  };

  const output = generateCode(node);
  return {
    code: output.join(''),
    success: errors.length === 0,
    perfect: errors.length === 0 && warnings.length === 0,
    dependencies,
    exportKeys,
    exportObjects,
    warnings,
    errors,
  };
}

module.exports = {
  generateCode: _backend,
};
