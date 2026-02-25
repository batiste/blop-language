// ============================================================================
// Literal Handlers - Type inference for literal values
// ============================================================================

import { visitChildren, resolveTypes } from '../visitor.js';
import { getBaseTypeOfLiteral, ObjectType } from '../typeSystem.js';
import { Types, StringType, NumberType, BooleanType, NullType, UndefinedType, AnyType, ArrayType, UnionType, TypeAlias } from '../Type.js';

/**
 * Deduplicate types by their string representation, last write wins.
 * @param {import('../Type.js').Type[]} types
 * @returns {import('../Type.js').Type[]}
 */
function deduplicateTypes(types) {
  const seen = new Map();
  for (const t of types) seen.set(t.toString(), t);
  return [...seen.values()];
}

/**
 * Collect element types from an array_literal_body node (right-recursive).
 * @param {Object} bodyNode
 * @returns {import('../Type.js').Type[]}
 */
function collectBodyElementTypes(bodyNode) {
  const elementTypes = [];
  function collect(current) {
    if (!current?.children) return;
    for (const child of current.children) {
      if (child.type === 'exp' && child.inference?.length > 0) {
        const inferredType = child.inference[0];
        // Detect spread elements (exp whose first child is 'spread')
        const isSpread = child.children?.some(c => c.type === 'spread');
        if (isSpread) {
          // Unwrap ArrayType: ...string[] contributes string elements, not string[]
          if (inferredType instanceof ArrayType) {
            elementTypes.push(inferredType.elementType);
          } else {
            // Unknown spread type — treat as any
            elementTypes.push(AnyType);
          }
        } else {
          elementTypes.push(inferredType);
        }
      } else if (child.type === 'array_literal_body') {
        collect(child);
      }
    }
  }
  collect(bodyNode);
  return elementTypes;
}

/**
 * Try to unify an array of ObjectTypes that share the same property keys.
 * Returns a single ObjectType, or null if unification is not possible.
 * @param {import('../Type.js').ObjectType[]} objectTypes
 * @returns {import('../Type.js').ObjectType|null}
 */
function tryUnifyObjectTypes(objectTypes) {
  const firstKeys = [...objectTypes[0].properties.keys()].sort();
  const allSameKeys = objectTypes.every(obj => {
    const keys = [...obj.properties.keys()].sort();
    return keys.length === firstKeys.length && keys.every((k, i) => k === firstKeys[i]);
  });
  if (!allSameKeys) return null;

  const unifiedProps = new Map();
  for (const key of firstKeys) {
    const propTypes = objectTypes.map(obj => obj.properties.get(key)?.type ?? AnyType);
    const unique = deduplicateTypes(propTypes.map(t => getBaseTypeOfLiteral(t)));
    const unified = unique.length === 1 ? unique[0] : Types.union(unique);
    const optional = objectTypes.some(obj => obj.properties.get(key)?.optional ?? false);
    unifiedProps.set(key, { type: unified, optional });
  }
  return Types.object(unifiedProps);
}

/**
 * Infer the element type of an array literal from its AST node
 * @param {Object} node - The array_literal AST node
 * @returns {import('../Type.js').Type|null} Array element Type object or null
 */
function inferArrayElementType(node) {
  if (!node?.children) return null;

  const bodyNode = node.children.find(c => c.type === 'array_literal_body');
  if (!bodyNode) return null; // empty array

  const elementTypes = collectBodyElementTypes(bodyNode);
  if (elementTypes.length === 0) return null;

  // If all elements are objects with identical keys → unify into one object type
  if (elementTypes.length > 1 && elementTypes.every(t => t instanceof ObjectType)) {
    const unified = tryUnifyObjectTypes(elementTypes);
    if (unified) return unified;
  }

  // Widen literals to their base types and deduplicate
  const uniqueBaseTypes = deduplicateTypes(elementTypes.map(t => getBaseTypeOfLiteral(t)));
  return uniqueBaseTypes.length === 1 ? uniqueBaseTypes[0] : Types.union(uniqueBaseTypes);
}

/**
 * Infer the structure of an object literal from its AST node
 * @param {Object} node - The object_literal AST node
 * @returns {string|null} Object type string like "{name: string, id: number}" or null
 */
