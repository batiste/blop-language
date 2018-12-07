const snabbdom = require('snabbdom');
const props = require('snabbdom/modules/props');
const style = require('snabbdom/modules/style');
const eventlisteners = require('snabbdom/modules/eventlisteners');
const snabbdomh = require('snabbdom/h');

class Component {}
Component.prototype.render = function render() {
  throw new Error('Blop Component need to implement the render method');
};

function createComponent(Comp, attributes, children) {
  if (Comp.prototype && Comp.prototype.render) {
    return (new Comp(attributes, children)).render(attributes, children);
  }
  return Comp(attributes, children);
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
  if (newNode.data.props.needRender === false) {
    console.log(`patching avoided for ${newNode.sel}`);
    copyToThunk(oldVnode, newNode);
  }
}

function h(name, properties, children) {
  const props = {};
  let on;
  let style;
  Object.entries(properties).forEach((prop) => {
    const [index, value] = prop;
    if (index === 'on') {
      on = value;
    } else if (index === 'style') {
      style = value;
    } else {
      props[index] = value;
    }
  });
  return snabbdomh.default(
    name,
    {
      on, style, props, hook: { prepatch },
    },
    children,
  );
}

const patch = snabbdom.init([props.default, style.default, eventlisteners.default]);

function mount(dom, render) {
  let vnode; let
    requested;
  function init() {
    vnode = render();
    patch(dom, vnode);
    requested = false;
  }
  function refresh() {
    if (requested) {
      return;
    }
    requested = true;
    window.requestAnimationFrame(() => {
      const newVnode = render();
      // nothing to update?
      if (!newVnode) {
        requested = false;
        return;
      }
      patch(vnode, newVnode);
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
  Component,
  c: createComponent,
};
