let snabbdom = require('snabbdom');
let props = require('snabbdom/modules/props');
let style = require('snabbdom/modules/style');
let eventlisteners = require('snabbdom/modules/eventlisteners');
let snabbdomh = require('snabbdom/h');

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
  return snabbdomh.default(name, ({ on: on, style: style, props: props }), children)
};

const patch = snabbdom.init([props.default, style.default, eventlisteners.default]);

function mount(dom, render) {
  let vnode, requested, interval;
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
      let newVnode;
      newVnode = render();
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

module.exports = { h, patch, mount }