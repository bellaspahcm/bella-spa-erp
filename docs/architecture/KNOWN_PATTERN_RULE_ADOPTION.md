# Known Pattern Rule — Formal Adoption

**Date:** 2026-09-03  
**Status:** ACTIVE  
**Type:** Governance Enhancement  
**Phase:** Phase 1 Regression Protection

---

## Decision

Formalize the **Known Pattern Rule** as an official governance decision rule, based on field test evidence from Real-Estate Platform remediation.

---

## Rationale

### Problem
Phase 1 governance was designed to prevent regressions during remediation. However, early implementation showed that treating every diagnostic as requiring full investigation created unnecessary ceremony:

- Known patterns required re-investigation
- Clear mechanical fixes delayed by analysis paralysis
- Speed sacrificed even when safety was proven

### Solution
Introduce pattern classification BEFORE investigation:

```text
Known Pattern + Gates PASS → Safe to proceed quickly
New Pattern OR Gate FAIL → STOP and investigate
```

---

## Field Test Evidence

**Real-Estate Platform Remediation (commit `6e5926ac`):**

### Context
- 3 TypeScript diagnostics
- Pattern: vocabulary/schema mismatch
- Prior investigation documented DB enum as canonical
- Migration `20260802100000` line 114: `completed → handed_over` mapping

### Execution
1. Classified as "known pattern" (vocabulary mismatch, DB canonical)
2. Applied minimal fix: aligned Platform Kernel to DB enum vocabulary
3. Ran mandatory gates:
   - TypeCheck: 3 → 0 diagnostics (PASS)
   - Regression: 0 new issues (ALLOW)
   - Architecture Guard: PASS
   - Relevant Tests: 4/5 PASS (1 pre-existing accounting failure)
4. Committed and pushed: `6e5926ac`

### Results
- Duration: ~30 minutes (vs. multi-hour investigation)
- Diagnostics: 3 → 0 (100% resolved)
- Regressions: 0 new
- Platform status: Real-Estate now PASS (40 PASS / 3 FAIL / 1 HOTSPOT)

### Key Observation
Known pattern + gates = safe speed without compromising correctness.

---

## Rule Definition

### Known Pattern Classification

**A pattern is "known" when:**
1. Root cause type is documented in governance/evidence docs
2. Canonical ownership rules already established
3. Fix approach is mechanical and documented
4. No new semantic ambiguity introduced

### Current Known Patterns (2026-09-03)

| Pattern | Fix Approach | Evidence Source |
|---------|-------------|-----------------|
| Duplicate export blocks | Mechanical removal | Host field test (`6ee30569`) |
| Vocabulary/schema mismatch (DB canonical) | Align code to DB enum | Real-Estate investigation + migration evidence |
| Import path errors | Fix module path | Clear module boundaries |

### Decision Flow

```text
Issue Detected
    ↓
Is pattern documented? ────NO───→ STOP → Investigate → Document
    ↓ YES
    │
Ownership clear? ──────────NO───→ STOP → Gather evidence
    ↓ YES
    │
Semantics unambiguous? ────NO───→ STOP → Document ambiguity
    ↓ YES
    │
Known Pattern: PROCEED WITH MINIMAL FIX
    ↓
Run Mandatory Gates
    ↓
All Gates PASS? ───────────NO───→ STOP → Investigate gate failure
    ↓ YES
    │
New ambiguity emerged? ────YES──→ STOP → Document and escalate
    ↓ NO
    │
COMMIT
```

### Mandatory Gates (Unchanged)

1. **TypeScript Check (Gate B)** — must PASS for changed scope
2. **Regression Protection** — must exit 0 (ALLOW)
3. **Architecture Guard** — must PASS
4. **Relevant Tests** — must PASS (or pre-existing failure confirmed)

**All gates must pass before commit, regardless of pattern classification.**

---

## What This Is NOT

❌ **NOT permission to skip investigation entirely**
- First occurrence of pattern type MUST be investigated
- Pattern must be documented before reuse
- New semantic ambiguity requires immediate STOP

❌ **NOT permission to bypass gates**
- All mandatory gates still required
- Gate failure blocks commit regardless of pattern

❌ **NOT a reduction in safety**
- Same gates, same safety guarantees
- Only eliminates redundant investigation effort

---

## What This IS

✅ **Investment of investigation effort ONCE per pattern**
- Deep investigation on first occurrence
- Document pattern and canonical rules
- Reuse knowledge for subsequent occurrences

✅ **Speed without ceremony for known-safe changes**
- Mechanical fixes proceed quickly
- Gates provide runtime safety verification
- Governance protects without blocking

