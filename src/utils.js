
const RED = '\x1B[0;31m';
const YELLOW = '\x1B[1;33m';
const NC = '\x1B[0m';

function replaceInvisibleChars(v) {
  v = v.replace(/\r/g, '⏎\r');
  v = v.replace(/\n/g, '⏎\n');
  v = v.replace(/\t/g, '⇥');
  v = v.replace('\xa0', 'nbsp');
  return v.replace(/ /g, '␣');
}

function tokenPosition(input, token) {
  const charn = token.start || 0;
  const lines = input.split('\n'); let i; let charCounter = 0; let
    charOnLine = 0;
  for (i = 0; i < lines.length; i++) {
    charCounter += lines[i].length + 1;
    if (charCounter >= charn) {
      break;
    }
    charOnLine += lines[i].length + 1;
  }
  const lineNumber = Math.max(0, i) + 1; // line number
  const charNumber = (charn - charOnLine) + 1;
  const end = charNumber + token.len;
  return { lineNumber, charNumber, end };
}

function streamContext(input, token, firstToken, stream) {
  const { index } = token;
  const firstTokenIndex = firstToken.index;
  const { lineNumber } = tokenPosition(input, token);

  let lineNb = 1;
  let streamIndex = 0;
  let str = NC;
  while (lineNb < (lineNumber + 4) && stream[streamIndex]) {
    let v = stream[streamIndex].value;
    if (v.match(/\n/)) {
      lineNb++;
      if (lineNb > (lineNumber + 3)) {
        return str;
      }
      if (lineNb >= (lineNumber - 3)) {
        str += `${v + String(`     ${lineNb}`).slice(-5)}:`;
      }
    } else if (lineNb >= (lineNumber - 3)) {
      if (streamIndex === index) {
        v = RED + replaceInvisibleChars(v) + NC;
      } else if (streamIndex >= firstTokenIndex && streamIndex < index) {
        v = YELLOW + replaceInvisibleChars(v) + NC;
      }
      str += v;
    }
    streamIndex++;
  }
  return str;
}

function displayError(input, stream, tokensDefinition, grammar, bestFailure) {
  const sub_rules = grammar[bestFailure.rule_name][bestFailure.sub_rule_index];
  let rule = '';
  const { token } = bestFailure;
  const firstToken = bestFailure.first_token;
  const positions = tokenPosition(input, token);
  let failingToken = '';
  for (let i = 0; i < sub_rules.length; i++) {
    let sr = sub_rules[i];
    if (tokensDefinition[sr] && tokensDefinition[sr].verbose) {
      sr = tokensDefinition[sr].verbose.replace(/\s/g, '-');
    }
    if (i === bestFailure.sub_rule_token_index) {
      rule += `${RED}${sr}${NC} `;
      failingToken = `${sr}`;
    } else {
      rule += `${YELLOW}${sr}${NC} `;
    }
  }
  throw new Error(`
  ${RED}Parser error at line ${positions.lineNumber} char ${positions.charNumber} to ${positions.end} ${NC}
  Best match was at rule ${bestFailure.rule_name}[${bestFailure.sub_rule_index}][${bestFailure.sub_rule_token_index}] ${rule}
  token "${YELLOW}${replaceInvisibleChars(token.value)}${NC}" (type:${token.type}) doesn't match rule item ${YELLOW}${failingToken}${NC}
  Context:
${streamContext(input, token, firstToken, stream)}
`);
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

module.exports = {
  streamContext,
  preprocessGrammar,
  checkGrammarAndTokens,
  displayError,
  printTree,
  NC,
};
