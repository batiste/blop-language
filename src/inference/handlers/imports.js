// ============================================================================
// Import Handler - Type inference for import statements
// ============================================================================

import fs from 'fs';
import path from 'path';
import { isStdlibImport, resolveStdlibPath } from '../../stdlib.js';
import parser from '../../parser.js';
import { tokensDefinition } from '../../tokensDefinition.js';
import backend from '../../backend.js';
import { runBindingPhase } from '../symbolTable.js';
import { extractImportNameNodes, registerImportedDefinition } from './shared.js';

/**
 * Create the import_statement handler
 */
export function createImportHandler(getState) {
  return {
    import_statement: (node) => {
      const { typeAliases, currentFilename } = getState();
      
      // If we don't have a filename context, we can't resolve imports
      if (!currentFilename) {
        return;
      }
      
      // Extract the file being imported
      const fileNode = node.named.file || node.named.module;
      if (!fileNode) {
        return;
      }
      
      const importPath = fileNode.value.slice(1, -1); // Remove quotes
      
      // Only process .blop file imports (skip node_modules, etc.)
      if (!importPath.startsWith('.') && !isStdlibImport(importPath)) {
        return;
      }
      
      try {
        // Resolve the import path relative to current file
        const resolvedPath = isStdlibImport(importPath)
          ? resolveStdlibPath(importPath)
          : path.resolve(path.dirname(currentFilename), importPath);
        
        // Check if it's a .blop file
        if (!resolvedPath.endsWith('.blop')) {
          return;
        }
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
          return;
        }
        
        // Load and parse the imported file to extract its type definitions
        const importedSource = fs.readFileSync(resolvedPath, 'utf8');
        
        const tokenStream = parser.tokenize(tokensDefinition, importedSource);
        const tree = parser.parse(tokenStream);
        
        if (tree.success) {
          // Generate backend to extract type definitions
          const result = backend.generateCode(tree, tokenStream, importedSource, resolvedPath);
          
          // Run binding phase on imported tree to get function definitions
          const importedSymbolTable = runBindingPhase(tree);
          const importedSymbols = importedSymbolTable.getAllSymbols();
          const importedFunctions = importedSymbols.functions;
          const importedClasses = importedSymbolTable.getClasses();

          if (result.typeAliases) {
            // Check what's being imported
            if (node.named.dest_values) {
              // import { User, Post } from './types.blop'
              // Only import specific types
              const importNameNodes = extractImportNameNodes(node.named.dest_values);
              const { getCurrentScope } = getState();
              const scope = getCurrentScope();
              importNameNodes.forEach(({ name, node: nameNode }) => {
                registerImportedDefinition(name, nameNode, result, importedFunctions, importedClasses, typeAliases, scope);
              });
            } else if (node.named.name && !node.named.module) {
              // import User from './types.blop'
              const name = node.named.name.value;
              const nameNode = node.named.name;
              const { getCurrentScope } = getState();
              const scope = getCurrentScope();
              registerImportedDefinition(name, nameNode, result, importedFunctions, importedClasses, typeAliases, scope);
            } else {
              // import './types.blop' - bare import (no binding name)
              // Type aliases are still merged globally below, making them available
              // in type annotations throughout the file. See bareImport.test.blop for proof.
              //
              // import './types.blop' as types - namespace alias (not yet implemented)
              // Would require supporting qualified names like `types.User` in type annotations.
            }

            // Always merge all type aliases from the imported file into the
            // current file's typeAliases so that signatures of imported
            // functions/classes that reference them (e.g. Route in add(route: Route))
            // can be fully resolved in the consuming file.
            const importedTypeAliases = importedSymbolTable.getAllSymbols().typeAliases;
            for (const [aliasName, aliasValue] of Object.entries(importedTypeAliases)) {
              if (!typeAliases[aliasName]) {
                typeAliases[aliasName] = aliasValue;
              }
            }
          }
        }
      } catch (error) {
        // Silently ignore errors in import resolution for inference
        // The backend will report actual import errors
      }
    },
  };
}
