# THEME GUARD GOVERNANCE NOTE

**Date:** 2026-09-10  
**Status:** Evidence Boundary Checkpoint  
**Baseline:** 108 BLOCK, 12 WARN (detector v1.0.0)

---

## 🎯 Critical Understanding

### Current Baseline Interpretation

```text
108 BLOCK / 12 WARN
```

**This represents:** Findings from current detector logic  
**This does NOT represent:** 108 confirmed architectural defects

**Why:**
- Detector logic may have false-positive rate
- Static analysis cannot confirm runtime behavior
- Preliminary evidence suggests significant over-blocking
- Runtime verification required for final classification

### Specific Uncertainty: BROAD_TENANT_SELECTOR

**Current detector findings:** 26 violations  
**Preliminary static analysis:** 24 appear legitimate, 2 token candidates, 0 apparent defects  
**Confidence:** LOW (static analysis only)  
**Status:** Awaiting runtime verification

**Cannot conclude:**
- ❌ "26 violations need CSS fixes"
- ❌ "24 violations can be ignored"
- ✅ "26 findings need runtime verification before classification"

---

## 🔒 Checkpoint Status

### What Is Sealed

**Phase 1A - Guard Infrastructure:**
- ✅ 6 detection rules implemented
- ✅ No-new-debt enforcement active
- ✅ Test suite (10/10 passing)
- ✅ CI/CD integration
- ✅ Documentation framework
- **Status:** 🔒 **CLOSED** (infrastructure complete)

**P1B.1 - Static Discovery:**
- ✅ 26 BROAD_TENANT_SELECTOR inventoried
- ✅ CSS source context analyzed
- ✅ Preliminary classification proposed
- ✅ Runtime verification template created
- **Status:** ✅ **COMPLETE** (static phase done)

### What Is Pending

**P1B.1 - Runtime Verification:**
- ⏸️ Browser DOM inspection
- ⏸️ Computed style verification
- ⏸️ Tenant switching tests
- ⏸️ Cross-component leakage detection
- **Status:** 🛑 **BLOCKED** (requires browser execution)

**P1B.1 - Guard Refinement:**
- ⏸️ Final classification
- ⏸️ Detector logic updates
- ⏸️ Regression fixture creation
- ⏸️ Baseline regeneration
- **Status:** ⏸️ **WAITING** (evidence required first)

**P1B.2 - Duplicate Visual Owners:**
- **Status:** ⏸️ **DO NOT START** (P1B.1 must complete first)

---

## 🚫 What Will NOT Be Done (At This Time)

1. **CSS Remediation** - No CSS changes without runtime evidence
2. **Detector Rule Changes** - No guard refinement without evidence
3. **Baseline Adjustments** - No manual baseline reduction
4. **P1B.2 Start** - Must resolve P1B.1 detector uncertainty first
5. **Classification Finalization** - Preliminary classifications not sealed

---

## 🎓 Governance Principle Established

### Gate Serves Correctness, Not Vice Versa

**CORRECT approach:**
```text
Gate detects pattern
        ↓
Evidence shows potential false-positive
        ↓
Runtime verification executed
        ↓
Evidence confirms false-positive
        ↓
Refine gate to understand architecture correctly
        ↓
Add regression fixtures
        ↓
Gate becomes more accurate
```

**INCORRECT approach:**
```text
Gate flags 26 violations
        ↓
"Fix" all 26 to make gate pass
        ↓
Break legitimate runtime behavior
        ↓
Gate happy, product broken
```

### Key Insight from P1B.1

**False-green incident taught us:**
- Static gate validation ≠ Runtime correctness
- Must verify replacement selectors exist in DOM
- Cannot skip browser verification

**Static discovery taught us:**
- Pattern matching ≠ Architectural understanding
- Tenant theming ≠ Architectural violation
- Guard may over-block legitimate patterns

**Next step teaches us:**
- Runtime evidence will finalize classification
- Guard refinement based on evidence, not assumptions
- Mature governance systems learn from adversarial examples

---

## 📋 Decision Protocol When Evidence Returns

**When `P1B1_RUNTIME_VERIFICATION.md` is delivered:**

### Step 1: Review Evidence (DO NOT CODE YET)

```text
1. Read runtime verification report
2. Compare to static classification
3. Identify discrepancies
4. Document classification changes
5. Propose detector refinement strategy
6. Get approval before implementation
```

### Step 2: Classification Reconciliation

