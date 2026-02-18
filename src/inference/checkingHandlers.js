// ============================================================================
// Checking Handlers - Phase 3: Type validation (no inference)
// ============================================================================

import { visitChildren } from '../visitor.js';
import TypeChecker from '../typeChecker.js';
import { 
  isTypeCompatible,
  resolveTypeAlias,
  getPropertyType
} from '../typeSystem.js';
import { ObjectType, AnyType } from '../Type.js';

/**
 * Create checking handlers for Phase 3
 * These handlers ONLY validate types that were already inferred in Phase 2
 * They do NOT compute new types or modify the AST
 */
function createCheckingHandlers(getState) {
  return {
    /**
     * Check mathematical operations for type compatibility
     */
    math_operator: (node) => {
      const { pushWarning, typeAliases } = getState();
      if (!node.parent) return; // Skip if no parent context

      // Get left and right operands from parent's inference
      const parent = node.parent;
      if (!parent.inference || parent.inference.length < 2) return;

      const types = parent.inference;
      const idx = types.indexOf(node);
      if (idx < 2) return;

      const leftType = types[idx - 1];
      const rightType = types[idx - 2];

      if (!leftType || !rightType) return;

      const result = TypeChecker.checkMathOperation(leftType, rightType, node.value);
      if (result.warning) {
        pushWarning(node, result.warning);
      }
      if (result.warnings) {
        result.warnings.forEach(warn => pushWarning(node, warn));
      }
    },

    /**
     * Check variable assignment compatibility
     */
    assign: (node, parent) => {
      const { pushWarning, lookupVariable, typeAliases } = getState();
      const { annotation, name, explicit_assign } = node.named;

      // Only check if there's a type annotation
      if (!annotation) return;

      const annotationType = annotation.type?.value || 
                          (annotation.named?.type_exp?.value);
      if (!annotationType) return;

      // Get the inferred type of the value from parent's inference
      if (!parent || !parent.inference || parent.inference.length === 0) return;

      const valueType = parent.inference[parent.inference.length - 1];
      if (!valueType || valueType === 'any') return;

      const result = TypeChecker.checkAssignment(valueType, annotationType, typeAliases);
      if (!result.valid) {
        pushWarning(node, result.warning);
      }
    },

    /**
     * Check property access on object types
     */
    object_access: (node, parent) => {
      const { pushWarning, typeAliases } = getState();

      // Extract property name and object type from context
      let propertyName = null;
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'name') {
            propertyName = child.value;
            break;
          }
        }
      }

      if (!propertyName || !parent) return;

      // Skip optional chaining - no validation needed
      const isOptionalChain = node.children?.some(child => child.type === 'optional_chain');
      if (isOptionalChain) return;

      // Get object type from parent's inferred type
      if (!parent.inference || parent.inference.length === 0) return;

      const objectType = parent.inference[0];
      if (!objectType || objectType === AnyType) return;

      // Validate property exists
      const resolvedType = resolveTypeAlias(objectType, typeAliases);
      if (!(resolvedType instanceof ObjectType)) return;

      const propertyType = getPropertyType(objectType, propertyName, typeAliases);
      if (propertyType === null) {
        pushWarning(node, `Property '${propertyName}' does not exist on type ${objectType}`);
      }
    },

    /**
     * Check function call arguments
     */
    func_call: (node, parent) => {
      const { pushWarning, lookupVariable, typeAliases } = getState();

      // Get the function being called
      let functionName = null;
      if (parent && parent.named && parent.named.name) {
        functionName = parent.named.name.value;
      }

      if (!functionName) return;

      const def = lookupVariable(functionName);
      if (!def || !def.params) return;

      // Get argument types from node's inference
      const argTypes = node.inference || [];
      if (argTypes.length === 0) return;

      const result = TypeChecker.checkFunctionCall(
        argTypes,
        def.params,
        functionName,
        typeAliases
      );

      if (!result.valid) {
        result.warnings.forEach(warn => pushWarning(node, warn));
      }
    },

    /**
     * Check variable reassignment type compatibility
     */
    variable_reassign: (node, parent) => {
      const { pushWarning, lookupVariable, typeAliases } = getState();

      const { name } = node.named;
      if (!name) return;

      // Get the inferred type of the new value
      if (!parent || !parent.inference || parent.inference.length === 0) return;

      const valueType = parent.inference[parent.inference.length - 1];
      if (!valueType || valueType === AnyType) return;

      const result = TypeChecker.checkVariableReassignment(
        valueType,
        name.value,
        lookupVariable,
        typeAliases
      );

      if (!result.valid) {
        pushWarning(node, result.warning);
      }
    },

    /**
     * Check function return type
     */
    return_statement: (node, parent) => {
      const { pushWarning, getFunctionScope, typeAliases } = getState();

      // Get expected return type
      const functionScope = getFunctionScope();
      if (!functionScope) return;

      // This will be checked during function definition validation
      // Return statements collect their types into __returnTypes array
    },

    /**
     * Check property assignment (e.g., obj.prop = value)
     */
    property_assignment: (node, parent) => {
      const { pushWarning, lookupVariable, typeAliases } = getState();

      const { name, access } = node.named;
      if (!name || !access) return;

      // Get object name
      const objectName = name?.value;
      if (!objectName) return;

      // Extract property name
      let propertyName = null;
      const findPropertyName = (n) => {
        if (!n) return;
        if (n.type === 'name' && !propertyName) {
          propertyName = n.value;
          return;
        }
        if (n.children) {
          n.children.forEach(findPropertyName);
        }
        if (n.named && typeof n.named === 'object') {
          Object.values(n.named).forEach(child => {
            if (child && typeof child === 'object') {
              findPropertyName(child);
            }
          });
        }
      };
      findPropertyName(access);

      if (!propertyName) return;

      // Get the inferred type of the value
      if (!parent || !parent.inference || parent.inference.length === 0) return;

      const valueType = parent.inference[parent.inference.length - 1];
      if (!valueType || valueType === AnyType) return;

      // Look up object and validate property type
      const objectDef = lookupVariable(objectName);
      if (!objectDef || !objectDef.type) return;

      const expectedType = getPropertyType(objectDef.type, propertyName, typeAliases);
      if (expectedType !== null) {
        const resolvedExpectedType = resolveTypeAlias(expectedType, typeAliases);

        if (!isTypeCompatible(valueType, resolvedExpectedType, typeAliases)) {
          pushWarning(
            node,
            `Cannot assign ${valueType} to property '${propertyName}' of type ${expectedType}`
          );
        }
      }
    },

    /**
     * Check function definition return type
     */
    func_def: (node, parent) => {
      const { pushWarning, typeAliases } = getState();

      const { annotation, name } = node.named;
      if (!annotation || !name) return;

      // Get declared return type
      const declaredReturnType = annotation.type?.value || 
                                (annotation.named?.type_exp?.value);
      if (!declaredReturnType) return;

      // The actual return type should have been inferred during Phase 2
      // This check is supplementary - if both are available, validate them
    },
  };
}

/**
 * Run checking phase on AST
 * Validates types that were inferred in Phase 2
 * Should be called after Phase 2 inference pass completes
 */
function runCheckingPhase(node, stream, typeAliases, lookupVariable, getFunctionScope) {
  const warnings = [];
  const handlers = createCheckingHandlers(() => ({
    pushWarning: (n, msg) => {
      const error = new Error(msg);
      error.token = stream[n.stream_index];
      warnings.push(error);
    },
    typeAliases,
    lookupVariable,
    getFunctionScope,
  }));

  // Traverse AST and run checking handlers
  function check(n) {
    if (!n) return;
    if (handlers[n.type]) {
      handlers[n.type](n, n.parent);
    }
    if (n.children) {
      n.children.forEach(c => {
        c.parent = n;
        check(c);
      });
    }
  }

  check(node);
  return warnings;
}

export default createCheckingHandlers;
export { runCheckingPhase };
