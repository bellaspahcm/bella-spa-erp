# P2.3 Combined Evidence Strategy

**Date:** 2026-09-11  
**Status:** 📋 **STRATEGY DOCUMENTED**

---

## Evidence Combination Approach

### Valid Combined Evidence

P2.3 can be sealed with **combined evidence** from two sources:

```text
Playwright Evidence (Automated)
B1: Login                       ✅ PASS
B2: /apartments loads           ✅ PASS
B3: "Tạo căn mới" clickable     ✅ PASS
B4: Modal renders               ✅ PASS

+

Manual Runtime Evidence
B5: Form fields bind            ✅ PASS
B6: Submit succeeds             ✅ PASS
B7: Modal closes / success      ✅ PASS
B8: Product in list             ✅ PASS
B9: Reload persistence          ✅ PASS
B10: DB verification            ✅ PASS

=

Combined Browser Acceptance
B1-B10                          🔒 10/10 VERIFIED
```

### Rationale

**Why combined evidence is acceptable:**
1. Playwright B1-B4 evidence already captured and documented
2. No code changes to production UI after B1-B4 execution
3. Manual B5-B10 completes the evidence chain
4. Both evidence streams audit-safe and reproducible

**NOT acceptable if:**
- Production UI code changed after B1-B4
- Playwright evidence not properly documented
- Manual evidence incomplete or unclear
- Any contradiction between evidence streams

---

## Evidence Staleness Check

Before using combined evidence, verify:

### ✅ Playwright Evidence Still Valid

**Files to check:**
- `src/app/dashboard/real-estate/apartments/page.tsx`
- `src/modules/real_estate/actions/productActions.ts`
- `src/modules/real_estate/services/ProductService.ts`

**Verification:**
```bash
# Check git history since last Playwright run
git log --since="2026-09-11" --oneline -- \
  src/app/dashboard/real-estate/apartments/page.tsx \
  src/modules/real_estate/actions/productActions.ts \
  src/modules/real_estate/services/ProductService.ts
```

**If no changes:** Playwright B1-B4 evidence still valid

**If changes exist:** Must rerun full B1-B10 (not just B5-B10)

---

## Manual Test Execution Options

### Option A: B5-B10 Only (Recommended if Playwright B1-B4 valid)

**Test:** Manual B5-B10 from modal open state

**Assumption:** B1-B4 already verified by Playwright

**Result:** Combined evidence B1-B10

**Condition:** No code changes since Playwright run

---

### Option B: Full B1-B10 Manual (Safer if uncertain)

**Test:** Complete manual test B1-B10

**Advantage:** Single evidence chain, easier audit

**Use when:**
- Code changed after Playwright
- Uncertainty about Playwright evidence
- Prefer complete manual evidence

---

## Evidence Documentation Requirements

### Combined Evidence (Option A)

**Must document:**
1. Playwright execution timestamp
2. Playwright B1-B4 results
3. Code change verification (none since Playwright)
4. Manual B5-B10 execution timestamp
5. Manual B5-B10 results
6. Combined verdict

**Document format:**
```text
P2.3 BROWSER RUNTIME — COMBINED EVIDENCE

Playwright Evidence (2026-09-11 14:30)
B1-B4: ✅ PASS
Code changes since: NONE

Manual Evidence (2026-09-11 15:00)
B5-B10: ✅ PASS

Combined Verdict
B1-B10: 🔒 10/10 VERIFIED
```

### Single Evidence (Option B)

**Must document:**
1. Manual execution timestamp
2. Full B1-B10 results
3. Screenshots
4. Console logs

---

## Critical Path After P2.3

```text
Complete Browser Evidence (Combined or Single)
                ↓
        P2.3 🔒 VERIFIED
                ↓
            Cleanup
    ├─ Remove /test-bella-land-product
    ├─ Remove [P2.3 Evidence] logs
    └─ Verify no test-only code remains
                ↓
        P2.4 Regression
    ├─ P2.1 write flow:      5/5
    ├─ P2.2 auth security:   10/10
    ├─ Production browser:   smoke PASS
    └─ Existing flows:       PASS
                ↓
        P2.5 Products Seal
    ├─ All gates closed
    ├─ Evidence complete
    └─ Baseline compliant
                ↓
        Products 🔒 CLOSED
                ↓
    Customers Evidence Closure
                ↓
    All 4 Capabilities CLOSED
    (Projects ✅ / Products ✅ / Customers ✅ / Reservations ✅)
                ↓
    Phase 5 Cross-Capability Business Flow
                ↓
    Final RC Evidence Review
                ↓
    Bella Land v2 RC 🔒 SEALED
```

---

## Important Boundaries

### Products ≠ Bella Land RC

**Products closure means:**
- ✅ Projects (P2.0-P2.5) sealed
- ✅ Products capability complete
- ✅ Security verified
- ✅ Browser runtime verified

**Products closure does NOT mean:**
- ❌ Customers complete
- ❌ Phase 5 integration complete
- ❌ Bella Land v2 RC ready

**Bella Land v2 RC requires:**
1. All 4 capabilities closed:
   - Projects ✅ (already closed)
   - Products ⏸️ (P2.3-P2.5 remaining)
   - Customers ⏸️ (evidence closure pending)
   - Reservations ✅ (already closed)
2. Phase 5 Cross-Capability Business Flow
3. Final RC Evidence Review

**Current baseline state:**
```text
Projects       🔒 CLOSED
Products       🟡 CLOSURE IN PROGRESS
Customers      ⚪ PENDING
Reservations   🔒 CLOSED

Phase 5        ⚪ PENDING
Final RC       ⏸️ NOT SEALED
```

---

## Execution Decision Matrix

| Condition | Evidence Strategy | Action |
|-----------|------------------|--------|
| Playwright B1-B4 valid + no code changes | Combined | Manual B5-B10 only |
| Code changed after Playwright | Single | Full manual B1-B10 |
| Uncertain about Playwright evidence | Single | Full manual B1-B10 |
| Prefer single evidence chain | Single | Full manual B1-B10 |

---

## Next Session Checklist

**Before starting:**
- [ ] Check code changes since Playwright
- [ ] Choose evidence strategy (Combined vs Single)
- [ ] Prepare test data
- [ ] Open manual test guide

**During test:**
- [ ] Document timestamps
- [ ] Capture screenshots
- [ ] Save console logs
- [ ] Note any anomalies

**After test:**
- [ ] Document verdict
- [ ] Create P2_3_BROWSER_RUNTIME_VERIFIED.md
- [ ] Cleanup test artifacts
- [ ] Update status
- [ ] Proceed to P2.4

---

**Status:** 📋 **STRATEGY DOCUMENTED**  
**Ready:** Combined or single evidence path  
**Next:** Execute manual test → Document → Seal P2.3

