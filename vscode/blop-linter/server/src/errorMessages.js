/**
 * Error Message Enhancement System
 * 
 * Transforms cryptic parser/grammar errors into human-readable messages
 * with helpful suggestions and quick fixes.
 */

import chalk from 'chalk';
import { PATTERNS } from './constants.js';

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
  'virtual_node_exp': 'a virtual DOM node expression',
  'virtual_node_assign': 'a virtual DOM node assignment',
  'class_def': 'a class definition',
  'import_statement': 'an import statement',
  'try_catch': 'a try-catch block',
  'object_destructuring': 'object destructuring',
  'object_literal_body': 'an object literal property (key: value)',
  'virtual_node_attributes': 'a virtual DOM element attribute',
  'name_exp': 'an identifier or expression',
  'annotation': 'a type annotation',
};

/**
 * Token type explanations - makes token types more understandable
 */
const TOKEN_EXPLANATIONS = {
  'newline': 'line break',
  'w': 'whitespace',
  'W': 'required whitespace',
  'ws': 'whitespace',
  'name': 'identifier',
  'number': 'number',
  'string': 'string',
  'EOS': 'end of the file',
  'def': '`def` keyword',
  'if': '`if` keyword',
  'for': '`for` keyword',
  'while': '`while` keyword',
  'return': '`return` keyword',
  'class': '`class` keyword',
  'import': '`import` keyword',
  'fat_arrow': 'arrow function `=>`',
  'lbracket': 'opening bracket `[`',
  'rbracket': 'closing bracket `]`',
  'lparen': 'opening parenthesis `(`',
  'rparen': 'closing parenthesis `)`',
  'lbrace': 'opening brace `{`',
  'rbrace': 'closing brace `}`',
  'comma': 'comma `,`',
  'colon': 'colon `:`',
  'semicolon': 'semicolon `;`',
  'dot': 'dot `.`',
  'explicit_assign': 'explicit assignment operator `:=`',
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
             (context.expectedToken === 'in' || context.expectedToken === 'of');
    },
    message: () => 'Missing `in` or `of` keyword in for loop',
    suggestion: () => 'For loop syntax:\n' +
      '  for item in items { ... }\n' +
      '  for index, item of items { ... }',
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
    name: 'missing_whitespace_after_colon',
    detect: (context) => {
      // Detect when we expect whitespace after a colon (common in object literals)
      const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
      return lastToken && 
             lastToken.type === 'colon' && 
             context.token.type === 'name' &&
             (context.ruleName === 'object_literal_body' || 
              (context.ruleName && context.ruleName.includes('object')));
    },
    message: () => 'Missing whitespace after colon',
    suggestion: (context) => {
      const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
      const prevToken = context.precedingTokens[context.precedingTokens.length - 2];
      const key = prevToken ? prevToken.value : 'key';
      const value = context.token.value;
      return `Object literal syntax requires a space after the colon:\n` +
        `  { ${key}: ${value} }     // correct\n` +
        `  { ${key}:${value} }      // missing space (error)`;
    },
  },
  {
    name: 'multiple_spaces_instead_of_single',
    detect: (context) => {
      // Expected single space but got multiple spaces
      return context.expectedToken === 'w' && context.token.type === 'W';
    },
    message: () => 'Multiple spaces where single space expected',
    suggestion: () => 'Use only a single space:\n' +
      '  a = 1     // correct\n' +
      '  a =  1    // too many spaces (error)',
  },
  {
    name: 'missing_required_whitespace',
    detect: (context) => {
      // Generic pattern: grammar explicitly expects a 'w' token (single space) but found something else
      // The token stream is missing a whitespace token that the grammar requires
      if (context.expectedToken !== 'w') {
        return false;
      }
      
      // We expected a whitespace token, but got a different token type
      // Exclude 'W' (multiple spaces) as that has its own pattern above
      return context.token.type !== 'w' && context.token.type !== 'W';
    },
    message: () => 'Missing required whitespace',
    suggestion: (context) => {
      const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
      if (lastToken) {
        const tokenDesc = TOKEN_EXPLANATIONS[lastToken.type] || lastToken.type;
        
        // Provide context-specific examples based on what came before
        if (lastToken.type === '=' && context.ruleName === 'assign') {
          return `Add a space after the equals sign:\n` +
            `  myVar = value     // correct\n` +
            `  myVar =value      // missing space (error)\n` +
            `  response = await fetch()  // correct`;
        } else if (lastToken.type === 'colon') {
          return `Add a space after the colon:\n` +
            `  { key: value }    // correct\n` +
            `  { key:value }     // missing space (error)`;
        } else {
          return `Add a space after ${tokenDesc}`;
        }
      }
      return 'Add a space at this position';
    },
  },
  {
    name: 'unwanted_whitespace_after_equals',
    detect: (context) => {
      // Detect unwanted whitespace after '=' in contexts like HTML attributes
      const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
      return lastToken && 
             lastToken.type === '=' && 
             context.token.type === 'w' &&
             (context.ruleName === 'virtual_node_attributes' || 
              context.ruleName === 'exp' ||
              context.ruleName === 'name_exp');
    },
    message: () => 'Unexpected whitespace after equals sign',
    suggestion: (context) => {
      const prevPrevToken = context.precedingTokens[context.precedingTokens.length - 2];
      const attrName = prevPrevToken ? prevPrevToken.value : 'attribute';
      return `Remove the space after '=' in attribute assignment:\n` +
        `  ${attrName}="value"     // correct\n` +
        `  ${attrName}= "value"    // unwanted space (error)`;
    },
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
  {
    name: 'inline_vnode_multiple_children',
    detect: (context) => {
      // Two possible failures get selected depending on token statistics:
      //
      // Case A: virtual_node_exp alt3 (<tag> exp </tag>) parsed the first child,
      //   then expects '</' for the closing tag but finds the second child literal.
      //   ruleName='virtual_node_exp', expectedToken='</', lastToken='>'
      //
      // Case B: exp left-recursive extension tries optional_chain/dot/etc. after
      //   the first child expression, but finds another expression token.
      //   ruleName='exp', expectedToken='optional_chain', lastToken='>'
      //
      const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
      if (!lastToken || lastToken.type !== '>') return false;

      const caseA = (context.ruleName === 'virtual_node_exp' || context.ruleName === 'virtual_node')
        && context.expectedToken === '</';

      const caseB = context.ruleName === 'exp'
        && context.expectedToken === 'optional_chain';

      return caseA || caseB;
    },
    message: () => 'Multiple virtual node children must be on separate lines',
    suggestion: () => 'Each child of a virtual node must be on its own line:\n' +
      '  <div>           // correct\n' +
      '    <strong>text</strong>\n' +
      '    \'world\'\n' +
      '  </div>\n' +
      '\n' +
      '  <div><strong>text</strong>\'world\'</div>  // error: multiple inline children',
  },
  {
    name: 'vnode_closing_tag_on_different_line',
    detect: (context) => {
      // <p>'hello'    ← inline expression child
      //   </p>        ← closing tag on next line
      //
      // Case A: selectBestFailure picks virtual_node_exp expecting '</' but found newline.
      //   lastToken is the expression (e.g. str), NOT '>' (which would be multiple-children case).
      //
      // Case D: statistics may pick str_expression or another rule at the same position.
      //   Detected positionally: newline found immediately after <tag>'str' with no space,
      //   i.e. lastToken = str, prevToken = '>'.
      const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
      const prevToken = context.precedingTokens[context.precedingTokens.length - 2];

      if (context.token.type !== 'newline') return false;

      const caseA = (context.ruleName === 'virtual_node_exp' || context.ruleName === 'virtual_node')
        && context.expectedToken === '</'
        && lastToken && lastToken.type !== '>';

      // Position-based: any rule, but token stream shows <tag>'str'\n pattern
      const caseD = lastToken && lastToken.type === 'str'
        && prevToken && prevToken.type === '>';

      return caseA || caseD;
    },
    message: () => 'Closing tag must be on the same line as its inline content',
    suggestion: () => 'Either keep the content and closing tag on the same line:\n' +
      '  <p>\'hello\'</p>     // correct\n' +
      '\n' +
      'Or move the content to its own indented line:\n' +
      '  <p>               // correct\n' +
      '    \'hello\'\n' +
      '  </p>',
  },
];

