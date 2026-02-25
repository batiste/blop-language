/**
 * Constants for Blop Language Compiler
 * 
 * This module contains all magic strings, error messages, and constant values
 * used throughout the Blop compiler. Centralizing these values improves
 * maintainability and consistency.
 */

/**
 * Scope type identifiers used in scope tracking
 */
const SCOPE_TYPES = {
  FUNCTION: 'fct',
  CONDITIONAL: 'cdt',
  LOOP: 'loop',
  VIRTUAL_NODE: 'vn'
};

/**
 * Minimum scope depths for various scope types
 */
const SCOPE_DEPTH = {
  MIN_FUNCTION_DEPTH: 1,
  MIN_LOOP_DEPTH: 1,
  MIN_CONDITIONAL_DEPTH: 1
};

/**
 * Error messages for backend validation
 * These messages should be clear, end with periods, and provide actionable information
 */
const ERROR_MESSAGES = {
  // Variable and scope errors
  UNUSED_VARIABLE: (name) => 
    `Unused variable "${name}". Remove or prefix with underscore.`,
  
  UNDEFINED_TOKEN: (name) => 
    `Token "${name}" is undefined in the current scope.`,
  
  REDEFINITION: (name) => 
    `Variable "${name}" is already defined in this scope. Use explicit assignment (:=) or rename.`,
  
  // Import/export errors
  IMPORT_KEY_NOT_EXPORTED: (key, filename) => 
    `Imported key "${key}" is not exported in ${filename}.`,
  
  // Virtual node errors
  VIRTUAL_NODE_OUTSIDE_FUNCTION: () => 
    `Virtual node statement cannot be used outside a function scope.`,
  
  ROOT_VIRTUAL_NODE_IN_LOOP: () => 
    `Root virtual nodes are return statements. The loop will not iterate. ` +
    `Wrap the loop in a virtual node or build an array of virtual nodes.`,
  
  ROOT_VIRTUAL_NODE_ALREADY_DEFINED: () => 
    `A root virtual node is already defined in this function.`,
  
  ROOT_VIRTUAL_NODE_IN_BRANCH: () => 
    `A root virtual node is already defined in this branch.`,
  
  VIRTUAL_NODE_ASSIGNMENT_OUTSIDE: () => 
    `Virtual node assignment must be inside a virtual node.`,
  
  VIRTUAL_NODE_IN_STRING_INTERPOLATION: () =>
    `A virtual node cannot be used inside a string interpolation — it would be stringified to '[object Object]'. ` +
    `Move the virtual node to a separate child on its own line.`,

  UNREACHABLE_CODE_AFTER_VIRTUAL_NODE: () => 
    `Code is unreachable after root virtual node.`,
  
  // Control flow errors
  RETURN_OUTSIDE_FUNCTION: () => 
    `Return statement must be inside a function scope.`,
  
  BREAK_OUTSIDE_LOOP: () => 
    `Break statement must be inside a loop scope.`,
  
  CONTINUE_OUTSIDE_LOOP: () => 
    `Continue statement must be inside a loop scope.`,
  
  // Async/await errors
  AWAIT_OUTSIDE_FUNCTION: () => 
    `Await keyword can only be used inside a function.`,
  
  AWAIT_OUTSIDE_ASYNC: () => 
    `Await keyword can only be used inside an async function.`,
  
  // Type annotation errors
  UNDEFINED_TYPE: (typeName) =>
    `Type "${typeName}" is not defined. Use a built-in type, define it with 'type', or import it.`,
  
  // Source map errors
  SOURCEMAP_WITHOUT_FILENAME: () => 
    `Cannot generate a source map without a filename.`,

  // Context errors
  INVALID_CONTEXT: (name, ctx) =>
    `"${name}" is only available inside a ${ctx} body.`
};

/**
 * Warning messages (non-fatal issues)
 */
const WARNING_MESSAGES = {
  UNUSED_VARIABLE: ERROR_MESSAGES.UNUSED_VARIABLE,
  UNREACHABLE_CODE: ERROR_MESSAGES.UNREACHABLE_CODE_AFTER_VIRTUAL_NODE,
  ROOT_VIRTUAL_NODE_IN_LOOP: ERROR_MESSAGES.ROOT_VIRTUAL_NODE_IN_LOOP
};

