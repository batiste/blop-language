const snabbdom = require('snabbdom');
const attributes = require('snabbdom/modules/attributes');
const style = require('snabbdom/modules/style');
const sclass = require('snabbdom/modules/class');
const eventlisteners = require('snabbdom/modules/eventlisteners');
const snabbdomh = require('snabbdom/h');
const toVNode = require('snabbdom/tovnode').default;

// the node being currently rendered
let currentNode = null;
// this is the component state cache
let cache = {};
// this is the next cache that replace cache after a full re-render
let nextCache = {};

class Component {
  constructor(componentFct, attributes, children, name) {
    this.componentFct = componentFct;
    this.attributes = attributes;
    this.children = children;
    this.name = name;
    this.path = currentNode ? `${currentNode.path}.${currentNode.componentsChildren.length}.${name}` : name;
    this.componentsChildren = [];
    this.listeners = [];
    this.life = { mount: [], unmount: [] };
    this.vnode = null;
    this.parent = currentNode;
    this.state = [];
    this.context = {};
    this.mounted = !!this.vnode;
    cache[this.path] = this;
  }

  // called on a partial render
  partialRender() {
    const parentNode = currentNode;
    currentNode = this;
    this.componentsChildren = [];
    this.listeners = [];
    const { life } = this;
    this.life = { mount: [], unmount: [] };
    const newVnode = this.renderComponent();
    this.life = life; // disregard the new lifecycle hooks in a partial render
    patch(this.vnode, newVnode);
    this.vnode = newVnode;
    currentNode = parentNode;
  }

  render(componentFct, attributes, children) {
    this.componentFct = componentFct;
    this.attributes = attributes;
    this.children = children;
    const parentNode = currentNode;
    currentNode = this;
    const { life } = this;
    const newVnode = this.renderComponent();
    if (this.vnode) {
      this.life = life; // disregard the new lifecycles hooks if already mounted
    } else {
      this.mount();
    }
    parentNode && parentNode.componentsChildren.push(this);
    nextCache[this.path] = this;
    this.vnode = newVnode;
    currentNode = parentNode;
    return this.vnode;
  }

  renderComponent() {
    try {
      return this.componentFct(this.attributes, this.children, this);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      return h('span', {}, [e.message]);
    }
  }

  unmount(recur = false) {
    this.life.unmount.forEach(fct => fct());
    this.life.unmount = [];
    if (recur) {
      this.componentsChildren.forEach((child) => {
        child.unmount(true);
      });
    }
    this.mounted = false;
  }

  mount() {
    // do not mount in node
    if (process && process.title === 'node') {
      return;
    }
    this.mounted = true;
    this.life.mount.forEach(fct => fct());
    this.life.mount = [];
  }

  lifecycle(obj) {
    if (obj.mount) this.life.mount.push(obj.mount);
    if (obj.unmount) this.life.unmount.push(obj.unmount);
  }

  destroy() {
    this.unmount();
    this.parent = null;
    this.children = null;
    // some asyncronous operation might depends on this
    this.state = [];
    this.context = {};
    this.componentsChildren = [];
  }

  useState(name, initialValue) {
    const value = this.state[name] || initialValue;
    // this freeze the value for the closure
    const stateName = name;
    const closureNode = this;
    const setState = (newState) => {
      closureNode.state[stateName] = newState;
      scheduleRender(() => closureNode.partialRender());
    };
    return { value, setState, getState: () => closureNode.state[name] };
  }

  useContext(name, initialValue) {
    const closureNode = this;
    if (initialValue) {
      closureNode.context[name] = initialValue;
    }
    const setContext = (value) => {
      closureNode.context[name] = value;
      closureNode.listeners.forEach((node) => {
        scheduleRender(() => node.partialRender());
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
}

function createComponent(componentFct, attributes, children, name) {
  const path = currentNode ? `${currentNode.path}.${currentNode.children.length}.${name}` : name;
  if (cache[path]) {
    return cache[path].render(componentFct, attributes, children, name);
  }
  const component = new Component(componentFct, attributes, children, name);
  return component.render(componentFct, attributes, children, name);
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
let alreadyRendering = false;

function scheduleRender(render) {
  renderPipeline.push(render);
  if (!alreadyRendering) {
    window.requestAnimationFrame(() => {
      alreadyRendering = true;
      renderPipeline.forEach(fct => fct());
      renderPipeline = [];
      alreadyRendering = false;
    });
  }
}

function destroyUnreferencedComponents() {
  const keysCache = Object.keys(cache);
  const keysNextCache = Object.keys(nextCache);
  const difference = keysCache.filter(x => !keysNextCache.includes(x));
  difference.forEach(path => cache[path].destroy());
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
      destroyUnreferencedComponents();
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
  Component,
};
