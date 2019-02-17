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

function getKeys(filename) {
  const stats = fs.statSync(filename);
  if (keysCache[filename] && keysCache[filename].mtime.getTime() === stats.mtime.getTime()) {
    return keysCache[filename].keys;
  }
  const source = fs.readFileSync(filename).toString('utf8');
  const stream = parser.tokenize(tokensDefinition, source);
  const tree = parser.parse(stream);
  if (tree.success) {
    const result = _backend(tree, stream, source, filename);
    keysCache[filename] = { keys: result.exportKeys, mtime: stats.mtime };
    return keysCache[filename].keys;
  }
  return [];
}

function _backend(node, _stream, _input, _filename = false) {
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
  let exportKeys = [];
  let line = 0;
  const rootSource = new sourceMap.SourceNode(null, null, _filename);


  const currentNameSpaceVN = () => namespacesVN[namespacesVN.length - 1];
  const addNameSpaceVN = () => namespacesVN.push({}) && currentNameSpaceVN();
  const popNameSpaceVN = () => namespacesVN.pop();

  const currentNameSpaceFCT = () => namespacesFCT[namespacesFCT.length - 1];
  const addNameSpaceFCT = () => namespacesFCT.push({}) && currentNameSpaceFCT();
  const popNameSpaceFCT = () => namespacesFCT.pop();

  const currentNamespacesCDT = () => namespacesCDT[namespacesCDT.length - 1];
  const addNameSpaceCDT = () => namespacesCDT.push({}) && currentNamespacesCDT();
  const popNameSpaceCDT = () => namespacesCDT.pop();

  function registerName(name, node, token, hoist = false) {
    checkRedefinition(name, node);
    if (!token) {
      token = node;
    }
    const ns = currentNameSpaceFCT();
    ns[name] = { node, token, hoist };
  }

  function checkRedefinition(name, node, explicit = false) {
    if (explicit) return;
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
    const keys = getKeys(filename);
    for (let i = 0; i < importedKeys.length; i++) {
      const { key, node } = importedKeys[i];
      if (!keys.includes(key)) {
        const error = new Error(`Imported key ${key} is not exported in ${filename}`);
        error.token = node;
        warnings.push(error);
      }
    }
  }

  function resolveImport(name, node, importedKeys) {
    if (!checkFilename) {
      return;
    }
    let filename;
    try {
      if (name.startsWith('.')) {
        filename = require.resolve(name, { paths: [path.dirname(checkFilename)] });
      } else {
        filename = require.resolve(name);
      }
      if (filename.endsWith('.blop')) {
        checkImportKeys(filename, importedKeys);
      }
    } catch (error) {
      const token = stream[node.stream_index];
      error.token = token;
      warnings.push(error);
    }
  }

  function shouldBeDefined(name, node) {
    if (all[name] || configGlobals[name]) {
      return;
    }
    let defined = false;
    namespacesFCT.slice().reverse().forEach((ns) => {
      if (ns[name]) {
        defined = true;
      }
    });
    if (!defined) {
      const token = stream[node.stream_index];
      const sourceContext = utils.streamContext(input, token, token, stream);
      const error = new Error(`Token ${name} is undefined in the current scope
      ${sourceContext}
  `);
      error.token = token;
      errors.push(error);
    }
  }

  function registerVirtualNode(node) {
    const currentFctNS = currentNameSpaceFCT();
    const currentCdtNS = currentNamespacesCDT();
    const parent = currentNameSpaceVN().currentVNode;
    if (node.type !== 'virtual_node_exp' && !parent) {
      if (currentFctNS.returnVirtualNode) {
        const { opening, closing } = node.named;
        opening.len = closing.start - opening.start + closing.len;
        const sourceContext = utils.streamContext(input, opening, opening, stream);
        const error = new Error(`A root virtual node is already defined in this function
        ${sourceContext}
  `);
        error.token = opening;
        warnings.push(error);
      } else if (namespacesCDT.length > 1) {
        let isRedefined = false;
        namespacesCDT.slice().reverse().forEach((ns) => {
          if (ns.returnVirtualNode) {
            isRedefined = true;
          }
        });
        if (isRedefined) {
          const { opening, closing } = node.named;
          opening.len = closing.start - opening.start + closing.len;
          const error = new Error('A root virtual node is already defined in this branch');
          error.token = opening;
          warnings.push(error);
        } else {
          currentCdtNS.returnVirtualNode = { node, hoist: false };
        }
      } else {
        currentFctNS.returnVirtualNode = { node, hoist: false };
      }
    }
  }

  function generateCode(node) {
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
  }

  const uid = () => {
    uid_i++;
    return `__${uid_i}`;
  };

  const backend = {
    'newline': () => {
      // need to be done in comment
      line += 1;
      return ['\n'];
    },
    'def': () => ['function '],
    'str': (node) => {
      const str = node.value.slice(1, -1);
      const lines = str.split('\n');
      line += lines;
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
      exportKeys = Object.keys(ns);
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
    'GLOBAL_STATEMENT': (node) => {
      const output = [];
      node.children.forEach(child => output.push(...generateCode(child)));
      const token = stream[node.stream_index];
      rootSource.add(new sourceMap.SourceNode(
        token.lineStart + 1,
        token.columnStart + 1,
        _filename,
        output.join('')
      ));
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
        shouldBeDefined(name.value, node.named.path);
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
      output.push(';');
      return output;
    },
    'destructuring_values': (node, exportKeys) => {
      const output = [];
      let name;
      if (exportKeys) {
        exportKeys.push({ key: node.named.name.value, node: node.named.name });
      }
      if (node.named.rename) {
        name = node.named.rename.value;
        registerName(name, node.named.rename);
        output.push(`${node.named.name.value}: ${name}`);
      } else {
        name = node.named.name.value;
        registerName(name, node.named.name);
        output.push(name);
      }
      if (node.named.more) {
        output.push(', ');
        output.push(...backend.destructuring_values(node.named.more, exportKeys));
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
        output.push(` const ${_uid} = blop.c(${start}, ${_uid}a, ${_uid}c);`);
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
      const _uid = currentNameSpaceVN().currentVNode;
      const cn = currentNameSpaceFCT();
      const a_uid = uid();
      cn[a_uid] = node;
      output.push(`${a_uid} = `);
      output.push(...generateCode(node.named.exp));
      output.push(`; Array.isArray(${a_uid}) ? ${_uid}c.push(...${a_uid}) : ${_uid}c.push(${a_uid}); `);
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
      const ns = addNameSpaceFCT();
      const output = [];
      const key = (node.named.key && node.named.key.value) || '__index';
      const { value } = node.named.value;
      ns[key] = { node: node.named.key, hoist: false, token: node.named.key };
      ns[value] = { node: node.named.value, hoist: false, token: node.named.value };

      // generate a different type of loop using annotation
      const isArray = (node.named.keyannotation
        && node.named.keyannotation.children[2].value === 'int')
        || (node.named.objectannotation
          && node.named.objectannotation.children[2].value === 'array');
      // an proper array is expected
      if (isArray) {
        output.push(...generateCode(node.named.exp));
        output.push(`.forEach((${value}, ${key}) => { `);
        node.named.stats ? node.named.stats.forEach(
          stat => output.push(...generateCode(stat)),
        ) : null;
        output.push('});');
      // any other objects
      } else {
        const f_uid = uid();
        output.push(`let ${f_uid} = `);
        output.push(...generateCode(node.named.exp));
        output.push(`; Object.keys(${f_uid}).forEach(${key} => {let ${value} = ${f_uid}[${key}]; `);
        node.named.stats ? node.named.stats.forEach(
          stat => output.push(...generateCode(stat)),
        ) : null;
        output.push('});');
      }
      popNameSpaceFCT();
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
      const output = [];
      output.push('while(');
      output.push(...generateCode(node.named.exp));
      output.push(') {');
      node.named.stats.forEach((stat) => {
        output.push(...generateCode(stat));
      });
      output.push('}');
      return output;
    },
    'func_def': (node) => {
      const output = [];
      const parentns = currentNameSpaceFCT();
      addNameSpaceFCT();
      if (node.named['async']) {
        output.push('async ');
      }
      if (node.named['fat-arrow']) {
        if (node.named.name) {
          checkRedefinition(node.named.name.value, node.named.name);
          parentns[node.named.name.value] = {
            node,
            hoist: false,
            token: node.named.name,
          };
          output.push(node.named.name.value);
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
          checkRedefinition(node.named.name.value, node.named.name);
          parentns[node.named.name.value] = {
            node,
            hoist: false,
            token: node.named.name,
          };
          output.push(node.named.name.value);
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
      ns[node.named.name.value] = { node, hoist: false, token: node.named.name };
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
      const output = ['try {'];
      node.named.statstry.forEach(stat => output.push(...generateCode(stat)));
      output.push('} catch(');
      const ns = currentNameSpaceFCT();
      ns[node.named.name.value] = { node: node.named.name, hoist: false, token: node.named.name };
      output.push(...generateCode(node.named.name));
      output.push(') {');
      node.named.statscatch.forEach(stat => output.push(...generateCode(stat)));
      output.push('}');
      return output;
    },
    'comment': node => node.value.replace('#', '//'),
    '==': () => ['==='],
    '!=': () => ['!=='],
  };

  const output = generateCode(node);
  const sourceMapGen = rootSource.toStringWithSourceMap({ file: _filename }).map;
  output.push(`n//# sourceMappingURL=${_filename}.map`)
  return {
    sourceMap: sourceMapGen.toString(),
    code: output.join(''),
    success: errors.length === 0,
    perfect: errors.length === 0 && warnings.length === 0,
    exportKeys,
    warnings,
    errors,
  };
}

module.exports = {
  generateCode: _backend,
};
