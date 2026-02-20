// ============================================================================
// Built-in Types - Type definitions for native JavaScript objects
// ============================================================================

import {
  Types,
  AnyType, StringType, NumberType, BooleanType, NullType, UndefinedType,
  ArrayType, UnionType,
  FunctionType,
  AnyFunctionType,
} from './Type.js';

/**
 * Define built-in object types with their properties.
 * Values are structured Type objects (from Type.js).
 * This allows the type system to validate property access on native JS objects.
 */
let builtinObjectTypes = {
  // Component type - injected context for component functions
  // Provides access to hooks like useState, useEffect, etc.
  Component: {
    // function useState(key, initialValue) {
    //   return { value, setState: (newValue) => {}, getState: () => value };
    // }
    useState: new FunctionType(
      [StringType, Types.alias('T')],
      Types.object(new Map([
        ['value',    { type: Types.alias('T'), optional: false }],
        ['setState', { type: new FunctionType([Types.alias('T')], UndefinedType, [], ['newValue']), optional: false }],
        ['getState', { type: new FunctionType([], Types.alias('T')), optional: false }],
      ])),
      ['T'],
      ['key', 'initialValue']
    ),

    // function onMount() { return this; }
    onMount: new FunctionType([], AnyType, [], []),

    // function onUnmount() { return this; }
    onUnmount: new FunctionType([], AnyType, [], []),

    // function onChange(attribute, callback) { ... }
    onChange: new FunctionType([StringType, AnyType], UndefinedType, [], ['attribute', 'callback']),

    // function mount(func) { return this; }
    mount: new FunctionType([AnyType], AnyType, [], ['func']),

    // function unmount(func) { return this; }
    unmount: new FunctionType([AnyType], AnyType, [], ['func']),

    // function refresh() { ... }
    refresh: new FunctionType([], UndefinedType, [], []),

    // function useContext(name, initialValue) {
    //   return { setContext, getContext, value };
    // }
    useContext: new FunctionType(
      [StringType, Types.alias('T')],
      Types.object(new Map([
        ['setContext', { type: new FunctionType([Types.alias('T')], UndefinedType, [], ['value']), optional: false }],
        ['getContext', { type: new FunctionType([], Types.alias('T')), optional: false }],
        ['value',      { type: Types.alias('T'), optional: false }],
      ])),
      ['T'],
      ['name', 'initialValue']
    ),
  },

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
    abs: new FunctionType([NumberType], NumberType, [], ['x']),
    acos: new FunctionType([NumberType], NumberType, [], ['x']),
    acosh: new FunctionType([NumberType], NumberType, [], ['x']),
    asin: new FunctionType([NumberType], NumberType, [], ['x']),
    asinh: new FunctionType([NumberType], NumberType, [], ['x']),
    atan: new FunctionType([NumberType], NumberType, [], ['x']),
    atan2: new FunctionType([NumberType, NumberType], NumberType, [], ['y', 'x']),
    atanh: new FunctionType([NumberType], NumberType, [], ['x']),
    cbrt: new FunctionType([NumberType], NumberType, [], ['x']),
    ceil: new FunctionType([NumberType], NumberType, [], ['x']),
    clz32: new FunctionType([NumberType], NumberType, [], ['x']),
    cos: new FunctionType([NumberType], NumberType, [], ['x']),
    cosh: new FunctionType([NumberType], NumberType, [], ['x']),
    exp: new FunctionType([NumberType], NumberType, [], ['x']),
    expm1: new FunctionType([NumberType], NumberType, [], ['x']),
    floor: new FunctionType([NumberType], NumberType, [], ['x']),
    fround: new FunctionType([NumberType], NumberType, [], ['x']),
    hypot: new FunctionType([NumberType], NumberType, [], ['args']),
    imul: new FunctionType([NumberType, NumberType], NumberType, [], ['a', 'b']),
    log: new FunctionType([NumberType], NumberType, [], ['x']),
    log10: new FunctionType([NumberType], NumberType, [], ['x']),
    log1p: new FunctionType([NumberType], NumberType, [], ['x']),
    log2: new FunctionType([NumberType], NumberType, [], ['x']),
    max: new FunctionType([NumberType], NumberType, [], ['values']),
    min: new FunctionType([NumberType], NumberType, [], ['values']),
    pow: new FunctionType([NumberType, NumberType], NumberType, [], ['x', 'y']),
    random: new FunctionType([], NumberType, [], []),
    round: new FunctionType([NumberType], NumberType, [], ['x']),
    sign: new FunctionType([NumberType], NumberType, [], ['x']),
    sin: new FunctionType([NumberType], NumberType, [], ['x']),
    sinh: new FunctionType([NumberType], NumberType, [], ['x']),
    sqrt: new FunctionType([NumberType], NumberType, [], ['x']),
    tan: new FunctionType([NumberType], NumberType, [], ['x']),
    tanh: new FunctionType([NumberType], NumberType, [], ['x']),
    trunc: new FunctionType([NumberType], NumberType, [], ['x']),
  },

  // JavaScript console object – all methods are functions that return undefined
  console: {
    log: new FunctionType([], UndefinedType, [], []),
    info: new FunctionType([], UndefinedType, [], []),
    warn: new FunctionType([], UndefinedType, [], []),
    error: new FunctionType([], UndefinedType, [], []),
    debug: new FunctionType([], UndefinedType, [], []),
    trace: new FunctionType([], UndefinedType, [], []),
    dir: new FunctionType([], UndefinedType, [], []),
    dirxml: new FunctionType([], UndefinedType, [], []),
    table: new FunctionType([], UndefinedType, [], []),
    group: new FunctionType([], UndefinedType, [], []),
    groupCollapsed: new FunctionType([], UndefinedType, [], []),
    groupEnd: new FunctionType([], UndefinedType, [], []),
    clear: new FunctionType([], UndefinedType, [], []),
    count: new FunctionType([], NumberType, [], []),
    countReset: new FunctionType([], UndefinedType, [], []),
    assert: new FunctionType([], UndefinedType, [], []),
    time: new FunctionType([], UndefinedType, [], []),
    timeLog: new FunctionType([], UndefinedType, [], []),
    timeEnd: new FunctionType([], UndefinedType, [], []),
  },

  // JavaScript JSON object
  JSON: {
    parse: new FunctionType([StringType], AnyType, [], ['text']),
    stringify: new FunctionType([AnyType], Types.union([StringType, UndefinedType]), [], ['value']),
  },

  // JavaScript Object constructor
  Object: {
    assign: new FunctionType([AnyType], AnyType, [], ['target']),
    create: new FunctionType([AnyType], AnyType, [], ['proto']),
    defineProperty: new FunctionType([AnyType, StringType, AnyType], AnyType, [], ['obj', 'key', 'descriptor']),
    defineProperties: new FunctionType([AnyType, AnyType], AnyType, [], ['obj', 'properties']),
    entries: new FunctionType([AnyType], Types.array(AnyType), [], ['obj']),
    freeze: new FunctionType([AnyType], AnyType, [], ['obj']),
    fromEntries: new FunctionType([AnyType], AnyType, [], ['iterable']),
    getOwnPropertyDescriptor: new FunctionType([AnyType, StringType], AnyType, [], ['obj', 'key']),
    getOwnPropertyDescriptors: new FunctionType([AnyType], AnyType, [], ['obj']),
    getOwnPropertyNames: new FunctionType([AnyType], Types.array(StringType), [], ['obj']),
    getOwnPropertySymbols: new FunctionType([AnyType], Types.array(AnyType), [], ['obj']),
    getPrototypeOf: new FunctionType([AnyType], AnyType, [], ['obj']),
    is: new FunctionType([AnyType, AnyType], BooleanType, [], ['value1', 'value2']),
    isExtensible: new FunctionType([AnyType], BooleanType, [], ['obj']),
    isFrozen: new FunctionType([AnyType], BooleanType, [], ['obj']),
    isSealed: new FunctionType([AnyType], BooleanType, [], ['obj']),
    keys: new FunctionType([AnyType], Types.array(StringType), [], ['obj']),
    preventExtensions: new FunctionType([AnyType], AnyType, [], ['obj']),
    seal: new FunctionType([AnyType], AnyType, [], ['obj']),
    setPrototypeOf: new FunctionType([AnyType, AnyType], AnyType, [], ['obj', 'prototype']),
    values: new FunctionType([AnyType], Types.array(AnyType), [], ['obj']),
  },

  // JavaScript Array constructor
  Array: {
    from: new FunctionType([AnyType], Types.array(AnyType), [], ['arrayLike']),
    isArray: new FunctionType([AnyType], BooleanType, [], ['value']),
    of: new FunctionType([AnyType], Types.array(AnyType), [], ['elements']),
  },

  Symbol: AnyType,
  RegExp: AnyType,
  Error: AnyType,
  Proxy: AnyType,

  // JavaScript Date constructor
  Date: {
    now: new FunctionType([], NumberType, [], []),
    parse: new FunctionType([StringType], NumberType, [], ['dateString']),
    UTC: new FunctionType([NumberType], NumberType, [], ['year']),
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
    isFinite: new FunctionType([AnyType], BooleanType, [], ['value']),
    isInteger: new FunctionType([AnyType], BooleanType, [], ['value']),
    isNaN: new FunctionType([AnyType], BooleanType, [], ['value']),
    isSafeInteger: new FunctionType([AnyType], BooleanType, [], ['value']),
    parseFloat: new FunctionType([StringType], NumberType, [], ['string']),
    parseInt: new FunctionType([StringType], NumberType, [], ['string']),
  },

  // JavaScript String constructor
  String: {
    fromCharCode: new FunctionType([NumberType], StringType, [], ['charCodes']),
    fromCodePoint: new FunctionType([NumberType], StringType, [], ['codePoints']),
    raw: new FunctionType([AnyType], StringType, [], ['template']),
  },

  // JavaScript Promise constructor – returns are opaque without generics
  Promise: {
    all: new FunctionType([AnyType], AnyType, [], ['iterable']),
    allSettled: new FunctionType([AnyType], AnyType, [], ['iterable']),
    any: new FunctionType([AnyType], AnyType, [], ['iterable']),
    race: new FunctionType([AnyType], AnyType, [], ['iterable']),
    reject: new FunctionType([AnyType], AnyType, [], ['reason']),
    resolve: new FunctionType([AnyType], AnyType, [], ['value']),
  },

  // Browser window object (common properties)
  window: {
    document: AnyType,
    console: AnyType,
    alert: new FunctionType([StringType], UndefinedType, [], ['message']),
    confirm: new FunctionType([StringType], BooleanType, [], ['message']),
    prompt: new FunctionType([StringType], Types.union([StringType, NullType]), [], ['message']),
    setTimeout: new FunctionType([AnyFunctionType, NumberType], NumberType, [], ['callback', 'delay']),
    setInterval: new FunctionType([AnyFunctionType, NumberType], NumberType, [], ['callback', 'delay']),
    clearTimeout: new FunctionType([NumberType], UndefinedType, [], ['id']),
    clearInterval: new FunctionType([NumberType], UndefinedType, [], ['id']),
    fetch: new FunctionType([StringType], AnyType, [], ['url']),  // returns Promise<Response>; typed as any until generics
    location: AnyType,
    history: AnyType,
    navigator: AnyType,
    screen: AnyType,
    localStorage: AnyType,
    sessionStorage: AnyType,
    requestAnimationFrame: new FunctionType([AnyFunctionType], NumberType, [], ['callback']),
    cancelAnimationFrame: new FunctionType([NumberType], UndefinedType, [], ['id']),
  },

  // Browser document object (common properties)
  document: {
    getElementById: new FunctionType([StringType], AnyType, [], ['id']),            // returns HTMLElement | null
    getElementsByClassName: new FunctionType([StringType], AnyType, [], ['className']),    // returns HTMLCollectionOf<Element>
    getElementsByTagName: new FunctionType([StringType], AnyType, [], ['tagName']),      // returns HTMLCollectionOf<Element>
    querySelector: new FunctionType([StringType], AnyType, [], ['selector']),             // returns Element | null
    querySelectorAll: new FunctionType([StringType], AnyType, [], ['selector']),          // returns NodeListOf<Element>
    createElement: new FunctionType([StringType], AnyType, [], ['tagName']),             // returns HTMLElement
    createTextNode: new FunctionType([StringType], AnyType, [], ['text']),            // returns Text
    createDocumentFragment: new FunctionType([], AnyType, [], []),    // returns DocumentFragment
    body: AnyType,
    head: AnyType,
    title: StringType,
    cookie: StringType,
    location: AnyType,
    URL: StringType,
    domain: StringType,
    referrer: StringType,
    addEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
    removeEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
  },
};

