# P1-T2 Step 3: Education OS TypeScript Cluster Analysis

**Date:** 2026-09-16  
**Checkpoint:** `45b397b5` — 3 scopes locked  
**Status:** ANALYSIS ONLY (no code modifications)

---

## Baseline Verification

**Config:** `tsconfig.education.json`  
**Compiler:** `npx tsc --noEmit`  
**Result:** 231 diagnostics (matches P1-T1 census)

✅ Baseline confirmed stable

---

## Error Code Distribution

| Code | Count | % | Description |
|------|-------|---|-------------|
| **TS2339** | **69** | **30%** | Property does not exist on type |
| **TS2322** | **66** | **29%** | Type not assignable |
| **TS2345** | **24** | **10%** | Argument type not assignable |
| TS18047 | 14 | 6% | Possibly null/undefined |
| TS2363 | 10 | 4% | Left side not assignable |
| TS2367 | 9 | 4% | Comparison always false |
| TS2365 | 8 | 3% | Operator cannot be applied |
| TS18046 | 6 | 3% | Possibly undefined |
| TS2551 | 5 | 2% | Property typo suggestion |
| TS2488 | 4 | 2% | Iterator method missing |
| **Other** | 16 | 7% | Various |

**Top 3 errors: 159/231 (69%)** — Strong clustering signal

---

## File Distribution (Top 15)

| File | Errors | % of Total |
|------|--------|------------|
| **lib/decision-engine/providers/payroll/payroll-provider.ts** | **49** | **21%** |
| **platform/education/repositories/supabase-education.repository.ts** | **48** | **21%** |
| platform/host/event-bus/wiring/medication-to-timeline.wiring.ts | 23 | 10% |
| platform/host/event-bus/wiring/vitals-to-ai-alerts.wiring.ts | 16 | 7% |
| platform/education/education-engine.service.ts | 16 | 7% |
| platform/host/event-bus/wiring/bed-to-billing.wiring.ts | 15 | 6% |
| platform/host/rule-engine/rule-engine.service.ts | 7 | 3% |
| platform/education/course/course.repository.ts | 7 | 3% |
| platform/education/contracts/teacher-assignment.contract.impl.ts | 6 | 3% |
| platform/host/person/person.repository.ts | 5 | 2% |
| platform/education/contracts/enrollment.contract.impl.ts | 5 | 2% |
| app/dashboard/education/finance/page.tsx | 4 | 2% |
| platform/education/contracts/assessment.contract.impl.ts | 3 | 1% |
| platform/education/contracts/course.contract.impl.ts | 3 | 1% |
| platform/education/attendance/attendance.repository.ts | 2 | 1% |

**Top 2 files: 97/231 (42%)** — Extreme concentration

---

## Root Cause Clusters (Preliminary)

### Cluster A: SupabaseClient Type Contract Mismatch

**Pattern:** TS2345 - Argument type mismatch  
**Affected:** Multiple API routes in `app/api/education/**`

**Signature:**
```
Argument of type 'SupabaseClient<Database, "public", "public", {...}>'
is not assignable to parameter of type
'SupabaseClient<Record<string, unknown>, "public", "public", never, {...}>'
```

**Root cause hypothesis:**
- Education repositories expect generic `SupabaseClient<Record<string, unknown>>`
- Callers pass typed `SupabaseClient<Database>`
- Type contract mismatch at repository boundary

**Affected files:** ~15-20 API route files

**Impact:** ~24 diagnostics (10% of total)

**Fix strategy:** Align repository type signatures with typed Database client

---

### Cluster B: payroll-provider.ts — Type Inference Failure

**Pattern:** TS2488, TS2365, TS2322  
**Concentrated:** 49 diagnostics in ONE file (21% of total)

**Signatures:**
```
TS2488: Type '{}' must have a '[Symbol.iterator]()' method
TS2365: Operator '>' cannot be applied to types '{}' and 'number'
TS2322: Type '{}' is not assignable to type 'number'
```

**Root cause hypothesis:**
- Array/object destructuring with incorrect type annotation
- Type inference collapsed to `{}`
- Cascading operator/iterator errors

**Affected:** `lib/decision-engine/providers/payroll/payroll-provider.ts` only

**Impact:** 49 diagnostics (CASCADE from likely 1-2 root causes)

**Fix strategy:** Fix type annotation/inference → 49 errors likely resolve

---

### Cluster C: supabase-education.repository.ts — Repository Type Issues

**Pattern:** Mixed TS2339, TS2322  
**Concentrated:** 48 diagnostics in ONE file (21% of total)

**Root cause hypothesis:**
- Repository layer type mismatches
- Similar to Cluster A but internal to repository implementation
- Possible database type generation issue

**Affected:** `platform/education/repositories/supabase-education.repository.ts` only

