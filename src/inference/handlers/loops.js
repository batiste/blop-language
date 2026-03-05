// ============================================================================
// Loop Handlers - Type inference for while and for loops
// ============================================================================

import { visit, pushToParent } from '../visitor.js';
import { resolveTypeAlias, createUnionType } from '../typeSystem.js';
import { ArrayType, ObjectType, StringType, NumberType, AnyType } from '../Type.js';
import { detectTypeofCheck, detectEqualityCheck, detectTruthinessCheck, applyIfBranchGuard, detectImpossibleComparison } from '../typeGuards.js';
import { stampInferencePhaseOnly } from '../visitor.js';

/**
 * Create loop handlers (while_loop and for_loop)
 */
export function createLoopHandlers(getState) {
  return {
    while_loop: (node, parent) => {
      const { pushScope, popScope, lookupVariable, pushWarning, typeAliases } = getState();

      // Check for impossible comparisons in the condition
      const impossibleComparison = detectImpossibleComparison(node.named.exp, lookupVariable, typeAliases);
      if (impossibleComparison) {
        const { variable, comparedValue, possibleValues } = impossibleComparison;
        pushWarning(
          node.named.exp,
          `This condition will always be false: '${variable}' has type ${possibleValues.join(' | ')} and can never equal ${comparedValue}`
        );
      }

      // Detect type guards in the loop condition (same patterns as `condition` handler)
      const typeGuard = detectTypeofCheck(node.named.exp) || detectEqualityCheck(node.named.exp) || detectTruthinessCheck(node.named.exp);

      // Visit condition expression
      if (node.named.exp) {
        visit(node.named.exp, node);
      }

      // Push an isolated scope for the loop body (mirrors for_loop / condition)
      const scope = pushScope();

      // Apply type narrowing from the condition into the body
      if (typeGuard) {
        applyIfBranchGuard(scope, typeGuard, lookupVariable);
      }

      // Visit body statements
      if (node.named.stats) {
        node.named.stats.forEach(stat => visit(stat, node));
      }

      popScope();
      pushToParent(node, parent);
    },

    for_loop: (node, parent) => {
      const { pushScope, popScope, pushWarning, typeAliases } = getState();
      const scope = pushScope();
      
      // Get variable names
      const key = (node.named.key && node.named.key.value) || null;
      const value = node.named.value ? node.named.value.value : null;
      
      // Check for 'of' keyword (array iteration mode)
      const isArray = !!(node.named.of);
      
      // Key type: number with :array, string without (Object.keys returns strings)
      const keyType = isArray ? NumberType : StringType;
      
      // Add variables to scope with their types
      if (key) {
        scope[key] = { type: keyType, node: node.named.key };
        stampInferencePhaseOnly(node.named.key, keyType);
      }
      
      // Visit the expression being iterated
      if (node.named.exp) {
        visit(node.named.exp, node);
        
        // Check if we're iterating an array without :array annotation
        const expType = node.named.exp.inference?.[0];
        if (expType && key && !isArray) {
          const resolvedExpType = resolveTypeAlias(expType, typeAliases);
          const isArrayType = resolvedExpType instanceof ArrayType;
          
          if (isArrayType) {
            pushWarning(
              node.named.exp,
              `Iterating array without 'of' keyword - variable '${key}' will be string ("0", "1", ...) instead of number. Add 'of' after the expression to fix this.`
            );
          }
        }
      }
      
      // Infer value type if possible
      if (value && node.named.exp && node.named.exp.inference) {
        const expType = node.named.exp.inference[0];
        let valueType = AnyType;
        
        const resolvedExpType = resolveTypeAlias(expType, typeAliases);
        if (resolvedExpType instanceof ArrayType) {
          valueType = resolvedExpType.elementType;
        } else if (!isArray && resolvedExpType instanceof ObjectType && resolvedExpType.properties.size > 0) {
          // for key, value in obj — value is the union of all property value types
          const propTypes = Array.from(resolvedExpType.properties.values()).map(p => p.type);
          const unique = [...new Map(propTypes.map(t => [t.toString(), t])).values()];
          valueType = unique.length === 1 ? unique[0] : createUnionType(unique);
        }
        
        scope[value] = { type: valueType, node: node.named.value };
        stampInferencePhaseOnly(node.named.value, valueType);
      }
      
      // Visit loop body statements
      if (node.named.stats) {
        node.named.stats.forEach(stat => visit(stat, node));
      }
      
      popScope();
      pushToParent(node, parent);
    },
  };
}
