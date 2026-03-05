// ============================================================================
// Shared Utilities - Common functions for statement handlers
// ============================================================================

import { LiteralType, UnionType } from '../Type.js';
import { parseTypeExpression } from '../typeSystem.js';
import { AnyType, AnyFunctionType, FunctionType } from '../Type.js';
import { stampInferencePhaseOnly } from '../visitor.js';

/**
 * Extract import name nodes from destructuring_values node
 * @param {Object} node - destructuring_values AST node
 * @returns {Array<{name: string, node: Object}>} Array of {name, node} pairs
 */
export function extractImportNameNodes(node) {
  const entries = [];

  function traverse(n) {
    if (!n) return;

    if (n.type === 'destructuring_values') {
      if (n.named.name) {
        entries.push({ name: n.named.name.value, node: n.named.name });
      }
      if (n.named.more) {
        traverse(n.named.more);
      }
    }
  }

  traverse(node);
  return entries;
}

/**
 * Collect all property names from an exp:path tree (for LHS of property assignment).
 * For `a.b.c`, walks the nested exp nodes and collects [a, b, c], returning "b.c"
 * (skipping the base variable name — only the property chain part).
 */
export function collectPropertyPathFromExp(expNode) {
  const parts = [];
  function walk(node) {
    if (!node) return;
    if (node.type === 'exp') {
      if (node.named?.prop) {
        // Inlined property access: recurse into obj first, then add this prop
        walk(node.named.obj);
        parts.push(node.named.prop.value);
      } else {
        for (const child of node.children ?? []) {
          if (child.type === 'exp') walk(child);
        }
      }
    }
  }
  walk(expNode);
  return parts.join('.');
}

/**
 * Widen literal types to their abstract base types
 * For LiteralType, returns baseType; for UnionType, widens each member
 */
export function widenLiteralTypes(type) {
  if (type instanceof LiteralType) {
    return type.baseType;
  } else if (type instanceof UnionType) {
    const widenedTypes = type.types.map(t => widenLiteralTypes(t));
    // Avoid creating nested unions by flattening
    const flattened = [];
    for (const t of widenedTypes) {
      if (t instanceof UnionType) {
        flattened.push(...t.types);
      } else {
        flattened.push(t);
      }
    }
    return new UnionType(flattened);
  }
  return type;
}

/**
 * Extract destructuring bindings recursively from destructuring_values node.
 * Returns array of {propertyPath, propertyName, varName, node, annotationNode}.
 *
 * `propertyPath` is an ordered array of property keys needed to reach the bound
 * variable from the RHS object, e.g. ['info', 'score'] for `{ info: { score } }`.
 * `propertyName` (the last element of propertyPath) is retained for backward compat.
 */
export function extractDestructuringBindings(node, parentPath = []) {
  const bindings = [];
  
  if (node.type === 'destructuring_values') {
    if (node.named.nested) {
      // Nested destructuring: e.g. `info: { score, rank }`
      // `node.named.name` is the intermediate property; descend into the nested pattern.
      const intermediateProp = node.named.name.value;
      const nestedValues = node.named.nested.named?.values;
      if (nestedValues) {
        bindings.push(...extractDestructuringBindings(nestedValues, [...parentPath, intermediateProp]));
      }
    } else if (node.named.name && node.named.rename) {
      // Renamed: x as xPos
      bindings.push({
        propertyPath: [...parentPath, node.named.name.value],
        propertyName: node.named.name.value,
        varName: node.named.rename.value,
        node: node.named.rename,
        annotationNode: null,
      });
    } else if (node.named.name) {
      // Simple name or typed: attributes, or attributes: DogGameProps
      bindings.push({
        propertyPath: [...parentPath, node.named.name.value],
        propertyName: node.named.name.value,
        varName: node.named.name.value,
        node: node.named.name,
        annotationNode: node.named.annotation || null,
      });
    }
    // Recurse for siblings through 'more' (same parent path level)
    if (node.named.more) {
      bindings.push(...extractDestructuringBindings(node.named.more, parentPath));
    } else if (node.children) {
      // Find nested destructuring_values in children
      for (const child of node.children) {
        if (child.type === 'destructuring_values') {
          bindings.push(...extractDestructuringBindings(child, parentPath));
        }
      }
    }
  } else if (node.children) {
    // For other container nodes, recurse through children
    for (const child of node.children) {
      if (child.type === 'destructuring_values') {
        bindings.push(...extractDestructuringBindings(child, parentPath));
      }
    }
  }
  
  return bindings;
}

/**
 * Get the current return type count for a function scope
 */
export function getReturnTypeCount(functionScope) {
  return functionScope?.__returnTypes?.length || 0;
}

/**
 * Register an imported definition (type alias, function, or class) in the scope.
 * Handles the common pattern of checking the import result and stamping the type.
 * @param {string} name - Name to import
 * @param {Object} nameNode - AST node for the name (for hover support)
 * @param {Object} result - Import compilation result with typeAliases, exportObjects
 * @param {Object} importedFunctions - Exported functions from the module
 * @param {Object} importedClasses - Exported classes from the module
 * @param {Object} typeAliases - Current file's type alias map to merge into
 * @param {Object} scope - Current scope to register the name in
 */
export function registerImportedDefinition(name, nameNode, result, importedFunctions, importedClasses, typeAliases, scope) {
  if (result.typeAliases[name] && result.typeAliases[name].typeNode) {
    // Type alias: parse and register globally
    const aliasType = parseTypeExpression(result.typeAliases[name].typeNode);
    typeAliases[name] = aliasType;
    stampInferencePhaseOnly(nameNode, aliasType);
  } else if (importedFunctions[name]) {
    // Imported function: register in scope with FunctionType for hover
    const def = importedFunctions[name];
    scope[name] = def;
    stampInferencePhaseOnly(nameNode, def.params
      ? new FunctionType(def.params, def.type ?? AnyType, def.genericParams ?? [], def.paramNames ?? [])
      : AnyFunctionType);
  } else if (importedClasses[name]) {
    // Imported class: register in scope with class ObjectType for hover
    const def = importedClasses[name];
    scope[name] = def;
    stampInferencePhaseOnly(nameNode, def.type);
  }
}
