import path from 'path';

function createImportGenerators(context) {
  const { generateCode, validators, dependencies, imports } = context;
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
      const fileNode = node.named.file || node.named.module;
      let importedFilename;
      const importedKeys = [];
      let modulePath;
      let isBlop = false;
      
      if (fileNode) {
        const rawPath = fileNode.value.slice(1, -1);
        if (rawPath === 'blop') {
          modulePath = 'blop';
          isBlop = true;
        } else {
          dependencies.push(fileNode.value);
          modulePath = rawPath;
          importedFilename = rawPath;
        }
      }
      
      // Special handling for 'blop' runtime imports
      // These should not generate import statements, but variable declarations
      // accessing the runtime object already imported at the top
      if (isBlop) {
        const output = [];
        if (node.named.module) {
          // import 'blop' as name
          const name = node.named.name.value;
          registerName(name, node.named.name);
          output.push(`let ${name} = blop;`);
        } else if (node.named.dest_values) {
          // import { x, y } from 'blop'
          output.push('let { ');
          const names = collectDestructuredNames(node.named.dest_values, importedKeys, registerName);
          output.push(names.map(n => n.source !== n.local ? `${n.source}: ${n.local}` : n.source).join(', '));
          output.push(' } = blop;');
        } else if (node.named.name) {
          // import name from 'blop'
          const name = node.named.name.value;
          registerName(name, node.named.name);
          output.push(`let ${name} = blop.${name};`);
        }
        return output;
      }
      
      // Regular imports - collect for ESM import generation
      const importInfo = {
        path: modulePath,
        type: null,
        names: [],
        as: null
      };
      
      if (node.named.module) {
        // import 'module' as name
        const name = node.named.name.value;
        registerName(name, node.named.name);
        importInfo.type = 'default';
        importInfo.as = name;
      } else if (node.named.dest_values) {
        // import { x, y } from 'filename'
        importInfo.type = 'destructured';
        importInfo.names = collectDestructuredNames(node.named.dest_values, importedKeys, registerName);
      } else if (node.named.name) {
        // import name from 'file'
        const name = node.named.name.value;
        registerName(name, node.named.name);
        importedKeys.push({ key: name, node: node.named.name });
        importInfo.type = 'named';
        importInfo.names = [name];
      } else {
        // import 'file'
        const { file } = node.named;
        const { name } = path.parse(path.basename(file.value.slice(1, -1)));
        registerName(name, file);
        importInfo.type = 'default';
        importInfo.as = name;
      }
      
      imports.push(importInfo);
      
      if (importedFilename) {
        resolveImport(importedFilename, fileNode, importedKeys, context.resolve);
      }
      
      // Return empty output - imports will be generated at the top of the file
      return [];
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

function collectDestructuredNames(node, exportKeys, registerName) {
  const names = [];
  if (exportKeys) {
    exportKeys.push({
      key: node.named.name.value,
      node: node.named.name,
      rename: node.named.rename,
    });
  }
  
  let sourceName = node.named.name.value;
  let localName = sourceName;
  
  if (node.named.rename) {
    localName = node.named.rename.value;
    registerName(localName, node.named.rename);
  } else {
    registerName(localName, node.named.name);
  }
  
  names.push({ source: sourceName, local: localName });
  
  if (node.named.more) {
    names.push(...collectDestructuredNames(node.named.more, exportKeys, registerName));
  }
  
  return names;
}

export {
  createImportGenerators,
};
