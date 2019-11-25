const path = require('path');
const fs = require('fs');
const sourceMap = require('source-map');
const utils = require('./utils');
const { all } = require('./builtin');
const parser = require('./parser');
const { tokensDefinition } = require('./tokensDefinition');

const config = utils.getConfig();
const configGlobals = config.globals || {};

const keysCache = {};

function getExports(filename) {
  const stats = fs.statSync(filename);
  if (keysCache[filename] && keysCache[filename].mtime.getTime() === stats.mtime.getTime()) {
    return keysCache[filename];
  }
  const source = fs.readFileSync(filename).toString('utf8');
  const stream = parser.tokenize(tokensDefinition, source);
  const tree = parser.parse(stream);
  if (tree.success) {
    const result = _backend(tree, stream, source, filename);
    keysCache[filename] = {
      keys: result.exportKeys,
      objects: result.exportObjects,
      mtime: stats.mtime,
    };
    return keysCache[filename];
  }
  return [];
}

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
  const namespacesVN = [{}]; // namespace for virtual nodes
  const namespacesFCT = [{}]; // namespace for functions
  const namespacesCDT = [{}]; // namespace for conditions
  const namespacesLOOP = [{}];
  const exportObjects = {};
  let exportKeys = [];

  const currentNameSpaceVN = () => namespacesVN[namespacesVN.length - 1];
  const addNameSpaceVN = () => namespacesVN.push({}) && currentNameSpaceVN();
  const popNameSpaceVN = () => namespacesVN.pop();

  const currentNameSpaceFCT = () => namespacesFCT[namespacesFCT.length - 1];
  const addNameSpaceFCT = () => namespacesFCT.push({}) && currentNameSpaceFCT();
  const popNameSpaceFCT = () => {
    const ns = namespacesFCT.pop();
    if (ns) {
      Object.keys(ns).forEach((name) => {
        if (all[name] || configGlobals[name] || name.startsWith('_')) {
          return;
        }
        if (ns[name].node && ns[name].used !== true) {
          generateError(ns[name].node, `Unused variable ${name}, remove or add underscore`, true);
        }
      });
    }
  };

  const currentNamespacesCDT = () => namespacesCDT[namespacesCDT.length - 1];
  const addNameSpaceCDT = () => namespacesCDT.push({}) && currentNamespacesCDT();
  const popNameSpaceCDT = () => namespacesCDT.pop();

  const currentNamespacesLOOP = () => namespacesLOOP[namespacesLOOP.length - 1];
  const addNameSpaceLOOP = () => namespacesLOOP.push({}) && currentNamespacesLOOP();
  const popNameSpaceLOOP = () => namespacesLOOP.pop();

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
    const ns = currentNameSpaceFCT();
    ns[name] = { node, token, hoist: !!options.hoist };
  }

  function checkRedefinition(name, node, explicit_assign = false) {
    if (explicit_assign) return;
    namespacesFCT.slice().reverse().forEach((ns) => {
      const upperScopeNode = ns[name];
      if (upperScopeNode) {
        const { token } = upperScopeNode;
        const redefinedBy = stream[node.stream_index];
        const sourceContext = utils.streamContext(input, token, token, stream);
        const redefineContext = utils.streamContext(input, redefinedBy, redefinedBy, stream);
        const error = new Error(`Redefinition of ${name} from upper scope. Use explicit := or rename ${name}
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

  function checkImportKeys(filename, importedKeys) {
    const exports = getExports(filename);
    for (let i = 0; i < importedKeys.length; i++) {
      const { key, node } = importedKeys[i];
      if (!exports.objects[key]) {
        generateError(node, `Imported key ${key} is not exported in ${filename}`);
      }
    }
  }

  function resolveImport(name, node, importedKeys) {
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

  function shouldBeDefined(name, node) {
    if (all[name] || configGlobals[name]) {
      return;
    }
    let defined = false;
    namespacesFCT.slice().reverse().forEach((ns) => {
      if (ns[name]) {
        ns[name].used = true;
        defined = true;
      }
    });
    if (!defined) {
      generateError(node, `Token ${name} is undefined in the current scope`);
    }
  }

  function registerVirtualNode(node) {
    const currentFctNS = currentNameSpaceFCT();
    const currentCdtNS = currentNamespacesCDT();
    const currentLoopNS = currentNamespacesLOOP();
    const parent = currentNameSpaceVN().currentVNode;
    const { opening, closing } = node.named;
    if (node.type === 'virtual_node_exp') {
      return;
    }
    if (closing) {
      opening.len = closing.start - opening.start + closing.len;
    }
    if (namespacesFCT.length <= 1) {
      generateError(opening, 'Virtual node statement cannot be used outside a function scope.');
    }

    if (!parent && currentLoopNS.functionNS === currentFctNS) {
      generateError(opening, 'Root virtual node are return satements. The loop will not iterate. Wrap the loop in a virtual node or build an array of virtual node', true);
    }

    if (!parent) {
      if (currentFctNS._returnVirtualNode) {
        generateError(opening, 'A root virtual node is already defined in this function');
      } else if (namespacesCDT.length > 1) {
        let isRedefined = false;
        namespacesCDT.slice().reverse().forEach((ns) => {
          if (ns._returnVirtualNode) {
            isRedefined = true;
          }
        });
        if (isRedefined) {
          generateError(opening, 'A root virtual node is already defined in this branch.');
        } else {
          currentCdtNS._returnVirtualNode = { node, hoist: false, used: true };
        }
      } else {
        currentFctNS._returnVirtualNode = { node, hoist: false, used: true };
      }
    }
  }

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

  const uid = () => {
    uid_i++;
    return `__${uid_i}`;
  };

  const backend = {
    'newline': () => ['\n'],
    'def': () => ['function '],
    'str': (node) => {
      const str = node.value.slice(1, -1);
      const lines = str.split('\n');
      if (lines.length > 1) {
        return [`\`${str}\``];
      }
      return [`'${str}'`];
    },
    'str_expression': (node) => {
      const output = ['`', node.named.str.value.slice(1, -1)];
      output.push(...generateCode(node.named.str_exp));
      return output;
    },
    'inner_str_expression': (node) => {
      const output = ['${'];
      output.push(...generateCode(node.named.exp));
      output.push('}');
      output.push(node.named.str.value.slice(1, -1));
      if (node.named.str_exp) {
        output.push(...generateCode(node.named.str_exp));
      } else {
        output.push('`');
      }
      return output;
    },
    'EOS': () => [],
    'START': (node) => {
      const final = [];
      const module = [];
      node.children.forEach(stats => module.push(...generateCode(stats)));
      const ns = currentNameSpaceFCT();
      exportKeys = Object.keys(ns).filter(key => ns[key].export !== false);
      exportKeys.reduce((acc, key) => {
        acc[key] = ns[key];
        return acc;
      }, exportObjects);
      const hoistKeys = Object.keys(ns).filter(key => ns[key].hoist !== false);
      if (hoistKeys.length > 0) {
        final.push(`let ${hoistKeys.join(', ')};\n`);
      }
      final.push(module.join(''));
      final.push('\nmodule.exports = { ');
      final.push(exportKeys.join(', '));
      final.push(' };\n');
      return final;
    },
    'SCOPED_STATEMENT': (node) => {
      const output = [];
      const currentFctNS = currentNameSpaceFCT();
      const alreadyVnode = !!currentFctNS._returnVirtualNode;
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      const parent = currentNameSpaceVN().currentVNode;
      // small improvement but this doesn't account for normal returns
      // or conditions
      if (!parent && currentFctNS._returnVirtualNode && alreadyVnode) {
        generateError(node, 'Code is unreachable after root virtual node', true);
      }
      return output;
    },
    'annotation': () => [],
    'assign': (node) => {
      const output = [];
      const ns = currentNameSpaceFCT();
      if (node.named.name) {
        if (!node.named.explicit_assign) {
          checkRedefinition(node.named.name.value, node, node.named.explicit_assign);
          ns[node.named.name.value] = { node, token: node.named.name };
        }
        output.push(...generateCode(node.named.name));
      } else if (node.named.path) {
        const name = node.named.path.value;
        shouldBeDefined(name, node.named.path);
        output.push(...generateCode(node.named.path));
        output.push(...generateCode(node.named.access));
      } else {
        output.push(...generateCode(node.named.destructuring));
      }
      output.push(' = ');
      output.push(...generateCode(node.named.exp));
      output.push(';');
      return output;
    },
    'exp_statement': (node) => {
      const output = [];
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      output.push(';');
      return output;
    },
    'object_destructuring': (node) => {
      const output = [];
      output.push('let ');
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'destructuring_values': (node, exportKeys) => {
      const output = [];
      let name;
      if (exportKeys) {
        exportKeys.push({
          key: node.named.name.value, node: node.named.name,
          rename: node.named.rename,
        });
      }
      if (node.named.rename) {
        name = node.named.rename.value;
        registerName(name, node.named.rename);
        output.push(`${node.named.name.value}: ${name}`);
      } else {
        name = node.named.name.value;
        registerName(name, node.named.name);
        output.push(...generateCode(node.named.name));
      }
      if (node.named.more) {
        output.push(', ');
        output.push(...backend.destructuring_values(
          node.named.more, exportKeys,
        ));
      }
      return output;
    },
    'as': () => [':'],
    'object_literal': (node) => {
      const output = [];
      output.push('(');
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      output.push(')');
      return output;
    },
    'object_literal_body': (node) => {
      const output = [];
      if (node.named.key) {
        const name = node.named.key.children[0].value;
        shouldBeDefined(name, node.named.key.children[0]);
      }
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'object_literal_key': (node) => {
      const child = node.children[0];
      if (child.type === 'str') {
        return [`'${child.value.slice(1, -1)}'`];
      }
      return [child.value];
    },
    'import_statement': (node) => {
      const output = [];
      let module;
      const fileNode = node.named.file || node.named.module;
      let importedFilename;
      const importedKeys = [];
      if (fileNode) {
        if (fileNode.value.slice(1, -1) === 'blop') {
          module = 'blop';
        } else {
          module = `require(${fileNode.value})`;
          importedFilename = fileNode.value.slice(1, -1);
        }
      }
      if (node.named.module) {
        // import 'module' as name
        const name = node.named.name.value;
        registerName(name, node.named.name);
        output.push(`let ${name} = ${module};`);
      } else if (node.named.dest_values) {
        // import { destructuring } from 'filename'
        output.push('let { ');
        output.push(...backend.destructuring_values(node.named.dest_values, importedKeys));
        output.push(` } = ${module};`);
      } else if (node.named.name) {
        // import name from 'file'
        const name = node.named.name.value;
        registerName(name, node.named.name);
        importedKeys.push({ key: name, node: node.named.name });
        output.push(`let ${name} = ${module}.${name};`);
      } else {
        // import 'file'
        const { file } = node.named;
        const { name } = path.parse(path.basename(file.value.slice(1, -1)));
        registerName(name, file);
        output.push(`let ${name} = ${module};`);
      }
      if (importedFilename) {
        resolveImport(importedFilename, fileNode, importedKeys);
      }
      return output;
    },
    'virtual_node': (node) => {
      const output = []; let
        renderGuard = null;

      registerVirtualNode(node);

      const parent = currentNameSpaceVN().currentVNode;
      const _uid = uid();
      output.push(`const ${_uid}c = []; const ${_uid}a = {};`);
      addNameSpaceVN().currentVNode = _uid;
      node.named.attrs ? node.named.attrs.forEach(
        attr => output.push(...generateCode(attr)),
      ) : null;

      // optimization with snabbdom to not render children
      if (node.named.attrs) {
        node.named.attrs.forEach((attr) => {
          if (attr.named.name.value === 'needRender') {
            output.push('if (');
            renderGuard = attr.named.exp ? generateCode(attr.named.exp) : [attr.named.name.value];
            output.push(renderGuard);
            output.push(' !== false) {');
          }
        });
      }
      node.named.stats ? node.named.stats.forEach(
        stat => output.push(...generateCode(stat)),
      ) : null;
      if (node.named.exp) {
        const a_uid = uid();
        output.push(` const ${a_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; Array.isArray(${a_uid}) ? ${_uid}c.push(...${a_uid}) : ${_uid}c.push(${a_uid});`);
      }
      if (renderGuard) {
        output.push('}');
      }
      popNameSpaceVN();
      const start = node.named.opening.value;
      if (/^[A-Z]/.test(start)) {
        shouldBeDefined(start, node.named.opening);
        output.push(` const ${_uid} = blop.c(${start}, ${_uid}a, ${_uid}c, '${_uid}');`);
      } else {
        output.push(` const ${_uid} = blop.h('${start}', ${_uid}a, ${_uid}c);`);
      }
      if (parent && node.type !== 'virtual_node_exp') {
        output.push(` ${parent}c.push(${_uid});`);
      } else {
        output.push(` return ${_uid};`);
      }
      return output;
    },
    'virtual_node_exp': (node) => {
      const output = [];
      output.push('(() => {');
      output.push(...backend.virtual_node(node));
      output.push('})()');
      return output;
    },
    'virtual_node_assign': (node) => {
      const output = [];
      const parent = currentNameSpaceVN().currentVNode;
      const cn = currentNameSpaceFCT();
      const a_uid = uid();
      cn[a_uid] = node;
      output.push(`${a_uid} = `);
      output.push(...generateCode(node.named.exp));
      if (!parent) {
        generateError(node, 'Virtual node assignment have to be in a virtual node');
      }
      output.push(`; Array.isArray(${a_uid}) ? ${parent}c.push(...${a_uid}) : ${parent}c.push(${a_uid}); `);
      return output;
    },
    'virtual_node_attributes': (node) => {
      const output = [];
      const _uid = currentNameSpaceVN().currentVNode;
      output.push(` ${_uid}a['${node.named.name.value}'] = `);
      if (node.named.exp) {
        output.push(...generateCode(node.named.exp));
      } else {
        shouldBeDefined(node.named.name.value, node.named.name);
        output.push(node.named.name.value);
      }
      output.push(';');
      return output;
    },
    'for_loop': (node) => {
      const ns = currentNameSpaceFCT();
      const lns = addNameSpaceLOOP();
      lns.functionNS = ns;
      const output = [];
      const key = (node.named.key && node.named.key.value) || `_i${uid()}`;
      const { value } = node.named.value;
      checkRedefinition(key, node.named.key);
      checkRedefinition(node.named.value.value, node.named.value);
      ns[key] = {
        node: node.named.key, hoist: false, export: false, token: node.named.key,
      };
      ns[value] = {
        node: node.named.value,
        export: false, hoist: false, token: node.named.value,
      };

      // generate a different type of loop using annotation
      const isArray = (node.named.keyannotation
        && node.named.keyannotation.children[2].value === 'int')
        || (node.named.objectannotation
          && node.named.objectannotation.children[2].value === 'array');
      // an proper array is expected
      if (isArray) {
        const f_uid = uid();
        output.push(`let ${f_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; let ${key}=0; for(; ${key} < ${f_uid}.length; ${key}++) { let ${value} = ${f_uid}[${key}];`);
        node.named.stats ? node.named.stats.forEach(
          stat => output.push(...generateCode(stat)),
        ) : null;
        output.push('};');
      // any other objects
      } else {
        const f_uid = uid();
        const k_uid = uid();
        const i_uid = uid();
        output.push(`let ${f_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; let ${k_uid} = Object.keys(${f_uid}); let ${key}; `);
        output.push(`for(let ${i_uid}=0; ${i_uid} < ${k_uid}.length; ${i_uid}++) { ${key} = ${k_uid}[${i_uid}]; let ${value} = ${f_uid}[${key}];`);
        node.named.stats ? node.named.stats.forEach(
          stat => output.push(...generateCode(stat)),
        ) : null;
        output.push('};');
      }
      popNameSpaceLOOP();
      return output;
    },
    'condition': (node) => {
      const output = [];
      addNameSpaceCDT();
      output.push(`${node.named.type.value}(`);
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      popNameSpaceCDT();
      output.push(...generateCode(node.named.elseif));
      return output;
    },
    'name_exp': (node) => {
      const output = [];
      shouldBeDefined(node.named.name.value, node);
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'named_func_call': (node) => {
      const output = [];
      shouldBeDefined(node.named.name.value, node);
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'exp': (node) => {
      const output = [];
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          output.push(...generateCode(node.children[i]));
        }
      }
      return output;
    },
    'conditionelseif': (node) => {
      const output = [];
      if (!node.named.type) {
        return output;
      }
      if (node.named.type.type === 'else') {
        output.push(' else {');
        addNameSpaceCDT();
        node.named.stats.forEach((stat) => {
          output.push(...generateCode(stat));
        });
        output.push('}');
        popNameSpaceCDT();
        return output;
      }
      output.push(' else if (');
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      addNameSpaceCDT();
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      popNameSpaceCDT();
      output.push(...generateCode(node.named.elseif));
      return output;
    },
    'while_loop': (node) => {
      const ns = currentNameSpaceFCT();
      const lns = addNameSpaceLOOP();
      lns.functionNS = ns;
      const output = [];
      output.push('while(');
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      popNameSpaceLOOP();
      return output;
    },
    'func_def': (node) => {
      const output = [];
      const parentns = currentNameSpaceFCT();
      const ns = addNameSpaceFCT();
      if (node.named['async']) {
        output.push('async ');
      }
      ns._currentFunction = node;

      function namedFct() {
        checkRedefinition(node.named.name.value, node.named.name);
        parentns[node.named.name.value] = {
          node,
          hoist: false,
          token: node.named.name,
          used: true,
        };
        output.push(...generateCode(node.named.name));
      }

      if (node.named['fat-arrow']) {
        if (node.named.name) {
          namedFct();
        }
        output.push('(');
        if (node.named.params) {
          output.push(...generateCode(node.named.params));
        }
        output.push(') =>');
        output.push(...generateCode(node.named.body));
      } else {
        if (!node.named.name) {
          output.push('(');
        }
        output.push('function ');
        if (node.named.name) {
          namedFct();
        }
        output.push('(');
        if (node.named.params) {
          output.push(...generateCode(node.named.params));
        }
        output.push(')');
        output.push(...generateCode(node.named.body));
        if (!node.named.name) {
          output.push(')');
        }
      }
      popNameSpaceFCT();
      return output;
    },
    'class_def': (node) => {
      const output = [];
      const ns = currentNameSpaceFCT();
      ns[node.named.name.value] = { node, hoist: false, token: node.named.name };
      output.push('class ');
      output.push(node.named.name.value);
      if (node.named.extends) {
        output.push(` extends ${node.named.extends.value}`);
      }
      output.push(' {');
      if (node.named.stats) {
        node.named.stats.forEach(stat => output.push(...generateCode(stat)));
      }
      output.push(' }');
      return output;
    },
    'class_func_def': (node) => {
      const output = [];
      const ns = addNameSpaceFCT();
      ns[node.named.name.value] = {
        node, hoist: false, token: node.named.name, used: true,
      };
      ns._currentFunction = node;
      if (node.named['async']) {
        output.push('async ');
      }
      output.push(`${node.named.name.value}`);
      output.push('(');
      if (node.named.params) {
        output.push(...generateCode(node.named.params));
      }
      output.push(')');
      output.push(...generateCode(node.named.body));
      output.push('\n');
      popNameSpaceFCT();
      return output;
    },
    'func_def_params': (node) => {
      const ns = currentNameSpaceFCT();
      registerName(node.named.name.value, node.named.name);
      ns[node.named.name.value] = {
        node,
        hoist: false,
        token: node.named.name,
        annotation: node.named.annotation,
      };
      const output = [];
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'func_body': (node) => {
      const output = [];
      output.push(...backend.func_body_fat(node));
      return output;
    },
    'func_body_fat': (node) => {
      const ns = currentNameSpaceFCT();
      let output = [];
      if (node.named.exp) {
        output = generateCode(node.named.exp);
      } else {
        output.push(' {');
        const body = [];
        // states can be empty
        if (node.named.stats) {
          node.named.stats.forEach(stat => body.push(...generateCode(stat)));
          // hoisting
          const keys = Object.keys(ns).filter(key => ns[key].hoist !== false);
          if (keys.length > 0) {
            output.push(`let ${keys.join(', ')};`);
          }
          output.push(...body);
        }
        output.push('}');
      }
      return output;
    },
    'try_catch': (node) => {
      const output = [];
      output.push(...generateCode(node.named.try));
      node.named.statstry.forEach(stat => output.push(...generateCode(stat)));
      output.push(...generateCode(node.named.catch));
      const ns = currentNameSpaceFCT();
      ns[node.named.name.value] = { node: node.named.name, hoist: false, token: node.named.name };
      output.push(...generateCode(node.named.name));
      output.push(') {');
      node.named.statscatch.forEach(stat => output.push(...generateCode(stat)));
      output.push('}');
      return output;
    },
    'boolean_operator': (node) => {
      if (node.value === '==') {
        return ['==='];
      }
      if (node.value === '!=') {
        return ['!=='];
      }
      return [node.value];
    },
    'if_expression': (node) => {
      addNameSpaceFCT();
      const output = [];
      output.push('(() => { ');
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      output.push('})()');
      popNameSpaceFCT();
      return output;
    },
    'return': (node) => {
      if (namespacesFCT.length <= 1) {
        generateError(node, 'return statement outside of a function scope');
      }
      return ['return '];
    },
    'break': (node) => {
      if (namespacesLOOP.length <= 1) {
        generateError(node, 'break statement outside of a loop scope');
      }
      return ['break'];
    },
    'await': (node) => {
      const ns = currentNameSpaceFCT();
      if (!ns._currentFunction) {
        generateError(node, 'await only accepted inside a function');
      } else if (ns._currentFunction.named['async'] === undefined) {
        generateError(node, 'await only accepted inside an async function');
      }
      return ['await '];
    },
    'continue': (node) => {
      if (namespacesLOOP.length <= 1) {
        generateError(node, 'continue statement outside of a loop scope');
      }
      return ['continue'];
    },
    'try': () => ['try {'],
    'catch': () => ['} catch('],
  };

  const output = generateCode(node);
  return {
    code: output.join(''),
    success: errors.length === 0,
    perfect: errors.length === 0 && warnings.length === 0,
    exportKeys,
    exportObjects,
    warnings,
    errors,
  };
}

module.exports = {
  generateCode: _backend,
};
