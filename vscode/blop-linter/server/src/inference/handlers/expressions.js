// ============================================================================
// Expression Handlers - Type inference for expressions
// ============================================================================

import { visitChildren, resolveTypes, pushToParent } from '../visitor.js';
import { inferGenericArguments, substituteType, parseTypeExpression, getPropertyType, resolveTypeAlias } from '../typeSystem.js';
import { ObjectType, PrimitiveType, AnyType, ArrayType, FunctionType, AnyFunctionType } from '../Type.js';
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
 * Handle array instance method calls and built-in type method returns
 */
function handleArrayOrBuiltinMethodCall(name, access, definition, parent, { pushInference, typeAliases }) {
  const resolvedDefType = resolveTypeAlias(definition?.type, typeAliases);
  
  // Array instance method call (e.g. items.map(), nums.filter(), arr.pop())
  if (definition && resolvedDefType instanceof ArrayType) {
    const objectAccess = access.children?.find(child => child.type === 'object_access');
    const methodName = objectAccess?.children?.find(child => child.type === 'name')?.value;
    if (methodName) {
      const returnType = getArrayMemberType(resolvedDefType, methodName);
      const methodNode = objectAccess?.children?.find(child => child.type === 'name');
      if (methodNode) methodNode.inferredType = returnType;
      pushInference(parent, returnType);
      return true;
    }
  }
  
  return false;
}

/**
 * Handle built-in object method calls (e.g. Math.cos, Object.keys)
 */
function handleBuiltinMethodCall(name, access, parent, { pushInference }) {
  if (!isBuiltinObjectType(name.value)) return false;
  
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const methodName = objectAccess?.children?.find(child => child.type === 'name')?.value;
  if (methodName) {
    const builtinType = getBuiltinObjectType(name.value);
    const rawReturn = builtinType?.[methodName];
    const returnType = rawReturn ?? AnyType;
    pushInference(parent, returnType);
    return true;
  }
  
  return false;
}

/**
 * Handle generic function calls with explicit or inferred type arguments
 */
function handleGenericFunctionCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases }) {
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const typeArgsNode = objectAccess?.children?.find(child => child.type === 'type_arguments');
  const explicitTypeArgs = extractExplicitTypeArguments(typeArgsNode);
  
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
function handleNonGenericFunctionCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases }) {
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
 * Handle function calls in name_exp with validation
 */
function handleFunctionCall(name, access, parent, { lookupVariable, pushInference, pushWarning, typeAliases }) {
  visitChildren(access);
  
  const definition = lookupVariable(name.value);
  const argTypes = access.children
    ?.find(child => child.type === 'object_access')
    ?.children?.find(child => child.type === 'func_call')
    ?.inference || [];
  
  // Try array/builtin method calls first
  if (handleArrayOrBuiltinMethodCall(name, access, definition, parent, { pushInference, typeAliases })) {
    return true;
  }
  
  // Try builtin object method calls
  if (handleBuiltinMethodCall(name, access, parent, { pushInference })) {
    return true;
  }
  
  // Handle user-defined function calls
  if (definition && definition.params) {
    if (definition.genericParams && definition.genericParams.length > 0) {
      handleGenericFunctionCall(name, access, definition, argTypes, parent, { pushInference, pushWarning, typeAliases });
    } else {
      handleNonGenericFunctionCall(name, definition, argTypes, parent, { pushInference, pushWarning, typeAliases });
    }
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
    const isCurrentPrimitive = resolvedCurrent instanceof PrimitiveType &&
                               (resolvedCurrent.name === 'string' || resolvedCurrent.name === 'number' || resolvedCurrent.name === 'boolean');
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
    const objectAccess = access.children?.find(child => child.type === 'object_access');
    const propName = objectAccess?.children?.find(child => child.type === 'name')?.value;
    if (propName) {
      const memberType = getArrayMemberType(resolvedType, propName);
      const propNode = objectAccess?.children?.find(child => child.type === 'name');
      if (propNode) propNode.inferredType = memberType;
      name.inferredType = resolvedType;
      pushInference(parent, memberType);
      return true;
    }
  }
  
  // Validate property access for object types and primitive scalar types
  const isPrimitiveType = resolvedType instanceof PrimitiveType &&
                          (resolvedType.name === 'string' || resolvedType.name === 'number' || resolvedType.name === 'boolean');
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
  
  const objectAccess = access.children?.find(child => child.type === 'object_access');
  const propName = objectAccess?.children?.find(child => child.type === 'name')?.value;
  if (propName) {
    const builtinType = getBuiltinObjectType(name.value);
    const rawProp = builtinType?.[propName];
    const propType = rawProp ?? AnyType;
    pushInference(parent, propType);
    return true;
  }
  
  return false;
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
    const { inferencePhase, typeAliases } = getState();
    if (inferencePhase === 'inference' && name.inferredType === undefined) {
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
    name_exp: (node, parent) => {
      const { lookupVariable, pushInference, pushWarning, typeAliases } = getState();
      const { name, access } = node.named;
      
      if (access) {
        // Check if this is a function call
        const hasFuncCall = access.children?.some(child => 
          child.type === 'object_access' && 
          child.children?.some(c => c.type === 'func_call')
        );
        
        if (hasFuncCall) {
          if (handleFunctionCall(name, access, parent, { lookupVariable, pushInference, pushWarning, typeAliases })) {
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
        
        // Unknown variable or couldn't validate
        visitChildren(access);
        pushInference(parent, AnyType);
        return;
      }
      
      // No access - handle simple variable reference
      const definition = lookupVariable(name.value);
      handleSimpleVariable(name, parent, definition, getState);
    },
    operation: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      pushToParent(node, parent);
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
