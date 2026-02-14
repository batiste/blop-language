const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { PATHS, PATTERNS } = require('./constants');
const { enhanceErrorMessage, formatEnhancedError } = require('./errorMessages');

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
  const lineNumber = token.lineStart !== undefined ? token.lineStart : 0;
  const charNumber = token.columnStart !== undefined ? token.columnStart : 0;
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
  if (process.env.BLOP_DEBUG) {
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
    fullMessage += '\n' + chalk.dim('  Technical details:');
    fullMessage += chalk.dim(`\n  Rule: ${bestFailure.type}[${bestFailure.sub_rule_index}][${bestFailure.sub_rule_token_index}]`);
    fullMessage += chalk.dim(`\n  Expected: ${rule}`);
    fullMessage += chalk.dim(`\n  Token type: ${token.type}\n`);
  }
  
  throw new Error(fullMessage);
}

function displayBackendError(stream, error) {
  const { token } = error;
  const positions = tokenPosition(token);
  const unexpected = chalk.yellow(noNewline(token.value));
  const firstLine = chalk.red(`Backend error at line ${positions.lineNumber + 1} char ${positions.charNumber} to ${positions.end}`);
  throw new Error(`
  ${firstLine}
  ${error.message} ${unexpected}
  token "${unexpected}"
  Context:
${streamContext(error.token, token, stream)}
`);
}

function printTree(node, sp) {
  if (node.type) {
    console.log(`${sp}r ${node.type}(${node.sub_rule_index})`);
  } else {
    console.log(`${sp}t ${node.type} ${node.value}`);
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      printTree(node.children[i], `${sp}  `);
    }
  }
}

function lookUp(dir, name) {
  const up = [];
  let currentDir = dir;
  while (fs.existsSync(currentDir) && currentDir.length > 1) {
    const filename = path.join(dir, ...up, name);
    if (fs.existsSync(filename)) {
      return filename;
    }
    up.push('..');
    currentDir = path.join(dir, ...up);
  }
}

function getConfig(filename) {
  if (!filename) {
    return {};
  }
  const dirname = path.dirname(filename) || process.cwd();
  const config = lookUp(dirname, PATHS.CONFIG_FILE);
  if (!config) {
    return {};
  }
  // eslint-disable-next-line import/no-dynamic-require global-require
  return require(config);
}

module.exports = {
  getConfig,
  lookUp,
  streamContext,
  displayError,
  displayBackendError,
  printTree,
  tokenPosition,
};
