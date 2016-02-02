// Early parser,
// Completly based on 
// http://loup-vaillant.fr/tutorials/earley-parsing/

var sets = [[]];
var set_index = 0;
var stream_index = 0;
var sub_rule_index = 0;
var sub_rule_token_index = 0;
var debug = false;

function print() {
    if(debug) {
        console.log.apply(console, arguments);
    }
}

// structure of an early item
var structure = {
    start: "start set index (set of tokens)",
    rule_name: "name or the rule",
    rule_index: "index of the rule",
    parsed: "amount of symbols parsed withing the rules (this isn't the amount of symbol)",
    c: "true if the item is complete (the fat dot is at the end of the rule"
};


function ruleAlreadyInSet(set, rule_name, index, parsed, start) {
    for(var i = 0; i < set.length; i++) {
        var item = set[i];
        if(item.rule_name == rule_name && 
            item.rule_index == index && 
            item.parsed == parsed &&
            item.start == start) {
            return true;
        }
    }
    return false;
}

function push_unsafe(set_index, rule_name, rule_index, parsed, start, early_complete) {
    if(!sets[set_index]) {
        sets[set_index] = [];
    }
    sets[set_index].push({
        start: start,
        rule_name: rule_name,
        rule_index: rule_index,
        parsed: parsed,
        c: early_complete === true
    });
    return true;
}

function push(set_index, rule_name, rule_index, parsed, start, early_complete) {
    if(!sets[set_index]) {
        sets[set_index] = [];
    }
    if(ruleAlreadyInSet(sets[set_index], rule_name, rule_index, parsed, start)) {
        return false;
    }
    push_unsafe(set_index, rule_name, rule_index, parsed, start, early_complete);
    return true;
}

function prediction(sub_rules, rule_name, set_index, early_item) {
    for(var i = 0; i < sub_rules.length; i++) {
        if(push(set_index, rule_name, i, 0, set_index)) {
            print("Push prediction in set", set_index, lastItem(set_index));
        }
    }
}

function next(rules, item) {
    return rules[item.rule_name][item.rule_index][item.parsed];
}

function lastItem(index) {
    var len = sets[index].length;
    return sets[index][len-1];
}

function complete(rules, set_index, early_item) {
    var i = 0;
    var set = sets[early_item.start];
    var completed_rule_name = early_item.rule_name;
    //var item = rules[early_item.rule_name][early_item.rule_index];
    while(i < set.length) {
        var old_item = set[i];
        var next_old = next(rules, old_item);
        if(completed_rule_name === next_old) {
            var early_complete = rules[old_item.rule_name][old_item.rule_index][old_item.parsed + 1] === undefined;
            if(push(set_index, old_item.rule_name, old_item.rule_index, old_item.parsed + 1, old_item.start, early_complete)) {
                print("Push complete in set", set_index , lastItem(set_index));
            } else {
                print("Item already there", old_item);
            }
        }
        i++;
    }
}

function init(rules) {
    for(var i=0; i<rules.START.length; i++) {
        push(0, 'START', 0, i, 0);
    }
}

function buildTree(node, index, early_rule) {

}


function parse(rules, stream) {
    set_index = 0;
    sets = [[]];
    init(rules);

    var i = 0;
    while(sets[set_index] && (set_index < stream.length + 1)) {
        print("--- Set", set_index, "with value", stream[set_index]);
        if(!sets[set_index]) {
            sets[set_index] = [];
        } else if (sets[set_index].length === 0) {
            print("No more rules");
            return;
        }
        i = 0;
        while(i < sets[set_index].length) {
            var early_item = sets[set_index][i];
            var early_rule = rules[early_item.rule_name][early_item.rule_index];
            var symbol = early_rule[early_item.parsed];
            print('Early item', early_item);
            if(symbol === undefined) {
                // complete
                print('- complete', set_index, early_item);
                complete(rules, set_index, early_item);
            } else if(!rules[symbol]) {
                if(stream[set_index] === symbol) {
                    var complet = rules[early_item.rule_name][early_item.rule_index][early_item.parsed + 1] === undefined;
                    push_unsafe(set_index + 1, early_item.rule_name, early_item.rule_index, early_item.parsed + 1, early_item.start, complet);
                    print("- terminal match", symbol, ", scan in set", set_index + 1, lastItem(set_index + 1));
                } else {
                    print("- terminal mismatch");
                }
            } else if(rules[symbol]) {
                print('- predict', set_index, early_item);
                // we have a rule, we need to predict
                prediction(rules[symbol], symbol, set_index, early_item);
            }
            i++;
        }
        set_index++;
    }

    // test completness
    var last_set = sets[stream.length];
    if(last_set) {
        for(i=0; i<last_set.length; i++) {
            var item = last_set[i];
            if(item.rule_name === 'START' && 
                item.start === 0 && 
                item.parsed && 
                rules.START[item.rule_index].length === item.parsed) {
                return true;
            }
        }
    }

    return false;
}

module.exports = {
    parse: parse,
    prediction: prediction,
    sets: sets,
    getSets: function(){ return sets; }
};
