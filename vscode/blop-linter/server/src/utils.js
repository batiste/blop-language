const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { enhanceErrorMessage } = require('./errorMessages');

function replaceInvisibleChars(v) {
  v = v.replace(/\r/g, '⏎\r');
  v = v.replace(/\n/g, '⏎\n');
  v = v.replace(/\t/g, '⇥');
  v = v.replace('\xa0', 'nbsp');
  return v.replace(/ /g, '␣');
}

function noNewline(v) {
  v = replaceInvisibleChars(v);
  v = v.replace(/\r/g, '');
  v = v.replace(/\n/g, '');
  return v;
}

function tokenPosition(token) {
  const lineNumber = token.lineStart;
  const charNumber = token.columnStart;
  const end = charNumber + token.len;
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
  
  // Generate enhanced error message
  const errorParts = enhanceErrorMessage(stream, tokensDefinition, grammar, bestFailure);
  
  // For VSCode linter, return a simplified message
  let message = errorParts.title;
  
  if (errorParts.description) {
    message += '. ' + errorParts.description;
  }
  
  if (errorParts.suggestion) {
    message += '\n\n' + errorParts.suggestion;
  }
  
  if (errorParts.quickFix) {
    message += '\n\nQuick fix: ' + errorParts.quickFix.fix;
  }
  
  throw new Error(message);
}

function printTree(node, sp) {
  if (node.rule_name) {
    console.log(`${sp}r ${node.rule_name}(${node.sub_rule_index})`);
  } else {
    console.log(`${sp}t ${node.type} ${node.value}`);
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      printTree(node.children[i], `${sp}  `);
    }
  }
}

function checkGrammarAndTokens(grammar, tokensDefinition) {
  const gkeys = Object.keys(grammar);
  const tkeys = Object.keys(tokensDefinition);
  const intersection = gkeys.filter(n => tkeys.indexOf(n) > -1);
  if (intersection.length > 0) {
    throw new Error(`Grammar and token have keys in common: ${intersection}`);
  }
}

function preprocessGrammar(rules) {
  return Object.keys(rules).reduce((accu, key) => {
    accu[key] = rules[key].map(
      subRule => subRule.map((subRuleItem) => {
        if (subRuleItem instanceof Function) {
          return { function: true, value: subRuleItem };
        }
        const values = subRuleItem.split(':');
        let optional = false;
        let repeatable = false;
        if (values[0].endsWith('?')) {
          values[0] = values[0].substring(0, values[0].length - 1);
          optional = true;
        }
        if (values[0].endsWith('*')) {
          values[0] = values[0].substring(0, values[0].length - 1);
          repeatable = true;
        }
        return {
          value: values[0],
          alias: values[1],
          optional,
          repeatable,
        };
      }),
    );
    return accu;
  }, {});
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
  const config = lookUp(dirname, 'blop.config.js');
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
  preprocessGrammar,
  checkGrammarAndTokens,
  displayError,
  printTree,
};