✅ **Immediate escalation for new ambiguity**
- Any new semantic uncertainty triggers STOP
- Pattern classification doesn't override judgment
- Safety remains paramount

---

## Integration with Existing Governance

### AI Coding Contract
- Added "Decision Rule: Known Pattern vs New Pattern" section
- Integrated into "After Every Code Change" workflow
- Updated Platform Status to reflect Real-Estate resolution
- Version: 1.0 → 1.1

### Regression Gate Policy
- Added "Known Pattern Decision Rule" section
- Documented field test evidence
- Clarified relationship with baseline comparison
- No version change (extension, not modification)

### Architecture Guard
- No changes required
- Known Pattern Rule works WITH Architecture Guard, not around it
- Frozen boundaries still enforced regardless of pattern

---

## Adoption Timeline

| Date | Event |
|------|-------|
| 2026-09-01 | Phase 1 Regression Protection closure |
| 2026-09-03 | Real-Estate remediation field test (known pattern workflow) |
| 2026-09-03 | Known Pattern Rule formalized and documented |
| 2026-09-03 | Updated AI Coding Contract (v1.1) |
| 2026-09-03 | Updated Regression Gate Policy |
| 2026-09-03 | Commit `1876ccab` pushed to remote |

---

## Success Metrics

### Quantitative
- Real-Estate: 3 → 0 diagnostics
- Time: ~30 minutes (vs. estimated 2-3 hours with full investigation)
- Regressions: 0 new
- Platform: 40 PASS / 3 FAIL (Real-Estate now PASS)

### Qualitative
- **Speed:** Mechanical fixes no longer blocked by redundant investigation
- **Safety:** All gates still mandatory, no reduction in protection
- **Clarity:** Pattern classification provides clear decision point
- **Reuse:** Investigation effort invested once, reused thereafter

---

## Future Pattern Discovery

### Adding New Known Patterns

**Requirements:**
1. Pattern observed in real remediation work
2. Root cause fully investigated and documented
3. Canonical ownership verified with evidence
4. Fix approach mechanical and repeatable
5. No semantic ambiguity remaining

**Process:**
1. Document pattern in investigation/evidence docs
2. Add to AI Coding Contract known patterns list
3. Update this document with pattern details
4. Field test pattern classification on next occurrence
5. Refine if needed based on evidence

### Pattern Lifecycle

```text
New Issue
    ↓
Investigate (STOP and gather evidence)
    ↓
Document findings
    ↓
Pattern emerges with clear ownership
    ↓
Add to Known Patterns registry
    ↓
Next occurrence: Known Pattern workflow
    ↓
If ambiguity appears: escalate and refine pattern
```

---

## Governance Principles Upheld

### Evidence Before Infrastructure
✅ Known Pattern Rule field-tested before formalization
✅ Real-Estate remediation provided concrete evidence
✅ No speculative patterns added

### Minimal Complexity
✅ Simple classification: known vs. new
✅ No new infrastructure required
✅ Works within existing gate framework

### No Claim Without Evidence
✅ Pattern classification requires documented evidence
✅ Gates provide runtime verification
✅ Baseline comparison still mandatory for test failures

### Kernel-First Philosophy
✅ Investigation invested once (kernel knowledge)
✅ Reused across remediation instances (kernel reuse)
✅ Evolved based on real need (not speculative)

---

## Review and Evolution

### Review Trigger
- After 5 known-pattern remediations
- Any gate failure on known-pattern fix
- Discovery of pattern classification error

### Potential Evolution
- Pattern taxonomy refinement
- Additional patterns documented
- Classification criteria updates
- Integration with future Phase 2/3 governance

**Next Review:** After 5 successful known-pattern remediations OR first pattern misclassification event.

---

## Related Documents

- `AI_CODING_CONTRACT.md` — AI coding rules with Known Pattern decision flow
- `docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md` — Baseline comparison with pattern classification
- `docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md` — Phase 1 field test and closure
- `docs/architecture/REAL_ESTATE_OWNERSHIP_INVESTIGATION.md` — Evidence for vocabulary/schema pattern

---

## Summary

The Known Pattern Rule is not new governance — it's **formalized learning** from Phase 1 field tests.

**Principle:**
> Investigate once per pattern type. Reuse knowledge. Stop when ambiguity appears.

**Result:**
> Safe speed without ceremony. Governance that accelerates rather than blocks.

**Status:**
> Active in AI Coding Contract v1.1, field-tested with Real-Estate, ready for reuse.

---

**Document Status:** CANONICAL  
**Effective Date:** 2026-09-03  
**Next Review:** After 5 known-pattern remediations  
**Commit:** `1876ccab`
