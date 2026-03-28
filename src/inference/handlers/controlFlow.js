// ============================================================================
// Control Flow Handlers - Type inference for conditions (if/elseif)
// ============================================================================

import { visit, pushToParent, visitChildren } from '../visitor.js';
import { resolveTypeAlias, isUnionType, parseUnionType } from '../typeSystem.js';
import { AnyType, LiteralType, StringType, NumberType } from '../Type.js';
import { detectTypeofCheck, detectEqualityCheck, detectTruthinessCheck, detectPredicateGuard, applyIfBranchGuard, applyElseBranchGuard, applyPostIfGuard, detectImpossibleComparison } from '../typeGuards.js';
import TypeChecker from '../typeChecker.js';
import { getReturnTypeCount } from './shared.js';

function branchHasExitStatement(stats = []) {
  if (!Array.isArray(stats) || stats.length === 0) {
    return false;
  }

  const containsExit = node => {
    if (!node) return false;
    if (node.type === 'return' || node.type === 'throw') return true;
    for (const child of (node.children || [])) {
      if (containsExit(child)) return true;
    }
    if (node.named) {
      for (const value of Object.values(node.named)) {
        if (value && typeof value === 'object' && containsExit(value)) {
          return true;
        }
      }
    }
    return false;
  };

  return stats.some(containsExit);
}

function collectEqualityGuardChain(conditionNode) {
  const guards = [];
  let currentCondition = conditionNode;

  while (currentCondition) {
    if (!branchHasExitStatement(currentCondition.named?.stats)) {
      return { guards: [], hasTerminalElse: false };
    }

    const guard = extractLiteralEqualityGuard(currentCondition.named?.exp);
    if (!guard || guard.negated || guard.property || !(guard.checkType instanceof LiteralType)) {
      return { guards: [], hasTerminalElse: false };
    }
    guards.push(guard);

    const next = currentCondition.named?.elseif;
    if (!next) {
      return { guards, hasTerminalElse: false };
    }

    if (!next.named?.exp) {
      const hasElseContent =
        (next.named?.stats && next.named.stats.length > 0)
        || next.named?.elseif;
      return { guards, hasTerminalElse: Boolean(hasElseContent) };
    }

    currentCondition = next;
  }

  return { guards, hasTerminalElse: false };
}

function extractLiteralEqualityGuard(expNode) {
  if (!expNode) return null;

  let hasEquality = false;
  let isNegated = false;
  let variable = null;
  let literalType = null;

  const visitNode = node => {
    if (!node) return;

    if (node.type === 'boolean_operator') {
      if (node.value === '==' || node.value === '===') {
        hasEquality = true;
      }
      if (node.value === '!=' || node.value === '!==') {
        hasEquality = true;
        isNegated = true;
      }
    }

    if (!variable && node.type === 'name') {
      variable = node.value;
    }

    if (!literalType && node.type === 'str') {
      literalType = new LiteralType(node.value.slice(1, -1), StringType);
    }

    if (!literalType && node.type === 'number') {
      literalType = new LiteralType(Number(node.value), NumberType);
    }

    (node.children || []).forEach(visitNode);
    if (node.named) {
      Object.values(node.named).forEach(child => {
        if (child && typeof child === 'object') {
          visitNode(child);
        }
      });
    }
  };

  visitNode(expNode);

  if (!hasEquality || !variable || !literalType) {
    return null;
  }

  return { variable, checkType: literalType, negated: isNegated };
}

function isLiteralUnionType(type) {
  if (!isUnionType(type)) {
    return false;
  }
  return parseUnionType(type).every(t => t instanceof LiteralType);
}

function maybeApplyExhaustiveChainPostGuard(node, getState) {
  const { lookupVariable, typeAliases, getCurrentScope } = getState();
  const { guards, hasTerminalElse } = collectEqualityGuardChain(node);

  if (hasTerminalElse || guards.length < 2) {
    return;
  }

  const variable = guards[0]?.variable;
  if (!variable || guards.some(g => g.variable !== variable)) {
    return;
  }

  const def = lookupVariable(variable);
  if (!def?.type) {
    return;
  }

  const resolved = resolveTypeAlias(def.type, typeAliases);
  if (!isLiteralUnionType(resolved)) {
    return;
  }

  const unionLiterals = parseUnionType(resolved);
  const isExhaustive = unionLiterals.every(unionLiteral =>
    guards.some(guard => unionLiteral.equals(guard.checkType))
  );

  if (!isExhaustive) {
    return;
  }

  const scope = getCurrentScope();
  guards.forEach(guard => applyPostIfGuard(scope, guard, lookupVariable, typeAliases));
}

/**
 * Create control flow handlers (condition and else_if)
 */
