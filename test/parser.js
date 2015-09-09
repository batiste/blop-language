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



function incomplete(rules, input) {
    var result = parser.parse(rules, input.split(''));
    assert.equal(result, false, input + ' should be incomplete');
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
    });

    it('should reject', function () {
      incomplete(rules, '1+');
      incomplete(rules, '++');
      incomplete(rules, '1-2+11');
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
      // there we see the problem with the lake of left recursion
      complete(rules, "1+(1+1)");
      complete(rules, "(1+1)+1");
    });

});

describe('Left to right parser basics', function() {

    var complete = curryComplete(early);
    var incomplete = curryIncomplete(early);

    var rules = {
        'START': [['math']],
        'NUM': [['1'], ['2'], ['3']],
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
      // there we see the problem with the lake of left recursion
      complete(rules, "1+(1+1)");
      incomplete(rules, "(1+1)+1");
    });

});