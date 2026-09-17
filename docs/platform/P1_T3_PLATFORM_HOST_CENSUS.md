# P1-T3: Platform Host TypeScript Hardening — Census

**Status:** Census Complete  
**Checkpoint:** `8740d94c`  
**Date:** 2026-09-16  
**Branch:** `hardening/platform-stability-20260916`

---

## Scope Definition

**Platform Host** comprises shared infrastructure services used across all product verticals:
- **Person Repository**: Party/Person identity management
- **Rule Engine Service**: Cross-domain business rules evaluation

These are **Platform Core dependencies** referenced by Education, Healthcare, Real Estate, and other domains.

---

## Current State @ 8740d94c

```
Platform Host TypeScript Diagnostics: 12

person.repository.ts         5
rule-engine.service.ts       7
```

**Locked Scopes (Unchanged):**
```
Platform Core                0 🔒
Beauty OS                    0 🔒
Real Estate                  0 🔒
Education-owned              0 🔒
```

---

## Diagnostic Classification

### Pattern A: `Record<string, unknown>` → `Json | undefined` (7 diagnostics)

**Files:**
- `person.repository.ts`: lines 44, 81 (2)
- `rule-engine.service.ts`: lines 194, 198, 287, 450, 454 (5)

**Root Cause:**  
TypeScript `Record<string, unknown>` is not structurally compatible with Supabase `Json` type definition.

**Probable Fix:**  
Type assertion at DB boundary: `as Json` after validating structure.

**Risk:** LOW — DB boundary type mismatch, no runtime impact if structure matches.

---

### Pattern B: `Json` → Typed Arrays (3 diagnostics)

**File:** `person.repository.ts`, lines 262-264

**Specific Errors:**
```typescript
Line 262: Json → PersonIdentifier[]
Line 263: Json → PersonContact[]
Line 264: Json → PersonAddress[]
```

**Root Cause:**  
JSONB fields from database queried as `Json`, cast directly to domain types without intermediate validation.

**Probable Fix:**  
1. Define interface for JSONB structure
2. Add null check
3. Type assertion via `unknown` intermediate

**Risk:** LOW — Similar to Education course metadata pattern (already solved in P1-T2).

---

### Pattern C: `string | number` → `never` (2 diagnostics)

**File:** `rule-engine.service.ts`, lines 161-162

**Root Cause:**  
Function parameter typed too narrowly (`never`), rejecting valid union types.

**Probable Fix:**  
Widen parameter type to accept `string | number` or provide proper type guard.

**Risk:** LOW — Likely over-constrained signature, needs inspection.

---

## Pattern Summary

```
Total: 12 diagnostics

By Pattern:
├─ Pattern A (Record → Json)          7  (58%)
├─ Pattern B (Json → typed arrays)    3  (25%)
└─ Pattern C (union → never)          2  (17%)

By File:
├─ person.repository.ts               5  (42%)
└─ rule-engine.service.ts             7  (58%)
```

**Observation:** All 12 diagnostics are **type boundary mismatches** at DB/domain boundaries. No complex logic errors.

---

## Recommended Batch Approach

### Batch 1: person.repository.ts (5 diagnostics)
```
Lines 44, 81: Record → Json (Pattern A)          2
Lines 262-264: Json → typed arrays (Pattern B)   3
```
**Strategy:** Handle both patterns in single file sweep.

### Batch 2: rule-engine.service.ts (7 diagnostics)
```
Lines 161-162: string | number → never (Pattern C)  2
Lines 194, 198, 287, 450, 454: Record → Json (A)    5
```
**Strategy:** Fix parameter typing first (Pattern C), then apply Pattern A fix consistently.

**Total batches: 2**  
Expected commits: 2 (one per file)

---

## Risk Assessment

**Overall Risk: LOW**

1. **No schema changes required** — all fixes at type level
2. **No business logic changes** — boundary assertions only
3. **Patterns already validated** — similar fixes proven in Education hardening
4. **Isolated scope** — Platform Host changes don't affect locked scopes
5. **Comprehensive verification** — can verify all 4 locked scopes + Platform Host

**Dependencies:**
- Platform Host is **used by** Education, Healthcare, Real Estate
- Changes here require regression verification across consumers

---

## Verification Strategy

After each batch:
```bash
# 1. Platform Host progress
npx tsc --project tsconfig.education.json --noEmit
# Count person.repository + rule-engine diagnostics

# 2. Locked scopes invariance
npx tsc --project tsconfig.platform-core.json --noEmit  # Must = 0
npx tsc --project tsconfig.beauty.json --noEmit         # Must = 0
npx tsc --project tsconfig.real-estate.json --noEmit    # Must = 0

# 3. Education gate
npm run gate:education-no-new-debt                       # Must PASS

# 4. Payroll baseline
# Verify payroll-provider.ts still = 49 (no increase)
```

**Success Criteria:**
- person.repository.ts: 5 → 0
- rule-engine.service.ts: 7 → 0
- Platform Host total: 12 → 0
- All locked scopes remain 0
- Payroll/Legacy remains 49 (baseline)

---

## Expected Outcome

```
Platform Host: 12 → 0 🔒

Education compiler: 61 → 49
├─ Payroll/Legacy: 49 (unchanged)
├─ Platform Host: 0 ✅
└─ Education-owned: 0 ✅

Locked Scopes @ 0:
├─ Platform Core 🔒
├─ Beauty OS 🔒
├─ Real Estate 🔒
├─ Education-owned 🔒
└─ Platform Host 🔒 (NEW)
```

---

## Next Steps

1. **Batch 1:** Fix person.repository.ts (5 → 0)
   - Verify locked scopes unchanged
   - Commit with evidence

2. **Batch 2:** Fix rule-engine.service.ts (7 → 0)
   - Verify locked scopes unchanged
   - Commit with evidence

3. **Platform Host Gate:** Create No-New-Debt gate for Platform Host
   - Similar to Education gate
   - Ownership-based enforcement

4. **Transfer to Platform Core:** Once Platform Host clean, consider moving to Platform Core tsconfig for stricter governance

---

## Lessons from Education Hardening (Applied Here)

1. ✅ **Census first** — classify before fixing
2. ✅ **Batch by pattern** — efficient, clear audit trail
3. ✅ **Evidence-based fixes** — no blind assertions
4. ✅ **Locked scope verification** — every commit
5. ✅ **Ownership clarity** — Platform Host = shared infrastructure

---

**Signed-off:** Platform Stability Workstream  
**Date:** 2026-09-16  
**Checkpoint:** 8740d94c  
**Status:** Census complete, ready for cleanup
