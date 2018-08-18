var code = `
v = {"h": (name, attrs, children) => [
  name, 
  children, 
  attrs]
}

abc = 10
abc = 100 + 213 + 2321 + 1.00

def testNamespace() {
  abc = 290
  abc = 343
  blop = 123
  () => {
    abc = 323243
    blop := 323243
  }
  return b
}

def fib(n: number): number {
  if n < 2 {
    return n
  }
  return fib(n - 2) + fib(n - 1)
}

def component(number) {
   def test() {
     if 1 > 10 {
       <hello>number + 1</hello>
     } else {
       <span>
        = 1
       </span>
     }
   }
   <div>
     = fib(number)
     <hello id="blop" className=1 + 2 + 1 blop="héllo">
       if number == 1 {
         = fib(number)
       } else {
         = "Héllo"
         = "Blop"
       }
       = test()
     </hello>
  </div>
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
