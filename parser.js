

// This is a left to right top down grammar parser

// This grammar parser will work with non left recursive rules
// Left recusive garmmar will create a infinite loops

function parse(rules, stream, modifiers, debug) {
    "use strict";
    debug = debug || false;
    var stack = [];
    var token, rule_item;

    var current = {
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

    function popStack(msg) {
        if(stack.length === 0) {
            throw "Stack empty";
        }
        var tmp = stack.pop();
        current = tmp;
        //printStack("Restored");
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
        popStack('Backtrack');
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
                return false;
            }
            backtrack('No more sub rules');
            current.stream_index = parentStreamIndex();
            current.sub_rule_token_index = 0;
            current.sub_rule_index++;
            printStack("Next sub rule");
        }

        // test satisfaction of the current rule
        if(current.sub_rule_token_index >= subRule().length) {

            print('Rule satisfied: ', subRule(), " Stack depth: ", stack.length);
            var _parent = parent();
            if(_parent && current.children !== undefined) {
                _parent.children.push(Object.assign({}, current));
            }

            // rule satified so we pop to get the previous rule 
            // but with the stream_index moved forward
            var tmp = current.stream_index;
            popStack();

            current.stream_index = tmp;
            current.sub_rule_token_index++;

            printStack("Forward");

            if(stack.length === 0) {

                if(current.stream_index == stream.length) {
                    print("Parsing successful");
                    return start;
                }

                print("Stack empty, Token not consumed" +
                    stream.length - current.stream_index + ' Last token ' + stream[current.stream_index]);

                return false;
            }

            continue;
        }

        token = stream[current.stream_index];
        rule_item = subRuleItem();

        if(!token) {
            printStack('Token exhausted');
            current.stream_index = parentStreamIndex();
            current.sub_rule_token_index = 0;
            current.sub_rule_index++;
            current.children = [];
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
            // Token does match?
            if(rule_item === token.type) {
                print('Token match ' + token.type + '('+current.stream_index+')');
                current.sub_rule_token_index++;
                current.stream_index++;
                current.children.push(token);
            // Token doesn't match, next sub rule
            } else {
                var n = {
                    children: [],
                    rule_name: current.rule_name,
                    sub_rule_token_index: 0,
                    sub_rule_index: current.sub_rule_index + 1,
                    stream_index: parentStreamIndex()
                };
                current = n;
                print("Token mismatch, next sub rule: " + n.rule_name + '('+ n.sub_rule_index + ')');
            }
            continue;
        }
    }
}

module.exports = {
    parse: parse
};