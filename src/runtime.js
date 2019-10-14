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

const componentPath = name => (currentNode
  ? `${currentNode.path}.${currentNode.componentsChildren.length}.${name}`
  : name);


class Component {
  constructor(componentFct, attributes, children, name) {
    this.componentFct = componentFct;
    this.attributes = attributes || {};
    this.children = children || [];
    this.name = name;
    this.path = componentPath(name);
    this.componentsChildren = [];
    this.listeners = [];
    this.life = { mount: [], unmount: [] };
    this.vnode = null;
    this.parent = currentNode;
    this.state = {};
    this.context = {};
    this.mounted = false;
    cache[this.path] = this;
  }

  // called on a partial render
  partialRender() {
    const parentNode = currentNode;
    currentNode = this;
    this.componentsChildren = [];
    this.listeners = [];
    const newVnode = this.renderComponent();
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
    const newVnode = this.renderComponent();
    if (!this.mounted) {
      this._mount();
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

  _unmount() {
    this.life.unmount.forEach(fct => fct());
    this.mounted = false;
    this.life.unmount = [];
  }

  _mount() {
    // do not mount in node
    if ((process && process.title === 'node') || this.mounted) {
      return;
    }
    this.life.mount.forEach(fct => fct());
    this.mounted = true;
    this.life.mount = [];
  }

  mount(func) {
    if (this.mounted) return this;
    this.life.mount.push(func);
    return this;
  }

  unmount(func) {
    if (this.mounted) return this;
    this.life.unmount.push(func);
    return this;
  }

  destroy() {
    this._unmount();
    this.parent = null;
    this.children = [];
    this.state = {};
    delete cache[this.name];
    this.context = {};
    this.componentsChildren = [];
  }

  useState(name, initialValue) {
    this.state[name] = this.state[name] || initialValue;
    const value = this.state[name];
    const setState = (newState) => {
      this.state[name] = newState;
      scheduleRender(this);
    };
    return { value, setState, getState: () => this.state[name] };
  }

  useContext(name, initialValue) {
    if (initialValue) {
      this.context[name] = initialValue;
    }
    const setContext = (value) => {
      this.context[name] = value;
      this.listeners.forEach((node) => {
        scheduleRender(node);
      });
    };
    const getContext = () => {
      let node = this;
      const requestingNode = currentNode;
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
  const path = componentPath(name);
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

function scheduleRender(node) {
  renderPipeline.push(node);
  const rendering = [...renderPipeline];
  renderPipeline = [];
  window.requestAnimationFrame(() => {
    rendering.forEach(node => node.partialRender());
  });
}

function destroyUnreferencedComponents() {
  const keysCache = Object.keys(cache);
  const keysNextCache = Object.keys(nextCache);
  const difference = keysCache.filter(x => !keysNextCache.includes(x));
  difference.forEach(path => cache[path].destroy());
}

let rootNode = new Component(() => {}, {}, [], 'root');
currentNode = rootNode;

let mountCalled = false;

function mount(dom, render) {
  let vnode; let requested;
  if (mountCalled) {
    console.warn('Blop only supports one mount by app ATM');
  }
  mountCalled = true;
  function init() {
    rootNode = new Component(() => {}, {}, [], 'root');
    currentNode = rootNode;
    vnode = render();
    vnode = patch(toVNode(dom), vnode);
    requested = false;
    return vnode;
  }
  function refresh(callback) {
    if (requested) {
      return;
    }
    requested = true;
    renderPipeline = [];
    const rerender = () => {
      let newVnode;
      nextCache = {};
      const now = (new Date()).getTime();
      try {
        rootNode.componentsChildren = [];
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
