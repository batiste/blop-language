// ============================================================================
// Literal Handlers - Type inference for literal values
// ============================================================================

import { visitChildren, resolveTypes } from '../visitor.js';
import { getBaseTypeOfLiteral, resolveTypeAlias, ObjectType } from '../typeSystem.js';
import { Types, StringType, NumberType, BooleanType, NullType, UndefinedType, AnyType, ArrayType, UnionType, TypeAlias } from '../Type.js';

/**
 * Infer the element type of an array literal from its AST node
 * @param {Object} node - The array_literal AST node
 * @returns {import('../Type.js').Type|null} Array element Type object or null
 */
function inferArrayElementType(node) {
  if (!node || !node.children) {
    return null;
  }
  
  // Find the array_literal_body node
  const bodyNode = node.children.find(c => c.type === 'array_literal_body');
  if (!bodyNode) {
    // Empty array - can't infer element type
    return null;
  }
  
  const elementTypes = [];
  
  // Recursively collect element types from array_literal_body
  function collectElementTypes(current) {
    if (!current || !current.children) return;
    
    for (const child of current.children) {
      if (child.type === 'exp' && child.inference && child.inference.length > 0) {
        elementTypes.push(child.inference[0]);
      } else if (child.type === 'array_literal_body') {
        // Recursive body (for comma-separated elements)
        collectElementTypes(child);
      }
    }
  }
  
  collectElementTypes(bodyNode);
  
  if (elementTypes.length === 0) {
    return null;
  }
  
  // Check if all elements are object types
  const allObjectTypes = elementTypes.every(t => t instanceof ObjectType);
  
  if (allObjectTypes && elementTypes.length > 1) {
    // All objects — try to unify their structures
    const firstKeys = [...elementTypes[0].properties.keys()].sort();
    const allSameKeys = elementTypes.every(obj => {
      const keys = [...obj.properties.keys()].sort();
      return keys.length === firstKeys.length && keys.every((k, i) => k === firstKeys[i]);
    });
    
    if (allSameKeys) {
      // Unify property types to their base types
      const unifiedProps = new Map();
      for (const key of firstKeys) {
        const propTypes = elementTypes.map(obj => obj.properties.get(key)?.type ?? AnyType);
        const basePropTypes = propTypes.map(t => getBaseTypeOfLiteral(t));
        // Deduplicate by toString
        const seen = new Map();
        for (const t of basePropTypes) seen.set(t.toString(), t);
        const unique = [...seen.values()];
        
        const unified = unique.length === 1 ? unique[0] : Types.union(unique);
        const optional = elementTypes.some(obj => obj.properties.get(key)?.optional ?? false);
        unifiedProps.set(key, { type: unified, optional });
      }
      return Types.object(unifiedProps);
    }
  }
  
  // Unify all element types to a common base type
  const baseTypes = elementTypes.map(t => getBaseTypeOfLiteral(t));
  // Deduplicate by toString
  const seen = new Map();
  for (const t of baseTypes) seen.set(t.toString(), t);
  const uniqueBaseTypes = [...seen.values()];
  
  if (uniqueBaseTypes.length === 1) {
    // All elements have the same base type
    return uniqueBaseTypes[0];
  }
  
  // Mixed types - create a union type
  return Types.union(uniqueBaseTypes);
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
        valueType = exp.inference[0];
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
  return {
    number: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      // Infer literal types for numbers
      const numType = Types.literal(parseFloat(node.value), NumberType);
      pushInference(parent, numType);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = numType;
      }
    },
    str: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      // Strip quotes from node.value and infer as literal type
      const rawValue = node.value.slice(1, -1);
      const strType = Types.literal(rawValue, StringType);
      pushInference(parent, strType);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = strType;
      }
    },
    null: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      pushInference(parent, NullType);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = NullType;
      }
    },
    undefined: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      pushInference(parent, UndefinedType);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = UndefinedType;
      }
    },
    true: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      const trueType = Types.literal(true, BooleanType);
      pushInference(parent, trueType);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = trueType;
      }
    },
    false: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      const falseType = Types.literal(false, BooleanType);
      pushInference(parent, falseType);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = falseType;
      }
    },
    array_literal: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      
      // Try to infer the element type
      const elementType = inferArrayElementType(node);
      if (elementType) {
        pushInference(parent, Types.array(elementType));
      } else {
        pushInference(parent, Types.alias('array'));
      }
    },
    object_literal: (node, parent) => {
      const { pushInference, getExpectedObjectType, typeAliases, lookupVariable } = getState();
      resolveTypes(node);
      
      // Try to infer the structure of the object literal
      const structure = inferObjectLiteralStructure(node, lookupVariable);
      pushInference(parent, structure ?? Types.alias('object'));
      
      // If we have an expected type from context (e.g., from an assignment annotation),
      // use it to annotate the property keys with their expected types
      const expectedType = getExpectedObjectType();
      
      if (expectedType) {
        // Resolve type aliases to get the actual object structure
        const resolvedType = resolveTypeAlias(expectedType, typeAliases);
        
        if (resolvedType instanceof ObjectType) {
          // Recursively find and annotate object_literal_key nodes
          function annotatePropertyKeys(n) {
            if (!n || !n.children) return;
            
            for (const child of n.children) {
              // If this is an object_literal_key wrapper, get its inner name/str node
              if (child.type === 'object_literal_key' && child.children && child.children[0]) {
                const keyChild = child.children[0];  // This is the str or name node
                let keyName = keyChild.value;
                
                // Remove quotes from string keys
                if (keyName && (keyName.startsWith('"') || keyName.startsWith("'"))) {
                  keyName = keyName.slice(1, -1);
                }
                
                // Annotate THE KEY CHILD (not the wrapper) with its expected property type
                const prop = resolvedType.properties.get(keyName);
                if (keyName && prop) {
                  pushInference(keyChild, prop.type);
                }
              }
              
              // Recursively process all children
              annotatePropertyKeys(child);
            }
          }
          
          annotatePropertyKeys(node);
        }
      }
    },
    virtual_node: (node, parent) => {
      const { pushInference, getFunctionScope } = getState();
      resolveTypes(node);
      const VNodeType = Types.alias('VNode');
      pushInference(parent, VNodeType);
      
      // VNodes create implicit returns in Blop
      const functionScope = getFunctionScope();
      if (functionScope && functionScope.__returnTypes) {
        functionScope.__returnTypes.push(VNodeType);
      }
    },
    virtual_node_exp: (node, parent) => {
      const { pushInference, getFunctionScope } = getState();
      visitChildren(node);
      const VNodeType = Types.alias('VNode');
      pushInference(parent, VNodeType);
      
      // VNodes create implicit returns in Blop
      const functionScope = getFunctionScope();
      if (functionScope && functionScope.__returnTypes) {
        functionScope.__returnTypes.push(VNodeType);
      }
    },
  };
}

export default createLiteralHandlers;
