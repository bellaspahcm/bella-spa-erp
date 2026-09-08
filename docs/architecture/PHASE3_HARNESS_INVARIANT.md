# Phase 3: Adversarial Testing Harness Invariant

**Date:** 2026-09-08  
**Status:** ✅ ESTABLISHED

---

## Invariant

> **All adversarial FN/FP metrics MUST use target-rule verdict attribution, NOT orchestrator aggregate verdict.**

---

## Problem: Cross-Rule Masking

When multiple rules can BLOCK the same fixture, orchestrator exit code alone cannot determine if target rule performed correctly.

**Example:**

```text
Fixture: BLOCK2 (TS2741 missing required property)

Orchestrator execution:
  Rule 2: exit 2 (BLOCK) — schema drift detected
  Rule 4: exit 2 (BLOCK) — unknown diagnostic
  Rule 7: exit 0 (ALLOW)
  Rule 10: exit 0 (ALLOW)
  
Orchestrator verdict: exit 2 (BLOCK)
```

**If testing Rule 2:**
- Using orchestrator verdict → "Rule 2 blocked BLOCK2" ✓ correct
- But what if Rule 2 had exit 0 (ALLOW)?
  - Orchestrator still exits 2 (due to Rule 4)
  - We would incorrectly claim "Rule 2 blocked BLOCK2"
  - **False negative hidden by Rule 4 masking**

---

## Solution: Per-Rule Verdict Attribution

Orchestrator emits individual rule verdicts:

```text
──────────────────────────────────────────────────────────────────────
PER-RULE VERDICTS (for adversarial metric attribution):
──────────────────────────────────────────────────────────────────────
  [Rule 2] exitCode=2 verdict=BLOCK
  [Rule 4] exitCode=2 verdict=BLOCK
  [Rule 7] exitCode=0 verdict=ALLOW
  [Rule 10] exitCode=0 verdict=ALLOW
──────────────────────────────────────────────────────────────────────
```

**Adversarial test harness extracts target rule verdict ONLY:**

```typescript
// Extract Rule 2 verdict
if (output.match(/\[Rule 2\] exitCode=(\d+) verdict=(\w+)/)) {
  const r2Verdict = RegExp.$2; // "BLOCK" or "ALLOW"
  // Use r2Verdict for FN/FP calculation, ignore orchestrator exit code
}
```

---

## FN/FP Calculation (Correct Method)

**For Rule N adversarial testing:**

```text
Expected BLOCK fixtures: [BLOCK1, BLOCK2, BLOCK3]
Expected ALLOW fixtures: [ALLOW1, ALLOW2, ALLOW3]

For each fixture:
  1. Run orchestrator
  2. Extract [Rule N] verdict from per-rule output
  3. Record Rule N verdict (BLOCK or ALLOW)
  
False Negative = count(expected BLOCK but Rule N verdict=ALLOW)
False Positive = count(expected ALLOW but Rule N verdict=BLOCK)

FN Rate = FN / (FN + TP)
FP Rate = FP / (FP + TN)
```

**DO NOT use orchestrator exit code for FN/FP calculation.**

---

## Implementation

**Orchestrator:** `scripts/governance/factory-rules-gate.ts`

```typescript
// After executeAllRules() completes
console.log(`\n${'─'.repeat(70)}`);
console.log(`PER-RULE VERDICTS (for adversarial metric attribution):`);
console.log(`${'─'.repeat(70)}`);

const allExecutions: RuleExecution[] = [];
for (const [, result] of gateResults.entries()) {
  allExecutions.push(...result.executions);
}

allExecutions.sort((a, b) => {
  const aNum = parseInt(a.rule.match(/Rule (\d+)/)?.[1] || '999');
  const bNum = parseInt(b.rule.match(/Rule (\d+)/)?.[1] || '999');
  return aNum - bNum;
});

for (const exec of allExecutions) {
  const verdict = exec.passed ? 'ALLOW' : 'BLOCK';
  const exitCode = exec.passed ? 0 : 2;
  const ruleShort = exec.rule.replace(/:\s.*$/, '');
  console.log(`  [${ruleShort}] exitCode=${exitCode} verdict=${verdict}`);
}
```

