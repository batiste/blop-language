import { expectCompiles } from '../testHelpers.js';

describe('VNode property access inference', () => {
  test('infers VNode type for JSX elements', () => {
    const code = `
      backLink = <p>1</p>
    `;
    expectCompiles(code);
  });

  test('infers correct type for VNode.elm property access', () => {
    const code = `
      backLink = <p>1</p>
      content = backLink.elm
    `;
    expectCompiles(code);
  });

  test('infers correct type for VNode.sel property access', () => {
    const code = `
      node = <div />
      selector = node.sel
    `;
    expectCompiles(code);
  });

  test('infers correct type for VNode.text property access', () => {
    const code = `
      node = <div />
      text = node.text
    `;
    expectCompiles(code);
  });

  test('infers correct type for VNode.children property access', () => {
    const code = `
      node = <div />
      children = node.children
    `;
    expectCompiles(code);
  });

  test('infers correct type for VNode.data property access', () => {
    const code = `
      node = <div />
      data = node.data
    `;
    expectCompiles(code);
  });

  test('infers correct type for VNode.key property access', () => {
    const code = `
      node = <div />
      key = node.key
    `;
    expectCompiles(code);
  });
});

