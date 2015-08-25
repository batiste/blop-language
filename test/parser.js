var assert = require("assert");
var parser = require("../parser");


function assertTrueRules(rules, input) {
    var result = parser.parse(rules, input.split(''));
    assert.equal(result, true);
}

function assertFalseRules(rules, input) {
    var result = parser.parse(rules, input.split(''));
    assert.equal(result, false);
}

describe('Parser basics', function() {

    var rules = {
        'START': [['math']],
        'NUM': [['1'], ['2'], ['3']],
        'math': [['(', 'math', ')'], ['NUM' , '+', 'math'], ['NUM' , '-', 'math'], ['NUM']]
    };

    it('should accept', function () {
      assertTrueRules(rules, "3");
      assertTrueRules(rules, "1+1");
      assertTrueRules(rules, "1+2-3");
      assertTrueRules(rules, "(1+1)");
      assertTrueRules(rules, "(1-1)");
    });

    it('should reject', function () {
      assertFalseRules(rules, "1+");
      assertFalseRules(rules, "3--2");
      assertFalseRules(rules, "11");
      assertFalseRules(rules, "4");
      assertFalseRules(rules, "3-");
    });

    it('should be fast', function () {
      var perfTokens = [];
      // that many token seems to be fast enough
      for(var i=0; i<1000; i++) {
          perfTokens.push("2");
          perfTokens.push("-");
      }
      perfTokens.push("3");

      assert.equal(parser.parse(rules, perfTokens), true);
      perfTokens.push("+");
      assert.equal(parser.parse(rules, perfTokens), false);
    });

    it('should fail', function () {
      // there we see the problem with the lake of left recursion
      assertFalseRules(rules, "(1+1)+1");
    });

});