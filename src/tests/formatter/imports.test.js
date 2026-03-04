import { describe, it, expect } from 'vitest';
import { format } from '../../formatter/index.js';

describe('import statement formatting', () => {
  describe('named imports', () => {
    it('formats a single named import', () => {
      expect(format('import { foo } from "mod"')).toBe('import { foo } from "mod"\n');
    });

    it('formats multiple named imports', () => {
      expect(format('import { foo, bar, baz } from "mod"')).toBe('import { foo, bar, baz } from "mod"\n');
    });

    it('formats named import with rename (as)', () => {
      expect(format('import { foo as myFoo } from "mod"')).toBe('import { foo as myFoo } from "mod"\n');
    });

    it('formats named imports from a relative path', () => {
      expect(format('import { Component } from "./components/App.blop"')).toBe(
        'import { Component } from "./components/App.blop"\n',
      );
    });
  });

  describe('namespace imports (Blop syntax)', () => {
    it('formats Blop namespace import (import str as name)', () => {
      expect(format("import 'pkg' as m")).toBe("import 'pkg' as m\n");
    });

    it('formats Blop namespace import with relative path', () => {
      expect(format("import '../lib.blop' as lib")).toBe("import '../lib.blop' as lib\n");
    });
  });

  describe('side-effect imports', () => {
    it('formats a bare import (side-effect)', () => {
      expect(format("import 'pkg'")).toBe("import 'pkg'\n");
    });

    it('formats a bare import with double quotes', () => {
      expect(format('import "pkg"')).toBe('import "pkg"\n');
    });
  });

  describe('default (name) import', () => {
    it('formats a default-style import', () => {
      expect(format('import React from "react"')).toBe('import React from "react"\n');
    });
  });

  describe('multiple imports', () => {
    it('formats multiple import statements', () => {
      const src = 'import { a } from "a"\nimport { b } from "b"\nimport { c } from "c"';
      expect(format(src)).toBe('import { a } from "a"\nimport { b } from "b"\nimport { c } from "c"\n');
    });

    it('preserves blank lines between import groups', () => {
      const src = 'import { a } from "a"\n\nimport { b } from "b"';
      const result = format(src);
      expect(result).toBe('import { a } from "a"\n\nimport { b } from "b"\n');
    });
  });

  describe('long import lines', () => {
    it('keeps a short import on one line', () => {
      const result = format('import { alpha, beta, gamma } from "module"');
      expect(result.trim()).not.toContain('\n');
    });

    it('formats a long import with many names', () => {
      const src = 'import { alpha, beta, gamma, delta, epsilon, zeta, eta, theta, iota } from "module"';
      const result = format(src);
      // Should produce valid output regardless of breaking
      expect(result).toContain('import {');
      expect(result).toContain('"module"');
      expect(result.endsWith('\n')).toBe(true);
    });
  });
});
