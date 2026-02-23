const WHITESPACE_TYPES = new Set(['w', 'W', 'newline', 'single_space_or_newline', 'newline_and_space']);

function isWhitespace(node) { return WHITESPACE_TYPES.has(node.type); }

function rawValue(node) {
  if (!node) return '';
  if (node.value !== undefined && !node.children?.length) return node.value;
  return (node.children || []).map(rawValue).join('');
}

function firstContent(node) {
  return (node.children || []).find(c => !isWhitespace(c));
}

function contentChildren(node) {
  return (node.children || []).filter(c => !isWhitespace(c));
}

function hasFuncCall(node) {
  if (!node) return false;
  if (node.type === 'func_call') return true;
  return (node.children || []).some(hasFuncCall);
}

function collectCallArgs(node) {
  if (!node) return [];
  const children = node.children || [];
  if (children[1]?.type === '=') return [rawValue(node).trim()];
  const exp = children.find(c => c.type === 'exp');
  const rest = children.find(c => c.type === 'func_call_params');
  return exp ? [rawValue(exp).trim(), ...collectCallArgs(rest)] : [];
}

function collectArrayItems(node) {
  if (!node) return [];
  const children = node.children || [];
  const exp = children.find(c => c.type === 'exp');
  const rest = children.find(c => c.type === 'array_literal_body');
  return exp ? [rawValue(exp).trim(), ...collectArrayItems(rest)] : [];
}

function collectObjectProps(node) {
  if (!node) return [];
  const children = node.children || [];
  if (!children.length) return [];
  const rest = children.find(c => c.type === 'object_literal_body');
  if (children[0]?.type === 'spread') {
    const spreadExp = children.find(c => c.type === 'exp');
    return [`...${spreadExp ? rawValue(spreadExp).trim() : ''}`, ...collectObjectProps(rest)];
  }
  const key = children.find(c => c.type === 'object_literal_key');
  if (!key) return [];
  const keyStr = rawValue(key).trim();
  const colonIdx = children.findIndex(c => c.type === 'colon');
  let propStr;
  if (colonIdx >= 0) {
    const valueExp = children.slice(colonIdx + 1).find(c => c.type === 'exp');
    propStr = `${keyStr}: ${valueExp ? rawValue(valueExp).trim() : ''}`;
  } else {
    propStr = keyStr;
  }
  return [propStr, ...collectObjectProps(rest)];
}

export class Printer {
  constructor(options = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.maxLineLength = options.maxLineLength ?? 120;
    this.indentLevel = 0;
    this._lineOffset = 0;
  }

  get currentIndent() {
    return this.indentChar.repeat(this.indentSize * this.indentLevel);
  }

  indent() { this.indentLevel++; }
  dedent() { this.indentLevel--; }

  _tooLong(flat) {
    return this._lineOffset + flat.length > this.maxLineLength;
  }

  _withOffset(offset, fn) {
    const prev = this._lineOffset;
    this._lineOffset = offset;
    const result = fn();
    this._lineOffset = prev;
    return result;
  }

  print(ast) {
    return this.printNode(ast).trimEnd() + '\n';
  }

  printNode(node) {
    if (!node) return '';
    const handler = this[node.type];
    if (typeof handler === 'function') return handler.call(this, node);
    return rawValue(node).trim();
  }

  START(node) {
    const stmts = this._collectGlobalStatements(node);
    return stmts.map(s => this.printNode(s)).join('\n\n');
  }

  _collectGlobalStatements(node) {
    const results = [];
    for (const child of node.children || []) {
      if (child.type === 'GLOBAL_STATEMENT') results.push(child);
      else if (child.type === 'GLOBAL_STATEMENTS') results.push(...this._collectGlobalStatements(child));
    }
    return results;
  }

  GLOBAL_STATEMENT(node) {
    this._lineOffset = this.currentIndent.length;
    const stmt = firstContent(node);
    return stmt ? this.printNode(stmt) : '';
  }

  exp_statement(node) {
    const exp = (node.children || []).find(c => c.type === 'exp');
    return exp ? this.printNode(exp) : '';
  }

  exp(node) {
    const inner = firstContent(node);
    return inner ? this.printNode(inner) : '';
  }

  assign(node) {
    const nameNode = node.named?.name ?? node.children?.find(c => c.type === 'name');
    const name = nameNode?.value ?? rawValue(nameNode).trim();
    const expNode = node.named?.exp;
    const prefix = `${name} = `;
    const expStr = this._withOffset(this._lineOffset + prefix.length, () =>
      expNode ? this.printNode(expNode) : ''
    );
    return `${prefix}${expStr}`;
  }

  func_def(node) {
    const name = node.named.name?.value ?? '';
    const params = node.named.params ? this._printParams(node.named.params) : '';
    const body = node.named.body ? this._printFuncBody(node.named.body) : '{}';
    return `def ${name}(${params}) ${body}`;
  }

