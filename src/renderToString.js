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

// ─── Vnode serializer (no external dependencies) ─────────────────────────────

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// SVG elements that accept children — all others self-close
const SVG_CONTAINER_ELEMENTS = new Set([
  'a', 'defs', 'glyph', 'g', 'marker', 'mask', 'missing-glyph', 'pattern',
  'svg', 'switch', 'symbol', 'text', 'clipPath', 'linearGradient',
  'style', 'script', 'desc', 'metadata', 'title',
]);

const BOOLEAN_ATTRS = new Set([
  'disabled', 'checked', 'readonly', 'required', 'allowfullscreen',
  'autofocus', 'autoplay', 'controls', 'default', 'formnovalidate',
  'hidden', 'ismap', 'loop', 'multiple', 'muted', 'novalidate',
  'open', 'reversed', 'selected',
]);

// DOM properties that must not become HTML attributes
const PROPS_OMIT = new Set([
  'attributes', 'childElementCount', 'children', 'classList', 'clientHeight',
  'clientLeft', 'clientTop', 'clientWidth', 'currentStyle', 'firstElementChild',
  'innerHTML', 'lastElementChild', 'nextElementSibling', 'ongotpointercapture',
  'onlostpointercapture', 'onwheel', 'outerHTML', 'previousElementSibling',
  'runtimeStyle', 'scrollHeight', 'scrollLeft', 'scrollLeftMax', 'scrollTop',
  'scrollTopMax', 'scrollWidth', 'tabStop', 'tagName',
]);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// camelCase → kebab-case; keeps leading `--` for CSS custom properties intact
function toKebab(key) {
  const prefix = key.startsWith('--') ? '--' : '';
  return prefix + (prefix ? key.slice(2) : key).replace(/([A-Z])/g, m => '-' + m.toLowerCase());
}

// Parse a snabbdom CSS-selector string like 'div#app.foo.bar'
function parseSelector(sel) {
  const tagMatch = sel.match(/^([a-zA-Z][a-zA-Z0-9:-]*)/);
  const tagName = tagMatch ? tagMatch[1] : 'div';
  const idMatch = sel.match(/#([^.#[\s]+)/);
  const id = idMatch ? idMatch[1] : '';
  const classes = [];
  const classRe = /\.([^.#[\s]+)/g;
  let m;
  while ((m = classRe.exec(sel)) !== null) classes.push(m[1]);
  return { tagName, id, classes };
}

function vnodeToString(vnode) {
  if (vnode == null) return '';
  // Text-only node
  if (!vnode.sel && typeof vnode.text === 'string') return escapeHtml(vnode.text);

  const data = vnode.data || {};
  const { tagName, id, classes } = parseSelector(vnode.sel || 'div');
  const attrs = new Map();

  if (id) attrs.set('id', id);

  // Classes from selector + data.class boolean map
  const classSet = new Set(classes);
  for (const [k, v] of Object.entries(data.class || {})) {
    if (v) classSet.add(k); else classSet.delete(k);
  }
  if (classSet.size) attrs.set('class', [...classSet].join(' '));

  // data.attrs
  for (const [k, v] of Object.entries(data.attrs || {})) {
    if (v != null && v !== false) attrs.set(k, escapeHtml(v));
  }

  // data.props (DOM property names → HTML attributes)
  for (let [k, v] of Object.entries(data.props || {})) {
    if (PROPS_OMIT.has(k)) continue;
    if (k === 'htmlFor') k = 'for';
    if (k === 'className') k = 'class';
    const lk = k.toLowerCase();
    if (BOOLEAN_ATTRS.has(lk)) { if (v) attrs.set(lk, lk); }
    else if (v != null) attrs.set(lk, escapeHtml(v));
  }

  // data.style → inline style string
  const styleEntries = Object.entries(data.style || {})
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => toKebab(k) + ': ' + escapeHtml(v));
  if (styleEntries.length) attrs.set('style', styleEntries.join('; '));

  // data.dataset → data-* attributes
  for (const [k, v] of Object.entries(data.dataset || {})) {
    attrs.set('data-' + k, escapeHtml(v));
  }

  const attrStr = [...attrs.entries()].map(([k, v]) => k + '="' + v + '"').join(' ');
  const svg = data.ns === 'http://www.w3.org/2000/svg';

  if (tagName === '!') return '<!--' + vnode.text + '-->';

  const open = attrStr ? '<' + tagName + ' ' + attrStr + '>' : '<' + tagName + '>';

  // Void elements and non-container SVG elements don't get a closing tag
  if ((VOID_ELEMENTS.has(tagName) && !svg) || (svg && !SVG_CONTAINER_ELEMENTS.has(tagName))) {
    return open;
  }

  const props = data.props || {};
  let inner = '';
  if (props.innerHTML) inner = props.innerHTML;
  else if (vnode.text) inner = escapeHtml(vnode.text);
  else if (vnode.children) inner = vnode.children.map(vnodeToString).join('');

  return open + inner + '</' + tagName + '>';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Serialize a Snabbdom vnode (as produced by Blop's `h()`) to an HTML string.
 *
 * @param {object} vnode - Snabbdom vnode
 * @returns {string}
 */
function renderToString(vnode) {
  return vnodeToString(vnode);
}

/**
 * Render a Blop component tree to an HTML string.
 *
 * `render` is a zero-argument function that returns a vnode, e.g.:
 *   renderComponentToString(() => Index(state))
 *
 * The runtime's component cache is reset before each call so that
 * concurrent or repeated SSR calls do not bleed state.
 *
 * @param {() => object} render - Function that returns the root vnode
 * @returns {string}
 */
function renderComponentToString(render) {
  return vnodeToString(ssrRender(render));
}

export { renderToString, renderComponentToString };
