

function isObject(value) {
  if (value === null || value === undefined) return false;
  else return value.constructor === Object;
}

export function create(state, modificationTable, readOnly=false) {
  let callbacks = []
  function flush() {
    modificationTable = []
  }
  function connect(callback) {
    callbacks.push(callback)
  }
  function handler(currentState, path='', parentState) {
    function hasChanged() {
      return !!modificationTable.find(
        (modification) => modification.path.startsWith(path)
      )
    }
    return {
      get: function(obj, prop) {
        if(isObject(obj[prop])) {
          return new Proxy(currentState[prop], 
            handler(currentState[prop], path + '.' + prop, currentState))
        }
        if(prop === 'hasChanged') {
          return hasChanged
        }
        if(prop === 'flush') {
          return flush
        }
        if(prop === 'connect') {
          return connect
        }
        return obj[prop]
      },
      set: function(obj, prop, value) {
        if(readOnly) {
          throw new Error(`${obj}.${prop} is read only`)
        }
        if(prop === 'peel') {
          throw new Error('You cannot redefine the peel function')
        }
        modificationTable.push({path: path + '.' + prop, action: 'set', value})
        obj[prop] = value
        callbacks.forEach(fct => fct(path + '.' + prop))
        return true;
      },
      deleteProperty(target, prop) {
        if(readOnly) {
          throw new Error(`${target}.${prop} is read only`)
        }
        if (prop in target) {
          modificationTable.push({path: path + '.' + prop, action: 'delete'})
          delete target[prop];
        } else {
          return false
        }
        callbacks.forEach(fct => fct(path + '.' + prop))
        return true
      }
    }
  }
  return new Proxy(state, handler(state));
}
