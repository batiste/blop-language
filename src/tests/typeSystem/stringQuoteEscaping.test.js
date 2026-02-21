import { expectCompiles } from '../testHelpers.js';

describe('String quote escaping - Regression tests', () => {
  test('handles single quotes inside double-quoted strings', () => {
    const code = `msg = "Enter 'value"`;
    expectCompiles(code);
  });

  test('handles double quotes inside single-quoted strings', () => {
    const code = `msg = 'He said "hello"'`;
    expectCompiles(code);
  });

  test('handles mixed quotes in assignment', () => {
    const code = `
      msg1 = "It's working"
      msg2 = 'He said "yes"'
      msg3 = "Don't let me down"
    `;
    expectCompiles(code);
  });

  test('handles quotes in JSX string attributes', () => {
    const code = `
      input = <input placeholder="Enter 'value" />
      button = <button title='Click "here"'>'Do it'</button>
    `;
    expectCompiles(code);
  });

  test('handles multiple quoted attributes on same element', () => {
    const code = `
      elem = <div data-msg="It's ready" title='He said "go"' placeholder="Enter 'text'"></div>
    `;
    expectCompiles(code);
  });

  test('handles quotes in string concatenation', () => {
    const code = `
      msg = "Don't " + 'worry "too" much'
    `;
    expectCompiles(code);
  });

  test('handles quotes in backtick strings', () => {
    const code = `
      template = \`He said "yes" and I'm happy\`
      value = \`It's a 'test'\`
    `;
    expectCompiles(code);
  });

  test('handles quotes in embedded expressions within strings', () => {
    const code = `
      name = "Alice"
      greeting = 'Say "hello" to 'name
    `;
    expectCompiles(code);
  });

  test('handles quotes in console output', () => {
    const code = `
      console.log("Don't panic")
      console.log('He said "hi"')
    `;
    expectCompiles(code);
  });

  test('handles quotes in object properties', () => {
    const code = `
      obj = {
        message: "It's working",
        title: 'He said "hello"',
        note: "Don't worry 'too' much"
      }
    `;
    expectCompiles(code);
  });

  test('handles quotes in array elements', () => {
    const code = `
      items = [
        "Don't stop",
        'He said "yes"',
        "It's 'great'"
      ]
    `;
    expectCompiles(code);
  });

  test('handles quotes in component attributes with expressions', () => {
    const code = `
      def MyComponent(attributes) {
        { message, title } = attributes
        <div title=title>
          = message
        </div>
      }
      
      element = <MyComponent message="It's working" title='Click "here"' />
    `;
    expectCompiles(code);
  });

  test('handles quotes with escaped characters', () => {
    const code = `
      path = "C:\\Users\\John\\'s Folder"
      pattern = 'Line with \\n newline and \\'escaped\\' quotes'
    `;
    expectCompiles(code);
  });

  test('handles empty strings with different quote styles', () => {
    const code = `
      empty1 = ""
      empty2 = ''
      empty3 = \`\`
    `;
    expectCompiles(code);
  });

  test('handles strings with only quotes as content', () => {
    const code = `
      onlyDouble = "\\""
      onlySingle = "'"
      mixed = 'He said " and I\\'m done'
    `;
    expectCompiles(code);
  });

  test('handles backticks with single and double quotes', () => {
    const code = `
      template1 = \`It's a "test"\`
      template2 = \`Don't "worry" about it\`
      template3 = \`'Single' and "double" quotes\`
    `;
    expectCompiles(code);
  });

  test('handles multiline double-quoted strings', () => {
    const code = `
      msg = "Line 1
Line 2
It's in the middle"
    `;
    expectCompiles(code);
  });

  test('handles multiline single-quoted strings', () => {
    const code = `
      msg = 'Line 1
He said "yes"
Line 3'
    `;
    expectCompiles(code);
  });

  test('handles multiline backtick strings', () => {
    const code = `
      template = \`Line 1 with 'quotes'
Line 2 with "quotes"
Line 3\`
    `;
    expectCompiles(code);
  });

  test('handles quotes in multiline JSX attributes', () => {
    const code = `
      elem = <div title="It's a
multiline
string"></div>
    `;
    expectCompiles(code);
  });

  test('handles backtick expressions with quotes', () => {
    const code = `
      name = 'Alice'
      msg = \`Hello \`name\`! It's \`'grand'\`\`
    `;
    expectCompiles(code);
  });

  test('handles complex nested quote scenarios', () => {
    const code = `
      obj = {
        single: "He's 'here'",
        double: 'She said "hello"',
        template: \`They said 'yes' and "agreed"\`
      }
    `;
    expectCompiles(code);
  });
});
