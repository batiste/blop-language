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

  // JavaScript Math object – all methods return number
  Math: {
    E: 'number',
    LN10: 'number',
    LN2: 'number',
    LOG10E: 'number',
    LOG2E: 'number',
    PI: 'number',
    SQRT1_2: 'number',
    SQRT2: 'number',
    abs: 'number',
    acos: 'number',
    acosh: 'number',
    asin: 'number',
    asinh: 'number',
    atan: 'number',
    atan2: 'number',
    atanh: 'number',
    cbrt: 'number',
    ceil: 'number',
    clz32: 'number',
    cos: 'number',
    cosh: 'number',
    exp: 'number',
    expm1: 'number',
    floor: 'number',
    fround: 'number',
    hypot: 'number',
    imul: 'number',
    log: 'number',
    log10: 'number',
    log1p: 'number',
    log2: 'number',
    max: 'number',
    min: 'number',
    pow: 'number',
    random: 'number',
    round: 'number',
    sign: 'number',
    sin: 'number',
    sinh: 'number',
    sqrt: 'number',
    tan: 'number',
    tanh: 'number',
    trunc: 'number',
  },

  // JavaScript console object – all methods return undefined
  console: {
    log: 'undefined',
    info: 'undefined',
    warn: 'undefined',
    error: 'undefined',
    debug: 'undefined',
    trace: 'undefined',
    dir: 'undefined',
    dirxml: 'undefined',
    table: 'undefined',
    group: 'undefined',
    groupCollapsed: 'undefined',
    groupEnd: 'undefined',
    clear: 'undefined',
    count: 'number',
    countReset: 'undefined',
    assert: 'undefined',
    time: 'undefined',
    timeLog: 'undefined',
    timeEnd: 'undefined',
  },

  // JavaScript JSON object
  JSON: {
    parse: 'any',
    stringify: 'string | undefined',
  },

  // JavaScript Object constructor
  Object: {
    assign: 'any',
    create: 'any',
    defineProperty: 'any',
    defineProperties: 'any',
    entries: 'any[]',
    freeze: 'any',
    fromEntries: 'any',
    getOwnPropertyDescriptor: 'any',
    getOwnPropertyDescriptors: 'any',
    getOwnPropertyNames: 'string[]',
    getOwnPropertySymbols: 'any[]',
    getPrototypeOf: 'any',
    is: 'boolean',
    isExtensible: 'boolean',
    isFrozen: 'boolean',
    isSealed: 'boolean',
    keys: 'string[]',
    preventExtensions: 'any',
    seal: 'any',
    setPrototypeOf: 'any',
    values: 'any[]',
  },

  // JavaScript Array constructor
  Array: {
    from: 'any[]',
    isArray: 'boolean',
    of: 'any[]',
  },

  // JavaScript Date constructor
  Date: {
    now: 'number',
    parse: 'number',
    UTC: 'number',
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
    isFinite: 'boolean',
    isInteger: 'boolean',
    isNaN: 'boolean',
    isSafeInteger: 'boolean',
    parseFloat: 'number',
    parseInt: 'number',
  },

  // JavaScript String constructor
  String: {
    fromCharCode: 'string',
    fromCodePoint: 'string',
    raw: 'string',
  },

  // JavaScript Promise constructor – returns are opaque without generics
  Promise: {
    all: 'any',
    allSettled: 'any',
    any: 'any',
    race: 'any',
    reject: 'any',
    resolve: 'any',
  },

  // Browser window object (common properties)
  window: {
    document: 'any',
    console: 'any',
    alert: 'undefined',
    confirm: 'boolean',
    prompt: 'string | null',
    setTimeout: 'number',           // returns a timer id
    setInterval: 'number',          // returns a timer id
    clearTimeout: 'undefined',
    clearInterval: 'undefined',
    fetch: 'any',                   // returns Promise<Response>; typed as any until generics
    location: 'any',
    history: 'any',
    navigator: 'any',
    screen: 'any',
    localStorage: 'any',
    sessionStorage: 'any',
    requestAnimationFrame: 'number', // returns a request id
    cancelAnimationFrame: 'undefined',
  },

  // Browser document object (common properties)
  document: {
    getElementById: 'any',          // returns HTMLElement | null
    getElementsByClassName: 'any',  // returns HTMLCollectionOf<Element>
    getElementsByTagName: 'any',    // returns HTMLCollectionOf<Element>
    querySelector: 'any',           // returns Element | null
    querySelectorAll: 'any',        // returns NodeListOf<Element>
    createElement: 'any',           // returns HTMLElement
    createTextNode: 'any',          // returns Text
    createDocumentFragment: 'any',  // returns DocumentFragment
    body: 'any',
    head: 'any',
    title: 'string',
    cookie: 'string',
    location: 'any',
    URL: 'string',
    domain: 'string',
    referrer: 'string',
    addEventListener: 'undefined',
    removeEventListener: 'undefined',
  },
};