**Impact:** 48 diagnostics (CASCADE from repository contract issues)

**Fix strategy:** Investigate repository type contracts and database types

---

### Cluster D: Property Naming Convention Mismatch

**Pattern:** TS2551, TS2339  
**Signature:** `Property 'snake_case' does not exist. Did you mean 'camelCase'?`

**Examples:**
- `payment_method` vs `paymentMethod`
- `created_at` vs `createdAt`
- `sha256Fingerprint` missing

**Root cause hypothesis:**
- Database returns snake_case
- TypeScript types expect camelCase
- Missing property mappings

**Affected:** Finance page, various contracts

**Impact:** ~10-15 diagnostics

**Fix strategy:** Add property mapping or update type definitions

---

### Cluster E: Healthcare Event Bus Leakage into Education Scope

**Pattern:** TS2339 on healthcare-specific properties  
**Concentrated:** 54 diagnostics in 3 `platform/host/event-bus/wiring/*` files

**Files:**
- `medication-to-timeline.wiring.ts` (23)
- `vitals-to-ai-alerts.wiring.ts` (16)
- `bed-to-billing.wiring.ts` (15)

**Root cause hypothesis:**
- Healthcare event bus files incorrectly included in Education tsconfig
- OR Education scope depends on healthcare types it shouldn't
- Cross-domain coupling issue

**Impact:** 54 diagnostics (23% of total!)

**CRITICAL:** This might be a **scope configuration issue**, not source code issue.

**Investigation needed:** Why are healthcare event bus files compiled in Education scope?

---

## Cascade Analysis

**High-leverage root causes (estimated):**

1. **payroll-provider.ts type inference** → 49 diagnostics (21%)
2. **supabase-education.repository.ts contract** → 48 diagnostics (21%)
3. **Healthcare event bus scope leak** → 54 diagnostics (23%)
4. **SupabaseClient contract mismatch** → 24 diagnostics (10%)
5. **Property naming conventions** → 15 diagnostics (6%)

**Subtotal: 5 root causes → 190/231 diagnostics (82%)**

**Remaining 41 diagnostics:** Distributed across various files, likely individual issues

---

## Preliminary Cleanup Strategy

### Phase 1: Scope Configuration (Highest Leverage)

**Target:** Healthcare event bus files in Education scope  
**Impact:** 54 diagnostics (23%)  
**Risk:** LOW (tsconfig change only)

**Action:** Verify `tsconfig.education.json` include/exclude patterns

---

### Phase 2: Single-File Cascades (High Leverage)

**Target A:** `payroll-provider.ts`  
**Impact:** 49 diagnostics (21%)  
**Risk:** MEDIUM (decision engine, not core Education)

**Target B:** `supabase-education.repository.ts`  
**Impact:** 48 diagnostics (21%)  
**Risk:** MEDIUM (repository layer)

**Combined:** 97 diagnostics from 2 files

---

### Phase 3: Contract Alignment (Medium Leverage)

**Target:** SupabaseClient type signatures  
**Impact:** 24 diagnostics (10%)  
**Risk:** LOW-MEDIUM (API routes)

---

### Phase 4: Property Mapping (Low Leverage)

**Target:** snake_case/camelCase mismatches  
**Impact:** 15 diagnostics (6%)  
**Risk:** LOW

---

### Phase 5: Individual Fixes (Remainder)

**Target:** Remaining 41 diagnostics  
**Impact:** 18%  
**Risk:** VARIABLE

---

## Risk Assessment

**Scope creep risks:**
1. Healthcare event bus files → might affect Healthcare scope
2. Decision engine payroll → shared with other domains
3. Repository contracts → might affect other products

**Mitigation:**
- Verify no impact on locked scopes (Core, Beauty, Real Estate)
- Run Healthcare/English Center regression after each phase
- Test Education-specific functionality only

---

## Next Steps (DO NOT EXECUTE YET)

1. ✅ Baseline verified (231 diagnostics)
2. ✅ Cluster analysis complete
3. ⏳ Investigate Cluster E (Healthcare event bus scope issue)
4. ⏳ Create bounded fix batches
5. ⏳ Execute Phase 1 (if scope config issue confirmed)
6. ⏳ Execute Phase 2 (single-file cascades)
7. ⏳ Verify: compiler 0 + regression + locked scopes still 0
8. ⏳ Lock Education at 0 diagnostics

---

**Status:** Analysis complete, awaiting approval to investigate Cluster E and proceed with fixes

**Evidence quality:** HIGH
- 231 baseline confirmed
- Error distribution analyzed
- File concentration identified
- Root causes hypothesized
- Cascade patterns mapped

**Key insight:** 231 diagnostics likely stem from ~5-10 root causes, not 231 independent issues.
