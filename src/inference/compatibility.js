// ============================================================================
// Compatibility Checker - Extracted common type compatibility logic
// ============================================================================
// This module consolidates repeated patterns from Type.js isCompatibleWith
// methods to reduce duplication and improve maintainability.

/**
 * Check if a type is the 'any' type (works without instanceof via duck typing)
 * @param {Type} type
 * @returns {boolean}
 */
export function isAnyType(type) {
  return type?.kind === 'primitive' && type?.name === 'any';
}

/**
 * Check if a type is the 'never' type (bottom type)
 * @param {Type} type
 * @returns {boolean}
 */
export function isNeverType(type) {
  return type?.kind === 'primitive' && type?.name === 'never';
}

/**
 * Common alias resolution with recursion guard
 * Safely resolve TypeAlias, TypeMemberAccess, or KeyofType
 * Use duck-typing: check for 'kind' property to identify resolveable types
 * @param {Type} target
 * @param {TypeAliasMap} aliases
 * @returns {{resolved: Type|null, isCircular: boolean}}
 */
export function tryResolveAlias(target, aliases) {
  // Check if this is a resolveable type (TypeAlias, TypeMemberAccess, or KeyofType)
  // These have kind: 'alias' | 'member_access' | 'keyof'
  const needsResolution = target?.kind === 'alias' || target?.kind === 'member_access' || target?.kind === 'keyof';
  
  if (!needsResolution) {
    return { resolved: null, isCircular: false };
  }
  
  const resolved = aliases.resolve(target);
  
  // Avoid infinite recursion if alias can't be resolved (circular reference)
  if (resolved === target) {
    return { resolved: null, isCircular: true };
  }
  
  return { resolved, isCircular: false };
}

/**
 * Handle the case where target is a UnionType
 * Value is compatible if compatible with any member of the union
 * @param {Type} value
 * @param {Type[]} unionTypes - The constituent types of the union
 * @param {TypeAliasMap} aliases
 * @returns {boolean}
 */
export function checkUnionTarget(value, unionTypes, aliases) {
  return unionTypes.some(t => value.isCompatibleWith(t, aliases));
}

/**
 * Handle the case where target is an IntersectionType
 * Try to merge first (for all-object intersections), then check constituents
 * @param {Type} value
 * @param {Type} intersectionTarget
 * @param {TypeAliasMap} aliases
 * @returns {boolean|null} Returns null if can't handle intersection
 */
export function checkIntersectionTarget(value, intersectionTarget, aliases) {
  if (intersectionTarget?.kind !== 'intersection') {
    return null;
  }
  
  const merged = intersectionTarget.merge?.(aliases);
  if (merged) {
    return value.isCompatibleWith(merged, aliases);
  }
  
  // If can't merge, value must be compatible with all constituents
  return intersectionTarget.types.every(t => value.isCompatibleWith(t, aliases));
}
