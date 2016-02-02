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

      var tokens = '1+2'.split('');

      var r = early.parse(rules, tokens);

      console.log(tokens);

      var sets = early.getSets();
      console.log(sets);
      assert.equal(r, true);

      function reverse_and_cleanup(sets) {
        var items = {};
        for(var i=0; i<sets.length; i++) {
          for(var j=0; j<sets[i].length; j++) {
            var item = sets[i][j];
            if(item.c) {
              var new_item = {
                rule_name: item.rule_name,
                rule_index: item.rule_index,
                parsed: item.parsed,
                start: item.start,
                end: item.start + item.parsed - 1,
                consumed: i
              };
              if(!items[item.start]) {
                items[item.start] = [];
              }
              items[item.start].push(new_item);
            }
          }
        }
        return items;
      }

      console.log('-- Reversed and cleanup version --');
      reversed = reverse_and_cleanup(sets);
      console.log(reversed);
      console.log('----');

      function filter(pos, rule_name, consumed) {
        var list = reversed[pos];
        var rules = [];
        for(var i=0; i < list.length; i++) {
          if(list[i].rule_name == rule_name && list[i].consumed == consumed) {
            rules.push(list[i]);
          }
        }
        return rules;
      }

      function byName(pos, rule_name, consumed) {
        var list = reversed[pos];
        var early_items = [];
        for(var i=0; i < list.length; i++) {
          if(list[i].rule_name == rule_name && list[i].consumed <= consumed) {
            early_items.push(list[i]);
          }
        }
        return early_items;
      }

      var possibleStarts = filter(0, 'START', tokens.length);


      function develop(start, early_item, end) {
        
      }

      //console.log(possible_starts);
      //var tree = develop(0, possible_starts[0]);

      //console.log(JSON.stringify(tree, null, 2));

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