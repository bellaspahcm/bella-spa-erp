# T2-T6 Adversarial Test Plan

**Status:** READY TO EXECUTE (waiting for PR #81 merge)

## Prerequisites

✅ PR #81 merged to main  
✅ Workflow files verified on main:
- `.github/workflows/branch-protection.yml`
- `.github/workflows/branch-cleanup-on-merge.yml`
- `scripts/branch-reconciliation.js`

## Test Cases

### T2: Valid Single-Scope PR ✅ ALLOW

**Branch:** `product/english-center-test-t2-clean`

**Change:**
```typescript
// File: src/domains/education/products/english-center/test-artifact-t2-clean.ts
export const t2Test = { valid: true, scope: 'E1-only' };
```

**Expected:**
- Workflow detects: 1 product scope
- Status: ✅ ALLOWED
- CI check: SUCCESS
- Comment: "Single product scope: English Center"

**Acceptance:** PR can merge without warnings

---

### T3: Platform + Product Coupling ⚠️ WARNING

**Branch:** `platform/org-unit-with-e1-consumer`

**Changes:**
```typescript
// File 1: src/platform/org-unit/org-unit.engine.ts (add method)
public getHierarchyDepth(): number { ... }

// File 2: src/products/english-center/branch.service.ts (consume it)
const depth = orgUnitEngine.getHierarchyDepth();
```

**Expected:**
- Workflow detects: Platform + Product
- Status: ⚠️ WARNING  
- CI check: NEUTRAL
- Comment: "Platform + Product coupling detected. Document dependency."

**Acceptance:** PR flagged but NOT blocked

---

### T4: Large PR (>100 files) ⚠️ REVIEW

**Branch:** `product/english-center-mass-migration`

**Changes:**
- 120 test fixture files
- 1 actual feature file

**Expected:**
- Workflow detects: 121 files
- Status: ⚠️ REVIEW REQUIRED
- CI check: NEUTRAL
- Comment: "Large PR: 121 files. Provide justification."

**Acceptance:** PR requires explicit review approval

---

### T5: Daily Reconciliation Trigger 📊 REPORT

**Action:** Run scheduled workflow manually

**Command:**
```bash
gh workflow run .github/workflows/branch-reconciliation.yml
# OR trigger via cron schedule
```

**Expected:**
- Workflow runs successfully
- Classifies all branches:
  - IN_MAIN
  - CANONICAL
  - STALE (30+ days)
  - SUPERSEDED
- Uploads report artifact

**Acceptance:** Report generated with correct classifications

---

### T6: Main Branch Protection 🚫 REJECT

**Action:** Attempt direct push to main

**Command:**
```bash
git checkout main
echo "test" > direct-push-test.txt
git add direct-push-test.txt
git commit -m "test: direct push"
git push origin main
```

**Expected:**
- GitHub rejects push
- Error: "Protected branch update failed"
- Must use PR workflow

**Acceptance:** Direct push blocked by repository rules

---

## Execution Sequence

```
1. Verify PR #81 merged ✅
2. Pull latest main
3. Execute T2 → SUCCESS expected
4. Execute T3 → WARNING expected  
5. Execute T4 → REVIEW expected
6. Execute T5 → REPORT expected
7. Execute T6 → REJECT expected
8. Document all results
9. If 6/6 PASS → Declare "ENFORCEMENT PROVEN"
```

## Success Criteria

**6/6 PASS required:**
- T1: ✅ PASS (already proven - PR #76)
- T2: ✅ PASS
- T3: ⚠️ PASS (warning is correct behavior)
- T4: ⚠️ PASS (review required is correct)
- T5: 📊 PASS (report generated)
- T6: 🚫 PASS (push rejected)

**Final Status:**
```
Git Workflow Constitution — ENFORCEMENT PROVEN ✅
```

---

**Prepared:** 2026-09-13  
**Status:** Awaiting PR #81 merge to begin execution
