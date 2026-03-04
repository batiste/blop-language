import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('VNode formatting edge cases', () => {
  describe('self-closing tags', () => {
    it('formats a plain self-closing tag', () => {
      expect(format('def C() {\n<br />\n}')).toBe('def C() {\n  <br />\n}\n');
    });

    it('formats a self-closing tag with one attribute', () => {
      expect(format('def C() {\n<input type="text" />\n}')).toBe('def C() {\n  <input type="text" />\n}\n');
    });

    it('formats a self-closing tag with many attributes', () => {
      const src = 'def C() {\n<input type="text" name="email" placeholder="Email" required />\n}';
      const result = format(src);
      expect(result).toContain('<input');
      expect(result).toContain('/>');
      expect(result.endsWith('\n')).toBe(true);
    });
  });

  describe('tags with children', () => {
    it('formats a tag with a text expression child', () => {
      expect(format('def C() {\n<p>label</p>\n}')).toBe('def C() {\n  <p>label</p>\n}\n');
    });

    it('formats a tag containing another tag', () => {
      expect(format('def C() {\n<div>\n<span>text</span>\n</div>\n}')).toBe(
        'def C() {\n  <div>\n    <span>text</span>\n  </div>\n}\n',
      );
    });

    it('formats three levels of nesting', () => {
      const src = 'def C() {\n<section>\n<article>\n<p>content</p>\n</article>\n</section>\n}';
      expect(format(src)).toBe(
        'def C() {\n  <section>\n    <article>\n      <p>content</p>\n    </article>\n  </section>\n}\n',
      );
    });

    it('formats sibling elements', () => {
      const src = 'def C() {\n<div>\n<h1>title</h1>\n<p>body</p>\n</div>\n}';
      const result = format(src);
      const lines = result.split('\n');
      expect(lines[2]).toBe('    <h1>title</h1>');
      expect(lines[3]).toBe('    <p>body</p>');
    });
  });

  describe('attributes', () => {
    it('formats a tag with a boolean attribute', () => {
      const src = 'def C() {\n<button disabled>text</button>\n}';
      const result = format(src);
      expect(result).toContain('disabled');
    });

    it('formats a tag with a dynamic attribute value', () => {
      expect(format('def C() {\n<div class=className>content</div>\n}')).toBe(
        'def C() {\n  <div class=className>content</div>\n}\n',
      );
    });

    it('formats a tag with a string attribute', () => {
      expect(format('def C() {\n<a href="https://example.com">link</a>\n}')).toBe(
        'def C() {\n  <a href="https://example.com">link</a>\n}\n',
      );
    });
  });

  describe('VNode mixed with control flow', () => {
    it('formats a VNode inside an if block', () => {
      const src = 'def C() {\nif show {\n<span>visible</span>\n}\n}';
      expect(format(src)).toBe('def C() {\n  if show {\n    <span>visible</span>\n  }\n}\n');
    });

    it('formats VNodes in if/else branches', () => {
      const src = "def C() {\nif loading {\n<span>'Loading'</span>\n} else {\n<div>content</div>\n}\n}";
      expect(format(src)).toBe(
        "def C() {\n  if loading {\n    <span>'Loading'</span>\n  } else {\n    <div>content</div>\n  }\n}\n",
      );
    });

    it('formats a VNode inside a for loop', () => {
      const src = 'def C() {\n<ul>\nfor item in items {\n<li>item</li>\n}\n</ul>\n}';
      const result = format(src);
      expect(result).toContain('<ul>');
      expect(result).toContain('for item in items {');
      expect(result).toContain('<li>item</li>');
      expect(result).toContain('</ul>');
    });
  });

  describe('VNode string content', () => {
    it('formats a tag with a string literal child', () => {
      expect(format("def C() {\n<p>'Static text'</p>\n}")).toBe(
        "def C() {\n  <p>'Static text'</p>\n}\n",
      );
    });

    it('formats a tag with Blop string interpolation', () => {
      expect(format("def C() {\n<p>'Hello 'name</p>\n}")).toBe(
        "def C() {\n  <p>'Hello 'name</p>\n}\n",
      );
    });
  });

  describe('VNode idempotency', () => {
    it('repeated formatting of a simple vnode is stable', () => {
      const src = 'def C() {\n<div class="main">\n<p>text</p>\n</div>\n}';
      const first = format(src);
      expect(format(first)).toBe(first);
    });

    it('repeated formatting of nested vnodes is stable', () => {
      const src = 'def C() {\n<section>\n<article>\n<h1>title</h1>\n<p>body</p>\n</article>\n</section>\n}';
      const first = format(src);
      expect(format(first)).toBe(first);
    });
  });
});
