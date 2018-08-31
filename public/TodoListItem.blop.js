
TodoListItem = {
  view: (vnode) => {
    <li style=`margin: 1em`>
      = vnode.attrs.value + ' '
      <a href=`#delete-${vnode.attrs.value}` onclick=vnode.attrs.removeItem style="float:right">'x'</a>
    </li>
  }
}
