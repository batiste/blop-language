
TodoListItem = require("./TodoListItem.blop.js").TodoListItem
Button = require("./TodoListItem.blop.js").Button

root = document.body
state = {
  todoList: []
}

Title = {
  view: (vnode) => <h1 style=`font-size: ${vnode.attrs.size || 18}px`>vnode.children</h1>
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
       <ul style="max-width: 20em">
       for index, value in state.todoList {
         <TodoListItem
            removeItem=(e) => this.remove(e, index)
            editItem=(e) => this.editItem(e, index)
            changeItem=(e) => this.changeItem(e, index)
            editMode=this.editItemIndex == index
            value=value />
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
  editItem: def (e, index) {
    this.editItemIndex = index
  },
  changeItem: def (e, index) {
    this.editItemIndex = false
    state.todoList[index] = e.target.value
  },
  onChange: def (e) {
    this.inputValue = e.target.value
  },
  remove: def (e, index) {
    this.editItemIndex = false
    state.todoList.splice(index, 1)
  }
}

m.mount(root, TodoList)