builtinObjectTypes = { ...builtinObjectTypes, ...builtinObjectTypes.window }; // Include all global properties (e.g. setTimeout) as built-in types for convenience

export default builtinObjectTypes;

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
    charAt: new FunctionType([NumberType], StringType, [], ['index']),
    charCodeAt: new FunctionType([NumberType], NumberType, [], ['index']),
    codePointAt: new FunctionType([NumberType], Types.union([NumberType, UndefinedType]), [], ['index']),
    concat: new FunctionType([StringType], StringType, [], ['strings']),
    endsWith: new FunctionType([StringType], BooleanType, [], ['searchString']),
    includes: new FunctionType([StringType], BooleanType, [], ['searchString']),
    indexOf: new FunctionType([StringType], NumberType, [], ['searchString']),
    lastIndexOf: new FunctionType([StringType], NumberType, [], ['searchString']),
    localeCompare: new FunctionType([StringType], NumberType, [], ['compareString']),
    match: new FunctionType([AnyType], AnyType, [], ['regexp']),
    matchAll: new FunctionType([AnyType], AnyType, [], ['regexp']),
    normalize: new FunctionType([], StringType, [], []),
    padEnd: new FunctionType([NumberType], StringType, [], ['targetLength']),
    padStart: new FunctionType([NumberType], StringType, [], ['targetLength']),
    repeat: new FunctionType([NumberType], StringType, [], ['count']),
    replace: new FunctionType([AnyType, AnyType], StringType, [], ['searchValue', 'replaceValue']),
    replaceAll: new FunctionType([AnyType, AnyType], StringType, [], ['searchValue', 'replaceValue']),
    search: new FunctionType([AnyType], NumberType, [], ['regexp']),
    slice: new FunctionType([NumberType], StringType, [], ['begin']),
    split: new FunctionType([StringType], Types.array(StringType), [], ['separator']),
    startsWith: new FunctionType([StringType], BooleanType, [], ['searchString']),
    substring: new FunctionType([NumberType], StringType, [], ['start']),
    toLocaleLowerCase: new FunctionType([], StringType, [], []),
    toLocaleUpperCase: new FunctionType([], StringType, [], []),
    toLowerCase: new FunctionType([], StringType, [], []),
    toString: new FunctionType([], StringType, [], []),
    toUpperCase: new FunctionType([], StringType, [], []),
    trim: new FunctionType([], StringType, [], []),
    trimEnd: new FunctionType([], StringType, [], []),
    trimStart: new FunctionType([], StringType, [], []),
    valueOf: new FunctionType([], StringType, [], []),
    at: new FunctionType([NumberType], Types.union([StringType, UndefinedType]), [], ['index']),
  },

  // ---------------------------------------------------------------------------
  // Number prototype
  // ---------------------------------------------------------------------------
  number: {
    toExponential: new FunctionType([], StringType, [], []),
    toFixed: new FunctionType([], StringType, [], []),
    toLocaleString: new FunctionType([], StringType, [], []),
    toPrecision: new FunctionType([], StringType, [], []),
    toString: new FunctionType([], StringType, [], []),
    valueOf: new FunctionType([], NumberType, [], []),
  },

  // ---------------------------------------------------------------------------
  // Boolean prototype
  // ---------------------------------------------------------------------------
  boolean: {
    toString: new FunctionType([], StringType, [], []),
    valueOf: new FunctionType([], BooleanType, [], []),
  },

  // ---------------------------------------------------------------------------
  // Array prototype  (element type is unknown here, so we use AnyType or array(AnyType))
  // ---------------------------------------------------------------------------
  array: {
    // Properties
    length: NumberType,
    // Mutating methods
    push: new FunctionType([AnyType], NumberType, [], ['elements']),
    pop: new FunctionType([], AnyType, [], []),
    shift: new FunctionType([], AnyType, [], []),
    unshift: new FunctionType([AnyType], NumberType, [], ['elements']),
    splice: new FunctionType([NumberType], Types.array(AnyType), [], ['start']),
    reverse: new FunctionType([], Types.array(AnyType), [], []),
    sort: new FunctionType([], Types.array(AnyType), [], []),
    fill: new FunctionType([AnyType], Types.array(AnyType), [], ['value']),
    copyWithin: new FunctionType([NumberType], Types.array(AnyType), [], ['target']),
    // Non-mutating methods
    concat: new FunctionType([AnyType], Types.array(AnyType), [], ['items']),
    join: new FunctionType([StringType], StringType, [], ['separator']),
    slice: new FunctionType([NumberType], Types.array(AnyType), [], ['start']),
    indexOf: new FunctionType([AnyType], NumberType, [], ['searchElement']),
    lastIndexOf: new FunctionType([AnyType], NumberType, [], ['searchElement']),
    includes: new FunctionType([AnyType], BooleanType, [], ['searchElement']),
    find: new FunctionType([AnyFunctionType], AnyType, [], ['predicate']),
    findIndex: new FunctionType([AnyFunctionType], NumberType, [], ['predicate']),
    findLast: new FunctionType([AnyFunctionType], AnyType, [], ['predicate']),
    findLastIndex: new FunctionType([AnyFunctionType], NumberType, [], ['predicate']),
    every: new FunctionType([AnyFunctionType], BooleanType, [], ['predicate']),
    some: new FunctionType([AnyFunctionType], BooleanType, [], ['predicate']),
    forEach: new FunctionType([AnyFunctionType], UndefinedType, [], ['callback']),
    map: new FunctionType([AnyFunctionType], Types.array(AnyType), [], ['callback']),
    filter: new FunctionType([AnyFunctionType], Types.array(AnyType), [], ['predicate']),
    reduce: new FunctionType([AnyFunctionType], AnyType, [], ['callback']),
    reduceRight: new FunctionType([AnyFunctionType], AnyType, [], ['callback']),
    flat: new FunctionType([], Types.array(AnyType), [], []),
    flatMap: new FunctionType([AnyFunctionType], Types.array(AnyType), [], ['callback']),
    keys: new FunctionType([], AnyType, [], []),
    values: new FunctionType([], AnyType, [], []),
    entries: new FunctionType([], AnyType, [], []),
    at: new FunctionType([NumberType], AnyType, [], ['index']),
    toString: new FunctionType([], StringType, [], []),
    toLocaleString: new FunctionType([], StringType, [], []),
    toReversed: new FunctionType([], Types.array(AnyType), [], []),
    toSorted: new FunctionType([], Types.array(AnyType), [], []),
    toSpliced: new FunctionType([NumberType], Types.array(AnyType), [], ['start']),
    with: new FunctionType([NumberType, AnyType], Types.array(AnyType), [], ['index', 'value']),
  },
};

