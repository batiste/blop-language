


function assertTrue(a, msg) {
	if(a !== true) {
		throw "(" + a + ") is not true";
	}
}

function assertFalse(a, msg) {
	if(a !== false) {
		throw "(" + a + ") is not false";
	}
}

var rules = {
	'START': [['math']],
	'NUM': [['1'], ['2'], ['3']],
	'math': [['NUM' , '+', 'math'], ['math' , '-', 'math'], ['NUM']]
};

//assertTrue(parse(rules, ["3"], true));
assertFalse(parse(rules, ["9"], true));
/*assertFalse(parse(rules, ["1", '+'], true));
assertTrue(parse(rules, ["1", '+', "1"], true));
assertTrue(parse(rules, ["1", '+', "1", "-", "1"]));
assertTrue(parse(rules, ["3", '-', "3", "-", "1"]));
assertFalse(parse(rules, ["3", '-', "3", "-", "-", "1"]));
assertFalse(parse(rules, ["1", "1"]));*/

function parse(rules, stream, debug) {

	var stack = [];
	var memoization = {};
	var stream_index = 0;
	var sub_rule_index = 0;
	var sub_rule_token_index = 0;
	var current_rule = rules.START;
	var token;

	function print() {
		if(debug) {
			console.log.apply(console, arguments);
		}
	}

	function printStack(msg) {
		print(msg + "[", stack.length, "] -------> ", current_rule, sub_rule_index, sub_rule_token_index, stream_index);
	}

	function popStack() {
		if(stack.length === 0) {
			throw "Stack empty";
		}
		var tmp = stack.pop();
		current_rule = tmp[0];
		sub_rule_index = tmp[1];
		sub_rule_token_index = tmp[2];
		stream_index = tmp[3];
		printStack("Restore");
	}
	function pushStack() {
		stack.push([current_rule, sub_rule_index, sub_rule_token_index, stream_index]);
		printStack("Save");
	}
	function ruleItem() { return current_rule[sub_rule_index][sub_rule_token_index]; }
	function backtrack(msg) {
		if(stack.length === 0) {
			throw "Stack empty";
		}
		printStack(msg);
		popStack();
	}
	function ruleAlreadyInStack() {
	  // avoid infinite recursion
	  // This is faster than filter
	  var i = stack.length - 1;
	  console.log()
	  while(i >= 0) {
	    if(stack[i][0] === current_rule
	        && stack[i][1] === sub_rule_index 
	        && stack[i][2] === sub_rule_token_index 
	        && stack[i][3] === stream_index) {
	      return true;
	    }
	    i = i-1;
	  }
	  return false;
	}

	var j = 0;

	while(true) {

		if(ruleAlreadyInStack()) {
			backtrack('Rule already in stack');
			stream_index = stream_index - sub_rule_token_index;
			sub_rule_token_index = 0;
			sub_rule_index++;
			continue;
		}

		// backtrack if no rule
		while(!current_rule[sub_rule_index]) {
			if(stack.length === 0) {
				print("Stack is empty, failure to match");
				return false;
			}
			backtrack('No more sub rules');
			stream_index = stream_index - sub_rule_token_index;
			sub_rule_token_index = 0;
			sub_rule_index++;
			printStack("Next sub rule");
		}

		// test satisfaction of the current rule
		if(sub_rule_token_index >= current_rule[sub_rule_index].length) {

			print('Rule satisfied: ', current_rule[sub_rule_index], " Stack depth: ", stack.length);

			// rule satified so we pop to get the previous rule but with the stream_index forward
			var tmp = stream_index;
			printStack("Before");
			popStack();

			stream_index = tmp;
			sub_rule_token_index++;

			printStack("Forward");

			if(stack.length === 0) {
				print("Stack empty");
				if(stream_index == stream.length) {
					print("All tokens consumed");
					return true;
				}
				print("Token not consumed", stream.length - stream_index, ' Last token ', stream[stream_index]);
				return false;
			}

			continue;
		}

		token = stream[stream_index];
		rule_item = ruleItem();

		if(!token) {
			printStack('Token exhausted');
			stream_index = stream_index - sub_rule_token_index;
			sub_rule_token_index = 0;
			sub_rule_index++;
			printStack("Next sub rule");
			continue;
		}

		print('Rule item: ', rule_item);
		print('    Token: ', token);

		// Rules case
		if(rules[rule_item]) {

			print('Expand the new rule', rule_item);

			// save the current state
			pushStack();
			if(!ruleAlreadyInStack()) {
				console.log("Error");
				return;
			}

			current_rule = rules[rule_item];
			sub_rule_token_index = 0;
			sub_rule_index = 0;

			continue;

		// Token case
		} else {
			// Token does match
 			if(rule_item === token) {
 				print('Token match');
				sub_rule_token_index++;
				stream_index++;
			// Token doesn't match, next sub rule
			} else {
				stream_index = stream_index - sub_rule_token_index;
				sub_rule_token_index = 0;
				sub_rule_index++;
				print("Token mismatch, next sub rule:", current_rule[sub_rule_index]);
			}
			continue;
		}

	}
}