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
  currentNode.life = obj;
}

function prepareLifecycle(node, vnode) {
  vnode.path = node.path;
  // vnode.data.hook.destroy = () => console.log('destroy');
  // vnode.data.hook.destroy = () => console.log('destroy', node);
  if (node.life.mount) {
    vnode.data.hook.init = node.life.mount;
    // vnode.data.hook.insert = node.life.mount;
  }
  if (node.life.unmount) {
    vnode.data.hook.remove = () => {
      console.log('remove', node);
      node.life.unmount();
    };
    vnode.data.hook.destroy = () => {
      console.log('destroy', node);
      node.life.unmount();
    };
  }
  const handleChange = (oldnode, newnode) => {
    if (oldnode.path === newnode.path) {
      return;
    }
    console.log('handleChange');
    const oldComponent = cache[oldnode.path];
    if (oldComponent && oldComponent.life && oldComponent.life.unmount) {
      oldComponent.life.unmount(oldnode, () => null);
    }
    if (node.life.mount) {
      node.life.mount(newnode);
    }
  };
  vnode.data.hook.update = handleChange;
  vnode.data.hook.prepatch = handleChange;
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
  const life = (nodeCache && nodeCache.life) || null;
  const parent = currentNode;
  const node = {
    name, children: [], context: {}, state, life, listeners: [],
    parent, path, vnode: null, attributes,
    // allow a partial re-render of the component
    render: () => {
      const oldNode = currentNode;
      node.children = [];
      currentNode = node;
      // it is not really possible at this point to trigger a re-render of the children...
      const newVnode = renderComponent(componentFct, attributes, children);
      newVnode.path = path;
      if (currentNode.life) {
        prepareLifecycle(currentNode, newVnode);
      }
      patch(node.vnode, newVnode);
      cache[path] = node;
      node.vnode = newVnode;
      currentNode = oldNode;
    },
  };
  currentNode && currentNode.children.push(node);
  currentNode = node;
  const vnode = renderComponent(componentFct, attributes, children);
  vnode.path = path;
  if (currentNode.life) {
    prepareLifecycle(currentNode, vnode);
  }
  currentNode.vnode = vnode;
  nextCache[path] = node;
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

function diff(A, B) {
  return A.filter(a => !B.includes(a));
}

function unmount() {
  const destroyed = diff(Object.keys(cache), Object.keys(nextCache));
  destroyed.forEach((key) => {
    const node = cache[key];
    if (node.life && node.life.unmount) {
      console.log('umount -> ', node);
      node.life.unmount({}, () => {});
    }
  });
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
      unmount();
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