**Test harness:** Parse per-rule verdict output, extract target rule only.

---

## Evidence: Rule 2 Verification

**BLOCK2 fixture (TS2741 missing required):**

```text
PER-RULE VERDICTS (for adversarial metric attribution):
  [Rule 2] exitCode=2 verdict=BLOCK    ← Rule 2 correctly blocks
  [Rule 4] exitCode=2 verdict=BLOCK    ← Rule 4 also blocks (expected)
  [Rule 7] exitCode=0 verdict=ALLOW
  [Rule 10] exitCode=0 verdict=ALLOW

SUMMARY: 2/4 rules PASSED
✗ 2 FACTORY RULES FAILED (orchestrator exit 2)
```

**Attribution:**
- Rule 2 verdict: BLOCK ✅ (target rule correct)
- Rule 4 verdict: BLOCK (defense-in-depth, does not affect Rule 2 metric)
- Orchestrator: BLOCK (aggregate, NOT used for Rule 2 FN/FP)

**Rule 2 FN/FP calculation:**
- Expected: BLOCK
- Rule 2 verdict: BLOCK
- Classification: True Positive ✅
- Rule 4 blocking same fixture does NOT create false negative for Rule 2

---

## Harness Invariant Applied

**Rule 2 adversarial results (6 fixtures):**

```text
✓ BLOCK1: R2=BLOCK (exit 2) — TP
✓ BLOCK2: R2=BLOCK (exit 2) — TP (Rule 4 also blocked, irrelevant)
✓ BLOCK3: R2=BLOCK (exit 2) — TP
✓ ALLOW1: R2=ALLOW (exit 0) — TN
✓ ALLOW2: R2=ALLOW (exit 0) — TN
✓ ALLOW3: R2=ALLOW (exit 0) — TN

FN = 0 (no expected BLOCK had R2=ALLOW)
FP = 0 (no expected ALLOW had R2=BLOCK)

FN rate: 0/3 = 0% ✅
FP rate: 0/3 = 0% ✅
```

**Without per-rule attribution:** Cannot prove BLOCK2/BLOCK3 verdicts came from Rule 2 specifically (could be masked by Rule 4).

**With per-rule attribution:** Unambiguous—Rule 2 blocked all 3 BLOCK fixtures.

---

## Harness Requirements (All Phase 3 Rules)

**For Rule N to be ADVERSARIAL-VERIFIED:**

1. ✅ 6 fixtures designed (3 BLOCK + 3 ALLOW)
2. ✅ Fixtures validated (preflight confirms expected diagnostic/clean)
3. ✅ Orchestrator run with per-rule verdict logging
4. ✅ Rule N verdict extracted from `[Rule N]` output
5. ✅ FN/FP calculated using Rule N verdict ONLY
6. ✅ FN rate = 0%, FP rate < 5%

**DO NOT:**
- ❌ Use orchestrator exit code for FN/FP calculation
- ❌ Count fixture as Rule N success if only orchestrator blocked (attribution gap)
- ❌ Claim 0% FN without proving Rule N verdict = BLOCK for all BLOCK fixtures

---

## Status

**Invariant:** ✅ ESTABLISHED (applied to Rule 2)  
**Implementation:** ✅ COMPLETE (orchestrator emits per-rule verdicts)  
**Rule 2 verification:** ✅ ADVERSARIAL-VERIFIED (6/6 correct, 0% FN, 0% FP)  
**Remaining rules:** Rules 4, 7, 10 (must follow same invariant)

---

**Last Updated:** 2026-09-08  
**Established:** Phase 3 Rule 2 Adversarial Testing  
**Scope:** All Phase 3 adversarial metrics for automated Factory Rules
