
module = require("./module.blop.js")

root = document.body
count = 0
def click() {
  count := count + 1
}

Title = {
  view: (vnode) => {
    <h1 style=`font-size: ${vnode.attrs.size || 18}px`>
      = vnode.children
    </h1>
  }
}

Hello = {
  view: () => {
    <div>
       <Title size=24>
          = "We have "
          = count
          = " stuff"
       </Title>
       <button onclick=click>"Increase count: ${count}"</button>
    </div>
  }
}

m.mount(root, Hello)
