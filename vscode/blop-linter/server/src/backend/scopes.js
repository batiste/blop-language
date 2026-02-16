import { SCOPE_TYPES } from '../constants.js';

class Scope {
  constructor(type) {
    this.names = {};
    this.type = type;
  }
}

class ScopesStack {
  constructor() {
    this.scopes = [];
  }

  add(type) {
    const scope = new Scope(type);
    this.scopes.push(scope);
    return scope;
  }

  pop(type) {
    const scope = this.scopes.pop();
    if (scope.type !== type) {
      throw Error(`Expected scope ${type}, got ${scope.type}`);
    }
    return scope;
  }

  /** return the current block */
  currentBlock() {
    const scopes = this.blocks();
    return scopes[scopes.length - 1];
  }

  type(type) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const n = this.scopes[i];
      if (n.type === type) {
        return n;
      }
    }
  }

  filter(type) {
    return this.scopes.filter(n => n.type === type);
  }

  blocks() {
    return this.scopes.filter(n => [
      SCOPE_TYPES.FUNCTION,
      SCOPE_TYPES.LOOP,
      SCOPE_TYPES.CONDITIONAL
    ].includes(n.type));
  }

  parentFrom(type, scope) {
    let found = false;
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const n = this.scopes[i];
      if (n === scope) {
        found = true;
      }
      if (found && n.type === type) {
        return n;
      }
    }
  }

  names(type) {
    const scopes = this.filter(type);
    return scopes[scopes.length - 1].names;
  }
}

export {
  Scope,
  ScopesStack,
};
