// ============================================================================
// Built-in Types - Type definitions for native JavaScript objects
// ============================================================================

import {
  Types,
  AnyType, StringType, NumberType, BooleanType, NullType, UndefinedType,
} from './Type.js';

/**
 * Define built-in object types with their properties.
 * Values are structured Type objects (from Type.js).
 * This allows the type system to validate property access on native JS objects.
 */
export const builtinObjectTypes = {
  // Snabbdom VNode type
  VNode: {
    elm: AnyType,                                         // The DOM element
    data: AnyType,                                        // VNode data (props, style, etc)
    children: AnyType,                                    // Child VNodes
    text: Types.union([StringType, UndefinedType]),       // Text content
    key: AnyType,                                         // VNode key
    sel: Types.union([StringType, UndefinedType]),        // Selector
  },

  // JavaScript Math object – all methods return number
  Math: {
    E: NumberType,
    LN10: NumberType,
    LN2: NumberType,
    LOG10E: NumberType,
    LOG2E: NumberType,
    PI: NumberType,
    SQRT1_2: NumberType,
    SQRT2: NumberType,
    abs: NumberType,
    acos: NumberType,
    acosh: NumberType,
    asin: NumberType,
    asinh: NumberType,
    atan: NumberType,
    atan2: NumberType,
    atanh: NumberType,
    cbrt: NumberType,
    ceil: NumberType,
    clz32: NumberType,
    cos: NumberType,
    cosh: NumberType,
    exp: NumberType,
    expm1: NumberType,
    floor: NumberType,
    fround: NumberType,
    hypot: NumberType,
    imul: NumberType,
    log: NumberType,
    log10: NumberType,
    log1p: NumberType,
    log2: NumberType,
    max: NumberType,
    min: NumberType,
    pow: NumberType,
    random: NumberType,
    round: NumberType,
    sign: NumberType,
    sin: NumberType,
    sinh: NumberType,
    sqrt: NumberType,
    tan: NumberType,
    tanh: NumberType,
    trunc: NumberType,
  },

  // JavaScript console object – all methods return undefined
  console: {
    log: UndefinedType,
    info: UndefinedType,
    warn: UndefinedType,
    error: UndefinedType,
    debug: UndefinedType,
    trace: UndefinedType,
    dir: UndefinedType,
    dirxml: UndefinedType,
    table: UndefinedType,
    group: UndefinedType,
    groupCollapsed: UndefinedType,
    groupEnd: UndefinedType,
    clear: UndefinedType,
    count: NumberType,
    countReset: UndefinedType,
    assert: UndefinedType,
    time: UndefinedType,
    timeLog: UndefinedType,
    timeEnd: UndefinedType,
  },

  // JavaScript JSON object
  JSON: {
    parse: AnyType,
    stringify: Types.union([StringType, UndefinedType]),
  },

  // JavaScript Object constructor
  Object: {
    assign: AnyType,
    create: AnyType,
    defineProperty: AnyType,
    defineProperties: AnyType,
    entries: Types.array(AnyType),
    freeze: AnyType,
    fromEntries: AnyType,
    getOwnPropertyDescriptor: AnyType,
    getOwnPropertyDescriptors: AnyType,
    getOwnPropertyNames: Types.array(StringType),
    getOwnPropertySymbols: Types.array(AnyType),
    getPrototypeOf: AnyType,
    is: BooleanType,
    isExtensible: BooleanType,
    isFrozen: BooleanType,
    isSealed: BooleanType,
    keys: Types.array(StringType),
    preventExtensions: AnyType,
    seal: AnyType,
    setPrototypeOf: AnyType,
    values: Types.array(AnyType),
  },

  // JavaScript Array constructor
  Array: {
    from: Types.array(AnyType),
    isArray: BooleanType,
    of: Types.array(AnyType),
  },

  // JavaScript Date constructor
  Date: {
    now: NumberType,
    parse: NumberType,
    UTC: NumberType,
  },

  // JavaScript Number constructor
  Number: {
    EPSILON: NumberType,
    MAX_SAFE_INTEGER: NumberType,
    MAX_VALUE: NumberType,
    MIN_SAFE_INTEGER: NumberType,
    MIN_VALUE: NumberType,
    NEGATIVE_INFINITY: NumberType,
    NaN: NumberType,
    POSITIVE_INFINITY: NumberType,
    isFinite: BooleanType,
    isInteger: BooleanType,
    isNaN: BooleanType,
    isSafeInteger: BooleanType,
    parseFloat: NumberType,
    parseInt: NumberType,
  },

  // JavaScript String constructor
  String: {
    fromCharCode: StringType,
    fromCodePoint: StringType,
    raw: StringType,
  },

  // JavaScript Promise constructor – returns are opaque without generics
  Promise: {
    all: AnyType,
    allSettled: AnyType,
    any: AnyType,
    race: AnyType,
    reject: AnyType,
    resolve: AnyType,
  },

  // Browser window object (common properties)
  window: {
    document: AnyType,
    console: AnyType,
    alert: UndefinedType,
    confirm: BooleanType,
    prompt: Types.union([StringType, NullType]),
    setTimeout: NumberType,             // returns a timer id
    setInterval: NumberType,            // returns a timer id
    clearTimeout: UndefinedType,
    clearInterval: UndefinedType,
    fetch: AnyType,                     // returns Promise<Response>; typed as any until generics
    location: AnyType,
    history: AnyType,
    navigator: AnyType,
    screen: AnyType,
    localStorage: AnyType,
    sessionStorage: AnyType,
    requestAnimationFrame: NumberType,  // returns a request id
    cancelAnimationFrame: UndefinedType,
  },

  // Browser document object (common properties)
  document: {
    getElementById: AnyType,            // returns HTMLElement | null
    getElementsByClassName: AnyType,    // returns HTMLCollectionOf<Element>
    getElementsByTagName: AnyType,      // returns HTMLCollectionOf<Element>
    querySelector: AnyType,             // returns Element | null
    querySelectorAll: AnyType,          // returns NodeListOf<Element>
    createElement: AnyType,             // returns HTMLElement
    createTextNode: AnyType,            // returns Text
    createDocumentFragment: AnyType,    // returns DocumentFragment
    body: AnyType,
    head: AnyType,
    title: StringType,
    cookie: StringType,
    location: AnyType,
    URL: StringType,
    domain: StringType,
    referrer: StringType,
    addEventListener: UndefinedType,
    removeEventListener: UndefinedType,
  },
};