/**
 * Built-in method/property types for primitive types (string, number, boolean, array).
 * Each entry maps a method or property name to its return type when called/accessed.
 *
 * Return types use the same string notation as the rest of the type system.
 * Methods that vary by argument (e.g. Array.map) use 'any' as a conservative
 * fallback – they can be tightened later with generic support.
 */
export const builtinPrimitiveTypes = {
  // ---------------------------------------------------------------------------
  // String prototype
  // ---------------------------------------------------------------------------
  string: {
    // Properties
    length: 'number',
    // Methods returning string
    charAt: 'string',
    charCodeAt: 'number',
    codePointAt: 'number | undefined',
    concat: 'string',
    endsWith: 'boolean',
    includes: 'boolean',
    indexOf: 'number',
    lastIndexOf: 'number',
    localeCompare: 'number',
    match: 'any',
    matchAll: 'any',
    normalize: 'string',
    padEnd: 'string',
    padStart: 'string',
    repeat: 'string',
    replace: 'string',
    replaceAll: 'string',
    search: 'number',
    slice: 'string',
    split: 'string[]',
    startsWith: 'boolean',
    substring: 'string',
    toLocaleLowerCase: 'string',
    toLocaleUpperCase: 'string',
    toLowerCase: 'string',
    toString: 'string',
    toUpperCase: 'string',
    trim: 'string',
    trimEnd: 'string',
    trimStart: 'string',
    valueOf: 'string',
    at: 'string | undefined',
  },

  // ---------------------------------------------------------------------------
  // Number prototype
  // ---------------------------------------------------------------------------
  number: {
    toExponential: 'string',
    toFixed: 'string',
    toLocaleString: 'string',
    toPrecision: 'string',
    toString: 'string',
    valueOf: 'number',
  },

  // ---------------------------------------------------------------------------
  // Boolean prototype
  // ---------------------------------------------------------------------------
  boolean: {
    toString: 'string',
    valueOf: 'boolean',
  },

  // ---------------------------------------------------------------------------
  // Array prototype  (element type is unknown here, so we use 'any' or 'T[]')
  // ---------------------------------------------------------------------------
  array: {
    // Properties
    length: 'number',
    // Mutating methods
    push: 'number',
    pop: 'any',
    shift: 'any',
    unshift: 'number',
    splice: 'any[]',
    reverse: 'any[]',
    sort: 'any[]',
    fill: 'any[]',
    copyWithin: 'any[]',
    // Non-mutating methods
    concat: 'any[]',
    join: 'string',
    slice: 'any[]',
    indexOf: 'number',
    lastIndexOf: 'number',
    includes: 'boolean',
    find: 'any',
    findIndex: 'number',
    findLast: 'any',
    findLastIndex: 'number',
    every: 'boolean',
    some: 'boolean',
    forEach: 'undefined',
    map: 'any[]',
    filter: 'any[]',
    reduce: 'any',
    reduceRight: 'any',
    flat: 'any[]',
    flatMap: 'any[]',
    keys: 'any',
    values: 'any',
    entries: 'any',
    at: 'any',
    toString: 'string',
    toLocaleString: 'string',
    toReversed: 'any[]',
    toSorted: 'any[]',
    toSpliced: 'any[]',
    with: 'any[]',
  },
};

/**
 * Get the return type of a method/property on a primitive type.
 * @param {string} primitiveType - 'string' | 'number' | 'boolean' | 'array'
 * @param {string} memberName - The method or property name
 * @returns {string|null} Return type string, or null if unknown
 */
export function getPrimitiveMemberType(primitiveType, memberName) {
  const members = builtinPrimitiveTypes[primitiveType];
  if (!members) return null;
  return members[memberName] ?? null;
}

/**
 * Check if a given member name exists on a primitive type.
 * @param {string} primitiveType
 * @param {string} memberName
 * @returns {boolean}
 */
export function isPrimitiveMember(primitiveType, memberName) {
  return getPrimitiveMemberType(primitiveType, memberName) !== null;
}

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
