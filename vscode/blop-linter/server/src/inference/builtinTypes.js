// ============================================================================
// Built-in Types - Type definitions for native JavaScript objects
// ============================================================================

import {
  Types,
  AnyType, StringType, NumberType, BooleanType, NullType, UndefinedType,
  ArrayType, UnionType,
  FunctionType,
  AnyFunctionType,
  ObjectType,
  RecordType,
} from './Type.js';

/**
 * Define built-in object types with their properties.
 * Values are structured Type objects (from Type.js).
 * This allows the type system to validate property access on native JS objects.
 */
let builtinObjectTypes = {
  // Component type - context object for single-ctx component functions.
  // When using: def Foo(ctx: Component): VNode { { attributes, children } = ctx }
  // ctx has shape { attributes, children }.
  Component: {
    // attributes - Record<string, any>: open map of attribute name → value
    attributes: new RecordType(StringType, AnyType),
    // children - array of child VNodes passed to the component
    children: Types.array(Types.union([Types.alias('VNode'), StringType])),
    // function state(key, initialValue) {
    //   return { value, setState: (newValue) => {}, getState: () => value };
    // }
    state: new FunctionType(
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

    // function context(name, initialValue) {
    //   return { setContext, getContext, value };
    // }
    context: new FunctionType(
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

  // Snabbdom VNode type – represents a virtual DOM node
  // See: https://github.com/snabbdom/snabbdom/blob/master/src/vnode.ts
  VNode: {
    sel: Types.union([StringType, UndefinedType]),        // CSS selector string or undefined
    data: Types.alias('VNodeData'),                       // VNodeData (props, attrs, class, style, dataset, on, hooks, etc.)
    children: Types.union([Types.array(Types.alias('VNode')), StringType, UndefinedType]),  // Array of VNode | string, or undefined
    elm: AnyType, // Types.union([Types.alias('Node'), UndefinedType]),  // The actual DOM Node, or undefined
    text: Types.union([StringType, UndefinedType]),       // Text content, or undefined
    key: Types.union([Types.alias('PropertyKey'), UndefinedType]),  // PropertyKey (used for keyed elements), or undefined
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

  // AbortController / AbortSignal – used to cancel fetch requests and other async ops
  AbortController: {
    signal: AnyType,  // AbortSignal – typed as any to avoid circular reference issues
    abort: new FunctionType([AnyType], UndefinedType, [], ['reason']),
  },

  AbortSignal: {
    aborted: BooleanType,
    reason: AnyType,
    throwIfAborted: new FunctionType([], UndefinedType, [], []),
    addEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
    removeEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
  },

  // Fetch API – Headers, Request, Response
  Headers: {
    append: new FunctionType([StringType, StringType], UndefinedType, [], ['name', 'value']),
    delete: new FunctionType([StringType], UndefinedType, [], ['name']),
    get: new FunctionType([StringType], Types.union([StringType, NullType]), [], ['name']),
    has: new FunctionType([StringType], BooleanType, [], ['name']),
    set: new FunctionType([StringType, StringType], UndefinedType, [], ['name', 'value']),
    entries: new FunctionType([], AnyType, [], []),
    keys: new FunctionType([], AnyType, [], []),
    values: new FunctionType([], AnyType, [], []),
    forEach: new FunctionType([AnyFunctionType], UndefinedType, [], ['callback']),
  },

  Response: {
    ok: BooleanType,
    status: NumberType,
    statusText: StringType,
    headers: AnyType,   // Headers instance
    url: StringType,
    redirected: BooleanType,
    type: StringType,
    body: AnyType,
    bodyUsed: BooleanType,
    json: new FunctionType([], AnyType, [], []),           // Promise<any>
    text: new FunctionType([], AnyType, [], []),           // Promise<string>
    blob: new FunctionType([], AnyType, [], []),           // Promise<Blob>
    arrayBuffer: new FunctionType([], AnyType, [], []),    // Promise<ArrayBuffer>
    formData: new FunctionType([], AnyType, [], []),       // Promise<FormData>
    clone: new FunctionType([], AnyType, [], []),          // Response
  },

  Request: {
    url: StringType,
    method: StringType,
    headers: AnyType,   // Headers instance
    body: AnyType,
    bodyUsed: BooleanType,
    mode: StringType,
    credentials: StringType,
    cache: StringType,
    redirect: StringType,
    referrer: StringType,
    signal: AnyType,    // AbortSignal
    clone: new FunctionType([], AnyType, [], []),
    json: new FunctionType([], AnyType, [], []),
    text: new FunctionType([], AnyType, [], []),
    blob: new FunctionType([], AnyType, [], []),
    arrayBuffer: new FunctionType([], AnyType, [], []),
    formData: new FunctionType([], AnyType, [], []),
  },

  // URL API
  URL: {
    href: StringType,
    origin: StringType,
    protocol: StringType,
    username: StringType,
    password: StringType,
    host: StringType,
    hostname: StringType,
    port: StringType,
    pathname: StringType,
    search: StringType,
    searchParams: AnyType,  // URLSearchParams instance
    hash: StringType,
    toString: new FunctionType([], StringType, [], []),
    toJSON: new FunctionType([], StringType, [], []),
  },

  URLSearchParams: {
    append: new FunctionType([StringType, StringType], UndefinedType, [], ['name', 'value']),
    delete: new FunctionType([StringType], UndefinedType, [], ['name']),
    get: new FunctionType([StringType], Types.union([StringType, NullType]), [], ['name']),
    getAll: new FunctionType([StringType], Types.array(StringType), [], ['name']),
    has: new FunctionType([StringType], BooleanType, [], ['name']),
    set: new FunctionType([StringType, StringType], UndefinedType, [], ['name', 'value']),
    sort: new FunctionType([], UndefinedType, [], []),
    toString: new FunctionType([], StringType, [], []),
    entries: new FunctionType([], AnyType, [], []),
    keys: new FunctionType([], AnyType, [], []),
    values: new FunctionType([], AnyType, [], []),
    forEach: new FunctionType([AnyFunctionType], UndefinedType, [], ['callback']),
  },

  // DOM Event API
  Event: {
    type: StringType,
    target: AnyType,
    currentTarget: AnyType,
    bubbles: BooleanType,
    cancelable: BooleanType,
    defaultPrevented: BooleanType,
    eventPhase: NumberType,
    isTrusted: BooleanType,
    timeStamp: NumberType,
    preventDefault: new FunctionType([], UndefinedType, [], []),
    stopPropagation: new FunctionType([], UndefinedType, [], []),
    stopImmediatePropagation: new FunctionType([], UndefinedType, [], []),
  },

  CustomEvent: {
    type: StringType,
    target: AnyType,
    currentTarget: AnyType,
    bubbles: BooleanType,
    cancelable: BooleanType,
    defaultPrevented: BooleanType,
    detail: AnyType,
    isTrusted: BooleanType,
    timeStamp: NumberType,
    preventDefault: new FunctionType([], UndefinedType, [], []),
    stopPropagation: new FunctionType([], UndefinedType, [], []),
    stopImmediatePropagation: new FunctionType([], UndefinedType, [], []),
  },

  // Web Storage API (localStorage / sessionStorage)
  Storage: {
    length: NumberType,
    getItem: new FunctionType([StringType], Types.union([StringType, NullType]), [], ['key']),
    setItem: new FunctionType([StringType, StringType], UndefinedType, [], ['key', 'value']),
    removeItem: new FunctionType([StringType], UndefinedType, [], ['key']),
    clear: new FunctionType([], UndefinedType, [], []),
    key: new FunctionType([NumberType], Types.union([StringType, NullType]), [], ['index']),
  },

  // Map and Set constructors (static methods only; instance methods are on values returned by `new Map()`)
  Map: {
    groupBy: new FunctionType([AnyType, AnyFunctionType], AnyType, [], ['iterable', 'keySelector']),
  },

  Set: {},

  WeakMap: {},

  WeakSet: {},

  WeakRef: {},

  FinalizationRegistry: {},

  // Binary data / files
  Blob: {
    size: NumberType,
    type: StringType,
    arrayBuffer: new FunctionType([], AnyType, [], []),   // Promise<ArrayBuffer>
    text: new FunctionType([], AnyType, [], []),           // Promise<string>
    slice: new FunctionType([NumberType], AnyType, [], ['start']),
    stream: new FunctionType([], AnyType, [], []),
  },

  File: {
    name: StringType,
    size: NumberType,
    type: StringType,
    lastModified: NumberType,
    arrayBuffer: new FunctionType([], AnyType, [], []),
    text: new FunctionType([], AnyType, [], []),
    slice: new FunctionType([NumberType], AnyType, [], ['start']),
    stream: new FunctionType([], AnyType, [], []),
  },

  FileReader: {
    result: Types.union([StringType, AnyType, NullType]),
    error: AnyType,
    readyState: NumberType,
    onload: AnyType,
    onerror: AnyType,
    onabort: AnyType,
    onloadend: AnyType,
    onloadstart: AnyType,
    onprogress: AnyType,
    readAsArrayBuffer: new FunctionType([AnyType], UndefinedType, [], ['blob']),
    readAsBinaryString: new FunctionType([AnyType], UndefinedType, [], ['blob']),
    readAsDataURL: new FunctionType([AnyType], UndefinedType, [], ['blob']),
    readAsText: new FunctionType([AnyType], UndefinedType, [], ['blob']),
    abort: new FunctionType([], UndefinedType, [], []),
  },

  FormData: {
    append: new FunctionType([StringType, AnyType], UndefinedType, [], ['name', 'value']),
    delete: new FunctionType([StringType], UndefinedType, [], ['name']),
    get: new FunctionType([StringType], Types.union([StringType, AnyType, NullType]), [], ['name']),
    getAll: new FunctionType([StringType], Types.array(AnyType), [], ['name']),
    has: new FunctionType([StringType], BooleanType, [], ['name']),
    set: new FunctionType([StringType, AnyType], UndefinedType, [], ['name', 'value']),
    entries: new FunctionType([], AnyType, [], []),
    keys: new FunctionType([], AnyType, [], []),
    values: new FunctionType([], AnyType, [], []),
    forEach: new FunctionType([AnyFunctionType], UndefinedType, [], ['callback']),
  },

  // WebSocket – real-time bidirectional communication
  WebSocket: {
    url: StringType,
    readyState: NumberType,
    bufferedAmount: NumberType,
    protocol: StringType,
    extensions: StringType,
    binaryType: StringType,
    onopen: AnyType,
    onmessage: AnyType,
    onclose: AnyType,
    onerror: AnyType,
    send: new FunctionType([AnyType], UndefinedType, [], ['data']),
    close: new FunctionType([NumberType, StringType], UndefinedType, [], ['code', 'reason']),
    addEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
    removeEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
  },

  // DOM Observers
  MutationObserver: {
    observe: new FunctionType([AnyType, AnyType], UndefinedType, [], ['target', 'options']),
    disconnect: new FunctionType([], UndefinedType, [], []),
    takeRecords: new FunctionType([], Types.array(AnyType), [], []),
  },

  IntersectionObserver: {
    root: AnyType,
    rootMargin: StringType,
    thresholds: Types.array(NumberType),
    observe: new FunctionType([AnyType], UndefinedType, [], ['target']),
    unobserve: new FunctionType([AnyType], UndefinedType, [], ['target']),
    disconnect: new FunctionType([], UndefinedType, [], []),
    takeRecords: new FunctionType([], Types.array(AnyType), [], []),
  },

  ResizeObserver: {
    observe: new FunctionType([AnyType], UndefinedType, [], ['target']),
    unobserve: new FunctionType([AnyType], UndefinedType, [], ['target']),
    disconnect: new FunctionType([], UndefinedType, [], []),
  },

  // Web Crypto API
  crypto: {
    randomUUID: new FunctionType([], StringType, [], []),
    getRandomValues: new FunctionType([AnyType], AnyType, [], ['typedArray']),
    subtle: AnyType,  // SubtleCrypto – complex async API, typed as any
  },

  // Performance API
  performance: {
    now: new FunctionType([], NumberType, [], []),
    mark: new FunctionType([StringType], UndefinedType, [], ['name']),
    measure: new FunctionType([StringType, StringType, StringType], AnyType, [], ['name', 'startMark', 'endMark']),
    clearMarks: new FunctionType([StringType], UndefinedType, [], ['name']),
    clearMeasures: new FunctionType([StringType], UndefinedType, [], ['name']),
    getEntriesByName: new FunctionType([StringType], Types.array(AnyType), [], ['name']),
    getEntriesByType: new FunctionType([StringType], Types.array(AnyType), [], ['type']),
    getEntries: new FunctionType([], Types.array(AnyType), [], []),
    timeOrigin: NumberType,
    memory: AnyType,
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
  RegExp: {
    // Properties
    source: StringType,
    flags: StringType,
    global: BooleanType,
    ignoreCase: BooleanType,
    multiline: BooleanType,
    sticky: BooleanType,
    unicode: BooleanType,
    dotAll: BooleanType,
    hasIndices: BooleanType,
    lastIndex: NumberType,
    // Methods
    test: new FunctionType([StringType], BooleanType, [], ['str']),
    exec: new FunctionType([StringType], Types.union([Types.array(StringType), NullType]), [], ['str']),
    toString: new FunctionType([], StringType, [], []),
  },
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
    queueMicrotask: new FunctionType([AnyFunctionType], UndefinedType, [], ['callback']),
    structuredClone: new FunctionType([AnyType], AnyType, [], ['value']),
    fetch: new FunctionType([AnyType, AnyType], AnyType, [], ['input', 'init']),  // returns Promise<Response>
    location: AnyType,
    history: AnyType,
    navigator: AnyType,
    screen: AnyType,
    localStorage: AnyType,    // Storage instance – see Storage type above
    sessionStorage: AnyType,  // Storage instance – see Storage type above
    indexedDB: AnyType,
    requestAnimationFrame: new FunctionType([AnyFunctionType], NumberType, [], ['callback']),
    cancelAnimationFrame: new FunctionType([NumberType], UndefinedType, [], ['id']),
    addEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
    removeEventListener: new FunctionType([StringType, AnyFunctionType], UndefinedType, [], ['event', 'handler']),
    dispatchEvent: new FunctionType([AnyType], BooleanType, [], ['event']),
    postMessage: new FunctionType([AnyType, StringType], UndefinedType, [], ['message', 'targetOrigin']),
    open: new FunctionType([StringType, StringType], AnyType, [], ['url', 'target']),
    close: new FunctionType([], UndefinedType, [], []),
    atob: new FunctionType([StringType], StringType, [], ['encodedString']),
    btoa: new FunctionType([StringType], StringType, [], ['stringToEncode']),
    crypto: AnyType,        // Crypto instance – see crypto type above
    performance: AnyType,   // Performance instance – see performance type above
    // Constructor references exposed on window
    URL: AnyType,
    URLSearchParams: AnyType,
    Headers: AnyType,
    Request: AnyType,
    Response: AnyType,
    Event: AnyType,
    CustomEvent: AnyType,
    AbortController: AnyType,
    AbortSignal: AnyType,
    Blob: AnyType,
    File: AnyType,
    FileReader: AnyType,
    FormData: AnyType,
    WebSocket: AnyType,
    MutationObserver: AnyType,
    IntersectionObserver: AnyType,
    ResizeObserver: AnyType,
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

// Spread window globals into the top-level map so that `setTimeout`, `fetch`, etc.
// are accessible as bare names. Window properties are placed FIRST so that explicitly
// defined types (e.g. the full `console` object with `log`/`warn`/`error`) take
// precedence over the generic `AnyType` stubs in the `window` definition.
builtinObjectTypes = { ...builtinObjectTypes.window, ...builtinObjectTypes };

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
 * Some array methods have return types AND/OR parameter types that depend on the 
 * element type T of the array (e.g. `pop()` returns `T | undefined`, `push(T)` 
 * accepts T, `map()` returns `T[]`).
 * This function resolves those instead of falling back to the generic `AnyType`
 * entries in `builtinPrimitiveTypes.array`.
 *
 * @param {ArrayType} arrayType  - The concrete array type (e.g. `number[]`)
 * @param {string}   memberName - The method or property name
 * @returns {import('./Type.js').Type}  The resolved return type or FunctionType
 */
export function getArrayMemberType(arrayType, memberName) {
  if (!(arrayType instanceof ArrayType)) {
    return builtinPrimitiveTypes.array[memberName] ?? AnyType;
  }

  const T = arrayType.elementType;

  // Methods with parameters that depend on element type T
  switch (memberName) {
    // push(T): number
    // unshift(T): number
    case 'push':
    case 'unshift':
      return new FunctionType([T], NumberType, [], ['elements']);
    
    // fill(T): T[]
    case 'fill':
      return new FunctionType([T], new ArrayType(T), [], ['value']);
    
    // concat(T[]): T[]
    case 'concat':
      return new FunctionType([new ArrayType(T)], new ArrayType(T), [], ['items']);
    
    // indexOf(T): number
    // lastIndexOf(T): number
    case 'indexOf':
    case 'lastIndexOf':
      return new FunctionType([T], NumberType, [], ['searchElement']);
    
    // includes(T): boolean
    case 'includes':
      return new FunctionType([T], BooleanType, [], ['searchElement']);
    
    // with(number, T): T[]
    case 'with':
      return new FunctionType([NumberType, T], new ArrayType(T), [], ['index', 'value']);

    // pop(): T | undefined
    case 'pop':
    case 'shift':
    case 'find':
    case 'findLast':
    case 'at':
      return new UnionType([T, UndefinedType]);

    // Returns T[]  (new array of same element type)
    case 'reverse':
    case 'sort':
    case 'filter':
    case 'slice':
    case 'flat':
    case 'toReversed':
    case 'toSorted':
    case 'toSpliced':
      return new ArrayType(T);

    // splice(): T[]
    case 'splice':
      return new ArrayType(T);

    case 'copyWithin':
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
  
  // Environment specific
  __dirname: { type: 'String' },

  // Universal JS global
  globalThis: { type: 'Value' },
  Function: { type: 'Value' },

  // Node.js process global (also available via Vite/esbuild in browser bundles)
  process: { type: 'Value' },
};

// ============================================================================
// Context-scoped built-ins (only valid in certain AST contexts)
// ============================================================================

/**
 * Keywords that are only valid in specific scopes.
 * context: 'function' → valid inside any func_def or class_func_def body
 * context: 'class'    → valid inside a class_func_def body only
 *
 * NOTE: `this` type inference (e.g. this.methodName) is a future task.
 * For now these all resolve to AnyType at the inference level.
 */
export const builtinContextuals = {
  arguments: { type: ObjectType,    context: 'function' },
  this:      { type: ObjectType, context: 'function' },
  super:     { type: AnyFunctionType,  context: 'class' },
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

  // Add context-scoped built-ins
  Object.entries(builtinContextuals).forEach(([name, info]) => {
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
