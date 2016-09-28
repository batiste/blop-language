var assert = require("assert");
var parser = require("../parser");
var early = require("../early");
var tokenizer = require("../tokenizer");

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
          if(list[i].rule_name === rule_name && list[i].consumed === consumed) {
            rules.push(list[i]);
          }
        }
        return rules;
      }

      function byName(pos, rule_name, consumed) {
        var list = reversed[pos];
        var early_items = [];
        for(var i=0; i < list.length; i++) {
          if(list[i].rule_name === rule_name && list[i].consumed <= consumed) {
            early_items.push(list[i]);
          }
        }
        return early_items;
      }

      function getRule(item) {
        return rules[item.rule_name][item.rule_index];
      }

      var id = 1;

      function develop(start, early_item, end, depth) {
        var rule = getRule(early_item);
        console.log(rule);
        var pos = start;
        var node = {
          children: [],
          name: early_item.rule_name,
          id: id,
          rule: rule,
          pos: pos,
          depth: depth,
          end: end
        };
        id++;
        rule.map(function(item) {
          if(rules[item]) {
            // a rule
            var early_items = byName(pos, item, end);
            console.log('--->', pos, item, end, early_items);
            if(early_items.length === 0) {
              return false;
            }
            early_items.map(function(e_item) {
              var result = develop(pos, e_item, e_item.end, depth+1);
              if(result) {
                node.children.push(result);
              }
            });
          } else {
            // not a rule
            node.children.push({name:item});
          }
        });
        return node;
      }

      var possibleStarts = filter(0, 'START', tokens.length);
      console.log('------------');
      console.log(possibleStarts);
      console.log('------------');
      var tree = develop(0, possibleStarts[0], tokens.length, 0);
      console.log(JSON.stringify(tree, null, 2));

    });
});

describe('Left to right, top down parser complex', function() {

    function strDef(input) {
      var first, i, ch;
      first = input.charAt(0);
      if(first === '"' || first === "'") {
        i = 1;
        while(input.charAt(i)){
          ch = input.charAt(i);
          if(ch === '\\') {
            i++;
          } else if(ch === first) {
            return input.slice(0, i + 1);
          }
          i++;
        }
      }
    }

    var tokens = {
      'number': {reg: /^[0-9]+(\.[0-9]*)?/},
      'operator': {reg: /^\+|\-/},
      'name': {reg: /^\w+/},
      '.': {str: '.'},      
      '(': {str: '('},
      ')': {str: ')'},
      'str': {func:strDef}
    };

    var rules = {
        'START': [['exp']],
        'DOTTED_PATH': [['name', '.', 'name'], ['name']],
        'math': [
            ['(', 'math', ')', 'operator', 'math'], 
            ['(', 'math', ')'],
            ['number' , 'operator', 'math'],
            ['number']],
        'exp': [
          ['DOTTED_PATH', 'operator', 'exp'],
          ['DOTTED_PATH'],
          ['math', 'operator', 'exp'],
          ['str', 'operator', 'exp'],
          ['math'],
          ['str']
        ]
    };

    function complete(rules, input) {
      var stream = tokenizer.tokenize(tokens, input);
      var result = parser.parse(rules, stream, false);
      assert.equal(result, true, input + ' should be complete');
    }

    function incomplete(rules, input) {
      var stream = tokenizer.tokenize(tokens, input);
      var result = parser.parse(rules, stream, false);
      assert.equal(result, false, input + ' should be incomplete');
    }

    it('should accept', function () {
      complete(rules, "1+1");
      complete(rules, "(1)");
      complete(rules, "((1))");
      complete(rules, "(1+1)+1");
      complete(rules, "(1+1+1)");
      complete(rules, "hello");
      complete(rules, "hello.plop");
      complete(rules, "hello.plop+1");
      complete(rules, "hello+(1+1)");
      complete(rules, "(1+1)+hello");
      complete(rules, "(1+1)+hello.plop");
      complete(rules, "1.+2.");
      complete(rules, "1.090+1212.12312");
      complete(rules, "'my string'+'my other'");
    });

    it('should not accept', function () {
      incomplete(rules, "(()))");
      incomplete(rules, "1++");
    });

  describe('Tokenizer', function() {
    var tokens = {
      'number': {reg: /^[0-9]+/},
      'operator': {reg: /^\+|\-/},
      '(': {str: '('},
      ')': {str: ')'}
    };

    var r = tokenizer.tokenize(tokens, '(12+13)');
    assert.equal(r[0].value, '(');
    assert.equal(r[1].value, '12');
    assert.equal(r[2].value, '+');
    assert.equal(r[3].value, '13');
    assert.equal(r[4].value, ')');

  });


});