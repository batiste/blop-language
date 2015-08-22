
// This parser will work with non left recursive rules
// Left recusive rules will not create a infinite loops, but will
// Simply be interrrupted by ruleAlreadyInStack


function assertTrue(a, msg) {
    if(a !== true) {
        throw (msg || a) + " is not true";
    }
}

function assertFalse(a, msg) {
    if(a !== false) {
        throw (msg || a) + " is not false";
    }
}

function assertTrueRules(rules, input) {
    var result = parse(rules, input.split(''));
    assertTrue(result, input);
}

function assertFalseRules(rules, input) {
    var result = parse(rules, input.split(''));
    assertFalse(result, input);
}

var rules = {
    'START': [['math']],
    'NUM': [['1'], ['2'], ['3']],
    'math': [['(', 'math', ')'], ['NUM' , '+', 'math'], ['NUM' , '-', 'math'], ['NUM']]
};

var stack = [];
var stream_index = 0;
var sub_rule_index = 0;
var sub_rule_token_index = 0;
var current_rule;
var current_rule_name;
var memoization;
var debug = false;

assertTrueRules(rules, "3");
assertFalseRules(rules, "1+");
assertTrueRules(rules, "1+1");
assertTrueRules(rules, "1+2-3");
assertFalseRules(rules, "3--2");
assertFalseRules(rules, "11");
assertFalseRules(rules, "4");
assertFalseRules(rules, "3-");
assertTrueRules(rules, "(1+1)");
assertTrueRules(rules, "(1-1)");


var perfTokens = [];
// that many token seems to be fast enough
for(var i=0; i<1000; i++) {
    perfTokens.push("2");
    perfTokens.push("-");
}
perfTokens.push("3");

assertTrue(parse(rules, perfTokens));
perfTokens.push("+");
assertFalse(parse(rules, perfTokens));


// there we see the problem with the lake of left recursion
assertTrueRules(rules, "(1+1)+1");


function ruleAlreadyInStack() {
  // avoid infinite recursion
  // This is faster than filter
  var i = stack.length - 1;
  
  while(i >= 0) {
    if(stack[i][0] == current_rule_name
        && stack[i][1] == sub_rule_index 
        && stack[i][2] == sub_rule_token_index 
        && stack[i][3] == stream_index) {
      return true;
    }
    i = i-1;
  }
  return false;
}



function print() {
    if(debug) {
        console.log.apply(console, arguments);
    }
}
function printStack(msg) {
    print(msg + "[", stack.length, "] -------> ", current_rule, sub_rule_index, sub_rule_token_index, stream_index);
}

function popStack() {
    if(stack.length === 0) {
        throw "Stack empty";
    }
    var tmp = stack.pop();
    current_rule_name = tmp[0]
    current_rule = rules[current_rule_name];
    sub_rule_index = tmp[1];
    sub_rule_token_index = tmp[2];
    stream_index = tmp[3];
    printStack("Restore");
}
function pushStack() {
    stack.push([current_rule_name, sub_rule_index, sub_rule_token_index, stream_index]);
    printStack("Save");
}
// memoization makes no difference in perf
function memoize(value) {
    var key = [current_rule_name, sub_rule_index, sub_rule_token_index, stream_index].join(",");
    memoization[key] = value;
}
function worthExploring() {
    var key = [current_rule_name, sub_rule_index, sub_rule_token_index, stream_index].join(",");
    return memoization[key] !== false;
}
function ruleItem() { return current_rule[sub_rule_index][sub_rule_token_index]; }
function backtrack(msg) {
    if(stack.length === 0) {
        throw "Stack empty";
    }
    printStack(msg);
    popStack();
}


function parse(rules, stream) {

    stack = [];
    memoization = {};
    stream_index = 0;
    sub_rule_index = 0;
    sub_rule_token_index = 0;
    current_rule_name = "START";
    current_rule = rules.START;
    memoization = {};
    var token, rule_item;

    while(true) {

        // backtrack if no rule
        while(!current_rule[sub_rule_index]) {
            if(stack.length === 0) {
                print("Stack is empty, failure to match");
                return false;
            }
            backtrack('No more sub rules');
            stream_index = stream_index - sub_rule_token_index;
            sub_rule_token_index = 0;
            sub_rule_index++;
            printStack("Next sub rule");
        }

        // test satisfaction of the current rule
        if(sub_rule_token_index >= current_rule[sub_rule_index].length) {

            print('Rule satisfied: ', current_rule[sub_rule_index], " Stack depth: ", stack.length);

            // rule satified so we pop to get the previous rule but with the stream_index forward
            var tmp = stream_index;
            printStack("Before");
            popStack();

            stream_index = tmp;
            sub_rule_token_index++;

            printStack("Forward");

            if(stack.length === 0) {
                print("Stack empty");
                if(stream_index == stream.length) {
                    print("All tokens consumed");
                    return true;
                }
                print("Token not consumed", stream.length - stream_index, ' Last token ', stream[stream_index]);
                return false;
            }

            continue;
        }

        token = stream[stream_index];
        rule_item = ruleItem();

        if(!token) {
            printStack('Token exhausted');
            stream_index = stream_index - sub_rule_token_index;
            sub_rule_token_index = 0;
            sub_rule_index++;
            printStack("Next sub rule");
            continue;
        }

        print('Rule item: ', rule_item);
        print('    Token: ', token);

        // Rules case
        if(rules[rule_item]) {

            print('Expand the new rule', rule_item);
            if(!worthExploring()) {
                continue;
            }

            if(ruleAlreadyInStack()) {
                print("Rule already in the stack", current_rule);
                stream_index = stream_index - sub_rule_token_index;
                sub_rule_token_index = 0;
                sub_rule_index++;
                print("Next sub rule:", current_rule[sub_rule_index]);
                continue;
            }

            // save the current state
            pushStack();

            current_rule_name = rule_item;
            current_rule = rules[rule_item];
            sub_rule_token_index = 0;
            sub_rule_index = 0;

            continue;

        // Token case
        } else {
            // Token does match
             if(rule_item === token) {
                print('Token match');
                sub_rule_token_index++;
                stream_index++;
            // Token doesn't match, next sub rule
            } else {
                stream_index = stream_index - sub_rule_token_index;
                sub_rule_token_index = 0;
                sub_rule_index++;
                print("Token mismatch, next sub rule:", current_rule[sub_rule_index]);
            }
            continue;
        }

    }
}