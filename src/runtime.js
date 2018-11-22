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
  Object.entries(properties).forEach(__1 => {
    let [index, value] = __1;
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

function mount(dom, func) {
  let vnode, requested, interval;
  vnode = func();
  patch(dom, vnode)
  requested = false;
  function refresh() {
    if (requested) {
      return
    }
    requested = true;
    window.requestAnimationFrame(() =>  {
      let newVnode;
      newVnode = func();
      patch(vnode, newVnode)
      vnode = newVnode;
      requested = false;
    })
  }
  interval = setInterval(refresh, 60);
  return ({ refresh, umount: () => clearInterval(interval) })
}

module.exports = { h, patch, mount }