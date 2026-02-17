// ============================================================================
// Literal Handlers - Type inference for literal values
// ============================================================================

import { visitChildren, resolveTypes } from '../visitor.js';
import { getBaseTypeOfLiteral, parseObjectTypeString, resolveTypeAlias } from '../typeSystem.js';

/**
 * Infer the element type of an array literal from its AST node
 * @param {Object} node - The array_literal AST node
 * @returns {string|null} Array element type or null
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
  const allObjectTypes = elementTypes.every(t => t.startsWith('{') && t.endsWith('}'));
  
  if (allObjectTypes && elementTypes.length > 1) {
    // Parse all object structures
    const structures = elementTypes.map(t => parseObjectTypeString(t)).filter(s => s !== null);
    
    if (structures.length === elementTypes.length) {
      // All objects parsed successfully
      // Check if they have the same properties
      const firstKeys = Object.keys(structures[0]).sort();
      const allSameKeys = structures.every(s => {
        const keys = Object.keys(s).sort();
        return keys.length === firstKeys.length && keys.every((k, i) => k === firstKeys[i]);
      });
      
      if (allSameKeys) {
        // Unify property types to their base types
        const unifiedStructure = {};
        for (const key of firstKeys) {
          const propTypes = structures.map(s => s[key].type);
          const basePropTypes = propTypes.map(t => getBaseTypeOfLiteral(t));
          const uniqueBasePropTypes = [...new Set(basePropTypes)];
          
          if (uniqueBasePropTypes.length === 1) {
            unifiedStructure[key] = uniqueBasePropTypes[0];
          } else {
            // Mixed types for this property - create union
            unifiedStructure[key] = `(${uniqueBasePropTypes.sort().join(' | ')})`;
          }
        }
        
        // Build unified object type string
        const propStrings = Object.keys(unifiedStructure).map(k => `${k}: ${unifiedStructure[k]}`);
        return `{${propStrings.join(', ')}}`;
      }
    }
  }
  
  // Unify all element types to a common base type
  // If all elements are literals of the same base type (e.g., 1, 2, 3 -> number)
  // or all the same type, return that type
  
  const baseTypes = elementTypes.map(t => getBaseTypeOfLiteral(t));
  const uniqueBaseTypes = [...new Set(baseTypes)];
  
  if (uniqueBaseTypes.length === 1) {
    // All elements have the same base type
    return uniqueBaseTypes[0];
  }
  
  // Mixed types - create a union type like (number | string)
  // Sort for consistency
  const sortedTypes = uniqueBaseTypes.sort();
  return `(${sortedTypes.join(' | ')})`;
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
    return '{}';
  }
  
  // Use an object to track properties (for proper override behavior)
  const propertiesMap = {};
  
  // Process object_literal_body nodes in order
  // The grammar is right-recursive, so we need to process from left to right
  function processBodyNode(bodyNode) {
    if (!bodyNode || !bodyNode.children) return;
    
    // Check if this node contains a spread
    const spreadNode = bodyNode.named?.spread_exp;
    if (spreadNode && spreadNode.inference && spreadNode.inference.length > 0) {
      const spreadType = spreadNode.inference[0];
      const spreadStructure = parseObjectTypeString(spreadType);
      if (spreadStructure) {
        // Merge spread properties into our properties map
        for (const [propKey, propValue] of Object.entries(spreadStructure)) {
          const propType = typeof propValue === 'string' ? propValue : propValue.type;
          propertiesMap[propKey] = propType;
        }
      }
    }
    
    // Check for shorthand property (directly on bodyNode.named)
    if (bodyNode.named?.key) {
      const keyNode = bodyNode.named.key;
      const key = keyNode.value || (keyNode.children && keyNode.children[0] && keyNode.children[0].value);
      if (key) {
        let valueType = 'any';
        if (lookupVariable) {
          const def = lookupVariable(key);
          if (def && def.type) {
            valueType = def.type;
          }
        }
        propertiesMap[key] = valueType;
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
      let valueType = 'any';
      
      if (exp.inference && exp.inference.length > 0) {
        valueType = exp.inference[0];
      }
      
      propertiesMap[key] = valueType;
    }
    
    // Process the next body node in the recursion
    const nextBodyNode = bodyNode.children.find(c => c.type === 'object_literal_body');
    if (nextBodyNode) {
      processBodyNode(nextBodyNode);
    }
  }
  
  processBodyNode(bodyNode);
  
  if (Object.keys(propertiesMap).length === 0) {
    return '{}';
  }
  
  // Convert properties map to array of strings
  const propertyStrings = Object.entries(propertiesMap).map(([k, v]) => `${k}: ${v}`);
  return `{${propertyStrings.join(', ')}}`;
}

function createLiteralHandlers(getState) {
  return {
    number: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      // Infer literal types for numbers
      pushInference(parent, node.value);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = node.value;
      }
    },
    str: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      // Strip quotes from node.value and infer as literal type
      // node.value includes quotes like 'hello' or "hello", so we strip them
      const rawValue = node.value.slice(1, -1);
      pushInference(parent, `"${rawValue}"`);
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = `"${rawValue}"`;
      }
    },
    null: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      pushInference(parent, 'null');
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = 'null';
      }
    },
    undefined: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      pushInference(parent, 'undefined');
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = 'undefined';
      }
    },
    true: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      pushInference(parent, 'true');
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = 'true';
      }
    },
    false: (node, parent) => {
      const { pushInference, inferencePhase } = getState();
      pushInference(parent, 'false');
      if (inferencePhase === 'inference' && node.inferredType === undefined) {
        node.inferredType = 'false';
      }
    },
    array_literal: (node, parent) => {
      const { pushInference } = getState();
      visitChildren(node);
      
      // Try to infer the element type
      const elementType = inferArrayElementType(node);
      if (elementType) {
        pushInference(parent, `${elementType}[]`);
      } else {
        pushInference(parent, 'array');
      }
    },
    object_literal: (node, parent) => {
      const { pushInference, getExpectedObjectType, typeAliases, lookupVariable } = getState();
      resolveTypes(node);
      
      // Try to infer the structure of the object literal
      const structure = inferObjectLiteralStructure(node, lookupVariable);
      if (structure) {
        pushInference(parent, structure);
      } else {
        pushInference(parent, 'object');
      }
      
      // If we have an expected type from context (e.g., from an assignment annotation),
      // use it to annotate the property keys with their expected types
      const expectedType = getExpectedObjectType();
      
      if (expectedType) {
        // Resolve type aliases to get the actual object structure
        const resolvedType = resolveTypeAlias(expectedType, typeAliases);
        
        if (resolvedType && resolvedType.startsWith('{') && resolvedType.endsWith('}')) {
          // Parse the expected type to get property names and types
          const expectedProps = parseObjectTypeString(resolvedType);
          
          if (expectedProps) {
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
                  if (keyName && expectedProps[keyName]) {
                    const propType = expectedProps[keyName].type || expectedProps[keyName];
                    pushInference(keyChild, propType);
                  }
                }
                
                // Recursively process all children
                annotatePropertyKeys(child);
              }
            }
            
            annotatePropertyKeys(node);
          }
        }
      }
    },
    virtual_node: (node, parent) => {
      const { pushInference, getFunctionScope } = getState();
      resolveTypes(node);
      pushInference(parent, 'VNode');
      
      // VNodes create implicit returns in Blop
      const functionScope = getFunctionScope();
      if (functionScope && functionScope.__returnTypes) {
        functionScope.__returnTypes.push('VNode');
      }
    },
    virtual_node_exp: (node, parent) => {
      const { pushInference, getFunctionScope } = getState();
      visitChildren(node);
      pushInference(parent, 'VNode');
      
      // VNodes create implicit returns in Blop
      const functionScope = getFunctionScope();
      if (functionScope && functionScope.__returnTypes) {
        functionScope.__returnTypes.push('VNode');
      }
    },
  };
}

export default createLiteralHandlers;
