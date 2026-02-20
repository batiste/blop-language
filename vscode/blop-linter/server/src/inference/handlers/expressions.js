// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

import { visitChildren, resolveTypes, pushToParent } from '../visitor.js';
import { inferGenericArguments, substituteType, parseTypeExpression, getPropertyType, resolveTypeAlias } from '../typeSystem.js';
import { ObjectType, PrimitiveType, AnyType, ArrayType, FunctionType, AnyFunctionType, UndefinedType, TypeAlias } from '../Type.js';
import TypeChecker from '../typeChecker.js';
import { getBuiltinObjectType, isBuiltinObjectType, getArrayMemberType, getPrimitiveMemberType } from '../builtinTypes.js';
import { extractPropertyNodesFromAccess } from './utils.js';

/**
 * Extract explicit type arguments from type_arguments node
 * @param {Object} typeArgsNode - The type_arguments AST node
 * @returns {string[]} Array of type strings
 */
function extractExplicitTypeArguments(typeArgsNode) {
  if (!typeArgsNode) return null;
  
  const args = [];
  
  function collectArgs(node) {
    if (!node) return;
    
    // Check if this node itself has a named.arg (type_expression)
    if (node.named && node.named.arg) {
      const typeArg = parseTypeExpression(node.named.arg);
      if (typeArg) {
        args.push(typeArg);
      }
    }
    
    // Check if it has a named.rest (for comma-separated list)
    if (node.named && node.named.rest) {
      collectArgs(node.named.rest);
    }
  }
  
  // Start with the args node (type_argument_list)
  if (typeArgsNode.named && typeArgsNode.named.args) {
    collectArgs(typeArgsNode.named.args);
  }
  
  return args.length > 0 ? args : null;
}

/**
 * Get the member name from an object access node
 * (e.g. 'foo' from obj.foo or obj.foo())
 */
function getObjectAccessMemberName(access) {
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  return objectAccess?.children?.find(child => child.type === 'name')?.value;
}

/**
 * Get the member name and its AST node from an object access node
 * Used when we need to annotate the node with inferred type
 */
function getObjectAccessMemberInfo(access) {
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const memberName = objectAccess?.children?.find(child => child.type === 'name')?.value;
  const memberNode = objectAccess?.children?.find(child => child.type === 'name');
  return { memberName, memberNode };
}

/**
 * Extract return type from a Type (if it's a FunctionType, get returnType; otherwise return as-is)
 */
function extractReturnType(type) {
  if (type instanceof FunctionType) {
    return type.returnType;
  }
  return type ?? AnyType;
}

/**
 * Check if a type is a concrete primitive type (string, number, or boolean)
 */
function isValidPrimitiveType(type) {
  return type instanceof PrimitiveType && ['string', 'number', 'boolean'].includes(type.name);
}

/**
 * Generic handler for method calls on typed values (arrays, primitives, etc.)
 * Handles extraction of return type and stamping of AST nodes
 */
function handleTypedMethodCall(
  name,
  access,
  definition,
  parent,
  typeChecker,
  memberGetter,
  validTypeFilter,
  { pushInference, typeAliases }
) {
  const resolvedDefType = resolveTypeAlias(definition?.type, typeAliases);
  
  // Check if the resolved type matches the expected type
  if (!definition || !typeChecker(resolvedDefType)) {
    return false;
  }
  
  // Apply optional filter (e.g., exclude 'any' primitive type)
  if (validTypeFilter && !validTypeFilter(resolvedDefType)) {
    return false;
  }
  
  const { memberName, memberNode } = getObjectAccessMemberInfo(access);
  if (!memberName) {
    return false;
  }
  
  const methodDef = memberGetter(resolvedDefType, memberName);
  if (!methodDef) {
    return false;
  }
  
  const finalType = extractReturnType(methodDef);
  
  if (memberNode) memberNode.inferredType = finalType;
  pushInference(parent, finalType);
  return true;
}

/**
 * Handle array instance method calls (e.g. items.map(), nums.filter(), arr.pop())
 */
function handleArrayOrBuiltinMethodCall(name, access, definition, parent, { pushInference, typeAliases }) {
  return handleTypedMethodCall(
    name,
    access,
    definition,
    parent,
    (type) => type instanceof ArrayType,
    getArrayMemberType,
    null, // no extra filter needed
    { pushInference, typeAliases }
  );
}

/**
 * Handle primitive type method calls (e.g. s.toLowerCase(), nums.includes(), n.toFixed())
 */
