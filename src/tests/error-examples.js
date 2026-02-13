/**
 * Test file to demonstrate enhanced error messages
 * 
 * This file contains intentional syntax errors with comments showing
 * how the old vs new error messages would appear.
 */

// ============================================================================
// Example 1: Missing function body
// ============================================================================

/*
OLD ERROR:
  Parser error at line 15 char 20 to 21
  Unexpected ⏎
  Best match was at rule func_def[1][7] async? def name? ( func_def_params:params ) annotation?:annotation w func_body:body 
  token "⏎" (type:newline) doesn't match rule item w

NEW ERROR:
  ✖ Missing function body
  at line 16, column 20

  💡 Suggestion:
  Add a function body after the parameter list:
    def myFunction() {
      // function body here
    }
*/
// def broken(a, b)


// ============================================================================
// Example 2: Missing semicolon (common for JS developers)
// ============================================================================

/*
OLD ERROR:
  Parser error at line 40 char 10 to 11
  Unexpected ;
  Best match was at rule exp_statement[0][0] exp
  token ";" (type:semicolon) doesn't match rule item exp

NEW ERROR:
  ✖ Unexpected semicolon
  at line 41, column 10

  💡 Suggestion:
  Blop doesn't require semicolons. Remove the `;` character.

  ⚡ Quick fix: Remove the semicolon on line 41
*/
// x = 10;


// ============================================================================
// Example 3: Using var/let/const (coming from JavaScript)
// ============================================================================

/*
OLD ERROR:
  Parser error at line 61 char 0 to 3
  Unexpected let
  Best match was at rule GLOBAL_STATEMENT[0] condition
  token "let" (type:name) doesn't match rule item if

NEW ERROR:
  ✖ 'let' keyword not needed
  at line 62, column 0

  💡 Suggestion:
  Blop doesn't use var/let/const. Just assign directly:
    myVar = 10        // instead of: let myVar = 10
    myVar := 20       // explicit reassignment
*/
// let myVar = 10


// ============================================================================
// Example 4: JSX confusion (className instead of class)
// ============================================================================

/*
OLD ERROR:
  Parser error at line 82 char 8 to 17
  Unexpected className
  Best match was at rule virtual_node[...]
  token "className" (type:name) doesn't match expected

NEW ERROR:
  ✖ JSX syntax detected
  at line 83, column 8

  💡 Suggestion:
  Blop uses standard HTML attributes:
    Use `class` instead of `className`
    Use `for` instead of `htmlFor`

  ⚡ Quick fix: Change `className` to `class`
*/
// <div className="test">content</div>


// ============================================================================
// Example 5: Missing closing brace
// ============================================================================

/*
OLD ERROR:
  Parser error at line 105 char 0 to 0
  Unexpected EOS
  Best match was at rule SCOPED_STATEMENT[...]
  token "EOS" (type:EOS) doesn't match expected

NEW ERROR:
  ✖ Unclosed brace
  at line 106, column 0

  💡 Suggestion:
  Add a closing brace `}` to match the opening brace

  ⚡ Quick fix: Add `}` at the end of the block
*/
/*
def unclosed() {
  x = 10
*/


// ============================================================================
// Example 6: Missing 'in' keyword in for loop
// ============================================================================

/*
OLD ERROR:
  Parser error at line 129 char 14 to 19
  Unexpected items
  Best match was at rule for_loop[0][3] for name:value w in exp:exp...
  token "items" (type:name) doesn't match rule item in

NEW ERROR:
  ✖ Missing `in` keyword in for loop
  at line 130, column 14

  💡 Suggestion:
  For loop syntax:
    for item in items { ... }
    for index, item in items { ... }
*/
// for item items { }


// ============================================================================
// Example 7: Missing def keyword
// ============================================================================

/*
OLD ERROR:
  Parser error at line 152 char 0 to 8
  Unexpected myFunction
  Best match was at rule GLOBAL_STATEMENT[...]
  token "myFunction" (type:name) doesn't match expected

NEW ERROR:
  ✖ Missing `def` keyword for function definition
  at line 153, column 0

  💡 Suggestion:
  Use `def` to define functions:
    def myFunction() { ... }
*/
// myFunction() { }


module.exports = {}; // Valid blop to prevent errors when compiling this file
