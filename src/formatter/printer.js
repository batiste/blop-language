const INLINE_SPACE = new Set(['w', 'wcomment']);
const BREAKABLE = new Set(['single_space_or_newline', 'newline_and_space']);
const NEWLINE = new Set(['newline']);
const INDENT = new Set(['W']);
const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';
const VNODE_OPEN = { type: '__vopen', value: '' };

// Virtual_node has SCOPED_STATEMENTS* between '>' and '</' — just like {…}.
// We inject a synthetic __vopen marker after the opening '>' so the level
// counter increments for the content, matching what '{' does for blocks.
const VNODE_TYPES = new Set(['virtual_node', 'virtual_node_exp']);

function collectLeaves(node, out = []) {
  if (!node) return out;
  if (node.value !== undefined && (!node.children || node.children.length === 0)) {
    out.push(node);
    return out;
  }

  // single_space_or_newline / newline_and_space are breakable separators.
  // Replace with a synthetic __break so the printer can decide space vs newline.
  if (BREAKABLE.has(node.type)) {
    // Track whether the original source had a newline
    // single_space_or_newline contains either: [wcomment?, newline, w?, W?] or [w]
    // newline_and_space contains only: [wcomment?, newline, w?, W?]
    const hadNewline = node.type === 'newline_and_space' || 
                      (node.children && node.children.some(child => child.type === 'newline'));
    out.push({ type: '__break', value: '', hadNewline });
    return out;
  }

  const children = node.children || [];

  if (VNODE_TYPES.has(node.type)) {
    // VNode grammar forms (from grammar.js):
    //   Self-closing:     ['<', 'name:opening', 'virtual_node_attributes*:attrs', 'w?', '/>']
    //   With statements:  ['<', 'name:opening', 'virtual_node_attributes*:attrs', '>', 'SCOPED_STATEMENTS*:stats', '</', 'name:closing', '>']
    //   With expression:  ['<', 'name:opening', 'virtual_node_attributes*:attrs', '>', 'exp:exp', '</', 'name:closing', '>']
    //
    // The .named field provides grammar-aware access to:
    //   - .named.attrs[]       = virtual_node_attributes children (0 or more)
    //   - .named.stats[]       = SCOPED_STATEMENTS children (present in statement-form only)
    //   - .named.exp           = single expression (present in expression-form only)
    //   - .named.closing       = closing tag name (present only if not self-closing)
    
    const attrs = node.named?.attrs;
    const hasAttributes = attrs && attrs.length > 0;
    const hasClosingTag = !!node.named?.closing;
    const hasStatements = !!node.named?.stats;
    const hasExpression = !!node.named?.exp;
    
    let foundOpeningTagClose = false;
    
    for (const child of children) {
      // Inject marker before first attribute to enable special attribute indentation
      if (hasAttributes && !foundOpeningTagClose && child === attrs[0]) {
        out.push({ type: '__vnode_attrs_start', value: '' });
      }
      
      collectLeaves(child, out);
      
      // Inject marker after last attribute to end special attribute indentation
      if (hasAttributes && !foundOpeningTagClose && child === attrs[attrs.length - 1]) {
        out.push({ type: '__vnode_attrs_end', value: '' });
      }
      
      // Inject __vopen after the opening tag's '>' to indent any children/content.
      // This mirrors how '{' increments level for block content.
      // Only inject once and only for non-self-closing tags (which have closing tags).
      if (!foundOpeningTagClose && child.type === '>' && hasClosingTag) {
        out.push(VNODE_OPEN);
        foundOpeningTagClose = true;
      }
    }
    
    return out;
  }

  for (const child of children) {
    collectLeaves(child, out);
  }
  return out;
}

// Measure display length of the next segment (until __break, newline, W, or a
// level-changing token). Used for look-ahead line-length decisions.
function segmentLength(leaves, from) {
  const STOP = new Set(['__break', '__vopen', '__vnode_attrs_start', '__vnode_attrs_end', 'EOS']);
  let len = 0;
  for (let i = from; i < leaves.length; i++) {
    const t = leaves[i];
    if (STOP.has(t.type)) break;
    if (NEWLINE.has(t.type) || INDENT.has(t.type)) break;
    if (INLINE_SPACE.has(t.type)) { len += 1; continue; }
    len += t.value ? t.value.length : 0;
  }
  return len;
}

export class Printer {
  constructor(options = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.maxLineLength = options.maxLineLength ?? 120;
  }

  _indent(level) {
    return this.indentChar.repeat(this.indentSize * Math.max(0, level));
  }

  print(ast) {
    const leaves = collectLeaves(ast);
    const parts = [];
    let level = 0;
    let lineLen = 0;   // current column position
    let needsIndent = false;
    let inVNodeOpening = false;  // tracking if we're inside VNode opening tag (between < and >)

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];