function handlePrimitiveTypeMethodCall(name, access, definition, parent, { pushInference, typeAliases }) {
  return handleTypedMethodCall(
    name,
    access,
    definition,
    parent,
    (type) => type instanceof PrimitiveType,
    (type, methodName) => getPrimitiveMemberType(type.name, methodName),
    (type) => ['string', 'number', 'boolean'].includes(type.name), // skip 'any'
    { pushInference, typeAliases }
  );
}

/**
 * Handle built-in object method calls (e.g. Math.cos, Object.keys)
 */
function handleBuiltinMethodCall(name, access, parent, { pushInference }) {
  if (!isBuiltinObjectType(name.value)) return false;
  
  const methodName = getObjectAccessMemberName(access);
  if (!methodName) return false;
  
  const builtinType = getBuiltinObjectType(name.value);
  const rawReturn = builtinType?.[methodName];
  const returnType = extractReturnType(rawReturn);
  
  pushInference(parent, returnType);
  return true;
}

/**
 * Handle method calls on variables whose type is a builtin object type
 * (e.g. node.useState<number>('count', 0) where node: Component)
 */
function handleBuiltinInstanceMethodCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase }) {
  const defType = definition?.type;
  if (!(defType instanceof TypeAlias) || !isBuiltinObjectType(defType.name)) return false;

  const builtinType = getBuiltinObjectType(defType.name);

  // For method calls like node.useState<T>(), the AST structure is:
  //   access_or_operation
  //     object_access (OUTER: contains '.', 'name=method', INNER object_access)
  //       object_access (INNER: contains 'type_arguments', 'func_call')
  const outerObjectAccess = access.children?.find(child => child.type === 'object_access');
  const methodName = outerObjectAccess?.children?.find(child => child.type === 'name')?.value;
  const methodNode = outerObjectAccess?.children?.find(child => child.type === 'name');
  const innerObjectAccess = outerObjectAccess?.children?.find(child => child.type === 'object_access');

  if (!methodName || !builtinType) return false;

  const methodDef = builtinType[methodName];
  if (!methodDef) return false;

  if (!(methodDef instanceof FunctionType)) {
    // Plain type property — just push as-is
    pushInference(parent, methodDef);
    return true;
  }

  // Stamp method node with full function type for hover
  if (inferencePhase === 'inference' && methodNode && methodNode.inferredType === undefined) {
    methodNode.inferredType = methodDef;
  }

  if (methodDef.genericParams && methodDef.genericParams.length > 0) {
    // type_arguments lives in the INNER object_access (one level deeper than the method name)
    const typeArgsNode = innerObjectAccess?.children?.find(child => child.type === 'type_arguments')
                      ?? innerObjectAccess?.named?.type_args;
    const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);

    let substitutions = {};
    if (explicitTypeArgs) {
      for (let i = 0; i < Math.min(methodDef.genericParams.length, explicitTypeArgs.length); i++) {
        substitutions[methodDef.genericParams[i]] = explicitTypeArgs[i];
      }
    } else {
      const result = inferGenericArguments(methodDef.genericParams, methodDef.params, argTypes, typeAliases);
      substitutions = result.substitutions;
      if (result.errors.length > 0) result.errors.forEach(e => pushWarning(name, e));
    }

    let returnType = methodDef.returnType ?? AnyType;
    returnType = substituteType(returnType, substitutions);
    pushInference(parent, returnType);
  } else {
    pushInference(parent, methodDef.returnType ?? AnyType);
  }

  return true;
}

/**
 * Handle generic function calls with explicit or inferred type arguments
 */
function handleGenericFunctionCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase }) {
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const typeArgsNode = objectAccess?.children?.find(child => child.type === 'type_arguments');
  const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
  
  // Stamp the name node with the function type for hover support
  if (inferencePhase === 'inference' && name.inferredType === undefined) {
    // For func_def functions, construct the FunctionType from params and return type
    const funcType = new FunctionType(definition.params, definition.type, definition.genericParams, definition.paramNames);
    name.inferredType = funcType;
  }
  
  const paramTypes = definition.params || [];
  let substitutions = {};
  let errors = [];
  
  if (explicitTypeArgs) {
    // Use explicit type arguments
    if (explicitTypeArgs.length !== definition.genericParams.length) {
      pushWarning(name, `Expected ${definition.genericParams.length} type arguments but got ${explicitTypeArgs.length}`);
    }
    
    for (let i = 0; i < Math.min(definition.genericParams.length, explicitTypeArgs.length); i++) {
      substitutions[definition.genericParams[i]] = explicitTypeArgs[i];
    }
  } else {
    // Infer type arguments from call site
    const result = inferGenericArguments(definition.genericParams, paramTypes, argTypes, typeAliases);
    substitutions = result.substitutions;
    errors = result.errors;
    
    if (errors.length > 0) {
      errors.forEach(error => pushWarning(name, error));
    }
  }
  
  // Check parameter types with substituted generics
  if (argTypes.length > 0) {
    const substitutedParams = paramTypes.map(p => substituteType(p, substitutions));
    const result = TypeChecker.checkFunctionCall(argTypes, substitutedParams, name.value, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }
  
  // Substitute type parameters in return type
  let returnType = definition.type ?? AnyType;
  returnType = substituteType(returnType, substitutions);
  pushInference(parent, returnType);
}

/**
 * Handle non-generic function calls
 */
function handleNonGenericFunctionCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase }) {
  // Stamp the name node with the function type for hover support
  if (inferencePhase === 'inference' && name.inferredType === undefined) {
    // For func_def functions, construct the FunctionType from params and return type
    const funcType = new FunctionType(definition.params, definition.type, undefined, definition.paramNames);
    name.inferredType = funcType;
  }
  
  if (argTypes.length > 0) {
    const result = TypeChecker.checkFunctionCall(argTypes, definition.params, name.value, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }
  
  const retType = definition.type ?? AnyType;
  pushInference(parent, retType);
}

/**
 * Handle function calls to variables whose type is a FunctionType (e.g., arrow functions)
 */
function handleFunctionTypedCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase }) {
  const funcType = definition.type;
  if (!(funcType instanceof FunctionType)) {
    return false;
  }
  
  // Stamp the name node with the function type for hover support
  if (inferencePhase === 'inference' && name.inferredType === undefined) {
    name.inferredType = funcType;
  }
  
  // Validate argument types if the function has a defined signature
  if (funcType.params && funcType.params !== null && argTypes.length > 0) {
    const result = TypeChecker.checkFunctionCall(argTypes, funcType.params, name.value, typeAliases);
    if (!result.valid) {
      result.warnings.forEach(warning => pushWarning(name, warning));
    }
  }
  
  // Push the return type as inference
  const returnType = funcType.returnType ?? AnyType;
  pushInference(parent, returnType);
  return true;
}

/**
 * When access_or_operation contains both a function call (object_access) and a
 * subsequent operation (e.g. num(5) + "10"), propagate the operation's inferred
 * operand types and operator to the parent so that math/boolean validation runs.
 */
function pushSubsequentOperation(access, parent, pushInference) {
  const subsequentOp = access.named?.op;
  if (!subsequentOp) return;
  // The operation's inference array already holds the right-operand type(s)
  // because visitChildren(access) ran before this helper is called.
  pushToParent(subsequentOp, parent);
  if (subsequentOp.named?.math_op) {
    pushInference(parent, subsequentOp.named.math_op);
  }
  if (subsequentOp.named?.boolean_op) {
    pushInference(parent, subsequentOp.named.boolean_op);
  }
  if (subsequentOp.named?.nullish_op) {
    pushInference(parent, subsequentOp.named.nullish_op);
  }
}

/**
 * Handle function calls in name_exp with validation
 */
function handleFunctionCall(name, access, parent, { lookupVariable, pushInference, pushWarning, typeAliases, inferencePhase }) {
  visitChildren(access);
  
  const definition = lookupVariable(name.value);
  const argTypes = access.children
    ?.find(child => child.type === 'object_access')
    ?.children?.find(child => child.type === 'func_call')
    ?.inference || [];
  
  // Try array/builtin method calls first
  if (handleArrayOrBuiltinMethodCall(name, access, definition, parent, { pushInference, typeAliases })) {
    pushSubsequentOperation(access, parent, pushInference);
    return true;
  }
  
  // Try primitive type method calls (e.g. s.toLowerCase(), n.toFixed())
  if (handlePrimitiveTypeMethodCall(name, access, definition, parent, { pushInference, typeAliases })) {
    pushSubsequentOperation(access, parent, pushInference);
    return true;
  }
  
  // Try builtin object method calls (e.g. Math.cos())
  if (handleBuiltinMethodCall(name, access, parent, { pushInference })) {
    pushSubsequentOperation(access, parent, pushInference);
    return true;
  }

  // Handle method calls on variables typed as a builtin (e.g. node.useState<number>())
  if (handleBuiltinInstanceMethodCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase })) {
    pushSubsequentOperation(access, parent, pushInference);
    return true;
  }
  
  // Handle function-typed variables (e.g., arrow function assignments)
  if (definition && definition.type instanceof FunctionType) {
    if (handleFunctionTypedCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase })) {
      pushSubsequentOperation(access, parent, pushInference);
      return true;
    }
  }
  
  // Handle user-defined function calls (from func_def)
  if (definition && definition.params) {
    if (definition.genericParams && definition.genericParams.length > 0) {
      handleGenericFunctionCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase });
    } else {
      handleNonGenericFunctionCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases, inferencePhase });
    }
    pushSubsequentOperation(access, parent, pushInference);
    return true;
  }
  
  return false;
}

