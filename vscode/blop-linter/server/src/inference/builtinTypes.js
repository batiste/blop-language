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
    setTimeout: AnyFunctionType,             // returns a timer id
    setInterval: AnyFunctionType,            // returns a timer id
    clearTimeout: AnyFunctionType,
    clearInterval: AnyFunctionType,
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
  eval: { type: 'Function' },
  uneval: { type: 'Function' },
  isFinite: { type: 'Function' },
  isNaN: { type: 'Function' },
  parseFloat: { type: 'Function' },
  parseInt: {
    type: 'Function',
    documentation: 'The parseInt() function parses a string argument and returns an integer of the specified radix (the base in mathematical numeral systems).',
    detail: 'parseInt(string, radix);',
  },
  decodeURI: { type: 'Function' },
  decodeURIComponent: { type: 'Function' },
  encodeURI: { type: 'Function' },
  encodeURIComponent: { type: 'Function' },
  escape: { type: 'Function' },
  unescape: { type: 'Function' },
  
  // Jest API
  test: { type: 'Function', detail: 'test(description, Function) { ... }' },
  expect: { type: 'Function', detail: 'expect(expression).toBe(value)', documentation: 'https://jestjs.io/docs/en/expect' },
  
  // Language keywords and object references
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
