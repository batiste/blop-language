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

// eslint-disable-next-line arrow-body-style
const componentPath = (name) => {
  return currentNode
    ? `${currentNode.path}.${currentNode.componentsChildren.length}.${name}`
    : name;
};

class Component {
  constructor(ComponentFct, attributes, children, name) {
    if (ComponentFct === null) {
      if (!this.render) {
        throw new Error('Component should implement the render() method');
      }
      this.componentFct = this.render;
    } else {
      this.componentFct = ComponentFct;
    }
    this.attributes = attributes || {};
    this.children = children || [];
    this.name = name;
    if (name === 'root') {
      this.path = 'root';
    } else {
      this.path = componentPath(name);
    }
    this.componentsChildren = [];
    this.listeners = [];
    this.life = { mount: [], unmount: [] };
    this.vnode = null;
    this.parent = currentNode;
    this.state = {};
    this.context = {};
    this.onChangeRegistry = {};
    this.mounted = false;
    this.destroyed = false;
    cache[this.path] = this;
  }

  // called on a partial render
  partialRender() {
    const parentNode = currentNode;
    currentNode = this;
    this._resetForRender();
    const newVnode = this.renderComponent();
    const thunk = patch(this.vnode, newVnode);
    copyToThunk(thunk, this.vnode);
    currentNode = parentNode;
  }

  refresh() {
    if (this.destroyed) return;
    scheduleRender(this);
  }

  renderComponent() {
    try {
      const node = this.componentFct(this.attributes, this.children, this);
      this._checkOnChange();
      return node;
    } catch (e) {
      console.error(e);
      return h('span', {}, [e.message]);
    }
  }

  onMount() { return this; }

  onUnmount() { return this; }

  onChange(attribute, callback) {
    const value = this.attributes[attribute];
    this.onChangeRegistry[attribute] = { callback, value };
  }

  _checkOnChange() {
    Object.keys(this.onChangeRegistry).forEach((attribute) => {
      const record = this.onChangeRegistry[attribute];
      if (record.value !== this.attributes[attribute]) {
        record.value = this.attributes[attribute];
        record.callback();
      }
    });
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
    this.listeners[name] = [];
    if (initialValue && this.context[name] === undefined) {
      this.context[name] = initialValue;
    }
    const setContext = (value) => {
      this.context[name] = value;
      this.listeners[name].forEach((node) => {
        scheduleRender(node);
      });
    };
    const getContext = () => {
      let node = this;
      const requestingNode = currentNode;
      while (node) {
        if (node.context[name] !== undefined) {
          if (!node.listeners[name].includes(requestingNode) && requestingNode !== node) {
            node.listeners[name].push(requestingNode);
          }
          return node.context[name];
        }
        node = node.parent;
      }
    };
    const value = initialValue || getContext();
    return { setContext, getContext, value };
  }

  _resetForRender() {
    this.componentsChildren = [];
    this.listeners = [];
  }

  _render(attributes, children) {
    const parentNode = currentNode;
    this.attributes = attributes;
    this.children = children;
    currentNode = this;
    this._resetForRender();
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

  _unmount() {
    this.onUnmount();
    this.life.unmount.forEach(fct => fct());
    this.mounted = false;
    this.life.unmount = [];
  }

  _mount() {
    // do not mount in node
    if ((process && process.title === 'node') || this.mounted) {
      return;
    }
    this.onMount();
    this.life.mount.forEach(fct => fct());
    this.mounted = true;
    this.life.mount = [];
  }

  _destroy() {
    this.destroyed = true;
    this._unmount();
    this.parent = null;
    this.children = [];
    this.state = {};
    // delete cache[this.name];
    this.context = {};
    this.componentsChildren = [];
  }
}

function isClass(v) {
  return typeof v === 'function' && /^\s*class\s+/.test(v.toString());
}

function createComponent(ComponentFct, attributes, children, name) {
  const path = componentPath(name);
  if (cache[path]) {
    return cache[path]._render(attributes, children);
  }
  let component;
  if (isClass(ComponentFct)) {
    component = new ComponentFct(null, attributes, children, name);
  } else {
    component = new Component(ComponentFct, attributes, children, name);
  }

  return component._render(attributes, children);
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
let animationRequest = false;

function scheduleRender(node) {
  renderPipeline.push(node);
  if (!animationRequest) {
    animationRequest = true;
    window.requestAnimationFrame(() => {
      renderPipeline.forEach(node => node.partialRender());
      animationRequest = false;
      renderPipeline = [];
    });
  }
}

function destroyUnreferencedComponents() {
  const keysCache = Object.keys(cache);
  const keysNextCache = Object.keys(nextCache);
  // O(n2), not great
  const difference = keysCache.filter(x => !keysNextCache.includes(x));
  difference.forEach(path => cache[path]._destroy());
}

let rootNode = new Component(() => {}, {}, [], 'root');
currentNode = rootNode;

const newRoot = () => {
  rootNode = new Component(() => {}, {}, [], 'root');
  currentNode = rootNode;
};

function mount(dom, render) {
  let vnode; let requested;
  cache = {};
  nextCache = {};
  function init() {
    const target = window.document.createElement('div');
    dom.innerHTML = '';
    dom.appendChild(target);
    newRoot();
    vnode = render();
    vnode = patch(toVNode(target), vnode);
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
        newVnode = render();
        // nothing to update
        if (!newVnode) {
          requested = false;
          const after = (new Date()).getTime();
          callback && callback(after - now);
          return;
        }
        newRoot();
        // error can happen during patching
        patch(vnode, newVnode);
      } catch (error) {
        requested = false;
        throw error;
      }
      const after = (new Date()).getTime();
      vnode = newVnode;
      destroyUnreferencedComponents();
      cache = nextCache;
      requested = false;
      callback && callback(after - now);
    };
    window.requestAnimationFrame(() => {
      rerender();
      renderPipeline = [];
    });
  }
  return { refresh, init };
}

module.exports = {
  h,
  patch,
  mount,
  c: createComponent,
  Component,
};