/**
 * Validate property chain access on a type and annotate nodes
 */
function validatePropertyChain(properties, definition, typeAliases, { pushInference, pushWarning, access }) {
  let currentType = definition.type;
  let validatedPath = [];
  let invalidProperty = null;
  
  for (let i = 0; i < properties.length; i++) {
    const { name: propName, node: propNode } = properties[i];
    const resolvedCurrent = resolveTypeAlias(currentType, typeAliases);
    
    // Skip empty objects
    if (resolvedCurrent.toString() === '{}') {
      break;
    }
    
    // Check if we can continue validating
    const isCurrentPrimitive = isValidPrimitiveType(resolvedCurrent);
    const isCurrentObject = resolvedCurrent instanceof ObjectType;
    const isCurrentArray = resolvedCurrent instanceof ArrayType;
    if (!isCurrentPrimitive && !isCurrentObject && !isCurrentArray) {
      break;
    }
    
    const nextType = getPropertyType(currentType, propName, typeAliases);
    if (nextType === null) {
      invalidProperty = propName;
      validatedPath.push(propName);
      break;
    }
    
    pushInference(propNode, nextType);
    propNode.inferredType = resolveTypeAlias(nextType, typeAliases);
    validatedPath.push(propName);
    currentType = nextType;
  }
  
  return { currentType, validatedPath, invalidProperty };
}

/**
 * Handle property access on object types and primitives
 */
function handleObjectPropertyAccess(name, access, parent, definition, { pushInference, pushWarning, typeAliases }) {
  const resolvedType = resolveTypeAlias(definition.type, typeAliases);
  
  // Check for optional chaining
  const hasOptionalChain = access.children?.some(child => 
    child.type === 'object_access' && child.children?.some(c => c.type === 'optional_chain')
  );
  
  if (hasOptionalChain) {
    visitChildren(access);
    pushInference(parent, AnyType);
    return true;
  }
  
  // Skip validation for empty object type
  if (resolvedType instanceof ObjectType && resolvedType.properties.size === 0) {
    visitChildren(access);
    pushInference(parent, AnyType);
    return true;
  }
  
  // Handle array property access
  if (resolvedType instanceof ArrayType) {
    const { memberName: propName, memberNode: propNode } = getObjectAccessMemberInfo(access);
    if (propName) {
      const memberType = getArrayMemberType(resolvedType, propName);
      if (propNode) propNode.inferredType = memberType;
      name.inferredType = resolvedType;
      pushInference(parent, memberType);
      return true;
    }
  }
  
  // Validate property access for object types and primitive scalar types
  const isPrimitiveType = isValidPrimitiveType(resolvedType);
  const isObjectType = resolvedType instanceof ObjectType;
  
  if (isPrimitiveType || isObjectType) {
    const properties = extractPropertyNodesFromAccess(access);
    
    if (properties.length > 0) {
      name.inferredType = resolvedType;
      
      const { currentType, validatedPath, invalidProperty } = validatePropertyChain(
        properties,
        definition,
        typeAliases,
        { pushInference, pushWarning, access }
      );
      
      if (invalidProperty) {
        const fullPropertyPath = validatedPath.join('.');
        pushWarning(access, `Property '${fullPropertyPath}' does not exist on type ${definition.type}`);
        visitChildren(access);
        pushInference(parent, AnyType);
        return true;
      }
      
      pushInference(parent, currentType);
      return true;
    }
  }
  
  return false;
}