**For each selector, determine:**
```text
Static classification:        [A/B/C/D/E]
Runtime verification:         [verdict]
Match/mismatch:              [analysis]
Final classification:         [A/B/C/D/E]
Action required:             [CSS fix / Guard refine / Document / None]
```

### Step 3: Decision Tree

**Scenario A: Runtime confirms most selectors legitimate (expected)**

```text
Action: Refine detector, not CSS
├─ Update BROAD_TENANT_SELECTOR logic
├─ Add BLOCK/ALLOW/WARN classifications
├─ Create regression fixtures
├─ Re-run against repository
├─ Regenerate baseline from corrected detector
└─ Close P1B.1 through detector improvement

CSS changes: 0-2 (only true violations)
Baseline after: 0-4 true BLOCK violations
```

**Scenario B: Runtime finds mix of legitimate + violations**

```text
Action: Refine detector AND fix CSS
├─ Update detector for false-positive reduction
├─ Fix true violations found
├─ Add regression fixtures for both
├─ Re-run against repository
├─ Regenerate baseline
└─ Close P1B.1 through detector + remediation

CSS changes: [count of true violations]
Baseline after: Reduced violations
```

**Scenario C: Runtime confirms many violations (unexpected)**

```text
Action: Re-evaluate static analysis methodology
├─ Understand why static analysis was wrong
├─ Proceed with CSS remediation
├─ Detector may be correct as-is
├─ Add regression fixtures
└─ Close P1B.1 through remediation

CSS changes: Significant
Baseline after: Reduced after remediation
```

### Step 4: Implementation Sequence

**Only after classification finalized:**

```bash
# 1. If detector needs refinement
#    Update scripts/architecture/theme-guard.ts
#    Add test fixtures
#    Verify tests pass

# 2. If CSS needs fixes
#    Apply fixes based on runtime evidence
#    Verify no new violations

# 3. Re-run detector
npm run theme:guard

# 4. Verify expected changes
#    Compare to predicted outcome

# 5. Regenerate baseline
npm run theme:guard:update-baseline

# 6. Close P1B.1
#    Document outcome
#    Move to P1B.2
```

---

## ⚠️ Critical Warnings

### Do NOT Do These Without Evidence

1. **Do not refine detector based on static analysis alone**
   - Risk: Remove detection of real violations
   - Requirement: Runtime confirmation required

2. **Do not fix CSS based on current detector findings alone**
   - Risk: Break legitimate runtime behavior (proven in rollback)
   - Requirement: Runtime verification required

3. **Do not manually adjust baseline to make diff checker pass**
   - Risk: Hide real violations or over-count false positives
   - Requirement: Baseline from corrected detector only

4. **Do not start P1B.2 before P1B.1 resolves detector accuracy**
   - Risk: Duplicate owners may be misclassified by inaccurate detector
   - Requirement: Confident detector required first

### Do These When Evidence Arrives

1. **Review evidence before implementation**
   - Evidence → Analysis → Decision → Implementation
   - Not: Evidence → Immediate implementation

2. **Reconcile static vs runtime classifications**
   - Document discrepancies
   - Understand why static analysis differed
   - Learn for future discoveries

3. **Test detector changes thoroughly**
   - Add regression fixtures for both false-positives and true-positives
   - Verify against repository
   - Confirm expected classification changes

4. **Document governance learning**
   - What worked in discovery process
   - What needs improvement
   - How detector matured

---

## 📊 Current Metrics (Interpreted Correctly)

```json
{
  "baseline": {
    "version": "1.0.0",
    "date": "2026-09-10",
    "detector_findings": {
      "BROAD_TENANT_SELECTOR": 26,
      "DUPLICATE_VISUAL_OWNER": 8,
      "EXCLUSION_CHAIN_SMELL_BLOCK": 74,
      "EXCLUSION_CHAIN_SMELL_WARN": 12,
      "TOTAL_BLOCK": 108,
      "TOTAL_WARN": 12
    },
    "interpretation": "Findings from current detector v1.0.0",
    "confidence": {
      "BROAD_TENANT_SELECTOR": "LOW (pending runtime verification)",
      "DUPLICATE_VISUAL_OWNER": "MEDIUM (static analysis reasonable)",
      "EXCLUSION_CHAIN_SMELL": "MEDIUM (pattern-based detection)"
    },
    "confirmed_defects": "TBD (requires runtime verification)"
  }
}
```

