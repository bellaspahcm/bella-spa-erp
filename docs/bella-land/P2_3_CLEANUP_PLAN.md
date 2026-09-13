# P2.3 Cleanup Plan

**Date:** 2026-09-11  
**Status:** ⏸️ **READY TO EXECUTE**

---

## Artifacts to Remove

### 1. Test-Only Page

**File:** `src/app/test-bella-land-product/page.tsx`

**Reason:** Test-only page, not part of production UI

**Action:**
```bash
rm -rf src/app/test-bella-land-product
```

---

### 2. Playwright Test File (Optional)

**File:** `e2e/tests/bella-land-p2-3-browser-runtime.spec.ts`

**Decision:** KEEP for now (may be useful for regression)

**Alternative:** Move to archive if not needed

---

### 3. Temporary Evidence Documents (Optional)

**Files:**
- `docs/bella-land/P2_3_MANUAL_EXECUTION_CHECKLIST.md` — KEEP (useful reference)
- `docs/bella-land/P2_3_READY_TO_TEST.md` — Can archive
- `docs/bella-land/P2_3_EXECUTE_NOW.md` — Can archive
- `docs/bella-land/P2_3_RE_TEST_AFTER_FIX.md` — Can archive
- `docs/bella-land/P2_3_B5_FAILURE_RCA.md` — KEEP (audit trail)
- `docs/bella-land/P2_3_UX_IMPROVEMENT.md` — KEEP (design decision)
- `docs/bella-land/P2_3_COMBINED_EVIDENCE_STRATEGY.md` — Can archive
- `docs/bella-land/P2_3_FINAL_STATUS.md` — Can archive

**Decision:** Move to `docs/bella-land/archive/p2-3/` instead of deleting

---

### 4. Keep for Regression

**Files to KEEP:**
- `scripts/bella-land/verify-p2-3-product.ts` — Useful for DB verification in regression
- `docs/bella-land/P2_3_VERIFIED.md` — Final evidence document
- Production implementation files (apartments/page.tsx, productActions.ts, ProductService.ts)

---

## Cleanup Commands

### Remove Test Page

```bash
rm -rf src/app/test-bella-land-product
```

### Archive Temporary Docs (Optional)

```bash
mkdir -p docs/bella-land/archive/p2-3
mv docs/bella-land/P2_3_READY_TO_TEST.md docs/bella-land/archive/p2-3/
mv docs/bella-land/P2_3_EXECUTE_NOW.md docs/bella-land/archive/p2-3/
mv docs/bella-land/P2_3_RE_TEST_AFTER_FIX.md docs/bella-land/archive/p2-3/
mv docs/bella-land/P2_3_COMBINED_EVIDENCE_STRATEGY.md docs/bella-land/archive/p2-3/
mv docs/bella-land/P2_3_FINAL_STATUS.md docs/bella-land/archive/p2-3/
```

### Git Commit

```bash
git add -A
git commit -m "chore(real-estate): P2.3 cleanup - remove test artifacts

- Remove /test-bella-land-product test page
- Archive temporary execution documents
- Keep production implementation and verification script

P2.3 Status: 🔒 VERIFIED (10/10 PASS)
Next: P2.4 Regression"
```

---

## Files to Keep

### Production Code
- `src/app/dashboard/real-estate/apartments/page.tsx` — Production UI
- `src/modules/real_estate/actions/productActions.ts` — Server actions
- `src/modules/real_estate/services/ProductService.ts` — Service layer
- Database migrations (already committed)

### Evidence & Documentation
- `docs/bella-land/P2_3_VERIFIED.md` — Final verification document
- `docs/bella-land/P2_3_B5_FAILURE_RCA.md` — Defect analysis (audit trail)
- `docs/bella-land/P2_3_UX_IMPROVEMENT.md` — Design decision (empty defaults)
- `docs/bella-land/P2_3_MANUAL_EXECUTION_CHECKLIST.md` — Reference for future tests

### Test Infrastructure
- `scripts/bella-land/verify-p2-3-product.ts` — DB verification (useful for regression)
- `e2e/tests/bella-land-p2-3-browser-runtime.spec.ts` — Playwright test (keep for regression)

---

## After Cleanup

### Verify Clean State

```bash
# Check no test artifacts remain
ls src/app/test-bella-land-product  # Should not exist

# Verify production files intact
ls src/app/dashboard/real-estate/apartments/page.tsx
ls src/modules/real_estate/actions/productActions.ts
ls src/modules/real_estate/services/ProductService.ts
```

### Proceed to P2.4

**Next phase:** P2.4 Full Products Regression
- Rerun P2.1: 5/5 tests
- Rerun P2.2: 10/10 tests
- Existing read/update flows
- Browser smoke test

---

## Status After Cleanup

```text
Test artifacts            ✅ REMOVED
Production code           ✅ INTACT
Evidence documentation    ✅ PRESERVED
Audit trail               ✅ MAINTAINED

P2.3                      🔒 VERIFIED + CLEANED
Next                      ▶️ P2.4 REGRESSION
```

---

**Execute cleanup → Commit → Proceed to P2.4**

