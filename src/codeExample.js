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

class Test {
  def constructor(a) {
    this.a = a
  }
  def blop(a) {
    return blop
  }
}
class Test2 {}

() => {
  a: 1
}

something() => 1

for key: int, value in array {
  console.log(key)
}

b = !b

a = 1 - (1 + 2) + (2 + 4) + 2

Hello = {
  view: render
}

() => {
  return 1
}
() => {}
`
var a = []
for(var i=0; i<10; i++) {
  a.push(code)
}
const lcode = a.join('')

module.exports = {
  code: lcode
}
