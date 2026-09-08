# Rule 2: Target-Rule Attribution Required

**Date:** 2026-09-08  
**Status:** ⏸️ PENDING TARGET-RULE ATTRIBUTION

---

## Issue: Cross-Rule Masking

**Problem identified:** Cannot claim Rule 2 ADVERSARIAL-VERIFIED based solely on orchestrator verdicts when multiple rules can BLOCK the same fixture.

### Current Evidence

**Orchestrator verdicts (6/6 correct):**
```text
✓ BLOCK1-camelcase:  BLOCK (exit 2)
✓ BLOCK2-missing:    BLOCK (exit 2) — ⚠️ BOTH R2 + R4 blocked
✓ BLOCK3-mismatch:   BLOCK (exit 2) — ⚠️ attribution unknown
✓ ALLOW1-snake:      ALLOW (exit 0)
✓ ALLOW2-viewmodel:  ALLOW (exit 0)
✓ ALLOW3-optional:   ALLOW (exit 0)
```

**Known attributions:**
- BLOCK1: ✅ Rule 2 blocks (manually verified previous session)
- BLOCK2: ⚠️ BOTH Rule 2 AND Rule 4 block (confirmed: "G2: 0/2 rules passed")
- BLOCK3: ❓ Unknown if Rule 2 blocks or only Rule 4 blocks

---

## Why This Matters

**False Negative calculation requires target-rule attribution:**

If BLOCK3 produces:
- Orchestrator: exit 2 (BLOCK)
- Rule 2: exit 0 (ALLOW) ← genuine false negative
- Rule 4: exit 2 (BLOCK) ← masks Rule 2 FN

Then claiming "Rule 2 correctly blocked BLOCK3" would be **false**. Orchestrator blocked due to Rule 4, not Rule 2.

---

## Required Verification

**Before upgrading Rule 2 to ADVERSARIAL-VERIFIED:**

1. Run Rule 2 in isolation on all 3 BLOCK fixtures
2. Confirm Rule 2 exit code = 2 for each
3. Confirm detection message shows schema drift classification
4. Document: each BLOCK fixture → Rule 2 verdict → attribution clear

**Target verification table:**

| Fixture | Diagnostic | Orchestrator | Rule 2 Isolation | Rule 4 Isolation | Attribution |
|---------|------------|--------------|------------------|------------------|-------------|
| BLOCK1  | TS2561     | BLOCK (2)    | ⏸️ verify       | ⏸️ verify       | ⏸️          |
| BLOCK2  | TS2741     | BLOCK (2)    | ⏸️ verify       | BLOCK (2) known  | ⏸️          |
| BLOCK3  | TS2322     | BLOCK (2)    | ⏸️ verify       | ⏸️ verify       | ⏸️          |

---

## Verification Method

**Option A: Run Rule 2 script directly**
```bash
npx tsx scripts/governance/rules/g2-rule2-schema-type-drift.ts <tsconfig-path>
# Expected: exit 2 for BLOCK fixtures
```

**Option B: Parse orchestrator G2 group output**
```text
G2: 0/2 rules passed
═══════════════════════════════════════════════════
  ✗ FAIL: Rule 2: Schema ↔ Type Drift Guard
═══════════════════════════════════════════════════
  FACTORY RULE 2: Schema ↔ Type Drift Guard (G2)
═══════════════════════════════════════════════════
✗ FAIL: 1 schema drift violations detected
```

Look for "schema drift violations detected" in Rule 2 section.

**Option C: Add orchestrator verbose mode**
```typescript
// In factory-rules-gate.ts
console.log(`[${rule.name}] exit=${code} verdict=${verdict}`);
```

---

## Current Blocker

**PowerShell execution environment:** npx tsx commands timing out or hanging in current session. Not a Rule 2 defect, but prevents isolation testing.

**Workaround options:**
1. Different terminal/shell
2. Add verbose logging to orchestrator
3. Manual review of previous session logs (BLOCK1 verified, BLOCK2 shows "G2: 0/2 rules passed")

---

## Minimum Evidence Required

**To close Rule 2 adversarial testing:**

```text
Preflight validity (all fixtures compile as expected)
├─ BLOCK1 → TS2561 present           ✅ confirmed
├─ BLOCK2 → TS2741 present           ✅ confirmed  
├─ BLOCK3 → TS2322 present           ⏸️ must confirm
├─ ALLOW1 → no errors                ✅ confirmed
├─ ALLOW2 → no errors                ✅ confirmed
└─ ALLOW3 → no errors                ✅ confirmed

Rule 2 target verdicts (NOT orchestrator verdicts)
├─ BLOCK1 → R2 exit 2                ✅ manual verified (previous session)
├─ BLOCK2 → R2 exit 2                ✅ confirmed ("G2: 0/2" output)
├─ BLOCK3 → R2 exit 2                ⏸️ REQUIRED
├─ ALLOW1 → R2 exit 0                ✅ confirmed (no drift detected)
├─ ALLOW2 → R2 exit 0                ✅ confirmed
└─ ALLOW3 → R2 exit 0                ✅ confirmed

False Negative calculation
├─ Ground truth BLOCK: 3
├─ Rule 2 BLOCK: ⏸️ 2 confirmed, 1 pending
├─ Rule 2 ALLOW (on BLOCK ground truth): ⏸️ unknown
└─ FN rate: ⏸️ cannot calculate until BLOCK3 attribution clear
```

---

## Next Action

**Proposed:** Add orchestrator debug output showing per-rule verdicts, rerun BLOCK3, extract Rule 2 verdict, complete attribution table.

**Alternative:** Accept that current evidence shows:
- BLOCK1: ✅ R2 blocks (manual)
- BLOCK2: ✅ R2 blocks (G2 group failed)
- BLOCK3: ⏸️ orchestrator blocks (R2 or R4 unknown)

Then mark Rule 2 as "BASELINE-VERIFIED (2/3 BLOCK confirmed)" and document BLOCK3 attribution gap.

---

**Principle preserved:**

> **Do not claim 0% false negative rate when cross-rule masking prevents target-rule attribution.**

If we cannot prove Rule 2 blocked BLOCK3, we cannot claim Rule 2 has 0% FN rate.

---

**Status:** Verification incomplete, orchestrator execution environment blocking progress.  
**Required:** Target-rule attribution for BLOCK3 before upgrading Rule 2 to ADVERSARIAL-VERIFIED.
