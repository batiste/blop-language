var code = `
root = document.body

def render(number) {
   <div>
     <h1>
       = "Hello"
     </h1>
     [1, 2].forEach((i) => {
       <p class="hello" + i>
         = "Hello " + i
       </p>
     })
  </div>
}

a = 1 - (1 + 2) + (2 + 4) + 2

Hello = {
  view: render
}

m.mount(root, Hello)
`
var a = []
for(var i=0; i<1; i++) {
  a.push(code)
}
const lcode = a.join('')

module.exports = {
  code: lcode
}