/**
 * Quick fixes that can be suggested programmatically
 * Returns structured edit information that can be applied by code action handlers
 */
const QUICK_FIXES = {
  missing_closing_brace: (token, context) => ({
    title: 'Add closing brace',
    description: 'Add `}` at the end of the block',
    edit: null, // Complex - needs more context about where to add it
  }),
  missing_closing_paren: (token, context) => ({
    title: 'Add closing parenthesis',
    description: 'Add `)` after the expression',
    edit: null, // Complex - needs more context
  }),
  missing_closing_bracket: (token, context) => ({
    title: 'Add closing bracket',
    description: 'Add `]` after the array expression',
    edit: null, // Complex - needs more context
  }),
  unexpected_semicolon: (token, context) => ({
    title: 'Remove semicolon',
    description: `Remove the semicolon on line ${token.line_start + 1}`,
    edit: {
      type: 'delete',
      range: 'token', // Delete the entire token range
    }
  }),
  jsx_confusion: (token, context) => {
    const newText = token.value === 'className' ? 'class' : 
                    token.value === 'htmlFor' ? 'for' : token.value;
    return {
      title: `Convert '${token.value}' to '${newText}'`,
      description: 'Convert JSX to Blop syntax',
      edit: {
        type: 'replace',
        range: 'token',
        newText: newText
      }
    };
  },
  var_let_const: (token, context) => ({
    title: `Remove '${token.value}' keyword`,
    description: 'Remove unnecessary keyword',
    edit: {
      type: 'delete',
      range: 'token',
    }
  }),
  missing_whitespace_after_colon: (token, context) => {
    // Find the colon in preceding tokens
    const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
    return {
      title: 'Add space after colon',
      description: `Add a space after the colon on line ${token.line_start + 1}`,
      edit: {
        type: 'insert',
        position: 'after-previous-token', // Insert after the : token
        text: ' '
      }
    };
  },
  missing_required_whitespace: (token, context) => {
    // Determine what comes before this token
    const lastToken = context.precedingTokens[context.precedingTokens.length - 1];
    let title = 'Add required space';
    
    if (lastToken) {
      if (lastToken.type === '=' || lastToken.type === 'colon' || lastToken.type === ',') {
        title = `Add space after '${lastToken.value || lastToken.type}'`;
      } else {
        title = `Add space before '${token.value}'`;
      }
    }
    
    return {
      title,
      description: `Add a space before '${token.value}' on line ${token.line_start + 1}`,
      edit: {
        type: 'insert',
        position: 'before-token', // Insert space before current token
        text: ' '
      }
    };
  },
  unwanted_whitespace_after_equals: (token, context) => ({
    title: 'Remove space after equals sign',
    description: `Remove the space after '=' on line ${token.line_start + 1}`,
    edit: {
      type: 'delete',
      range: 'token', // Delete the whitespace token
    }
  }),
  multiple_spaces_instead_of_single: (token, context) => ({
    title: 'Replace with single space',
    description: `Replace multiple spaces with a single space on line ${token.line_start + 1}`,
    edit: {
      type: 'replace',
      range: 'token',
      newText: ' '
    }
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
function analyzeErrorContext(stream, bestFailure, grammar) {
  const token = bestFailure.token;
  const precedingTokens = getPrecedingTokens(stream, token.stream_index);
  
  // Try to determine what token was expected based on grammar
  let expectedToken = null;
  if (grammar && bestFailure.type && 
      grammar[bestFailure.type] && 
      grammar[bestFailure.type][bestFailure.sub_rule_index]) {
    const subRule = grammar[bestFailure.type][bestFailure.sub_rule_index];
    const expectedTokenIndex = bestFailure.sub_rule_token_index;
    if (subRule[expectedTokenIndex]) {
      // Remove any annotations like 'object_literal_key:key' -> 'object_literal_key'
      expectedToken = String(subRule[expectedTokenIndex]).split(':')[0];
    }
  }
  
  return {
    token,
    ruleName: bestFailure.type,
    subRuleIndex: bestFailure.sub_rule_index,
    expectedToken,
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
  const context = analyzeErrorContext(stream, bestFailure, grammar);
  const pattern = detectErrorPattern(context);
  
  const token = bestFailure.token;
  const ruleName = bestFailure.type;
  const tokenValue = token.value.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  
  // Build the error message parts
  const parts = {
    title: '',
    description: '',
    suggestion: '',
    quickFix: null,
    patternName: null, // Store pattern name for code actions
  };
  
  if (pattern) {
    // Use pattern-specific messages
    parts.title = pattern.message(context);
    parts.suggestion = pattern.suggestion(context);
    parts.quickFix = QUICK_FIXES[pattern.name] ? 
      QUICK_FIXES[pattern.name](token, context) : null; // Pass context for structured edits
    parts.patternName = pattern.name; // Store for code actions
  } else {
    // Generate generic but improved message
    const ruleExplanation = RULE_EXPLANATIONS[ruleName] || (ruleName ? `in a ${ruleName}` : 'here');
    const tokenExplanation = TOKEN_EXPLANATIONS[token.type] || `'${token.type}'`;
    
    parts.title = `Unexpected ${tokenExplanation}`;
    
    // Build description with expected token info if available
    if (context.expectedToken) {
      const expectedExplanation = TOKEN_EXPLANATIONS[context.expectedToken] || `'${context.expectedToken}'`;
      parts.description = `Expected ${expectedExplanation} ${ruleExplanation}, but found '${tokenValue}'`;
    } else {
      parts.description = `Expected ${ruleExplanation}, but found '${tokenValue}'`;
    }
    
    // Try to provide generic helpful info based on rule name
    if (ruleName && ruleName.includes('func')) {
      parts.suggestion = 'Check your function syntax. Functions should be defined with:\n' +
        '  def functionName(params) { body }';
    } else if (ruleName && ruleName.includes('assign')) {
      parts.suggestion = 'Check your assignment syntax:\n' +
        '  variable = value      // initial assignment\n' +
        '  variable := value     // explicit reassignment';
    } else if (ruleName && ruleName.includes('import')) {
      parts.suggestion = 'Check your import syntax:\n' +
        '  import { name } from \'./file.blop\'';
    } else if (ruleName && ruleName.includes('loop')) {
      parts.suggestion = 'Check your loop syntax:\n' +
        '  for item in items { ... }\n' +
        '  while condition { ... }';
    }
  }
  
  return parts;
}

/**
 * Format enhanced error message for display
 * @param {Object} errorParts - The error parts (title, description, suggestion, quickFix)
 * @param {Object} positions - The position info (lineNumber, charNumber, end)
 * @param {Boolean} forEditor - If true, format for editor (no location, no colors, no context)
 */
function formatEnhancedError(errorParts, positions, forEditor = false) {
  let message = '';
  
  if (forEditor) {
    // Editor format: clean text without redundant location info
    message += errorParts.title;
    
    if (errorParts.description) {
      message += '\n\n' + errorParts.description;
    }
    
    if (errorParts.suggestion) {
      message += '\n\n💡 Suggestion:\n';
      errorParts.suggestion.split('\n').forEach(line => {
        message += line + '\n';
      });
    }
    
    if (errorParts.quickFix) {
      message += '\n⚡ Quick fix: ' + errorParts.quickFix.description;
    }
  } else {
    // Console format: with colors and location
    message = '\n';
    
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
      message += '\n' + chalk.yellow('  ⚡ Quick fix: ') + errorParts.quickFix.description + '\n';
    }
  }
  
  return message;
}


function replaceInvisibleChars(v) {
  v = v.replace(PATTERNS.INVISIBLE_CHARS.CARRIAGE_RETURN, '⏎\r');
  v = v.replace(PATTERNS.INVISIBLE_CHARS.NEWLINE, '⏎\n');
  v = v.replace(PATTERNS.INVISIBLE_CHARS.TAB, '⇥');
  v = v.replace(PATTERNS.INVISIBLE_CHARS.NBSP, 'nbsp');
  return v.replace(PATTERNS.INVISIBLE_CHARS.SPACE, '␣');
}

function noNewline(v) {
  v = replaceInvisibleChars(v);
  v = v.replace(/\r/g, '');
  v = v.replace(/\n/g, '');
  return v;
}


function tokenPosition(token) {
  const lineNumber = token.line_start !== undefined ? token.line_start : 0;
  const charNumber = token.column_start !== undefined ? token.column_start : 0;
  const end = charNumber + (token.len || 0);
  return { lineNumber, charNumber, end };
}

function streamContext(token, firstToken, stream) {
  const index = token.stream_index;
  const firstTokenIndex = firstToken.stream_index;
  const { lineNumber } = tokenPosition(token);

  let lineNb = 1;
  let streamIndex = 0;
  let str = '';

  function char(v) {
    if (streamIndex === index) {
      return chalk.red(replaceInvisibleChars(v));
    }
    if (streamIndex >= firstTokenIndex && streamIndex < index) {
      return chalk.yellow(replaceInvisibleChars(v));
    }
    return v;
  }

  while (lineNb < (lineNumber + 4) && stream[streamIndex]) {
    const v = stream[streamIndex].value;
    if (v.match(/\n/)) {
      lineNb++;
      if (lineNb > (lineNumber + 3)) {
        return str;
      }
      if (lineNb >= (lineNumber - 1)) {
        str += `${char(v)}${String(`     ${lineNb}`).slice(-5)}: `;
      }
    } else if (lineNb >= (lineNumber - 1)) {
      if (streamIndex === 0) {
        str += `\n${String(`     ${lineNb}`).slice(-5)}: `;
      }
      str += char(v);
    }
    streamIndex++;
  }
  return str;
}


function displayError(stream, tokensDefinition, grammar, bestFailure) {
  const { token } = bestFailure;
  const firstToken = bestFailure.first_token;
  const positions = tokenPosition(token);
  
  // Generate enhanced error message
  const errorParts = enhanceErrorMessage(stream, tokensDefinition, grammar, bestFailure);
  const enhancedMessage = formatEnhancedError(errorParts, positions);
  
  // Show code context
  const context = streamContext(token, firstToken, stream);
  
  // Build the full error message
  let fullMessage = enhancedMessage;
  fullMessage += '\n' + chalk.dim('  Code context:') + '\n';
  fullMessage += context;
  
  // Add technical details for debugging (can be disabled in production)
  // if (process.env.BLOP_DEBUG) {
    const sub_rules = grammar[bestFailure.type][bestFailure.sub_rule_index];
    let rule = '';
    for (let i = 0; i < sub_rules.length; i++) {
      let sr = sub_rules[i];
      if (tokensDefinition[sr] && tokensDefinition[sr].verbose) {
        sr = tokensDefinition[sr].verbose.replace(/\s/g, '-');
      }
      if (i === bestFailure.sub_rule_token_index) {
        rule += chalk.red(`${sr} `);
      } else {
        rule += chalk.yellow(`${sr} `);
      }
    }
  //   fullMessage += '\n' + chalk.dim('  Technical details:');
  //   fullMessage += chalk.dim(`\n  Rule: ${bestFailure.type}[${bestFailure.sub_rule_index}][${bestFailure.sub_rule_token_index}]`);
  //   fullMessage += chalk.dim(`\n  Expected: ${rule}`);
  //   fullMessage += chalk.dim(`\n  Token type: ${token.type}\n`);
  // }
  
  const err = new Error(fullMessage);
  err.blopLine = positions.lineNumber + 1; // 1-based
  err.blopColumn = positions.charNumber;   // 0-based
  throw err;
}



function displayBackendError(stream, error) {
  const { token } = error;
  const positions = tokenPosition(token);
  const unexpected = chalk.yellow(noNewline(token.value));
  const firstLine = chalk.red(`Backend error at line ${positions.lineNumber + 1} char ${positions.charNumber} to ${positions.end}`);
  const err = new Error(`
  ${firstLine}
  ${error.message} ${unexpected}
  token "${unexpected}"
  Context:
${streamContext(error.token, token, stream)}
`);
  err.blopLine = positions.lineNumber + 1; // 1-based
  err.blopColumn = positions.charNumber;   // 0-based
  throw err;
}


export {
  enhanceErrorMessage,
  formatEnhancedError,
  displayBackendError,
  displayError,
  streamContext,
  tokenPosition,
  ERROR_PATTERNS,
  RULE_EXPLANATIONS,
  TOKEN_EXPLANATIONS,
};