const path = require('path');

function createImportGenerators(context) {
  const { generateCode, validators, dependencies } = context;
  const { registerName, resolveImport } = validators;

  function destructuringValues(node, exportKeys) {
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
      output.push(...destructuringValues(node.named.more, exportKeys));
    }
    return output;
  }

  return {
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
          dependencies.push(fileNode.value);
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
        output.push(...destructuringValues(node.named.dest_values, importedKeys));
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
        resolveImport(importedFilename, fileNode, importedKeys, context.resolve);
      }
      return output;
    },
    'destructuring_values': destructuringValues,
    'as': () => [':'],
    'object_destructuring': (node) => {
      const output = [];
      output.push('let ');
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
  };
}

module.exports = {
  createImportGenerators,
};
