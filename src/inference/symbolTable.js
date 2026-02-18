// ============================================================================
// Symbol Table - Phase 1: Binding (collecting all definitions)
// ============================================================================

import { getAnnotationType, parseGenericParams, parseTypeExpression } from './typeSystem.js';
import { AnyType } from './Type.js';

/**
 * Symbol table for storing all bindings in the first pass
 * Separates binding concerns from type inference and checking
 */
class SymbolTable {
  constructor() {
    this.typeAliases = {};
    this.globalFunctions = {};
    this.globalVariables = {};
    this.functionLocals = new Map(); // funcName → { varName → { type, node } }
  }

  /**
   * Add a type alias to the symbol table
   * @param {string} name - Alias name
   * @param {string} type - Type expression
   * @param {Array} genericParams - Generic parameters if any
   */
  addTypeAlias(name, type, genericParams = []) {
    if (genericParams.length > 0) {
      this.typeAliases[name] = { type, genericParams };
    } else {
      this.typeAliases[name] = type;
    }
  }

  /**
   * Add a function definition to the symbol table
   * @param {string} name - Function name
   * @param {Object} info - Function info { type, params, genericParams, node }
   */
  addFunction(name, info) {
    this.globalFunctions[name] = {
      source: 'func_def',
      ...info,
    };
  }

  /**
   * Add a variable definition to the symbol table
   * @param {string} name - Variable name
   * @param {Object} info - Variable info { type, node }
   */
  addVariable(name, info) {
    this.globalVariables[name] = info;
  }

  /**
   * Add a local variable (annotated) inside a function body to the symbol table
   * @param {string} funcName - The enclosing function name
   * @param {string} varName - Variable name
   * @param {Object} info - Variable info { type, node }
   */
  addFunctionLocal(funcName, varName, info) {
    if (!this.functionLocals.has(funcName)) {
      this.functionLocals.set(funcName, {});
    }
    this.functionLocals.get(funcName)[varName] = info;
  }

  /**
   * Get all symbols for use in type checking phase
   */
  getAllSymbols() {
    return {
      typeAliases: this.typeAliases,
      functions: this.globalFunctions,
      variables: this.globalVariables,
      functionLocals: this.functionLocals,
    };
  }
}

/**
 * Create binding pass handlers for first pass over AST
 * These handlers only collect definitions without any type checking
 */
function createBindingHandlers() {
  let symbolTable;

  function initBinding(table) {
    symbolTable = table;
  }

  return {
    initBinding,
    getSymbolTable: () => symbolTable,

    /**
     * Traverse all children to find definitions
     */
    traverseChildren(node) {
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          this.visitNode(node.children[i]);
        }
      }
    },

    /**
     * Visit a node - dispatch to appropriate handler
     */
    visitNode(node) {
      if (!node) return;

      switch (node.type) {
        case 'GLOBAL_STATEMENT':
        case 'SCOPED_STATEMENTS':
        case 'compilation_unit':
          this.traverseChildren(node);
          break;

        case 'type_alias':
          this.handleTypeAlias(node);
          break;

        case 'func_def':
          this.handleFunctionDef(node);
          break;

        case 'SCOPED_STATEMENT':
          // Only collect function definitions in scoped statements at top level
          // Variable assignments will be handled by type inference phase
          this.traverseChildren(node);
          break;

        default:
          this.traverseChildren(node);
      }
    },

    /**
     * Handle type alias definition
     */
    handleTypeAlias(node) {
      const aliasName = node.named?.name?.value;
      if (!aliasName) return;

      const aliasType = parseTypeExpression(node.named.type);
      const genericParams = node.named.generic_params
        ? parseGenericParams(node.named.generic_params)
        : [];

      symbolTable.addTypeAlias(aliasName, aliasType, genericParams);
    },

    /**
     * Handle function definition
     */
    handleFunctionDef(node) {
      const functionName = node.named?.name?.value;
      if (!functionName) return;

      // Extract parameter types
      const paramTypes = [];
      let paramNode = node.named?.params;
      while (paramNode) {
        if (paramNode.named?.annotation) {
          const annotation = getAnnotationType(paramNode.named.annotation);
          paramTypes.push(annotation ?? AnyType);
        } else {
          paramTypes.push(AnyType);
        }
        paramNode = paramNode.named?.more;
      }

      // Extract return type annotation if present
      const returnTypeAnnotation = node.named?.annotation
        ? getAnnotationType(node.named.annotation)
        : null;

      // Extract generic parameters
      const genericParams = node.named?.generic_params
        ? parseGenericParams(node.named.generic_params)
        : [];

      symbolTable.addFunction(functionName, {
        type: returnTypeAnnotation ?? AnyType, // Will be refined by inference phase
        params: paramTypes,
        genericParams: genericParams.length > 0 ? genericParams : undefined,
        node,
      });

      // Pre-collect annotated local variables inside this function body
      if (node.named?.body) {
        this.collectFunctionLocals(functionName, node.named.body);
      }
    },

    /**
     * Recursively collect type-annotated local variable declarations inside a
     * function body. Stops at nested func_def boundaries so inner-function
     * locals are not folded into the outer function's map.
     *
     * Only annotated locals (`x: Type = …`) are collected; unannotated ones
     * require RHS evaluation and are skipped (handled by Phase 2 as before).
     */
    collectFunctionLocals(funcName, node) {
      if (!node) return;

      if (node.type === 'assign' && node.named?.annotation && node.named?.name?.value) {
        const type = getAnnotationType(node.named.annotation);
        symbolTable.addFunctionLocal(funcName, node.named.name.value, {
          type: type ?? AnyType,
          node,
        });
      }

      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          // Don't descend into nested function definitions
          if (child.type !== 'func_def') {
            this.collectFunctionLocals(funcName, child);
          }
        }
      }

      // Also traverse named children (not just the children array)
      if (node.named) {
        for (const key of Object.keys(node.named)) {
          const child = node.named[key];
          if (child && typeof child === 'object' && child.type && child.type !== 'func_def') {
            this.collectFunctionLocals(funcName, child);
          }
        }
      }
    },
  };
}

/**
 * Run binding phase on AST
 * Returns symbol table with all collected definitions
 */
function runBindingPhase(node) {
  const symbolTable = new SymbolTable();
  const handlers = createBindingHandlers();
  handlers.initBinding(symbolTable);
  handlers.visitNode(node);
  return handlers.getSymbolTable();
}

export {
  SymbolTable,
  createBindingHandlers,
  runBindingPhase,
};
