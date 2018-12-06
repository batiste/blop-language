let snabbdom = require('snabbdom');
let props = require('snabbdom/modules/props');
let style = require('snabbdom/modules/style');
let eventlisteners = require('snabbdom/modules/eventlisteners');
let snabbdomh = require('snabbdom/h');

class Component {}
Component.prototype.render = function render() {
  throw new Error(`Blop Component need to implement the render method`);
};

function createComponent(object, attributes, children) {
  if(object.prototype && object.prototype.render) {
    return (new object(attributes, children)).render(attributes, children)
  }
  return object(attributes, children)
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
  if(newNode.data.props.needRender === false) {
    console.log(`patching avoided for ${newNode.sel}`)
    copyToThunk(oldVnode, newNode)
  }
}

function h(name, properties, children) {
  let props, on, style;
  props = {};
  on = null;
  style = null;
  Object.entries(properties).forEach(prop => {
    let [index, value] = prop;
    if (index === `on`) {
      on = value;
    } else if (index === `style`) {
      style = value;
    } else {
      props[index] = value;
    }
  });
  return snabbdomh.default(
    name,
    {on: on, style: style, props: props, hook: {prepatch}},
    children
  )
};

const patch = snabbdom.init([props.default, style.default, eventlisteners.default]);

function mount(dom, render) {
  let vnode, requested;
  function init() {
    vnode = render();
    patch(dom, vnode);
    requested = false;
  }
  function refresh() {
    if (requested) {
      return
    }
    requested = true;
    window.requestAnimationFrame(() =>  {
      let newVnode = render();
      // nothing to update?
      if(!newVnode) {
        requested = false;
        return
      }
      patch(vnode, newVnode)
      vnode = newVnode;
      requested = false;
    })
  }
  return ({ refresh, init })
}

module.exports = {
  h,
  patch,
  mount,
  Component,
  c: createComponent
}