/**
 * Built-in method/property types for primitive types (string, number, boolean, array).
 * Each entry maps a method or property name to its Type.
 *
 * Methods that vary by argument (e.g. Array.map) use AnyType as a conservative
 * fallback – they can be tightened later with generic support.
 */
export const builtinPrimitiveTypes = {
  // ---------------------------------------------------------------------------
  // String prototype
  // ---------------------------------------------------------------------------
  string: {
    // Properties
    length: NumberType,
    // Methods
    charAt: StringType,
    charCodeAt: NumberType,
    codePointAt: Types.union([NumberType, UndefinedType]),
    concat: StringType,
    endsWith: BooleanType,
    includes: BooleanType,
    indexOf: NumberType,
    lastIndexOf: NumberType,
    localeCompare: NumberType,
    match: AnyType,
    matchAll: AnyType,
    normalize: StringType,
    padEnd: StringType,
    padStart: StringType,
    repeat: StringType,
    replace: StringType,
    replaceAll: StringType,
    search: NumberType,
    slice: StringType,
    split: Types.array(StringType),
    startsWith: BooleanType,
    substring: StringType,
    toLocaleLowerCase: StringType,
    toLocaleUpperCase: StringType,
    toLowerCase: StringType,
    toString: StringType,
    toUpperCase: StringType,
    trim: StringType,
    trimEnd: StringType,
    trimStart: StringType,
    valueOf: StringType,
    at: Types.union([StringType, UndefinedType]),
  },

  // ---------------------------------------------------------------------------
  // Number prototype
  // ---------------------------------------------------------------------------
  number: {
    toExponential: StringType,
    toFixed: StringType,
    toLocaleString: StringType,
    toPrecision: StringType,
    toString: StringType,
    valueOf: NumberType,
  },

  // ---------------------------------------------------------------------------
  // Boolean prototype
  // ---------------------------------------------------------------------------
  boolean: {
    toString: StringType,
    valueOf: BooleanType,
  },

  // ---------------------------------------------------------------------------
  // Array prototype  (element type is unknown here, so we use AnyType or array(AnyType))
  // ---------------------------------------------------------------------------
  array: {
    // Properties
    length: NumberType,
    // Mutating methods
    push: NumberType,
    pop: AnyType,
    shift: AnyType,
    unshift: NumberType,
    splice: Types.array(AnyType),
    reverse: Types.array(AnyType),
    sort: Types.array(AnyType),
    fill: Types.array(AnyType),
    copyWithin: Types.array(AnyType),
    // Non-mutating methods
    concat: Types.array(AnyType),
    join: StringType,
    slice: Types.array(AnyType),
    indexOf: NumberType,
    lastIndexOf: NumberType,
    includes: BooleanType,
    find: AnyType,
    findIndex: NumberType,
    findLast: AnyType,
    findLastIndex: NumberType,
    every: BooleanType,
    some: BooleanType,
    forEach: UndefinedType,
    map: Types.array(AnyType),
    filter: Types.array(AnyType),
    reduce: AnyType,
    reduceRight: AnyType,
    flat: Types.array(AnyType),
    flatMap: Types.array(AnyType),
    keys: AnyType,
    values: AnyType,
    entries: AnyType,
    at: AnyType,
    toString: StringType,
    toLocaleString: StringType,
    toReversed: Types.array(AnyType),
    toSorted: Types.array(AnyType),
    toSpliced: Types.array(AnyType),
    with: Types.array(AnyType),
  },
};

/**
 * Get the Type of a method/property on a primitive type.
 * @param {string} primitiveType - 'string' | 'number' | 'boolean' | 'array'
 * @param {string} memberName - The method or property name
 * @returns {Type|null} The Type, or null if unknown
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
