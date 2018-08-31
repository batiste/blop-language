
TodoListItem = {
  view: (vnode) => {
    <li style=`margin: 1em; font-size: 16px;`>
      = vnode.attrs.value + ' '
      <button
        onclick=vnode.attrs.removeItem
        style="float:right">'delete'</button>
    </li>
  }
}
