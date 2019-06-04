const snabbdom = require('snabbdom');
const attributes = require('snabbdom/modules/attributes');
const style = require('snabbdom/modules/style');
const sclass = require('snabbdom/modules/class');
const eventlisteners = require('snabbdom/modules/eventlisteners');
const snabbdomh = require('snabbdom/h');
const toVNode = require('snabbdom/tovnode').default;

let currentNode = null;
// this is the component state cache
let cache = {};
// this is the next cache that replace cache after a full re-render
let nextCache = {};

function useState(name, initialValue) {
  const { state } = currentNode;
  currentNode.state[name] = state[name] || initialValue;
  // this freeze the value for the closure
  const stateName = name;
  const closureNode = currentNode;
  const setState = (newState) => {
    state[stateName] = newState;
    scheduleRender(() => closureNode.render());
  };
  return { value: state[name], setState, getState: () => state[name] };
}

function useContext(name, initialValue) {
  const closureNode = currentNode;
  if (initialValue) {
    closureNode.context[name] = initialValue;
  }
  const setContext = (value) => {
    closureNode.context[name] = value;
    closureNode.listeners.forEach((node) => {
      scheduleRender(() => node.render());
    });
  };
  const getContext = () => {
    let node = closureNode;
    const requestingNode = closureNode;
    while (node) {
      if (node.context[name] !== undefined) {
        if (!node.listeners.includes(requestingNode) && requestingNode !== node) {
          node.listeners.push(requestingNode);
        }
        return node.context[name];
      }
      node = node.parent;
    }
  };
  const value = initialValue || getContext();
  return { setContext, getContext, value };
}

function lifecycle(obj) {
  if (obj.mount) currentNode.life.mount.push(obj.mount);
  if (obj.unmount) currentNode.life.unmount.push(obj.unmount);
}

function unmount(node, recur = false) {
  if (node.life && node.life.unmount) {
    node.life.unmount.forEach(fct => fct());
    node.life.unmount = [];
  }
  if (recur) {
    node.children.forEach((child) => {
      unmount(child, true);
    });
  }
  node.mounted = false;
}

function nodeMount(node) {
  // do not mount in node
  if (process && process.title === 'node') {
    return;
  }
  node.mounted = true;
  if (node.life && node.life.mount) {
    node.life.mount.forEach(fct => fct());
    node.life.mount = [];
  }
}

function get() {
  return currentNode;
}

const api = {
  useState,
  useContext,
  lifecycle,
  get,
};

function renderComponent(componentFct, attributes, children) {
  try {
    return componentFct(attributes, children, api);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return h('span', {}, [e.message]);
  }
}

function createComponent(componentFct, attributes, children, name) {
  const path = currentNode ? `${currentNode.path}.${currentNode.children.length}.${name}` : name;
  const nodeCache = cache[path];
  const state = (nodeCache && nodeCache.state) || [];
  const life = (nodeCache && nodeCache.life) || { mount: [], unmount: [] };
  const mounted = !!(nodeCache && nodeCache.mounted);
  const parent = currentNode;
  const node = {
    name, children: [], context: {}, state, life, listeners: [], mounted,
    parent, path, vnode: null, attributes,
    // allow a partial re-render of the component
    render: () => {
      const nodeCache = cache[path];
      const oldNode = currentNode;
      node.children = [];
      node.listeners = [];
      currentNode = node;
      const life = (nodeCache && nodeCache.life) || { mount: [], unmount: [] };
      currentNode.life = { mount: [], unmount: [] };
      const newVnode = renderComponent(componentFct, attributes, children);
      currentNode.life = life; // disregard the new lifecycle hooks
      patch(node.vnode, newVnode);
      cache[path] = currentNode;
      currentNode.vnode = newVnode;
      currentNode = oldNode;
    },
  };
  currentNode && currentNode.children.push(node);
  currentNode = node;
  currentNode.life = { mount: [], unmount: [] };
  const vnode = renderComponent(componentFct, attributes, children);
  // disregard the new lifecycles hooks
  if (mounted) {
    currentNode.life = life;
  } else {
    // important for unmount
    nodeMount(currentNode);
  }
  cache[path] = currentNode;
  currentNode.vnode = vnode;
  nextCache[path] = currentNode;
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

let renderPipeline = [];

function scheduleRender(render) {
  renderPipeline.push(render);
  window.requestAnimationFrame(() => {
    renderPipeline.forEach(fct => fct());
    renderPipeline = [];
  });
}

function umountDestroyedComponent() {
  const keysCache = Object.keys(cache);
  const keysNextCache = Object.keys(nextCache);
  const difference = keysCache.filter(x => !keysNextCache.includes(x));
  difference.forEach(path => unmount(cache[path]));
}

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
    renderPipeline = [];
    currentNode = null;
    const rerender = () => {
      let newVnode;
      nextCache = {};
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
      umountDestroyedComponent();
      cache = nextCache;
      requested = false;
    };
    window.requestAnimationFrame(() => {
      rerender();
      renderPipeline = [];
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
