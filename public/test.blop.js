
root = document.body

Hello = {
  view: (number) => {
     <div>
       <h1>
         = "A nice title"
       </h1>
       [1, 2, 33].forEach((i) => {
         <p class="hello" + i>
           = "Hello " + i * i
         </p>
       })
    </div>
    <div>
      <h1>
        = "A nice title"
      </h1>
      [1, 2, 33].forEach((i) => {
        <p class="hello" + i>
          = "Hello " + i * i
        </p>
      })
   </div>
  }
}

m.mount(root, Hello)
