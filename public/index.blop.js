
TodoListItem = require("./TodoListItem.blop.js").TodoListItem

root = document.body
state = {
  todoList: []
}

Title = {
  view: (vnode) => <h1 style=`font-size: ${vnode.attrs.size || 18}px`>vnode.children</h1>
}

Button = {
  view: (vnode) => {
    <button onclick=vnode.attrs.onclick style=`font-size: 16px; padding: 0.5em`>
      = vnode.children
    </button>
  }
}

Input = {
  view: (vnode) => <input
    type="text"
    value=vnode.attrs.value
    onchange=vnode.attrs.onchange
    style=`font-size: 16px; padding: 0.5em` />
}

TodoList = {
  inputValue: "",
  view: def () {
    <div>
       <Title size=24>`Todo list`</Title>
       <Input value=this.inputValue onchange=(e) => this.onChange(e) />
       <Button onclick=(e) => this.addItem(e)>`Add to list`</Button>
       <ul style="max-width: 15em">
       for index, value in state.todoList {
         <TodoListItem removeItem=(e) => this.remove(e, index) value=value />
       }
       </ul>
    </div>
  },
  addItem: def (e) {
    if this.inputValue {
      state.todoList.push(this.inputValue)
      this.inputValue = ''
    }
  },
  onChange: def (e) {
    this.inputValue = e.target.value
  },
  remove: def (e, index) {
    state.todoList.splice(index, 1)
  }
}

m.mount(root, TodoList)
