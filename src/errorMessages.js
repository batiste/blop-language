/**
 * Error Message Enhancement System
 * 
 * Transforms cryptic parser/grammar errors into human-readable messages
 * with helpful suggestions and quick fixes.
 */

const chalk = require('chalk');

/**
 * Grammar rule explanations - maps technical rule names to user-friendly descriptions
 */
const RULE_EXPLANATIONS = {
  'START': 'at the start of the program',
  'GLOBAL_STATEMENT': 'a top-level statement (function, class, import, assignment, or expression)',
  'GLOBAL_STATEMENTS': 'top-level statements',
  'SCOPED_STATEMENT': 'a statement inside a function or block',
  'SCOPED_STATEMENTS': 'statements inside a function or block',
  'assign': 'a variable assignment',
  'assign_op': 'an assignment operator (+=, -=, etc.)',
  'exp_statement': 'an expression',
  'exp': 'an expression',
  'func_def': 'a function definition',
  'func_call': 'a function call',
  'func_def_params': 'function parameters',
  'func_call_params': 'function arguments',
  'for_loop': 'a for loop',
  'while_loop': 'a while loop',
  'condition': 'an if statement',
  'virtual_node': 'a virtual DOM node',
  'class_def': 'a class definition',
  'import_statement': 'an import statement',
  'try_catch': 'a try-catch block',
  'object_destructuring': 'object destructuring',
  'annotation': 'a type annotation',
};

/**
 * Token type explanations - makes token types more understandable
 */
const TOKEN_EXPLANATIONS = {
  'newline': 'a line break',
  'w': 'whitespace',
  'W': 'required whitespace',
  'ws': 'whitespace',
  'name': 'an identifier',
  'number': 'a number',
  'string': 'a string',
  'EOS': 'the end of the file',
  'def': 'the `def` keyword',
  'if': 'the `if` keyword',
  'for': 'the `for` keyword',
  'while': 'the `while` keyword',
  'return': 'the `return` keyword',
  'class': 'the `class` keyword',
  'import': 'the `import` keyword',
  'fat_arrow': 'an arrow function `=>`',
  'lbracket': 'an opening bracket `[`',
  'rbracket': 'a closing bracket `]`',
  'lparen': 'an opening parenthesis `(`',
  'rparen': 'a closing parenthesis `)`',
  'lbrace': 'an opening brace `{`',
  'rbrace': 'a closing brace `}`',
  'comma': 'a comma `,`',
  'colon': 'a colon `:`',
  'semicolon': 'a semicolon `;`',
  'dot': 'a dot `.`',
  'explicit_assign': 'the explicit assignment operator `:=`',
};

/**
 * Common error patterns - detects specific issues and provides targeted help
 */
