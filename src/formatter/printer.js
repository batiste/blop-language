const INLINE_SPACE = new Set(['w', 'single_space_or_newline', 'newline_and_space', 'wcomment']);
const NEWLINE = new Set(['newline']);
const INDENT = new Set(['W']);
const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';

function collectLeaves(node, out = []) {
  if (!node) return out;
  if (node.value !== undefined && (!node.children || node.children.length === 0)) {
    out.push(node);
    return out;
  }
  for (const child of node.children || []) {
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
          // Look ahead to find next non-whitespace leaf.
          let j = i + 1;
          while (j < leaves.length &&
                 (NEWLINE.has(leaves[j].type) || INLINE_SPACE.has(leaves[j].type) || INDENT.has(leaves[j].type))) {
            j++;
          }
          const nextIsClose = j < leaves.length && leaves[j].type === CLOSE_BRACE;
          parts.push(this._indent(nextIsClose ? level - 1 : level));
          needsIndent = false;
        }
        // else: W without preceding newline (unusual), skip it.
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
