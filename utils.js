
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

function replaceInvisibleChars(v) {
  v = v.replace(/\r/g, '⏎\r')
  v = v.replace(/\n/g, '⏎\n')
  v = v.replace(/\t/g, '⇥')
  return v.replace(/ /g, '␣')
}

function streamContext(index, stream) {
  var min = Math.max(0, index-10), i
  var max = Math.min(stream.length, index+10)
  var str = ''
  i = index - 1
  var lines = 0
  while(i >= 0) {
    var v = stream[i].value
    if(v.match(/\n/)) {
      lines++
    }
    str = v + str
    if(lines > 3) {
      break
    }
    i--
  }
  
  var v = replaceInvisibleChars(stream[index].value);

  str = str + RED + v + NC
  i = index + 1
  var lines = 0
  while(i < stream.length) {
    var v = stream[i].value
    if(v.match(/\n/)) {
      lines++
    }
    str = str + v
    if(lines > 2) {
      break
    }
    i++
  }
  return str
}


function displayError(input, stream, tokensDefinition, grammar, bestFailure) {
    var sub_rules = grammar[bestFailure.rule_name][bestFailure.sub_rule_index];
    var rule = ''
    var token = bestFailure.token
    let = failingToken = ''
    for(i=0; i<sub_rules.length; i++) {
      var sr = sub_rules[i];
      if(tokensDefinition[sr] && tokensDefinition[sr].verbose) {
        sr = tokensDefinition[sr].verbose.replace(/\s/g, '-')
      }
      if(i === bestFailure.sub_rule_token_index) {
        rule += `${RED}${sr}${NC} `
        failingToken = `${sr}`
      } else {
        rule += `${YELLOW}${sr}${NC} `
      }
    }
    throw new Error(`
  ${RED}Parser error${NC}
  Best match was at rule ${bestFailure.rule_name}[${bestFailure.sub_rule_index}][${bestFailure.sub_rule_token_index}] ${rule}
  token ${YELLOW}${replaceInvisibleChars(token.value)}${NC}  doesn't match rule item ${YELLOW}${failingToken}${NC}
  Context:
${streamContext(token.index, stream)}
  `)
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
  printTree
}