const ERROR_PATTERNS = [
  {
    name: 'missing_function_body',
    detect: (context) => {
      return context.ruleName === 'func_def' && 
             context.token.type === 'newline' &&
             context.precedingTokens.some(t => t.type === 'rparen');
    },
    message: () => 'Missing function body',
    suggestion: () => 'Add a function body after the parameter list:\n' +
      '  def myFunction() {\n' +
      '    // function body here\n' +
      '  }',
  },
  {
    name: 'missing_closing_brace',
    detect: (context) => {
      return context.token.type === 'EOS' && 
             context.precedingTokens.some(t => t.type === 'lbrace');
    },
    message: () => 'Unclosed brace',
    suggestion: () => 'Add a closing brace `}` to match the opening brace',
  },
  {
    name: 'missing_closing_paren',
    detect: (context) => {
      return context.expectedToken === 'rparen' || 
             (context.token.type === 'newline' && 
              context.precedingTokens.some(t => t.type === 'lparen'));
    },
    message: () => 'Unclosed parenthesis',
    suggestion: () => 'Add a closing parenthesis `)` to match the opening parenthesis',
  },
  {
    name: 'missing_closing_bracket',
    detect: (context) => {
      return context.expectedToken === 'rbracket';
    },
    message: () => 'Unclosed bracket',
    suggestion: () => 'Add a closing bracket `]` to match the opening bracket',
  },
  {
    name: 'invalid_assignment',
    detect: (context) => {
      return context.ruleName === 'assign' && 
             context.token.type !== '=' && 
             context.token.type !== 'explicit_assign';
    },
    message: (context) => `Invalid assignment syntax with token '${context.token.value}'`,
    suggestion: () => 'Use `=` for initial assignment or `:=` for explicit reassignment:\n' +
      '  myVar = 10       // initial assignment\n' +
      '  myVar := 20      // explicit reassignment',
  },
  {
    name: 'missing_import_from',
    detect: (context) => {
      return context.ruleName === 'import_statement' && 
             context.expectedToken === 'from';
    },
    message: () => 'Missing `from` keyword in import statement',
    suggestion: () => 'Import syntax:\n' +
      '  import { name } from \'./file.blop\'\n' +
      '  import \'./styles.css\' as styles',
  },
  {
    name: 'missing_for_in',
    detect: (context) => {
      return context.ruleName === 'for_loop' && 
             context.expectedToken === 'in';
    },
    message: () => 'Missing `in` keyword in for loop',
    suggestion: () => 'For loop syntax:\n' +
      '  for item in items { ... }\n' +
      '  for index, item in items { ... }',
  },
  {
    name: 'virtual_node_unclosed',
    detect: (context) => {
      return context.ruleName === 'virtual_node' && 
             (context.expectedToken === 'gt' || context.expectedToken === 'close_tag');
    },
    message: () => 'Unclosed virtual DOM tag',
    suggestion: () => 'Make sure to close your tags:\n' +
      '  <div>content</div>\n' +
      '  <img />',
  },
  {
    name: 'jsx_confusion',
    detect: (context) => {
      return context.token.value === 'className' || 
             context.token.value === 'htmlFor';
    },
    message: () => 'JSX syntax detected',
    suggestion: () => 'Blop uses standard HTML attributes:\n' +
      '  Use `class` instead of `className`\n' +
      '  Use `for` instead of `htmlFor`',
  },
  {
    name: 'arrow_function_syntax',
    detect: (context) => {
      return context.ruleName === 'func_def' && 
             context.expectedToken === 'fat_arrow' &&
             context.token.type !== 'fat_arrow';
    },
    message: () => 'Invalid arrow function syntax',
    suggestion: () => 'Arrow function syntax:\n' +
      '  (x, y) => x + y\n' +
      '  (x) => { return x * 2 }',
  },
  {
    name: 'missing_comma_in_params',
    detect: (context) => {
      return (context.ruleName === 'func_def_params' || 
              context.ruleName === 'func_call_params') && 
             context.expectedToken === 'comma';
    },
    message: () => 'Missing comma between parameters',
    suggestion: () => 'Separate parameters with commas:\n' +
      '  def myFunc(a, b, c) { ... }\n' +
      '  myFunc(1, 2, 3)',
  },
  {
    name: 'unexpected_semicolon',
    detect: (context) => {
      return context.token.type === 'semicolon';
    },
    message: () => 'Unexpected semicolon',
    suggestion: () => 'Blop doesn\'t require semicolons. Remove the `;` character.',
  },
  {
    name: 'var_let_const',
    detect: (context) => {
      return context.token.value === 'var' || 
             context.token.value === 'let' || 
             context.token.value === 'const';
    },
    message: (context) => `'${context.token.value}' keyword not needed`,
    suggestion: () => 'Blop doesn\'t use var/let/const. Just assign directly:\n' +
      '  myVar = 10        // instead of: let myVar = 10\n' +
      '  myVar := 20       // explicit reassignment',
  },
  {
    name: 'missing_def_keyword',
    detect: (context) => {
      return context.expectedToken === 'def' && 
             context.token.type === 'name';
    },
    message: () => 'Missing `def` keyword for function definition',
    suggestion: () => 'Use `def` to define functions:\n' +
      '  def myFunction() { ... }',
  },
  {
    name: 'template_string_syntax',
    detect: (context) => {
      return context.token.value && 
             context.token.value.includes('${') &&
             context.token.type === 'string';
    },
    message: () => 'Template string syntax error',
    suggestion: () => 'Blop uses backticks with backtick-variables for interpolation:\n' +
      '  message = `Hello `name``\n' +
      '  result = `The sum is `a + b``',
  },
];

/**
 * Quick fixes that can be suggested programmatically
 */
const QUICK_FIXES = {
  missing_closing_brace: (token) => ({
    description: 'Add closing brace',
    fix: 'Add `}` at the end of the block',
  }),
  missing_closing_paren: (token) => ({
    description: 'Add closing parenthesis',
    fix: 'Add `)` after the expression',
  }),
  missing_closing_bracket: (token) => ({
    description: 'Add closing bracket',
    fix: 'Add `]` after the array expression',
  }),
  unexpected_semicolon: (token) => ({
    description: 'Remove semicolon',
    fix: `Remove the semicolon on line ${token.lineStart + 1}`,
  }),
  jsx_confusion: (token) => ({
    description: 'Convert JSX to Blop syntax',
    fix: token.value === 'className' ? 
      'Change `className` to `class`' : 
      'Change `htmlFor` to `for`',
  }),
};