      if (NEWLINE.has(leaf.type)) {
        parts.push('\n');
        lineLen = 0;
        needsIndent = true;
      } else if (INLINE_SPACE.has(leaf.type)) {
        // 'w' tokens are mandatory single spaces in the grammar - always preserve them
        // Only apply delimiter logic to 'wcomment' tokens
        if (leaf.type === 'w') {
          if (!needsIndent) { parts.push(' '); lineLen += 1; }
        } else if (leaf.type === 'wcomment') {
          // Skip wcomment spaces when at the start of a new line or after opening delimiters
          const prevLeaf = i > 0 ? leaves[i - 1] : null;
          const nextLeaf = i < leaves.length - 1 ? leaves[i + 1] : null;
          const prevIsOpenDelim = prevLeaf?.value && ['(', '['].includes(prevLeaf.value);
          const nextIsCloseDelim = nextLeaf?.value && [')', ']', '}'].includes(nextLeaf.value);
          
          if (!needsIndent && !prevIsOpenDelim && !nextIsCloseDelim) {
            parts.push(' ');
            lineLen += 1;
          }
        }
      } else if (leaf.type === '__vnode_attrs_start') {
        // Mark that we're entering a VNode attributes section - attributes should be indented
        inVNodeOpening = true;
      } else if (leaf.type === '__vnode_attrs_end') {
        // Mark that we're exiting a VNode attributes section
        inVNodeOpening = false;
      } else if (leaf.type === '__break') {
        // Breakable separator: emit space or newline+indent based on line length.
        // If the original source had a newline, preserve it.
        const seg = segmentLength(leaves, i + 1);
        const indentLen = this._indent(level).length;
        const shouldBreak = leaf.hadNewline || (lineLen + 1 + seg > this.maxLineLength);
        
        if (shouldBreak) {
          parts.push('\n');
          lineLen = 0;
          needsIndent = true;
        } else {
          if (!needsIndent) { parts.push(' '); lineLen += 1; }
        }
      } else if (INDENT.has(leaf.type)) {
        // W token = existing indentation in source: always replace with computed indent.
        if (needsIndent) {
          // W.value may carry an embedded newline, e.g. "  \n  " for a
          // whitespace-only blank line. Preserve at most one blank line.
          if (leaf.value.includes('\n')) { parts.push('\n'); lineLen = 0; }

          // Look ahead to find next non-whitespace leaf.
          let j = i + 1;
          while (j < leaves.length &&
                 (NEWLINE.has(leaves[j].type) || INLINE_SPACE.has(leaves[j].type) || INDENT.has(leaves[j].type) || 
                  leaves[j].type === '__break' || leaves[j].type === '__vnode_attrs_start' || leaves[j].type === '__vnode_attrs_end')) {
            j++;
          }
          // Use level-1 when the next content closes a brace or VNode.
          const nextType = j < leaves.length ? leaves[j].type : '';
          const nextIsClose = nextType === CLOSE_BRACE || nextType === '</' || nextType === '__vclose';
          // Add extra indentation for VNode opening tag attributes, but NOT for closing tags
          const indentLevel = nextIsClose ? level - 1 : level;
          const attrIndentLevel = (inVNodeOpening && !nextIsClose) ? indentLevel + 1 : indentLevel;
          const ind = this._indent(attrIndentLevel);
          parts.push(ind);
          lineLen = ind.length;
          needsIndent = false;
        }
        // else: W without preceding newline (unusual), skip it.
      } else if (leaf.type === '__vopen') {
        // Synthetic marker injected after a VNode's opening '>'.
        level++;
      } else if (leaf.type === OPEN_BRACE) {
        needsIndent = false;
        parts.push(leaf.value); lineLen += 1;
        level++;
      } else if (leaf.type === CLOSE_BRACE) {
        if (needsIndent) {
          const ind = this._indent(level - 1);
          parts.push(ind); lineLen = ind.length;
          needsIndent = false;
        }
        level--;
        parts.push(leaf.value); lineLen += 1;
      } else if (leaf.type === '</') {
        // VNode closing tag: decrement level so the tag aligns with its opener.
        level--;
        if (needsIndent) {
          const ind = this._indent(level);
          parts.push(ind); lineLen = ind.length;
          needsIndent = false;
        }
        parts.push(leaf.value); lineLen += leaf.value.length;
      } else if (leaf.type === 'EOS') {
        // skip end-of-stream marker
      } else {
        if (needsIndent) {
          // For VNode attributes on their own lines, add extra indentation
          const attrLevel = inVNodeOpening ? level + 1 : level;
          const ind = this._indent(attrLevel);
          parts.push(ind); lineLen = ind.length;
          needsIndent = false;
        }
        parts.push(leaf.value); lineLen += leaf.value.length;
      }
    }

    return parts.join('').trimEnd() + '\n';
  }
}