function inferObjectLiteralStructure(node, lookupVariable) {
  if (!node || !node.children) {
    return null;
  }
  
  // Find the object_literal_body node
  const bodyNode = node.children.find(c => c.type === 'object_literal_body');
  if (!bodyNode) {
    // Empty object
    return Types.object(new Map());
  }
  
  // Use a Map to track properties (for proper override behavior)
  // Values are { type: Type, optional: boolean }
  const propertiesMap = new Map();
  
  // Process object_literal_body nodes in order
  // The grammar is right-recursive, so we need to process from left to right
  function processBodyNode(bodyNode) {
    if (!bodyNode || !bodyNode.children) return;
    
    // Check if this node contains a spread
    const spreadNode = bodyNode.named?.spread_exp;
    if (spreadNode && spreadNode.inference && spreadNode.inference.length > 0) {
      const spreadTypeRaw = spreadNode.inference[0];
      if (spreadTypeRaw instanceof ObjectType) {
        // Merge spread properties into our properties map
        for (const [propKey, propValue] of spreadTypeRaw.properties) {
          propertiesMap.set(propKey, propValue);
        }
      }
    }
    
    // Check for shorthand property (directly on bodyNode.named)
    if (bodyNode.named?.key) {
      const keyNode = bodyNode.named.key;
      const key = keyNode.value || (keyNode.children && keyNode.children[0] && keyNode.children[0].value);
      if (key) {
        let valueType = AnyType;
        if (lookupVariable) {
          const def = lookupVariable(key);
          if (def && def.type) {
            valueType = def.type;
          }
        }
        propertiesMap.set(key, { type: valueType, optional: false });
      }
    }
    
    // Check if this node contains a regular key-value property
    let key = null;
    let exp = null;
    
    for (const child of bodyNode.children) {
      if (child.type === 'object_literal_key') {
        key = child.value || (child.children && child.children[0] && child.children[0].value);
      } else if (child.type === 'exp' && !bodyNode.named?.spread_exp) {
        // This is the value expression for a property (not a spread)
        exp = child;
      }
    }
    
    // Also check named exp (for properties with explicit values)
    if (!exp && bodyNode.named?.exp && !bodyNode.named?.spread_exp) {
      exp = bodyNode.named.exp;
    }
    
    if (key && exp) {
      // Determine the type of the value
      let valueType = AnyType;
      
      if (exp.inference && exp.inference.length > 0) {
        // Normalize literal types to their base types for object properties
        valueType = getBaseTypeOfLiteral(exp.inference[0]);
      }
      
      propertiesMap.set(key, { type: valueType, optional: false });
    }
    
    // Process the next body node in the recursion
    const nextBodyNode = bodyNode.children.find(c => c.type === 'object_literal_body');
    if (nextBodyNode) {
      processBodyNode(nextBodyNode);
    }
  }
  
  processBodyNode(bodyNode);
  
  return Types.object(propertiesMap);
}

function createLiteralHandlers(getState) {
  // Shared helper: push a type for a literal node and stamp inferredType
  function pushLiteralType(node, parent, type) {
    const { pushInference, inferencePhase } = getState();
    pushInference(parent, type);
    if (inferencePhase === 'inference' && node.inferredType === undefined) {
      node.inferredType = type;
    }
  }

  // Shared helper: push a VNode type and register an implicit return
  function pushVNodeType(node, parent) {
    const { pushInference, getFunctionScope } = getState();
    const VNodeType = Types.alias('VNode');
    pushInference(parent, VNodeType);
    const functionScope = getFunctionScope();
    if (functionScope?.__returnTypes) {
      functionScope.__returnTypes.push(VNodeType);
    }
  }

  return {
    number: (node, parent) =>
      pushLiteralType(node, parent, Types.literal(parseFloat(node.value), NumberType)),

    str: (node, parent) =>
      // Strip surrounding quotes before creating the literal type
      pushLiteralType(node, parent, Types.literal(node.value.slice(1, -1), StringType)),

    null: (node, parent) => pushLiteralType(node, parent, NullType),
    undefined: (node, parent) => pushLiteralType(node, parent, UndefinedType),
    true: (node, parent) => pushLiteralType(node, parent, Types.literal(true, BooleanType)),
    false: (node, parent) => pushLiteralType(node, parent, Types.literal(false, BooleanType)),

    regexp: (node, parent) => {
      const { pushInference } = getState();
      pushInference(parent, new TypeAlias('RegExp'));
    },

    array_literal: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      const elementType = inferArrayElementType(node);
      pushInference(parent, elementType ? Types.array(elementType) : Types.alias('array'));
    },

    str_expression: (node, parent) => {
      // String interpolation always produces a string regardless of embedded
      // expression types. Visit children so the embedded expressions are still
      // type-checked (e.g. property access errors still fire).
      const { pushInference } = getState();
      visitChildren(node);
      node.inference = [StringType];
      node.inferredType = StringType;
      if (parent) pushInference(parent, StringType);
    },

    inner_str_expression: (node, parent) => {
      // Inner string interpolation segment — same reasoning as str_expression.
      const { pushInference } = getState();
      visitChildren(node);
      node.inference = [StringType];
      node.inferredType = StringType;
      if (parent) pushInference(parent, StringType);
    },

    object_literal: (node, parent) => {
      const { pushInference, lookupVariable } = getState();
      resolveTypes(node);

      const structure = inferObjectLiteralStructure(node, lookupVariable);
      pushInference(parent, structure ?? Types.alias('object'));
    },

    virtual_node: (node, parent) => {
      resolveTypes(node);
      pushVNodeType(node, parent);
    },

    virtual_node_exp: (node, parent) => {
      visitChildren(node);
      pushVNodeType(node, parent);
    },

    virtual_node_assign: (node, parent) => {
      // `= expr` inside a virtual node pushes content into the parent node's
      // children array as a side effect. The expression itself has no meaningful
      // return value, so it infers as undefined.
      const { pushInference } = getState();
      visitChildren(node);
      node.inference = [UndefinedType];
      node.inferredType = UndefinedType;
      if (parent) pushInference(parent, UndefinedType);
    },
  };
}

export default createLiteralHandlers;
