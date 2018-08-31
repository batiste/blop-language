
TodoListItem = {
  view: (vnode) => {
    value = vnode.attrs.value
    <li style=`margin: 1em; font-size: 16px;`>
      if vnode.attrs.editMode {
        <input type="text" value=value onchange=vnode.attrs.changeItem />
      } else {
        <span onclick=vnode.attrs.editItem
          = value + ' '
        </span>
      }
      <button
        onclick=vnode.attrs.removeItem
        style="float:right">'delete'</button>
    </li>
  }
}