  _printParams(node) {
    return (node.children || []).filter(c => c.type === 'name').map(c => c.value).join(', ');
  }

  _printFuncBody(node) {
    return this._printStatsBlock(node.named.stats ?? []);
  }

  _printStatsBlock(statsArray) {
    const statements = this._extractScopedStatements(statsArray);
    this.indent();
    const lines = statements.map(s => {
      this._lineOffset = this.currentIndent.length;
      return `${this.currentIndent}${this._printScopedStatement(s)}`;
    });
    this.dedent();
    return `{\n${lines.join('\n')}\n${this.currentIndent}}`;
  }

  _extractScopedStatements(statsArray) {
    const results = [];
    for (const ss of statsArray) {
      const stmt = (ss.children || []).find(c => c.type === 'SCOPED_STATEMENT');
      if (stmt) results.push(stmt);
    }
    return results;
  }

  _printScopedStatement(node) {
    const children = contentChildren(node);
    if (!children.length) return '';
    const first = children[0];
    if (first.type === 'return') {
      const exp = children[1];
      const prefix = 'return ';
      const expStr = exp
        ? this._withOffset(this._lineOffset + prefix.length, () => this.printNode(exp))
        : '';
      return `return${expStr ? ' ' + expStr : ''}`;
    }
    if (first.type === 'condition') return this._printCondition(first);
    if (first.type === 'assign') return this.assign(first);
    if (first.type === 'exp_statement') return this.exp_statement(first);
    return children.map(c => this.printNode(c)).join(' ');
  }

  _printCondition(node) {
    const exp = node.named.exp ? this.printNode(node.named.exp) : '';
    const body = this._printStatsBlock(node.named.stats ?? []);
    let result = `if ${exp} ${body}`;
    if (node.named.elseif) result += this._printElseIf(node.named.elseif);
    return result;
  }

  _printElseIf(node) {
    const body = this._printStatsBlock(node.named.stats ?? []);
    return ` else ${body}`;
  }

  name_exp(node) {
    const flat = rawValue(node).trim();
    if (!this._tooLong(flat) || !hasFuncCall(node)) return flat;
    // Thread accumulated prefix length into _lineOffset as we walk
    return (node.children || []).reduce((result, c) => {
      if (isWhitespace(c)) return result;
      if (c.type === 'access_or_operation') {
        return result + this._withOffset(this._lineOffset + result.length, () =>
          this._printAccessOrOp(c)
        );
      }
      return result + rawValue(c);
    }, '').trimEnd();
  }

  _printAccessOrOp(node) {
    return (node.children || []).reduce((result, c) => {
      if (c.type === 'object_access') {
        return result + this._withOffset(this._lineOffset + result.length, () =>
          this._printObjectAccess(c)
        );
      }
      return result + rawValue(c);
    }, '');
  }

  _printObjectAccess(node) {
    return (node.children || []).reduce((result, c) => {
      if (c.type === 'func_call') {
        return result + this._withOffset(this._lineOffset + result.length, () =>
          this.func_call(c)
        );
      }
      if (c.type === 'object_access') {
        return result + this._withOffset(this._lineOffset + result.length, () =>
          this._printObjectAccess(c)
        );
      }
      return result + rawValue(c);
    }, '');
  }

  func_call(node) {
    const paramsNode = (node.children || []).find(c => c.type === 'func_call_params');
    if (!paramsNode) return '()';
    const args = collectCallArgs(paramsNode);
    const flat = `(${args.join(', ')})`;
    if (!this._tooLong(flat)) return flat;
    this.indent();
    const expanded = args.map(a => `${this.currentIndent}${a}`).join(',\n');
    this.dedent();
    return `(\n${expanded}\n${this.currentIndent})`;
  }

  array_literal(node) {
    const bodyNode = (node.children || []).find(c => c.type === 'array_literal_body');
    if (!bodyNode) return '[]';
    const items = collectArrayItems(bodyNode);
    const flat = `[${items.join(', ')}]`;
    if (!this._tooLong(flat)) return flat;
    this.indent();
    const expanded = items.map(i => `${this.currentIndent}${i}`).join(',\n');
    this.dedent();
    return `[\n${expanded}\n${this.currentIndent}]`;
  }

  object_literal(node) {
    const bodyNode = (node.children || []).find(c => c.type === 'object_literal_body');
    if (!bodyNode) return '{}';
    const props = collectObjectProps(bodyNode);
    const flat = `{ ${props.join(', ')} }`;
    if (!this._tooLong(flat)) return flat;
    this.indent();
    const expanded = props.map(p => `${this.currentIndent}${p},`).join('\n');
    this.dedent();
    return `{\n${expanded}\n${this.currentIndent}}`;
  }
}
