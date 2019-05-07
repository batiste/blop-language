const snabbdom = require('snabbdom');
const attributes = require('snabbdom/modules/attributes');
const style = require('snabbdom/modules/style');
const sclass = require('snabbdom/modules/class');
const eventlisteners = require('snabbdom/modules/eventlisteners');
const snabbdomh = require('snabbdom/h');
const toVNode = require('snabbdom/tovnode').default;

let currentNode = null;
// todo: garbage collect the state cache?
// this is the component state cache
const cache = {};

function useState(initialValue) {
  const { state, currentState } = currentNode;
  currentNode.state[currentState] = state[currentState] || initialValue;
  // this freeze the value for the closure
  const stateIndex = currentState;
  const closureNode = currentNode;
  const setState = (newState) => {
    state[stateIndex] = newState;
    closureNode.render();
  };
  currentNode.currentState = currentState + 1;
  return { value: state[currentState], setState };
}

function useContext(name) {
  const closureNode = currentNode;
  const setContext = (value) => {
    closureNode.context[name] = value;
    closureNode.listeners.forEach((node) => {
      node.render();
    });
  };
  const getContext = () => {
    let node = closureNode;
    const requestingNode = closureNode;
    while (node) {
      if (node.context[name] !== undefined) {
        if (!node.listeners.includes(requestingNode)) {
          node.listeners.push(requestingNode);
        }
        return node.context[name];
      }
      node = node.parent;
    }
  };
  return { setContext, value: getContext() };
}

function createComponent(componentFct, attributes, children, name) {
  const path = currentNode ? `${currentNode.path}.${currentNode.children.length}.${name}` : name;
  const state = cache[path] || [];
  const parent = currentNode;
  const node = {
    name, children: [], context: {}, state, listeners: [],
    currentState: 0, parent, path, vnode: null, attributes,
    // allow a partial re-render of the component
    render: () => {
      const oldNode = currentNode;
      currentNode = node;
      // currentNode.currentState = 0;
      // it is not really possible at this point to trigger a re-render of the children...
      const newVnode = componentFct(attributes, children);
      currentNode.currentState = 0;
      patch(node.vnode, newVnode);
      // cache[path] = node.state;
      node.vnode = newVnode;
      currentNode = oldNode;
    },
  };
  currentNode && currentNode.children.push(node);
  currentNode = node;
  const vnode = componentFct(attributes, children);
  node.currentState = 0;
  currentNode.vnode = vnode;
  cache[path] = node.state;
  currentNode = parent;
  return vnode;
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
  return ({ refresh, init });
}

module.exports = {
  h,
  patch,
  mount,
  c: createComponent,
  useState,
  useContext,
};
