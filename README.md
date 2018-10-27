# The blop language

The blop language is a toy language that ressembles modern JavaScript. It uses mithril to offer JSX like features.
It has the advantage to fully integrate the HTML tags into the language and you are not limited to expressions. You can mix any statement within a function as HTML tags can be statements as well as expressions.

It compiles to javascript using a compiler that is generated using a grammar and token definition.

```javascript
import { Button } from './Button.blop.js'

state = {
  todoList: []
}

TodoList = {
  inputValue: "",
  view: def () {
    <div>
       <h1>`Todo list`</h1>
       <input value=this.inputValue onchange=(e) => this.onChange(e) />
       <Button onclick=(e) => this.addItem(e)>`Add to list`</Button>
       if state.todoList.length > 0 {
         <ul style="max-width: 20em">
         for index, value in state.todoList {
           <li>value</li>
         }
         </ul>
       }
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
  }
 }
 
 m.mount(document.body, TodoList)
 ```

 # Vscode extension

 Install the extensions https://marketplace.visualstudio.com/search?term=blop&target=VSCode&category=All%20categories&sortBy=Relevance

 ![Extensions](/extensions.png)