**Read as:** "Current detector finds 108 BLOCK patterns"  
**Not as:** "108 confirmed architectural defects exist"

---

## 🎯 Success Criteria for P1B.1 Closure

**P1B.1 can close when:**

1. ✅ Runtime verification complete (all 26 selectors)
2. ✅ Classification finalized (evidence-backed)
3. ✅ Detector refined (if false-positives confirmed)
4. ✅ Regression fixtures added (both BLOCK and ALLOW)
5. ✅ Repository re-scanned with refined detector
6. ✅ Baseline regenerated from corrected detector
7. ✅ CSS fixes applied (if true violations found)
8. ✅ Browser verification of any CSS changes
9. ✅ Documentation updated
10. ✅ No outstanding evidence gaps

**P1B.1 success ≠ "26 → 0"**

**P1B.1 success = "Detector accurately distinguishes legitimate theming from violations"**

---

## 🚀 When to Resume P1B.1

**Resume when:**
- Development team delivers `P1B1_RUNTIME_VERIFICATION.md`
- All 26 selectors have runtime evidence
- Classification confidence upgraded from LOW to HIGH

**Then:**
- Review evidence with architect
- Finalize classification
- Proceed to detector refinement or CSS fixes
- Close P1B.1
- Start P1B.2 with confident detector

---

## 📚 References

- **Static Discovery:** `P1B1_OWNERSHIP_DISCOVERY_REPORT.md`
- **Verification Template:** `P1B1_RUNTIME_VERIFICATION_TEMPLATE.md`
- **Rollback Post-Mortem:** `P1B1_ROLLBACK_POST_MORTEM.md`
- **Current Status:** `P1B1_CURRENT_STATUS.md`
- **Guard Source:** `scripts/architecture/theme-guard.ts`
- **Baseline:** `scripts/architecture/theme-guard-baseline.json`

---

---

## 🔒 OFFICIAL GOVERNANCE CHECKPOINT

**BELLA THEME ARCHITECTURE — GOVERNANCE EVIDENCE BOUNDARY**

Tại checkpoint này, Theme Architecture phải dừng ở P1B.1 cho đến khi có browser runtime evidence.

`108 BLOCK / 12 WARN` là **detector findings**, không phải 108 defect đã được chứng minh.

26 `BROAD_TENANT_SELECTOR` đã hoàn thành static ownership discovery. Kết quả `24 A / 2 D` chỉ là **preliminary classification**, chưa phải verdict cuối.

Không được sửa production CSS, giảm baseline, thay đổi severity hoặc tạo exception chỉ để làm guard xanh trước khi runtime verification hoàn tất.

Khi `P1B1_RUNTIME_VERIFICATION.md` có evidence, execution order bắt buộc là:

```text
Browser Evidence
      ↓
Static ↔ Runtime Reconciliation
      ↓
Final A/B/C/D/E Classification
      ↓
Decide:
CSS defect or Detector defect?
      ↓
Correct the actual defect
      ↓
Regression Fixtures
      ↓
Repository Guard Rerun
      ↓
Baseline Reconciliation
      ↓
P1B.1 VERIFIED + CLOSED
      ↓
P1B.2
```

### Governance Invariants

```text
Gate PASS ≠ Runtime PASS
Static finding ≠ Confirmed defect
Zero violations ≠ Correct architecture
Detector finding must not force invalid product remediation
```

**Core Principle:**

Theme Guard exists to protect system correctness. Product code must never be modified solely to satisfy a detector whose architectural assumption has not been proven.

---

## 📊 Official Checkpoint Status

```text
Phase 1A                     🔒 CLOSED
No-New-Debt Enforcement      ✅ ACTIVE

Phase 1B                     🟡 IN PROGRESS

P1B.1 Static Discovery       ✅ COMPLETE
P1B.1 Runtime Verification   🛑 EVIDENCE BLOCKED
P1B.1 Final Closure          ⏸️
P1B.2 Duplicate Owners       ⏸️
P1B.3 Exclusion Chains       ⏸️
```

**Governance Status:** 🔒 **CHECKPOINTED AT EVIDENCE BOUNDARY**  
**Next Action:** Awaiting runtime verification from development team  
**Blocker:** Browser execution required  
**No further work without evidence**

**When evidence returns:** Resume from reconciliation step, do not restart from beginning.

**This checkpoint represents mature governance:** Gate serves correctness, not ego.
