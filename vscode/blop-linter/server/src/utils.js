
RED=''
YELLOW=''
NC=''

function replaceInvisibleChars(v) {
  v = v.replace(/\r/g, '⏎\r')
  v = v.replace(/\n/g, '⏎\n')
  v = v.replace(/\t/g, '⇥')
  v = v.replace('\xa0', 'nbsp')
  return v.replace(/ /g, '␣')
}

function streamContext(input, token, firstToken, stream) {
  let index = token.index
  let firstTokenIndex = firstToken.index
  let {lineNumber, charNumber, end} = tokenPosition(input, token)

  let lineNb = 1
  let streamIndex = 0
  let str = NC
  while(lineNb < (lineNumber + 4) && stream[streamIndex]) {
    let v = stream[streamIndex].value
    if(v.match(/\n/)) {
      lineNb++
      if(lineNb > (lineNumber + 3)) {
        return str
      }
      if(lineNb >= (lineNumber - 3)) {
        str += v + String("     " + lineNb).slice(-5) + ':'
      }
    } else {
      if(lineNb >= (lineNumber - 3)) {
        if(streamIndex === index) {
          v = RED + replaceInvisibleChars(v) + NC;
        } else if (streamIndex >= firstTokenIndex && streamIndex < index) {
          v = YELLOW + replaceInvisibleChars(v) + NC;
        }
        str += v
      }
    }
    streamIndex++
  }
  return str
}

function tokenPosition(input, token) {
  let charn = token.start || 0;
  let lines = input.split("\n"), i, charCounter = 0, charOnLine = 0;
  for(i=0; i<lines.length; i++) {
    charCounter += lines[i].length + 1;
    if(charCounter >= charn) {
      break;
    }
    charOnLine += lines[i].length + 1;
  }
  let lineNumber = Math.max(0, i) + 1; // line number
  let charNumber = (charn - charOnLine) + 1
  let end = charNumber + token.len
  return {lineNumber, charNumber, end}
}


function displayError(input, stream, tokensDefinition, grammar, bestFailure) {
    let sub_rules = grammar[bestFailure.rule_name][bestFailure.sub_rule_index];
    let rule = ''
    let token = bestFailure.token
    let = failingToken = ''
    for(i=0; i<sub_rules.length; i++) {
      var sr = sub_rules[i];
      if(tokensDefinition[sr] && tokensDefinition[sr].verbose) {
        sr = tokensDefinition[sr].verbose.replace(/\s/g, '-')
      }
      if(i === bestFailure.sub_rule_token_index) {
        rule += `${sr} `
        failingToken = `${sr}`
      } else {
        rule += `${sr} `
      }
    }
    return `Possible rule (${bestFailure.rule_name}): ${rule}
token "${replaceInvisibleChars(token.value)}" (type:${token.type}) doesn't match token ${replaceInvisibleChars(failingToken)}`
}

function printTree(node, sp) {
    if(node.rule_name) {
        console.log(sp + 'r ' + node.rule_name + '(' + node.sub_rule_index + ')');
    } else {
        console.log(sp + 't ' + node.type + ' ' + node.value);
    }

    if(node.children) {
        for(var i=0; i<node.children.length; i++) {
            printTree(node.children[i], sp + '  ');
        }
    }
}

function preprocessGrammar(rules) {
  return Object.keys(rules).reduce((accu, key) => {
    accu[key] = rules[key].map(
      subRule => subRule.map(subRuleItem => {
        if (subRuleItem instanceof Function) {
          return {function: true, value: subRuleItem}
        }
        const values = subRuleItem.split(':')
        let optional = false;
        let repeatable = false;
        if(values[0].endsWith('?')) {
          values[0] = values[0].substring(0, values[0].length - 1);
          optional = true
        }
        if(values[0].endsWith('*')) {
          values[0] = values[0].substring(0, values[0].length - 1);
          repeatable = true
        }
        return {
          value: values[0],
          alias: values[1],
          optional,
          repeatable
        }
      })
    )
    return accu
  }, {})
}


module.exports = {
  preprocessGrammar,
  displayError,
  printTree,
  streamContext
}
