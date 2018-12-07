const code = `
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
class Test2 extends Test {}

() => {
  a: 1
}

for key: int, value in array {
  a.b.c = 1
}

try {
  b = !b
  typeof b
} catch hello {
  throw hello
}

function.call(
  1,
  2,
  3)

a = 1 - (1 + 2) + (2 + 4) + 2

Hello = {
  view: render
}

() => {
  return 1
}
() => {}
`;

const a = [];
for (let i = 0; i < 500; i++) {
  a.push(code);
}
const lcode = a.join('');

module.exports = {
  code: lcode,
};
