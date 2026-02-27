import sourceMap from 'source-map';
import { SCOPE_TYPES } from '../constants.js';
import { ScopesStack } from './scopes.js';
import { createValidators } from './validators.js';
import { createBackendHandlers } from './generators/index.js';

function _backend(node, _stream, _input, _filename = false, rootSource, resolve = false, env = 'webpack', config = {}) {
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
  const typeAliases = {}; // Track type aliases for export
  const hasBlopImports = { value: false }; // Track if file has .blop imports
  const genericTypeParams = []; // Stack of generic type parameter scopes
  const dependencies = [];
  const imports = [];

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
    imports,
    typeAliases,
    hasBlopImports,
    genericTypeParams,
    uid,
    resolve,
    env, // Track environment for import/export generation
    generateCode: null, // Will be set after creation
    backendCompiler: _backend, // Reference to main compiler for recursive calls
  };

  // Create validators
  const validators = createValidators(context);
  context.validators = validators;

  // Main code generation function
  const _generateCode = function gen(node) {
    const output = [];
    if (backend[node.type]) {
      output.push(...backend[node.type](node));
    } else if (backend[node.type]) {
      output.push(...backend[node.type](node));
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
      if (node.line_start !== undefined) {
        const sn = new sourceMap.SourceNode(
          node.line_start + 1,
          node.column_start,
          _filename,
          output,
        );
        return [sn];
      }
      return output;
    };
  }

  let generateCode;
  if (_filename) {
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
      
      // Generate imports at the top in ESM format
      imports.forEach(imp => {
        if (imp.type === 'default') {
          final.push(`import * as ${imp.as} from '${imp.path}';\n`);
        } else if (imp.type === 'destructured') {
          if (imp.names.length === 0) return; // all names were type-only
          const specifiers = imp.names.map(n => 
            n.source !== n.local ? `${n.source} as ${n.local}` : n.source
          ).join(', ');
          final.push(`import { ${specifiers} } from '${imp.path}';\n`);
        } else if (imp.type === 'named') {
          final.push(`import { ${imp.names.join(', ')} } from '${imp.path}';\n`);
        }
      });
      
      const hoistKeys = Object.keys(scope.names).filter(key => scope.names[key].hoist !== false);
      if (hoistKeys.length > 0) {
        final.push(`let ${hoistKeys.join(', ')};\n`);
      }
      final.push(...module);
      
      // Generate exports in ESM format
      // NOTE: Types are tracked in exportObjects but not exported at runtime (yet)
      // When types become first-class citizens, remove the isType filter
      const runtimeExportKeys = exportKeys.filter(key => !scope.names[key].isType);
      if (runtimeExportKeys.length > 0) {
        final.push('\nexport { ');
        final.push(runtimeExportKeys.join(', '));
        final.push(' };\n');
      }
      return final;
    },
  };

  const output = generateCode(node);
  let code, map;
  if (_filename) {
    const rootSN = new sourceMap.SourceNode(null, null, _filename, output);
    const sm = rootSN.toStringWithSourceMap({ file: _filename });
    code = sm.code;
    sm.map.setSourceContent(_filename, input);
    map = sm.map.toJSON();
  } else {
    code = output.join('');
    map = null;
  }
  return {
    code,
    map,
    success: errors.length === 0,
    perfect: errors.length === 0 && warnings.length === 0,
    dependencies,
    exportKeys,
    exportObjects,
    typeAliases,
    warnings,
    errors,
  };
}

export {
  _backend as generateCode,
};