export function createControlFlowHandlers(getState) {
  return {
    condition: (node, parent) => {
      const { pushScope, popScope, lookupVariable, getCurrentScope, getFunctionScope, pushWarning, typeAliases } = getState();
      const functionScope = getFunctionScope();
      
      // Check for impossible comparisons
      const impossibleComparison = detectImpossibleComparison(node.named.exp, lookupVariable, typeAliases);
      if (impossibleComparison) {
        const { variable, comparedValue, possibleValues } = impossibleComparison;
        pushWarning(
          node.named.exp,
          `This condition will always be false: '${variable}' has type ${possibleValues.join(' | ')} and can never equal ${comparedValue}`
        );
      }

      const returnsBeforeIf = getReturnTypeCount(functionScope);

      // Visit condition expression FIRST. Predicate call nodes need inferredType stamped
      // before detectPredicateGuard can identify them.
      if (node.named.exp) {
        visit(node.named.exp, node);
      }

      // Detect type guard (syntax-based, then predicate which requires inferredType)
      const typeGuard = detectTypeofCheck(node.named.exp) || detectEqualityCheck(node.named.exp)
        || detectTruthinessCheck(node.named.exp) || detectPredicateGuard(node.named.exp);
      
      // Visit if branch (with type-narrowing scope when a type guard is present)
      if (typeGuard) {
        const ifScope = pushScope();
        applyIfBranchGuard(ifScope, typeGuard, lookupVariable, typeAliases);
        node.named.stats?.forEach(stat => visit(stat, node));
        popScope();
      } else {
        node.named.stats?.forEach(stat => visit(stat, node));
      }

      const returnsAfterIf = getReturnTypeCount(functionScope);

      // Visit else/elseif branch with type narrowing
      const elseNode = node.named.elseif;
      const isSimpleElse = elseNode && !elseNode.named?.exp && elseNode.named?.stats?.length > 0;

      if (isSimpleElse) {
        if (typeGuard) {
          const elseScope = pushScope();
          applyElseBranchGuard(elseScope, typeGuard, lookupVariable, typeAliases);
          elseNode.named.stats.forEach(stat => visit(stat, node));
          popScope();
        } else {
          visit(elseNode, node);
        }
      } else if (elseNode) {
        if (typeGuard) {
          const elseifScope = pushScope();
          applyElseBranchGuard(elseifScope, typeGuard, lookupVariable, typeAliases);
          visit(elseNode, node);
          popScope();
        } else {
          visit(elseNode, node);
        }
      }
      
      // When the if-branch is an early-exit type guard (always returns) with no else,
      // the code after this block is only reachable when the condition was false.
      // Apply type exclusion to the outer scope so subsequent statements see the narrowed type.
      // Note: the parser always creates an else_if node (matched with empty rule ['w?']) even
      // when there is no actual else clause, so we must check for meaningful else content.
      const ifBranchAlwaysReturns = returnsAfterIf > returnsBeforeIf;
      const elseHasContent = elseNode && (
        elseNode.named?.exp ||
        (elseNode.named?.stats && elseNode.named.stats.length > 0) ||
        elseNode.named?.elseif
      );
      if (typeGuard && !elseHasContent && ifBranchAlwaysReturns) {
        applyPostIfGuard(getCurrentScope(), typeGuard, lookupVariable, typeAliases);
      }

      // If an if/elseif chain compares the same literal-union variable and every
      // branch exits, mark the variable exhausted in outer scope.
      maybeApplyExhaustiveChainPostGuard(node, getState);
      
      pushToParent(node, parent);
    },

    else_if: (node, parent) => {
      const { pushScope, popScope, lookupVariable } = getState();

      // Simple else branch: no condition, just visit body
      if (!node.named?.exp) {
        node.named?.stats?.forEach(stat => visit(stat, node));
        if (node.named?.elseif) {
          visit(node.named.elseif, node);
        }
        pushToParent(node, parent);
        return;
      }

      // Visit the elseif condition expression
      visit(node.named.exp, node);

      // Apply type narrowing for this elseif's own condition
      const typeGuard = detectTypeofCheck(node.named.exp) || detectEqualityCheck(node.named.exp)
        || detectTruthinessCheck(node.named.exp) || detectPredicateGuard(node.named.exp);
      if (typeGuard) {
        const ifScope = pushScope();
        applyIfBranchGuard(ifScope, typeGuard, lookupVariable);
        node.named.stats?.forEach(stat => visit(stat, node));
        popScope();
      } else {
        node.named.stats?.forEach(stat => visit(stat, node));
      }

      // Visit chained else_if, applying exclusion from this branch's typeGuard
      if (node.named.elseif) {
        if (typeGuard) {
          const elseScope = pushScope();
          applyElseBranchGuard(elseScope, typeGuard, lookupVariable);
          visit(node.named.elseif, node);
          popScope();
        } else {
          visit(node.named.elseif, node);
        }
      }

      pushToParent(node, parent);
    },

    assign_op: (node, parent) => {
      const { lookupVariable, pushWarning, typeAliases, inferencePhase } = getState();

      // Always visit children so that expression inference is populated
      visitChildren(node);

      // Type-checking only happens in the checking phase.
      // Also skip property-access variants (e.g. obj.prop += 1) — those
      // require resolving the property type from the object, which is handled
      // by the property-access validators elsewhere.
      if (inferencePhase !== 'checking' || node.named.target) {
        pushToParent(node, parent);
        return;
      }

      const varName = node.named.name?.value;
      const expNode = node.named.exp;

      if (!varName || !expNode) {
        pushToParent(node, parent);
        return;
      }

      // Find the assign_operator token (e.g. '+=', '-=', '*=', '/=')
      const assignOperator = node.children?.find(c => c.type === 'assign_operator');
      if (!assignOperator) {
        pushToParent(node, parent);
        return;
      }

      // Strip the trailing '=' to get the base arithmetic operator
      const opChar = assignOperator.value.slice(0, -1); // '+=' -> '+'

      // Look up the variable's current type
      const varDef = lookupVariable(varName);
      if (!varDef || !varDef.type) {
        pushToParent(node, parent);
        return;
      }

      const varType = resolveTypeAlias(varDef.type, typeAliases);
      const rhsType = expNode.inference?.[0];

      if (!rhsType || rhsType === AnyType || varType === AnyType) {
        pushToParent(node, parent);
        return;
      }

      // Validate the compound assignment using the same math-operation rules
      const result = TypeChecker.checkMathOperation(varType, rhsType, opChar);
      if (!result.valid) {
        const msgs = result.warning ? [result.warning] : (result.warnings ?? []);
        msgs.forEach(msg => pushWarning(node, msg));
      }

      pushToParent(node, parent);
    },
  };
}