/**
 * Get the element-type-aware return type for an array member access or call.
 *
 * Some array methods have return types that depend on the element type T of the
 * array (e.g. `pop()` returns `T | undefined`, `map()` returns `T[]`).
 * This function resolves those instead of falling back to the generic `AnyType`
 * entries in `builtinPrimitiveTypes.array`.
 *
 * @param {ArrayType} arrayType  - The concrete array type (e.g. `number[]`)
 * @param {string}   memberName - The method or property name
 * @returns {import('./Type.js').Type}  The resolved return type
 */
export function getArrayMemberType(arrayType, memberName) {
  if (!(arrayType instanceof ArrayType)) {
    return builtinPrimitiveTypes.array[memberName] ?? AnyType;
  }

  const T = arrayType.elementType;

  // Methods / properties whose return type depends on T
  switch (memberName) {
    // Returns T | undefined
    case 'pop':
    case 'shift':
    case 'find':
    case 'findLast':
    case 'at':
      return new UnionType([T, UndefinedType]);

    // Returns T[]  (new array of same element type)
    case 'reverse':
    case 'sort':
    case 'fill':
    case 'copyWithin':
    case 'filter':
    case 'slice':
    case 'flat':
    case 'toReversed':
    case 'toSorted':
    case 'toSpliced':
    case 'with':
      return new ArrayType(T);

    // map / flatMap return a different element type (unknown at this stage → any[])
    // but concat merges arrays of the same type
    case 'concat':
      return new ArrayType(T);

    // Returns T (safe – splice returns the removed elements)
    case 'splice':
      return new ArrayType(T);

    default:
      // Fall back to the static table in builtinPrimitiveTypes
      return builtinPrimitiveTypes.array[memberName] ?? AnyType;
  }
}

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

