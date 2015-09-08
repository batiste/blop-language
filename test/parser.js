var assert = require("assert");
var parser = require("../parser");
var early = require("../early");

describe('Early parser basics', function() {

    var rules = {
        'START': [['math']],
        'NUM': [['1']],
        'math': [['math' , '+', 'math'], ['NUM']]
    };

    it('Prediction function', function () {
      var result = early.main(rules, ['1']);
      assert.equal(result, true);

      result = early.main(rules, ['1', '+', '1']);
      assert.equal(result, true);

      result = early.main(rules, ['1', '+']);
      assert.equal(result, false);

      result = early.main(rules, ['1', '1']);
      assert.equal(result, false);

      result = early.main(rules, ['1', '+', '1', '+', '1']);
      assert.equal(result, true);

      result = early.main(rules, ['+', '1', '+']);
      assert.equal(result, false);

    });
});

function assertComplete(rules, input) {
    var result = parser.parse(rules, input.split(''));
    assert.equal(result, true, input + ' should be complete');
}

function assertIncomplete(rules, input) {
    var result = parser.parse(rules, input.split(''));
    assert.equal(result, false, input + ' should be incomplete');
}

describe('Parser basics', function() {

    var rules = {
        'START': [['math']],
        'NUM': [['1'], ['2'], ['3']],
        'math': [['(', 'math', ')'], ['NUM' , '+', 'math'], ['NUM' , '-', 'math'], ['NUM']]
    };

    it('should accept', function () {
      assertComplete(rules, "3");
      assertComplete(rules, "1+1");
      assertComplete(rules, "1+2-3");
      assertComplete(rules, "(1+1)");
      assertComplete(rules, "(1-1)");
      assertComplete(rules, "(((2)))");
    });

    it('should reject', function () {
      assertIncomplete(rules, "1+");
      assertIncomplete(rules, "3--2");
      assertIncomplete(rules, "11");
      assertIncomplete(rules, "4");
      assertIncomplete(rules, "3-");
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

    it('should fail', function () {
      // there we see the problem with the lake of left recursion
      assertComplete(rules, "1+(1+1)");
      assertIncomplete(rules, "(1+1)+1");
    });

});