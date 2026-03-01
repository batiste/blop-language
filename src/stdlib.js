/**
 * Utilities for resolving Blop standard library (stdlib) imports.
 *
 * Stdlib modules live in src/lib/ and are imported with the 'blop/' prefix:
 *   import { Router } from 'blop/router'
 *   import { go }     from 'blop/navigation'
 *   import create     from 'blop/state'
 *
 * This module is used by the backend code generator, the inference engine,
 * and the Vite / Vitest plugins to resolve those import paths to the actual
 * .blop source files shipped with the blop-language package.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const LIB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib');

/** The namespace prefix that identifies a stdlib import (e.g. 'blop/router'). */
const STDLIB_PREFIX = 'blop/';

/**
 * Returns true when `importPath` is a stdlib import such as 'blop/router'.
 * Does NOT match the bare 'blop' runtime namespace.
 */
function isStdlibImport(importPath) {
  return importPath.startsWith(STDLIB_PREFIX);
}

/**
 * Resolves a stdlib import path to the absolute filesystem path of the
 * corresponding .blop source file.
 *
 * @param {string} importPath - e.g. 'blop/router'
 * @returns {string} absolute path, e.g. '/…/src/lib/router.blop'
 */
function resolveStdlibPath(importPath) {
  const name = importPath.slice(STDLIB_PREFIX.length);
  return path.join(LIB_DIR, name + '.blop');
}

export { LIB_DIR, STDLIB_PREFIX, isStdlibImport, resolveStdlibPath };