// ============================================================================
// Global Constants and Functions (non-object built-ins)
// ============================================================================

/**
 * Global constants and functions that are not part of object types.
 * These complement builtinObjectTypes and builtinPrimitiveTypes.
 */
export const builtinGlobals = {
  // Primitive value constants
  Infinity: { type: 'Value' },
  NaN: { type: 'Value' },
  undefined: { type: 'Value' },
  null: { type: 'Value' },
  true: { type: 'Value' },
  false: { type: 'Value' },
  
  // Global functions
  eval: new FunctionType([StringType], AnyType, [], ['code']),
  uneval: new FunctionType([AnyType], StringType, [], ['value']),
  isFinite: new FunctionType([AnyType], BooleanType, [], ['value']),
  isNaN: new FunctionType([AnyType], BooleanType, [], ['value']),
  parseFloat: new FunctionType([StringType], NumberType, [], ['string']),
  parseInt: new FunctionType([StringType, NumberType], NumberType, [], ['string', 'radix']),
  decodeURI: new FunctionType([StringType], StringType, [], ['encodedURI']),
  decodeURIComponent: new FunctionType([StringType], StringType, [], ['encodedURIComponent']),
  encodeURI: new FunctionType([StringType], StringType, [], ['uri']),
  encodeURIComponent: new FunctionType([StringType], StringType, [], ['uriComponent']),
  escape: new FunctionType([StringType], StringType, [], ['string']),
  unescape: new FunctionType([StringType], StringType, [], ['string']),
  
  // Jest API
  test: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['description', 'callback']),
  expect: new FunctionType([AnyType], AnyType, [], ['value']),
  
  // Language keywords and object references
  // TODO: think about using inference for these 
  // instead of hardcoding as globals 
  // (e.g. `this` type depends on context, 
  // `super` only valid in classes)
  arguments: { type: 'Object' },
  this: { type: 'Reference' },
  super: { type: 'Function' },
  
  // Environment specific
  __dirname: { type: 'String' },
};

/**
 * Get all built-in global names (both objects and other globals).
 * Used by the backend validator to check if a name is defined.
 */
export function getGlobalNames() {
  const names = new Set();
  
  // Add object type names
  Object.keys(builtinObjectTypes).forEach(name => names.add(name));
  
  // Add global constants and functions
  Object.keys(builtinGlobals).forEach(name => names.add(name));
  
  return names;
}

/**
 * Get metadata for globals used in autocomplete and hover information.
 * Combines type, documentation, and detail for VS Code server.
 */
export function getGlobalMetadata() {
  const metadata = {};
  
  // Add globals with their metadata
  Object.entries(builtinGlobals).forEach(([name, info]) => {
    metadata[name] = info;
  });
  
  // Add object types (all have type 'Object')
  Object.keys(builtinObjectTypes).forEach(name => {
    if (!metadata[name]) {
      metadata[name] = { type: 'Object' };
    }
  });
  
  return metadata;
}
