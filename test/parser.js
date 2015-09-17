var assert = require("assert");
var parser = require("../parser");
var early = require("../early");

function curryComplete(parser) {
  return function complete(rules, input) {
      var result = parser.parse(rules, input.split(''));
      assert.equal(result, true, input + ' should be complete');
  };
}

function curryIncomplete(parser) {
    return function incomplete(rules, input) {
      var result = parser.parse(rules, input.split(''));
      assert.equal(result, false, input + ' should be incomplete');
  };
}

describe('Early parser basics', function() {

    var complete = curryComplete(early);
    var incomplete = curryIncomplete(early);

    var rules = {
        'START': [['math']],
        'NUM': [['1'], ['2'], ['3']],
        'math': [['(', 'math', ')'], ['math' , '+', 'math'], ['math' , '-', 'math'], ['NUM']]
    };

    it('should accept', function () {
      complete(rules, '1');
      complete(rules, '1+2');
      complete(rules, '1+2+1-2-1');
      complete(rules, "(1-1)");
      complete(rules, "(((2)))");
    });

    it('should reject', function () {
      incomplete(rules, '1+');
      incomplete(rules, '++');
      incomplete(rules, '1-2+11');
      incomplete(rules, "(1-1)-1)");
      incomplete(rules, "(((2))");
    });

    it('should be fast', function () {
      var perfTokens = [];
      // that many token seems to be fast enough
      for(var i=0; i<100; i++) {
          perfTokens.push("2");
          perfTokens.push("-");
      }
      perfTokens.push("3");

      assert.equal(early.parse(rules, perfTokens), true);
      perfTokens.push("+");
      assert.equal(early.parse(rules, perfTokens), false);
    });

    it('left recursion should work', function () {
      complete(rules, "1+(1+1)");
      complete(rules, "(1+1)+1");
      complete(rules, "(1+(1+1)+1)");
      complete(rules, "(1+1)");
    });

    it('build tree', function() {

      var r = early.parse(rules, '1+1'.split(''));
      var sets = early.getSets();
      console.log(sets);
      assert.equal(r, true);

      function getCompleteRulesInSet(rule_name, set, start) {
        var r = [];
        for(var i=0; i<set.length; i++) {
          if(set[i].rule_name === rule_name && set[i].c && start === set[i].start) {
            r.push(set[i]);
          }
        }
        return r;
      }


      function develop(rule_name, start, set_index) {

        var item = getCompleteRulesInSet(rule_name, sets[set_index], start);
        item = item[0];

        var sub_rules = rules[rule_name][item.rule_index];
        var node = {name: rule_name, children: [], start:start, end:set_index};

        i = sub_rules.length - 1;
        while(i > -1) {
          var _rule_name = sub_rules[i];
          if(_rule_name) {

            var rules_in_set = getCompleteRulesInSet(_rule_name, sets[set_index], start);
            var ris = rules_in_set[0];
            var child = {name: ris.rule_name, start: ris.start, end: set_index, children: []};

            // create infinite loops
            // develop(ris.rule_name, ris.start, ris.start + ris.parsed);
            node.children.push(child);

          
          } else {
            node.children.push({name: 'terminal', start: set_index-1, end: set_index});
          }
          i--;
        }
        return node;
      }

      var rule_name = 'START';
      var set_index = sets.length - 1;

      var tree = develop(rule_name, 0, set_index);
      console.log(tree);

    });

});

describe('Left to right, top down parser basics', function() {

    var complete = curryComplete(early);
    var incomplete = curryIncomplete(early);

    var rules = {
        'START': [['math']],
        'NUM': [['1'], ['2'], ['3']],
        // Not the effort to avoid left recursion here
        'math': [['(', 'math', ')'], ['NUM' , '+', 'math'], ['NUM' , '-', 'math'], ['NUM']]
    };

    it('should accept', function () {
      complete(rules, "3");
      complete(rules, "1+1");
      complete(rules, "1+2-3");
      complete(rules, "(1+1)");
      complete(rules, "(1-1)");
      complete(rules, "(((2)))");
    });

    it('should reject', function () {
      incomplete(rules, "1+");
      incomplete(rules, "3--2");
      incomplete(rules, "11");
      incomplete(rules, "4");
      incomplete(rules, "3-");
      incomplete(rules, "-3");
    });

    it('should be fast', function () {
      var perfTokens = [];
      // that many token seems to be fast enough
      for(var i=0; i<100; i++) {
          perfTokens.push("2");
          perfTokens.push("-");
      }
      perfTokens.push("3");

      assert.equal(parser.parse(rules, perfTokens), true);
      perfTokens.push("+");
      assert.equal(parser.parse(rules, perfTokens), false);
    });

    it('left recursion should fail', function () {
      // there we see the problem with the lacke of left recursion
      complete(rules, "1+(1+1)");
      incomplete(rules, "(1+1)+1");
    });

});