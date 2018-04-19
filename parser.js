

// This is a left to right top down grammar parser

// This grammar parser will work with non left recursive rules
// Left recursive grammar will create a infinite loops

function parse(rules, stream, debug) {
    "use strict";
    debug = debug || false;
    var stack = [];
    var token, rule_item;
    var best_failure_stream_index = 0;
    var best_failure = null;

    var current = {
        success: true,
        rule_name: "START",
        sub_rule_index: 0,
        sub_rule_token_index: 0,
        stream_index: 0,
        children: []
    };
    var start = current;

    function print() {
        if(debug) {
            console.log.apply(console, arguments);
        }
    }

    function ruleRepr(frame) {
        return frame.rule_name + '(' +
            frame.sub_rule_index + '); rule_token_index(' +
            frame.sub_rule_token_index+ '); stream_index('+ frame.stream_index +')';
    }

    function printStack(msg) {
        if(!debug) {
            return;
        }
        var i = 0;
        var _msg = ['Stack ' + msg];
        var space = '  ', frame;
        while(i < stack.length) {
            frame = stack[i];
            _msg.push(space + '+ Rule name: ' + ruleRepr(frame));
            space = space + '  ';
            i++;
        }
        _msg.push(space + '-> Rule name: ' + ruleRepr(current));
        print(_msg.join("\n"));
    }

    function popStack(msg, failure) {
        if(stack.length === 0) {
            throw "Stack empty";
        }
        if(!failure) {
          //current.children
        }
        var tmp = stack.pop();
        current = tmp;
        printStack("Restored");
    }
    function pushStack(msg) {
        printStack("Save stack: "+msg);
        stack.push(Object.assign({}, current));
    }

    function rule() {
        return rules[current.rule_name];
    }
    function subRule() {
        return rule()[current.sub_rule_index];
    }
    function subRuleItem() {
        return subRule()[current.sub_rule_token_index];
    }

    function backtrack(msg) {
        if(stack.length === 0) {
            throw "Stack empty";
        }
        printStack("Backtrack Before " + msg);
        popStack('Backtrack', true);
        printStack("Backtrack After " + msg);
    }

    function parent() {
        return stack[stack.length - 1];
    }

    function parentStreamIndex() {
        var _parent = parent();
        if(_parent) {
            return _parent.stream_index;
        }
        return 0;
    }

    function buildBack() {
        var i = stack.length - 1, tree, item;
        while(i >= 0) {
            //var item = rule_item[i];
            i--;
        }
    }

    while(true) {

        // No more sub rule to evaluate
        while(!subRule()) {
            if(stack.length === 0) {
                print("Stack is empty: failure to match anything");
                return best_failure;
            }
            backtrack('No more sub rules');
            current.stream_index = parentStreamIndex();
            current.sub_rule_token_index = 0;
            current.sub_rule_index++;
            current.children = []
            printStack("Next sub rule");
        }

        // test satisfaction of the current rule
        if(current.sub_rule_token_index >= subRule().length) {

            print('Rule satisfied: ', subRule(), " Stack depth: ", stack.length);
            var _parent = parent();
            if(_parent && current.children !== undefined) {
                _parent.children.push(Object.assign({}, current));
            }

            if(stack.length === 0) {
                print("Stack empty");

                if(current.stream_index == stream.length) {
                    print("Parsing successful");
                    return start;
                }

                print('Token not consumed:' + (stream.length - current.stream_index));

                return best_failure;
            }

            // rule satified so we pop to get the previous rule
            // but with the stream_index moved forward
            var tmp = current.stream_index;
            popStack();

            current.stream_index = tmp;
            current.sub_rule_token_index++;

            printStack("Forward");

            continue;
        }

        token = stream[current.stream_index];
        rule_item = subRuleItem();

        if(!token) {
            printStack('Token exhausted');
            current.stream_index = parentStreamIndex();
            current.sub_rule_token_index = 0;
            current.sub_rule_index++;
            // current.children = [];
            printStack("Next sub rule");
            continue;
        }

        print('Rule item: ', rule_item);
        print('Token: ', token);

        // Rules case
        if(rules[rule_item]) {

            // save the current state
            pushStack('Save before expanding new rule ' + rule_item + '(0)');

            // setup the next rule to be evaluated
            var n = {
                children: [],
                rule_name: rule_item,
                sub_rule_token_index: 0,
                sub_rule_index: 0,
                stream_index: current.stream_index
            };
            current = n;
            continue;

        // Token case
        } else {
            var rule_item_optional = false;
            if(rule_item.endsWith('?')) {
              rule_item_optional = true;
              rule_item = rule_item.substring(0, rule_item.length - 1);
            }

            // Token does match?
            if(rule_item === token.type) {
                print('Token match ' + token.type + '('+current.stream_index+')');
                current.sub_rule_token_index++;
                current.stream_index++;
                current.children.push(token);
            // Token doesn't match, but the token is optionnal
            } else if(rule_item_optional) {
                current.sub_rule_token_index++;
            // Token doesn't match, next sub rule
            } else {
                if(best_failure_stream_index < current.stream_index) {
                  best_failure_stream_index = current.stream_index;
                  best_failure = {
                      success: false,
                      rule_name: current.rule_name,
                      sub_rule_token_index: current.sub_rule_token_index,
                      sub_rule_index: current.sub_rule_index,
                      stream_index: current.stream_index,
                      token: token,
                      rule_item: rule_item,
                  };
                }

                var n = {
                    rule_name: current.rule_name,
                    sub_rule_token_index: 0,
                    sub_rule_index: current.sub_rule_index + 1,
                    stream_index: parentStreamIndex()
                };
                current = n;
                current.children = [];
                print("Token mismatch, next sub rule: " + n.rule_name + '('+ n.sub_rule_index + ')');
            }
            continue;
        }
    }
}

module.exports = {
    parse: parse
};
