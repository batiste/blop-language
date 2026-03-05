// ============================================================================
// Const Assertion Helpers - Type freezing for `as const` assertions
// ============================================================================

import { parseTypeExpression } from '../typeParser.js';
import { AnyType, BooleanType, LiteralType, NullType, NumberType, StringType, TupleType, Types, UndefinedType } from '../Type.js';

/**
 * Check if a type_cast node represents "as const".
 * type_expression → type_primary (plain name, no array suffix) →
 * type_name → name token with value "const". No union/intersection.
 */
export function isConstAssertion(typeCastNode) {
  if (!typeCastNode) return false;
  if (typeCastNode.named?.union || typeCastNode.named?.intersection) return false;
  const typePrimary = typeCastNode.children?.[0];
  if (!typePrimary || typePrimary.type !== 'type_primary') return false;
  if (typePrimary.named?.array_suffix || typePrimary.named?.type_args ||
      typePrimary.named?.member || typePrimary.named?.member_key) return false;
  const typeName = typePrimary.named?.name;
  if (!typeName || typeName.type !== 'type_name') return false;
  const nameToken = typeName.children?.[0];
  if (!nameToken || nameToken.type !== 'name') return false;
  return nameToken.value === 'const';
}

/**
 * Build the frozen (as const) type from an expression node.
 * For literal AST nodes: returns the corresponding LiteralType.
 * For object/array literals: recursively freezes to literal types.
 * For anything else: returns the existing inferred type unchanged.
 */
export function buildConstType(expNode) {
  if (!expNode) return AnyType;
  // Navigate through single-child exp wrappers to reach the underlying node
  let inner = expNode;
  while (inner.type === 'exp' && inner.children?.length === 1) {
    inner = inner.children[0];
  }
  switch (inner.type) {
    case 'number':
      return new LiteralType(parseFloat(inner.value), NumberType);
    case 'str':
      return new LiteralType(inner.value.slice(1, -1), StringType);
    case 'true':
      return new LiteralType(true, BooleanType);
    case 'false':
      return new LiteralType(false, BooleanType);
    case 'null':
      return NullType;
    case 'undefined':
      return UndefinedType;
    case 'object_literal':
      return buildConstObjectType(inner);
    case 'array_literal':
      return buildConstArrayType(inner);
    default:
      // Variable / complex expression — preserve the already-inferred type
      return expNode.inferredType ?? AnyType;
  }
}

/**
 * Build a frozen ObjectType from an object_literal AST node.
 * Each property value is recursively processed via buildConstType.
 */
export function buildConstObjectType(objectLiteralNode) {
  const propertiesMap = new Map();

  function processBody(bodyNode) {
    if (!bodyNode?.children) return;
    let key = null;
    let valueExp = null;

    for (const child of bodyNode.children) {
      if (child.type === 'object_literal_key') {
        key = child.value ?? child.children?.[0]?.value;
      } else if (child.type === 'exp' && !bodyNode.named?.spread_exp) {
        valueExp = child;
      }
    }

    // Shorthand property { x } — key is labeled, no value exp in children
    if (!valueExp && bodyNode.named?.key) {
      const keyNode = bodyNode.named.key;
      key = keyNode.children?.[0]?.value ?? keyNode.value;
    }

    if (key && valueExp) {
      propertiesMap.set(key, { type: buildConstType(valueExp), optional: false });
    } else if (key && !valueExp && bodyNode.named?.key) {
      // Shorthand: preserve the variable's inferred type (can't freeze further)
      const inferredValType = bodyNode.named.key.inferredType ?? AnyType;
      propertiesMap.set(key, { type: inferredValType, optional: false });
    }

    const nextBody = bodyNode.children.find(c => c.type === 'object_literal_body');
    if (nextBody) processBody(nextBody);
  }

  const bodyNode = objectLiteralNode.children?.find(c => c.type === 'object_literal_body');
  if (bodyNode) processBody(bodyNode);

  const objType = Types.object(propertiesMap);
  objType.readonly = true;
  return objType;
}

/**
 * Build a frozen TupleType from an array_literal AST node.
 * Each element is recursively processed via buildConstType.
 */
export function buildConstArrayType(arrayLiteralNode) {
  const elements = [];

  function collectElements(bodyNode) {
    if (!bodyNode?.children) return;
    for (const child of bodyNode.children) {
      if (child.type === 'exp') {
        elements.push(buildConstType(child));
      } else if (child.type === 'array_literal_body') {
        collectElements(child);
      }
    }
  }

  const bodyNode = arrayLiteralNode.children?.find(c => c.type === 'array_literal_body');
  if (bodyNode) collectElements(bodyNode);

  const tupleType = Types.tuple(elements);
  tupleType.readonly = true;
  return tupleType;
}
