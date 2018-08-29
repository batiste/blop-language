
module = require("./module.blop.js")

root = document.body
count = 0
def click() {
  count := count + 1
}

def expressionVirtualNode(c) {
  if c < 10 {
    a = <p>"c ^ 3 === " + c * c * c</p>
  } else {
    a = "Too big"
  }
  b = <p>
    = "c ^ 2 === "
    = c * c
  </p>
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
       <Title size=24>`We have ${count} stuff`</Title>
       = expressionVirtualNode(count)
       if count > 10 {
         <p>"Very big number"</p>
       }
       <Button onclick=click>`Increase count: ${count}`</Button>
    </div>
  }
}

m.mount(root, Hello)
