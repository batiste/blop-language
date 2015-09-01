

var sets = [[]];
var set_index = 0;
var stream_index = 0;
var sub_rule_index = 0;
var sub_rule_token_index = 0;

function ruleAlreadyInSet(set, rule_name, index, parsed) {
    for(var i = 0; i < set.length; i++) {
        var item = set[i];
        if(item.rule_name == rule_name && item.rule_index == index && item.parsed == parsed) {
            return true;
        }
    }
    return false;
}

function push(set_index, rule_name, rule_index, parsed, start) {
    if(!sets[set_index]) {
        sets[set_index] = [];
    }
    if(ruleAlreadyInSet(sets[set_index], rule_name, rule_index, parsed)) {
        return false;
    }
    sets[set_index].push({
        start: start,
        rule_name: rule_name,
        rule_index: rule_index,
        parsed: parsed
    });
    return true;
}

function prediction(sub_rules, rule_name, set_index, early_item) {
    for(var i = 0; i < sub_rules.length; i++) {
        push(set_index, rule_name, i, 0, set_index);
    }
}

function next(rules, item) {
    return rules[item.rule_name][item.rule_index][item.parsed];
}
    
function complete(rules, set_index, early_item) {
    var i = 0;
    var set = sets[early_item.start];
    while(i < set.length) {
        var old_item = set[i];
        var nex = next(rules, old_item);
        if(early_item.rule_name == nex) {
            console.log("Push complete", old_item.rule_name)
            push(set_index, old_item.rule_name, old_item.rule_index, old_item.parsed+1, old_item.start);
        }
        i++;
    }
}

function main(rules, stream) {
    set_index = 0;
    push(0, 'START', 0, 0, 0);
    var i = 0;
    while(stream[set_index]) {
        console.log(set_index, stream[set_index]);
        if(!sets[set_index]) {
            sets[set_index] = [];
        } else if (sets[set_index].length == 0) {
            console.log("No more rules");
            return;
        }
        i = 0;
        while(i < sets[set_index].length) {
            var early_item = sets[set_index][i];
            var early_rule = rules[early_item.rule_name][early_item.rule_index];
            var symbol = early_rule[early_item.parsed];
            console.log('terminal:', symbol);
            if(symbol === undefined) {
                // complete
                console.log('complete', set_index, early_item);
                complete(rules, set_index, early_item);
            } else if(rules[symbol]) {
                // we have a rule, we need to predict
                prediction(rules[symbol], symbol, set_index, early_item);
            } else {
                console.log('terminal:', symbol);
                // terminal symbol, scan
                if(stream[set_index] === symbol) {
                    console.log('symbol match', symbol);
                    push(set_index+1, early_item.rule_name, early_item.rule_index, early_item.parsed+1, early_item.start);
                }
            }
            i++;
        }
        set_index++;
    }
}

module.exports = {
    main: main,
    prediction: prediction,
    sets: sets
};