/**
 * Reserved keywords and built-in identifiers
 */
const RESERVED = {
  BLOP_MODULE: 'blop',
  REQUIRE: 'require',
  MODULE_EXPORTS: 'module.exports'
};

/**
 * Default configuration values
 */
const DEFAULTS = {
  STRICTNESS_LEVEL: 'perfect',
  ENVIRONMENT: 'webpack',
  SOURCE_MAP_ENABLED: false,
  RESOLVE_IMPORTS: false
};

/**
 * Operator mappings
 */
const OPERATORS = {
  LOOSE_EQUALITY: '==',
  STRICT_EQUALITY: '===',
  LOOSE_INEQUALITY: '!=',
  STRICT_INEQUALITY: '!=='
};

/**
 * Token type identifiers
 */
const TOKEN_TYPES = {
  EOS: 'EOS',
  NEWLINE: 'newline',
  STRING: 'str',
  NUMBER: 'number',
  NAME: 'name',
  BOOLEAN_OPERATOR: 'boolean_operator',
  MATH_OPERATOR: 'math_operator'
};

/**
 * AST node type identifiers
 */
const NODE_TYPES = {
  START: 'START',
  GLOBAL_STATEMENT: 'GLOBAL_STATEMENT',
  SCOPED_STATEMENT: 'SCOPED_STATEMENT',
  VIRTUAL_NODE: 'virtual_node',
  VIRTUAL_NODE_EXP: 'virtual_node_exp',
  FUNCTION_DEF: 'func_def',
  CLASS_DEF: 'class_def',
  FOR_LOOP: 'for_loop',
  WHILE_LOOP: 'while_loop',
  CONDITION: 'condition',
  ASSIGN: 'assign',
  IMPORT_STATEMENT: 'import_statement'
};

/**
 * Annotation type identifiers for type inference
 */
const ANNOTATION_TYPES = {
  INT: 'int',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ANY: 'any',
  FUNCTION: 'function',
  OBJECT: 'object'
};

/**
 * Built-in type names that are always available
 * These don't need to be imported or defined
 */
const BUILTIN_TYPES = new Set([
  // Primitive types
  'string',
  'number',
  'boolean',
  'null',
  'undefined',
  'void',
  'any',
  'never',
  
  // Special types
  'object',
  'array',
  'function',
  'VNode',
  'Component',
  
  // Legacy/alias types
  'int',
]);

/**
 * File and path constants
 */
const PATHS = {
  RUNTIME_MODULE: './runtime.js',
  CONFIG_FILE: 'blop.config.js'
};

/**
 * Regular expressions for code analysis
 */
const PATTERNS = {
  CLASS_DEFINITION: /^\s*class\s+/,
  UPPERCASE_START: /^[A-Z]/,
  INVISIBLE_CHARS: {
    CARRIAGE_RETURN: /\r/g,
    NEWLINE: /\n/g,
    TAB: /\t/g,
    NBSP: '\xa0',
    SPACE: / /g
  }
};

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  RESET: '\x1B[0m'
};

/**
 * The name of the runtime namespace variable injected into every compiled file.
 * Must match the identifier used by the Vite plugin and the backend code generators.
 */
const RUNTIME_NAMESPACE = 'blop';

/**
 * Performance and limits
 */
const LIMITS = {
  MAX_CACHE_SIZE: 10000,
  MAX_DEPTH: 100
};

export {
  SCOPE_TYPES,
  SCOPE_DEPTH,
  ERROR_MESSAGES,
  RUNTIME_NAMESPACE,
  WARNING_MESSAGES,
  RESERVED,
  DEFAULTS,
  OPERATORS,
  TOKEN_TYPES,
  NODE_TYPES,
  ANNOTATION_TYPES,
  BUILTIN_TYPES,
  PATHS,
  PATTERNS,
  COLORS,
  LIMITS
};
