
Button = {
  view: (vnode) => {
    <button onclick=vnode.attrs.onclick style=`font-size: 16px; padding: 0.5em`>
      = vnode.children
    </button>
  }
}

TodoListItem = {
  view: (vnode) => {
    { value, changeItem } = vnode.attrs
    <li style=`padding: 1em 0; font-size: 16px;`>
      if vnode.attrs.editMode {
        <input type="text" style=`font-size: 16px;` value=value onchange=changeItem />
      } else {
        <span onclick=vnode.attrs.editItem>
          = value + ' '
        </span>
      }
      <div style="float:right">
        <Button onclick=vnode.attrs.removeItem>'delete'</Button>
      </div>
    </li>
  }
}
