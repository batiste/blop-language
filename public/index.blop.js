
module = require("./module.blop.js")

root = document.body
count = 0
def click() {
  count := count + 1
}

def expressionVirtualNode(c) {
  a = null
  if c < 5 {
    a = <i>1 + c</i>
  } else {
    a = "Too small"
  }
  b = <i>
    = ", "
    = c * c
  </i>
  return [a, b]
}

Title = {
  view: (vnode) => {
    <h1 style=`font-size: ${vnode.attrs.size || 18}px`>
      = vnode.children
    </h1>
  }
}

Button = {
  view: (vnode) => {
    <button onclick=vnode.attrs.onclick style=`font-size: 18px; padding: 1em`>
      = vnode.children
    </button>
  }
}

Hello = {
  view: () => {
    <div>
       <Title size=24>
          = "We have "
          = expressionVirtualNode(count)
          = " stuff"
       </Title>
       <Button onclick=click>"Increase count: ${count}"</Button>
    </div>
  }
}

m.mount(root, Hello)
