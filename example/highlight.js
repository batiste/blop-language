// Syntax highlighting via Shiki using the Blop TextMate grammar from the VSCode extension.
// Uses shiki/core + JS regex engine (no WASM, no full language registry) so the
// build only includes the two grammars we actually need.

import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langJsx from 'shiki/langs/jsx.mjs'
import themeGithubDark from 'shiki/themes/github-dark.mjs'
import blopGrammar from '../vscode/blop-syntax-highlighter/blop.json'

let highlighterPromise = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [themeGithubDark],
      langs: [
        langJsx,
        // Custom Blop language from the VSCode syntax highlighter extension
        { ...blopGrammar, name: 'blop' },
      ],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

// Inject extra inline styles into Shiki's generated <pre> element.
function patchPre(html, extraStyles) {
  return html.replace(/(<pre[^>]*style=")/, `$1${extraStyles}`)
}

/**
 * Highlight a code snippet for a static code block (ShowcasePage CodeBlock).
 */
export async function highlightCode(code, lang = 'blop', borderRadius = '6px') {
  const highlighter = await getHighlighter()
  const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' })
  const extra = `border-radius:${borderRadius};overflow-x:auto;padding:1.25em 1.5em;font-size:0.875em;line-height:1.65;margin:0;`
  return patchPre(html, extra)
}

/**
 * Highlight a code snippet for use as a positioned underlay inside an editor container.
 * The <pre> is absolutely positioned so a transparent textarea can be laid on top.
 */
export async function highlightCodeForEditor(code, lang = 'blop') {
  const highlighter = await getHighlighter()
  const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' })
  const extra = [
    'position:absolute;top:0;left:0;right:0;bottom:0;',
    'overflow:hidden;pointer-events:none;z-index:1;',
    'margin:0;border-radius:0;',
    "padding:1.25em 1.5em;font-size:13px;line-height:1.65;",
    "font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;",
    'white-space:pre;',
  ].join('')
  return patchPre(html, extra)
}

/**
 * Highlight a code snippet for the output panel (fixed height, scrollable).
 */
export async function highlightCodeForOutput(code, lang = 'javascript', height = '520px') {
  const highlighter = await getHighlighter()
  const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' })
  const extra = `border-radius:0;overflow:auto;padding:1.25em 1.5em;font-size:13px;line-height:1.65;margin:0;height:${height};`
  return patchPre(html, extra)
}
