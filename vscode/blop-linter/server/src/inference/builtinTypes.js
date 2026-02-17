// ============================================================================
// Built-in Types - Type definitions for native JavaScript objects
// ============================================================================

/**
 * Define built-in object types with their properties
 * This allows the type system to validate property access on native JS objects
 */
export const builtinObjectTypes = {
  // Snabbdom VNode type
  VNode: {
    elm: 'any',                    // The DOM element
    data: 'any',                   // VNode data (props, style, etc)
    children: 'any',               // Child VNodes
    text: 'string | undefined',    // Text content
    key: 'any',                    // VNode key
    sel: 'string | undefined',     // Selector
  },

  // JavaScript Math object
  Math: {
    E: 'number',
    LN10: 'number',
    LN2: 'number',
    LOG10E: 'number',
    LOG2E: 'number',
    PI: 'number',
    SQRT1_2: 'number',
    SQRT2: 'number',
    abs: 'function',
    acos: 'function',
    acosh: 'function',
    asin: 'function',
    asinh: 'function',
    atan: 'function',
    atan2: 'function',
    atanh: 'function',
    cbrt: 'function',
    ceil: 'function',
    clz32: 'function',
    cos: 'function',
    cosh: 'function',
    exp: 'function',
    expm1: 'function',
    floor: 'function',
    fround: 'function',
    hypot: 'function',
    imul: 'function',
    log: 'function',
    log10: 'function',
    log1p: 'function',
    log2: 'function',
    max: 'function',
    min: 'function',
    pow: 'function',
    random: 'function',
    round: 'function',
    sign: 'function',
    sin: 'function',
    sinh: 'function',
    sqrt: 'function',
    tan: 'function',
    tanh: 'function',
    trunc: 'function',
  },

  // JavaScript console object
  console: {
    log: 'function',
    info: 'function',
    warn: 'function',
    error: 'function',
    debug: 'function',
    trace: 'function',
    dir: 'function',
    dirxml: 'function',
    table: 'function',
    group: 'function',
    groupCollapsed: 'function',
    groupEnd: 'function',
    clear: 'function',
    count: 'function',
    countReset: 'function',
    assert: 'function',
    time: 'function',
    timeLog: 'function',
    timeEnd: 'function',
  },

  // JavaScript JSON object
  JSON: {
    parse: 'function',
    stringify: 'function',
  },

  // JavaScript Object constructor
  Object: {
    assign: 'function',
    create: 'function',
    defineProperty: 'function',
    defineProperties: 'function',
    entries: 'function',
    freeze: 'function',
    fromEntries: 'function',
    getOwnPropertyDescriptor: 'function',
    getOwnPropertyDescriptors: 'function',
    getOwnPropertyNames: 'function',
    getOwnPropertySymbols: 'function',
    getPrototypeOf: 'function',
    is: 'function',
    isExtensible: 'function',
    isFrozen: 'function',
    isSealed: 'function',
    keys: 'function',
    preventExtensions: 'function',
    seal: 'function',
    setPrototypeOf: 'function',
    values: 'function',
  },

  // JavaScript Array constructor
  Array: {
    from: 'function',
    isArray: 'function',
    of: 'function',
  },

  // JavaScript Date constructor
  Date: {
    now: 'function',
    parse: 'function',
    UTC: 'function',
  },

  // JavaScript Number constructor
  Number: {
    EPSILON: 'number',
    MAX_SAFE_INTEGER: 'number',
    MAX_VALUE: 'number',
    MIN_SAFE_INTEGER: 'number',
    MIN_VALUE: 'number',
    NEGATIVE_INFINITY: 'number',
    NaN: 'number',
    POSITIVE_INFINITY: 'number',
    isFinite: 'function',
    isInteger: 'function',
    isNaN: 'function',
    isSafeInteger: 'function',
    parseFloat: 'function',
    parseInt: 'function',
  },

  // JavaScript String constructor
  String: {
    fromCharCode: 'function',
    fromCodePoint: 'function',
    raw: 'function',
  },

  // JavaScript Promise constructor
  Promise: {
    all: 'function',
    allSettled: 'function',
    any: 'function',
    race: 'function',
    reject: 'function',
    resolve: 'function',
  },

  // Browser window object (common properties)
  window: {
    document: 'any',
    console: 'any',
    alert: 'function',
    confirm: 'function',
    prompt: 'function',
    setTimeout: 'function',
    setInterval: 'function',
    clearTimeout: 'function',
    clearInterval: 'function',
    fetch: 'function',
    location: 'any',
    history: 'any',
    navigator: 'any',
    screen: 'any',
    localStorage: 'any',
    sessionStorage: 'any',
    requestAnimationFrame: 'function',
    cancelAnimationFrame: 'function',
  },

  // Browser document object (common properties)
  document: {
    getElementById: 'function',
    getElementsByClassName: 'function',
    getElementsByTagName: 'function',
    querySelector: 'function',
    querySelectorAll: 'function',
    createElement: 'function',
    createTextNode: 'function',
    createDocumentFragment: 'function',
    body: 'any',
    head: 'any',
    title: 'string',
    cookie: 'string',
    location: 'any',
    URL: 'string',
    domain: 'string',
    referrer: 'string',
    addEventListener: 'function',
    removeEventListener: 'function',
  },
};

/**
 * Get the type definition for a built-in object
 * @param {string} typeName - The name of the built-in type
 * @returns {Object|null} The type definition or null if not found
 */
export function getBuiltinObjectType(typeName) {
  return builtinObjectTypes[typeName] || null;
}

/**
 * Check if a type is a known built-in object type
 * @param {string} typeName - The name of the type to check
 * @returns {boolean} True if it's a built-in object type
 */
export function isBuiltinObjectType(typeName) {
  return typeName in builtinObjectTypes;
}
