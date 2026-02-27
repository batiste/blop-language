/**
 * Server-side rendering utilities for Blop.
 *
 * Usage:
 *
 *   import { renderToString, renderComponentToString } from 'blop-language/ssr'
 *
 *   // Render a raw vnode to an HTML string
 *   const html = renderToString(vnode)
 *
 *   // Render a full component tree (render function → vnode → HTML)
 *   const html = renderComponentToString(() => <MyApp />)
 */

import { ssrRender } from './runtime.js';

// Lazily resolved so this module can be loaded in both Node (direct) and inside
// Vite's SSR module runner (which doesn't support createRequire with import.meta.url).
let _toHTML = null;
async function getToHTML() {
  if (!_toHTML) {
    // snabbdom-to-html is CJS; Vite's interop puts the function on .default
    const mod = await import('snabbdom-to-html');
    _toHTML = typeof mod.default === 'function' ? mod.default : mod['module.exports'];
  }
  return _toHTML;
}

/**
 * Serialize a Snabbdom vnode (as produced by Blop's `h()`) to an HTML string.
 *
 * @param {object} vnode - Snabbdom vnode
 * @returns {Promise<string>}
 */
async function renderToString(vnode) {
  const toHTML = await getToHTML();
  return toHTML(vnode);
}

/**
 * Render a Blop component tree to an HTML string.
 *
 * `render` is a zero-argument function that returns a vnode, e.g.:
 *
 *   renderComponentToString(() => <App route={url} />)
 *
 * The runtime's component cache is reset before each call so that
 * concurrent or repeated SSR calls do not bleed state.
 *
 * @param {() => object} render - Function that returns the root vnode
 * @returns {Promise<string>}
 */
async function renderComponentToString(render) {
  const toHTML = await getToHTML();
  const vnode = ssrRender(render);
  return toHTML(vnode);
}

export { renderToString, renderComponentToString };
