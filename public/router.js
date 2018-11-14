
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); // $& means the whole matched string
}

function replace(str) {
  let str1 = str.replace(/\:(\w+)/g, '(?<$1>\\w+)');
  return `^${str1}$`
}

class Router {
  constructor(initial) {
    this.routes = [];
    window.addEventListener('popstate', (e) => {
      if(e.state === null) {
        initial && initial()
      } else {
        let matchedRoute = this.routes.find(route => route.path === e.state.path)
        matchedRoute && matchedRoute.handler(e.state.params)
      }
    })
  }
  init() {
    this.go(window.location.pathname, false)
  }
  add(route) {
    route.reg = new RegExp(replace(escapeRegExp(route.path)))
    this.routes.push(route)
  }
  match(path) {
    let m
    let matchedRoute = this.routes.find(route => {
      m = path.match(route.reg)
      return m
    })
    if(matchedRoute) {
      return {route: matchedRoute, params: m.groups}
    }
  }
  go(path, push=true) {
    let m = this.match(path)
    if(!m) {
      console.log(`No route for path ${path}`)
      return
    }
    if(push) {
      history.pushState({name: m.route.name, path: m.route.path, params: m.params}, m.route.name, path);
    }
    if(m.route.handler) {
      m.route.handler(m.params)
    }
  }
}

module.exports = {
  Router
}