/**
 * Handle property access on built-in objects (e.g. Math.PI, Number.MAX_VALUE)
 */
function handleBuiltinPropertyAccess(name, access, parent, { pushInference }) {
  if (!isBuiltinObjectType(name.value)) return false;
  
  const propName = getObjectAccessMemberName(access);
  if (!propName) return false;
  
  const builtinType = getBuiltinObjectType(name.value);
  const propType = extractReturnType(builtinType?.[propName]);
  pushInference(parent, propType);
  return true;
}

/**
 * Handle simple variable reference without property access
 */
function handleSimpleVariable(name, parent, definition, getState) {
  const { pushInference } = getState();  
  if (!definition) {
    pushInference(parent, AnyType);
    return;
  }
  
  if (definition.source === 'func_def') {
    pushInference(parent, AnyFunctionType);
    const { inferencePhase } = getState();
    if (inferencePhase === 'inference' && name.inferredType === undefined) {
      name.inferredType = definition.type ?? AnyFunctionType;
    }
  } else {
    pushInference(parent, definition.type);
    // console.log('handleSimpleVariable', name.value, 'inferred type:', definition.type);
    const { typeAliases } = getState();
    if (name.inferredType === undefined) {
      name.inferredType = resolveTypeAlias(definition.type, typeAliases);
    }
  }
}

function createExpressionHandlers(getState) {
  return {
    math: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushInference(parent, PrimitiveType.Number);
    },
    exp: (node, parent) => {
      resolveTypes(node);
      pushToParent(node, parent);
    },
    name_exp: (node, parent) => {
      const { lookupVariable, pushInference, pushWarning, typeAliases, inferencePhase } = getState();
      const { name, access } = node.named;
      
      if (access) {
        // Check if this is a function call (search recursively through nested
        // object_access nodes, e.g. obj.method(x) has func_call one level deeper)
        function hasFuncCallInObjectAccess(node) {
          if (!node || node.type !== 'object_access') return false;
          if (node.children?.some(c => c.type === 'func_call')) return true;
          return node.children?.some(c => hasFuncCallInObjectAccess(c)) ?? false;
        }
        const hasFuncCall = access.children?.some(child => hasFuncCallInObjectAccess(child));
        
        if (hasFuncCall) {
          if (handleFunctionCall(name, access, parent, { lookupVariable, pushInference, pushWarning, typeAliases, inferencePhase })) {
            return;
          }
        }
        
        // Try built-in property access first
        if (handleBuiltinPropertyAccess(name, access, parent, { pushInference })) {
          return;
        }
        
        // Try object property access
        const definition = lookupVariable(name.value);
        const defTypeIsAny = !definition?.type || definition.type === AnyType ||
                              (definition.type instanceof PrimitiveType && definition.type.name === 'any');
        
        if (definition && definition.type && !defTypeIsAny) {
          if (handleObjectPropertyAccess(name, access, parent, definition, { pushInference, pushWarning, typeAliases })) {
            return;
          }
        }
        
        // Unknown variable or couldn't validate.
        // If access contains a binary operation (e.g. value + 'a'), propagate the
        // variable's type so the math/boolean type check fires on the parent.
        // For function/property accesses that fell through, keep AnyType to avoid
        // leaking the raw literal type (e.g. LiteralType(5) from index.toString()).
        visitChildren(access);
        const hasOp = access.named?.op &&
          (access.named.op.named?.math_op || access.named.op.named?.boolean_op || access.named.op.named?.nullish_op);
        if (hasOp && definition && definition.type && !defTypeIsAny) {
          pushInference(parent, definition.type);
          pushToParent(access, parent);
        } else {
          pushInference(parent, AnyType);
        }
        return;
      }
      
      // No access - handle simple variable reference
      const definition = lookupVariable(name.value);
      handleSimpleVariable(name, parent, definition, getState);
    },
    operation: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      pushToParent(node, parent);
      // Push the operator node itself so parent can process the binary operation
      if (node.named.math_op) {
        pushInference(parent, node.named.math_op);
      }
      if (node.named.boolean_op) {
        pushInference(parent, node.named.boolean_op);
      }
    },
    access_or_operation: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushToParent(node, parent);
      if (node.named.access) {
        pushInference(parent, node.named.access);
      }
    },
    new: (node, parent) => {
      const { pushInference } = getState();
      resolveTypes(node);
      pushInference(parent, ObjectType);
    },
  };
}

export default createExpressionHandlers;