/**
 * Get preceding tokens for context
 */
function getPrecedingTokens(stream, currentIndex, count = 5) {
  const tokens = [];
  for (let i = Math.max(0, currentIndex - count); i < currentIndex; i++) {
    tokens.push(stream[i]);
  }
  return tokens;
}

/**
 * Analyze error context and detect patterns
 */
function analyzeErrorContext(stream, bestFailure) {
  const token = bestFailure.token;
  const precedingTokens = getPrecedingTokens(stream, token.stream_index);
  
  return {
    token,
    ruleName: bestFailure.rule_name,
    subRuleIndex: bestFailure.sub_rule_index,
    expectedToken: null, // Will be determined from grammar
    precedingTokens,
    stream,
  };
}

/**
 * Detect which error pattern matches the current context
 */
function detectErrorPattern(context) {
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.detect(context)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Generate enhanced error message
 */
function enhanceErrorMessage(stream, tokensDefinition, grammar, bestFailure) {
  const context = analyzeErrorContext(stream, bestFailure);
  const pattern = detectErrorPattern(context);
  
  const token = bestFailure.token;
  const ruleName = bestFailure.rule_name;
  const tokenValue = token.value.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  
  // Build the error message parts
  const parts = {
    title: '',
    description: '',
    suggestion: '',
    quickFix: null,
  };
  
  if (pattern) {
    // Use pattern-specific messages
    parts.title = pattern.message(context);
    parts.suggestion = pattern.suggestion(context);
    parts.quickFix = QUICK_FIXES[pattern.name] ? 
      QUICK_FIXES[pattern.name](token) : null;
  } else {
    // Generate generic but improved message
    const ruleExplanation = RULE_EXPLANATIONS[ruleName] || `in a ${ruleName}`;
    const tokenExplanation = TOKEN_EXPLANATIONS[token.type] || `'${token.type}'`;
    
    parts.title = `Unexpected ${tokenExplanation}`;
    parts.description = `Expected ${ruleExplanation}, but found '${tokenValue}'`;
    
    // Try to provide generic helpful info based on rule name
    if (ruleName.includes('func')) {
      parts.suggestion = 'Check your function syntax. Functions should be defined with:\n' +
        '  def functionName(params) { body }';
    } else if (ruleName.includes('assign')) {
      parts.suggestion = 'Check your assignment syntax:\n' +
        '  variable = value      // initial assignment\n' +
        '  variable := value     // explicit reassignment';
    } else if (ruleName.includes('import')) {
      parts.suggestion = 'Check your import syntax:\n' +
        '  import { name } from \'./file.blop\'';
    } else if (ruleName.includes('loop')) {
      parts.suggestion = 'Check your loop syntax:\n' +
        '  for item in items { ... }\n' +
        '  while condition { ... }';
    }
  }
  
  return parts;
}

/**
 * Format enhanced error message for display
 */
function formatEnhancedError(errorParts, positions) {
  let message = '\n';
  
  // Title (main error)
  message += '  ' + chalk.red.bold('✖ ') + chalk.red.bold(errorParts.title) + '\n';
  
  // Location
  message += '  ' + chalk.dim(`at line ${positions.lineNumber + 1}, column ${positions.charNumber}`) + '\n';
  
  // Description
  if (errorParts.description) {
    message += '\n  ' + errorParts.description + '\n';
  }
  
  // Suggestion
  if (errorParts.suggestion) {
    message += '\n' + chalk.cyan('  💡 Suggestion:\n');
    errorParts.suggestion.split('\n').forEach(line => {
      message += chalk.cyan('  ' + line) + '\n';
    });
  }
  
  // Quick fix
  if (errorParts.quickFix) {
    message += '\n' + chalk.yellow('  ⚡ Quick fix: ') + errorParts.quickFix.fix + '\n';
  }
  
  return message;
}

module.exports = {
  enhanceErrorMessage,
  formatEnhancedError,
  ERROR_PATTERNS,
  RULE_EXPLANATIONS,
  TOKEN_EXPLANATIONS,
};
