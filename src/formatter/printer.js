const INLINE_SPACE = new Set(['w', 'single_space_or_newline', 'newline_and_space', 'wcomment']);
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

  const children = node.children || [];

  if (VNODE_TYPES.has(node.type)) {
    // Only non-self-closing variants have a '</' child.
    const hasClosingTag = children.some(c => c.type === '</');
    if (hasClosingTag) {
      let injectedOpen = false;
      for (const child of children) {
        collectLeaves(child, out);
        // The first direct '>' child is the opening tag's closer.
        if (!injectedOpen && child.type === '>') {
          out.push(VNODE_OPEN);
          injectedOpen = true;
        }
      }
      return out;
    }
  }

  for (const child of children) {
    collectLeaves(child, out);
  }
  return out;
}

export class Printer {
  constructor(options = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
  }

  _indent(level) {
    return this.indentChar.repeat(this.indentSize * Math.max(0, level));
  }

  print(ast) {
    const leaves = collectLeaves(ast);
    const parts = [];
    let level = 0;
    // After a newline, we must emit indentation before the next content token.
    // This handles both indented source (has W tokens) and flat source (no W).
    let needsIndent = false;

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];

      if (NEWLINE.has(leaf.type)) {
        parts.push('\n');
        needsIndent = true;
      } else if (INLINE_SPACE.has(leaf.type)) {
        // Skip inline spaces when at the start of a new line.
        if (!needsIndent) parts.push(' ');
      } else if (INDENT.has(leaf.type)) {
        // W token = existing indentation in source: always replace with computed indent.
        if (needsIndent) {
          // W.value may carry an embedded newline, e.g. "  \n  " for a
          // whitespace-only blank line. Preserve at most one blank line.
          if (leaf.value.includes('\n')) parts.push('\n');

          // Look ahead to find next non-whitespace leaf.
          let j = i + 1;
          while (j < leaves.length &&
                 (NEWLINE.has(leaves[j].type) || INLINE_SPACE.has(leaves[j].type) || INDENT.has(leaves[j].type))) {
            j++;
          }
          // Use level-1 when the next content closes a brace or VNode.
          const nextType = j < leaves.length ? leaves[j].type : '';
          const nextIsClose = nextType === CLOSE_BRACE || nextType === '</' || nextType === '__vclose';
          parts.push(this._indent(nextIsClose ? level - 1 : level));
          needsIndent = false;
        }
        // else: W without preceding newline (unusual), skip it.
      } else if (leaf.type === '__vopen') {
        // Synthetic marker injected after a VNode's opening '>'.
        level++;
      } else if (leaf.type === OPEN_BRACE) {
        needsIndent = false;
        parts.push(leaf.value);
        level++;
      } else if (leaf.type === CLOSE_BRACE) {
        if (needsIndent) {
          // '}' directly after newline, no W token — emit closing indent.
          parts.push(this._indent(level - 1));
          needsIndent = false;
        }
        level--;
        parts.push(leaf.value);
      } else if (leaf.type === '</') {
        // VNode closing tag: decrement level so the tag aligns with its opener.
        level--;
        if (needsIndent) {
          parts.push(this._indent(level));
          needsIndent = false;
        }
        parts.push(leaf.value);
      } else if (leaf.type === 'EOS') {
        // skip end-of-stream marker
      } else {
        if (needsIndent) {
          parts.push(this._indent(level));
          needsIndent = false;
        }
        parts.push(leaf.value);
      }
    }

    return parts.join('').trimEnd() + '\n';
  }
}
