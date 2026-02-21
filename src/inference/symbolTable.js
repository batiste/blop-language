// ============================================================================
// Symbol Table - Phase 1: Binding (collecting all definitions)
// ============================================================================

import { getAnnotationType, parseGenericParams, parseTypeExpression } from './typeSystem.js';
import { AnyType, FunctionType, ObjectType } from './Type.js';

/**
 * Symbol table for storing all bindings in the first pass
 * Separates binding concerns from type inference and checking
 */
class SymbolTable {
  constructor() {
    this.typeAliases = {};
    this.globalFunctions = {};
    this.globalVariables = {};
    this.globalClasses = {}; // className → { source, type: ObjectType, node }
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
   * Add a class definition to the symbol table
   * @param {string} name - Class name
   * @param {Object} info - { type: ObjectType, node }
   */
  addClass(name, info) {
    this.globalClasses[name] = {
      source: 'class_def',
      ...info,
    };
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

  /**
   * Get all class definitions (kept separate from getAllSymbols to avoid
   * polluting the inference scope with a 'classes' key that would shadow
   * any user variable named 'classes').
   */
  getClasses() {
    return this.globalClasses;
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

        case 'class_def':
          this.handleClassDef(node);
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

      // Extract parameter types and names
      const paramTypes = [];
      const paramNames = [];
      let paramNode = node.named?.params;
      while (paramNode) {
        if (paramNode.named?.annotation) {
          const annotation = getAnnotationType(paramNode.named.annotation);
          paramTypes.push(annotation ?? AnyType);
        } else {
          paramTypes.push(AnyType);
        }
        paramNames.push(paramNode.named?.name?.value || `p${paramNames.length}`);
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
        paramNames: paramNames,
        genericParams: genericParams.length > 0 ? genericParams : undefined,
        node,
      });

      // Pre-collect annotated local variables inside this function body
      if (node.named?.body) {
        this.collectFunctionLocals(functionName, node.named.body);
      }
    },

    /**
     * Handle class definition - build ObjectType for the class instance
     */
    handleClassDef(node) {
      const className = node.named?.name?.value;
      if (!className) return;

      const members = new Map();

      for (const stat of node.named?.stats ?? []) {
        // class_func_def: a method
        const methodNode =
          stat.children?.find(c => c.type === 'class_func_def') ??
          (stat.type === 'class_func_def' ? stat : null);
        if (methodNode) {
          const methodName = methodNode.named?.name?.value;
          if (methodName) {
            // Build param types from annotations (no stampTypeAnnotation needed here)
            const params = [];
            const paramNames = [];
            function collectParams(n) {
              if (!n) return;
              if (n.type === 'func_def') return;
              if (n.type === 'func_def_params') {
                const t = n.named?.annotation ? (getAnnotationType(n.named.annotation) ?? AnyType) : AnyType;
                params.push(t);
                paramNames.push(n.named?.name?.value ?? '_');
              }
              if (n.children) n.children.forEach(collectParams);
            }
            if (methodNode.named?.params) collectParams(methodNode.named.params);
            const returnType = methodNode.named?.annotation
              ? (getAnnotationType(methodNode.named.annotation) ?? AnyType)
              : AnyType;
            const genericParams = methodNode.named?.generic_params
              ? parseGenericParams(methodNode.named.generic_params)
              : [];
            members.set(methodName, {
              type: new FunctionType(params, returnType, genericParams, paramNames),
              optional: false,
            });
          }
        }

        // class_member_def: a typed property
        const memberNode =
          stat.children?.find(c => c.type === 'class_member_def') ??
          (stat.type === 'class_member_def' ? stat : null);
        if (memberNode) {
          const memberName = memberNode.named?.name?.value;
          const annotation = memberNode.named?.annotation;
          if (memberName && annotation) {
            const memberType = getAnnotationType(annotation);
            if (memberType) {
              members.set(memberName, { type: memberType, optional: false });
            }
          }
        }
      }

      const classType = new ObjectType(members, className);
      classType.isClassInstance = true;
      symbolTable.addClass(className, { type: classType, node });
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
