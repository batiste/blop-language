
Button = {
  view: (vnode) => {
    <button onclick=vnode.attrs.onclick style=`font-size: 16px; padding: 0.5em`>
      = vnode.children
    </button>
  }
}

TodoListItem = {
  view: (vnode) => {
    value = vnode.attrs.value
    <li style=`margin: 1em; font-size: 16px;`>
      if vnode.attrs.editMode {
        <input type="text" value=value onchange=vnode.attrs.changeItem />
      } else {
        <span onclick=vnode.attrs.editItem>
          = value + ' '
        </span>
      }
      <Button
        onclick=vnode.attrs.removeItem>'delete'</Button>
    </li>
  }
}
