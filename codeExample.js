var code = `
v = {"h": (name, attrs, children) => [
  name, 
  children, 
  attrs]
}

def fib(n: number): number {
  if n < 2 {
    return n
  }
  return fib(n - 2) + fib(n - 1)
}

def component(number) {
   def test() {
     <hello>
      = number
     </hello>
   }
   <test>
     = fib(5)
     <hello>
       if number == 1 {
         = fib(6)
       } else {
         = fib(8)
       }
       = test()
     </hello>
  </test>
}

console.log(component(4))

`
var a = []
for(var i=0; i<1; i++) {
  a.push(code)
}
const lcode = a.join('')

module.exports = {
  code: lcode
}
