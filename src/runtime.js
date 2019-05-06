const snabbdom = require('snabbdom');
const attributes = require('snabbdom/modules/attributes');
const style = require('snabbdom/modules/style');
const sclass = require('snabbdom/modules/class');
const eventlisteners = require('snabbdom/modules/eventlisteners');
const snabbdomh = require('snabbdom/h');
const toVNode = require('snabbdom/tovnode').default;

class Component {}
Component.prototype.render = function render() {
  throw new Error('Blop Component need to implement the render method');
};

// this global is an issue you mount
// several time
let globalRefresh = null;
let currentNode = null;
// todo: garbage collect the state cache?
// this is the component state cache
const cache = {};

function useState(initialValue) {
  const { state, currentState } = currentNode;
  currentNode.state[currentState] = state[currentState] || initialValue;
  const setStateHookIndex = currentState;
  const setState = (newState) => {
    state[setStateHookIndex] = newState;
    globalRefresh();
  };
  currentNode.currentState = currentState + 1;
  return { value: state[currentState], setState };
}

function createComponent(Comp, attributes, children, name) {
  const path = currentNode ? `${currentNode.path}.${currentNode.children.length}.${name}` : name;
  const state = cache[path] || [];
  const node = {
    name, children: [], state, currentState: 0, parent: currentNode, path,
  };
  currentNode && currentNode.children.push(node);
  currentNode = node;
  let output;
  if (Comp.prototype && Comp.prototype.render) {
    output = (new Comp(attributes, children)).render(attributes, children);
  } else {
    output = Comp(attributes, children);
  }
  cache[path] = node.state;
  currentNode = node.parent;
  return output;
}

function copyToThunk(vnode, thunk) {
  thunk.elm = vnode.elm;
  (vnode.data).fn = (thunk.data).fn;
  (vnode.data).args = (thunk.data).args;
  thunk.data = vnode.data;
  thunk.children = vnode.children;
  thunk.text = vnode.text;
  thunk.elm = vnode.elm;
}

function prepatch(oldVnode, newNode) {
  if (newNode.data.attrs.needRender === false) {
    console.log(`patching avoided for ${newNode.sel}`);
    copyToThunk(oldVnode, newNode);
  }
}

function h(name, attributes, children) {
  const attrs = {};
  let on;
  let style;
  let sclass;
  let hook = { prepatch };
  let key;
  Object.entries(attributes).forEach((attr) => {
    const [index, value] = attr;
    if (index === 'on') {
      on = value;
    } else if (index === 'style') {
      style = value;
    } else if (index === 'key') {
      key = value;
    } else if (index === 'hooks') {
      hook = { ...hook, ...value };
    } else if (index === 'class') {
      if (typeof value === 'string') {
        attrs[index] = value;
      } else {
        sclass = value;
      }
    } else {
      attrs[index] = value;
    }
  });
  return snabbdomh.default(
    name,
    {
      on, style, attrs, hook, class: sclass, key,
    },
    children,
  );
}

const patch = snabbdom.init([
  attributes.default,
  style.default,
  eventlisteners.default,
  sclass.default,
]);

function mount(dom, render) {
  let vnode; let
    requested;
  function init() {
    vnode = render();
    patch(toVNode(dom), vnode);
    requested = false;
  }
  function refresh(callback) {
    if (requested) {
      return;
    }
    requested = true;
    currentNode = false;
    window.requestAnimationFrame(() => {
      let newVnode;
      const now = (new Date()).getTime();
      try {
        newVnode = render();
        // nothing to update
        if (!newVnode) {
          requested = false;
          const after = (new Date()).getTime();
          callback && callback(after - now);
          return;
        }
        // error can happen during patching
        patch(vnode, newVnode);
      } catch (error) {
        requested = false;
        throw error;
      }
      const after = (new Date()).getTime();
      callback && callback(after - now);
      vnode = newVnode;
      requested = false;
    });
  }
  globalRefresh = refresh;
  return ({ refresh, init });
}

module.exports = {
  h,
  patch,
  mount,
  Component,
  c: createComponent,
  useState,
};
