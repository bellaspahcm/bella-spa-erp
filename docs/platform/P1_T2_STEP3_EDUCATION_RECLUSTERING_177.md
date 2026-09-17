# Education OS Re-Clustering — 177 Canonical Baseline

**Date:** 2026-09-16  
**Checkpoint:** `fb77de9d` — After Cluster E Healthcare scope leak fix  
**Previous baseline:** 231 (included 54 Healthcare pollution)  
**Canonical baseline:** 177 (Education scope only, verified)

---

## Baseline Change Summary

**Before Cluster E fix:** 231 diagnostics  
**Healthcare scope leak removed:** -54 diagnostics  
**Canonical Education baseline:** 177 diagnostics ✅

**Verification:**
- Healthcare event bus files (medication-to-timeline, vitals-to-ai-alerts, bed-to-billing): REMOVED ✅
- Locked scopes (Core, Beauty, Real Estate): All remain 0 ✅

---

## Error Code Distribution (177 baseline)

| Code | Count | % of 177 | Change from 231 | Description |
|------|-------|----------|-----------------|-------------|
| **TS2339** | **58** | **32.8%** | -11 (was 69) | Property does not exist |
| **TS2322** | **32** | **18.1%** | -34 (was 66) | Type not assignable |
| **TS2345** | **24** | **13.6%** | 0 (was 24) | Argument not assignable |
| TS18047 | 14 | 7.9% | 0 | Possibly null/undefined |
| TS2363 | 10 | 5.6% | 0 | Left side not assignable |
| TS2367 | 9 | 5.1% | 0 | Comparison always false |
| TS2365 | 8 | 4.5% | 0 | Operator cannot be applied |
| TS18046 | 6 | 3.4% | 0 | Possibly undefined |
| TS2488 | 4 | 2.3% | 0 | Iterator method missing |
| TS2352 | 3 | 1.7% | NEW | Conversion may be mistake |
| TS2304 | 2 | 1.1% | NEW | Cannot find name |
| TS2551 | 2 | 1.1% | -3 (was 5) | Property typo |
| Other | 5 | 2.8% | — | Various |

**Top 3 codes: 114/177 (64.4%)** — Strong clustering (down from 69% at 231)

**Changes analysis:**
- TS2339 reduced by 11: Healthcare types no longer pulled in
- TS2322 reduced by 34: Large reduction from Healthcare wiring type mismatches
- TS2345 unchanged: Education-specific argument issues
- New TS2352, TS2304: Now visible after Healthcare noise removed

---

## File Distribution (Top 15)

| File | Count | % of 177 | Change | Ownership |
|------|-------|----------|--------|-----------|
| **lib/decision-engine/providers/payroll/payroll-provider.ts** | **49** | **27.7%** | 0 | Decision Engine (Legacy) |
| **platform/education/repositories/supabase-education.repository.ts** | **48** | **27.1%** | 0 | Education Repository |
| platform/education/education-engine.service.ts | 16 | 9.0% | 0 | Education Engine |
| platform/education/course/course.repository.ts | 7 | 4.0% | 0 | Education Course |
| platform/host/rule-engine/rule-engine.service.ts | 7 | 4.0% | 0 | Platform Host |
| platform/education/contracts/teacher-assignment.contract.impl.ts | 6 | 3.4% | 0 | Education Contract |
| platform/host/person/person.repository.ts | 5 | 2.8% | 0 | Platform Host |
| platform/education/contracts/enrollment.contract.impl.ts | 5 | 2.8% | 0 | Education Contract |
| app/dashboard/education/finance/page.tsx | 4 | 2.3% | 0 | Education UI |
| platform/education/contracts/assessment.contract.impl.ts | 3 | 1.7% | 0 | Education Contract |
| platform/education/contracts/course.contract.impl.ts | 3 | 1.7% | 0 | Education Contract |
| platform/education/attendance/attendance.repository.ts | 2 | 1.1% | 0 | Education Repository |
| app/api/education/courses/route.ts | 2 | 1.1% | 0 | Education API |
| platform/education/enrollment/enrollment.repository.ts | 2 | 1.1% | 0 | Education Repository |
| products/bella-education/facilities/facilities.service.ts | 2 | 1.1% | 0 | Education Product |

**Top 2 files: 97/177 (54.8%)** — EXTREME concentration (was 42% of 231)

**Analysis:** Healthcare removal revealed that top 2 files dominate even MORE in Education-scoped baseline.

---

## Ownership Classification

### Decision Engine (Legacy) — 49 diagnostics (27.7%)

**File:** `lib/decision-engine/providers/payroll/payroll-provider.ts`

**Ownership:** Shared Legacy (pre-OS architecture)  
**Used by:** Multiple domains (Education, Healthcare, HR)  
**Scope:** Should this be in Education tsconfig?

**Error pattern:** Type `{}` inference failures (TS2488, TS2365, TS2322)

---

### Education Repository Layer — 48 diagnostics (27.1%)

**File:** `platform/education/repositories/supabase-education.repository.ts`

**Ownership:** Education Platform  
**Used by:** Education contracts and services  
**Scope:** ✅ Correctly in Education

**Error pattern:** Repository contract mismatches

---

### Education Platform — 44 diagnostics (24.9%)

**Files:**
- education-engine.service.ts (16)
- course.repository.ts (7)
- teacher-assignment.contract.impl.ts (6)
- enrollment.contract.impl.ts (5)
- assessment.contract.impl.ts (3)
- course.contract.impl.ts (3)
- attendance.repository.ts (2)
- enrollment.repository.ts (2)

**Ownership:** Education Platform Core  
**Scope:** ✅ Correctly in Education

---

### Platform Host — 12 diagnostics (6.8%)

**Files:**
- rule-engine.service.ts (7)
- person.repository.ts (5)

**Ownership:** Platform-of-Platforms (Host)  
**Used by:** Multiple OSs  
**Scope:** ⚠️ Pulled in by Education dependencies

**Analysis:** Similar to Healthcare event bus - transitive dependency issue?

---

### Education UI/API — 8 diagnostics (4.5%)

**Files:**
- dashboard/education/finance/page.tsx (4)
- api/education/courses/route.ts (2)
- products/bella-education/facilities/facilities.service.ts (2)

**Ownership:** Education Product/Application  
**Scope:** ✅ Correctly in Education

---

### Remaining — 16 diagnostics (9.0%)

Distributed across various Education files

---

## Re-Evaluated Cluster Candidates

### Cluster A: payroll-provider.ts — Type Inference Failure

**Concentration:** 49/177 (27.7%)  
**Owner:** Decision Engine (Legacy)  
**Pattern:** Type `{}` iterator/operator issues

**Status:** UNCHANGED from 231 analysis

**Question:** Should Decision Engine payroll provider be in Education scope?
- If YES → Fix type inference
- If NO → Similar to Healthcare leak, remove from scope

**Recommendation:** Investigate dependency chain before fixing

---

### Cluster B: supabase-education.repository.ts — Repository Contracts

**Concentration:** 48/177 (27.1%)  
**Owner:** Education Repository Layer  
**Pattern:** Mixed TS2339, TS2322

**Status:** UNCHANGED from 231 analysis, NOW HIGHEST Education-owned concentration

**Recommendation:** HIGH PRIORITY - Repository layer affects all Education contracts

---

### Cluster C: Education Platform Contracts — Distributed

**Concentration:** 44/177 (24.9%) across 8 files  
**Owner:** Education Platform  
**Pattern:** Contract implementation issues

**Status:** Likely CASCADE from Cluster B (repository)

**Recommendation:** Fix Cluster B first, may resolve many of these

---

### Cluster D: Platform Host Dependencies

**Concentration:** 12/177 (6.8%)  
**Owner:** Platform Host (rule-engine, person)  
**Pattern:** Transitive dependency

**Status:** NEW VISIBILITY after Healthcare removal

**Recommendation:** Investigate if legitimate or scope leak (like Cluster E was)

---

## Root Cause Hypothesis (Updated)

### High-Leverage Candidates

**1. supabase-education.repository.ts contract mismatch → 48 diagnostics + cascade?**
- Direct: 48 diagnostics
- Cascade: Possibly 20-30 more in contracts using repository
- **Total potential: 60-80 diagnostics (34-45%)**

**2. payroll-provider.ts type inference → 49 diagnostics**
- But: May not be Education's responsibility
- Need: Dependency chain investigation first

**3. Platform Host transitive dependencies → 12 diagnostics**
- Similar pattern to Cluster E
- May be removable without fixing

---

## Cleanup Strategy (Revised)

### Phase 0: Dependency Investigation (NEW)

**Target A:** Decision Engine payroll-provider  
**Question:** Why is this in Education scope?  
**Action:** Trace import chain, classify as legitimate or leak

**Target B:** Platform Host (rule-engine, person)  
**Question:** Pulled in like Healthcare was?  
**Action:** Check if Education directly uses or transitive dependency

**Impact:** Could reduce baseline further before any source fixes

---

### Phase 1: Repository Layer (Highest Education-Owned Leverage)

**Target:** `supabase-education.repository.ts` (48 diagnostics)  
**Impact:** 48 direct + potential cascade in contracts  
**Risk:** MEDIUM (repository layer)

---

### Phase 2: Education Platform Contracts

**Target:** Files using repository (44 diagnostics)  
**Impact:** May auto-resolve after Phase 1  
**Risk:** LOW (if Phase 1 fixes root contract)

---

### Phase 3: Decision Engine (If Legitimate Dependency)

**Target:** payroll-provider.ts (49 diagnostics)  
**Impact:** 49 diagnostics  
**Risk:** MEDIUM-HIGH (shared component)

---

## Key Insights

**1. Healthcare removal revealed HIGHER concentration**
- Top 2 files went from 42% → 55% of baseline
- Repository layer now clearly dominant issue

**2. Additional scope leak candidates identified**
- Platform Host files (rule-engine, person)
- Decision Engine (payroll-provider)
- Pattern: Shared/legacy components in domain-specific scope

**3. Repository contract is likely cascade root**
- 48 diagnostics in repository
- 44 diagnostics in contracts using repository
- Pattern suggests repository fix may resolve ~90 total

**4. Cluster E methodology should repeat**
- Don't assume all 177 are Education-owned
- Investigate dependency chains
- Classify: Owned vs Legitimate Dependency vs Scope Leak

---

## Next Steps

1. ✅ Re-clustering complete (177 baseline)
2. ⏳ Investigate payroll-provider dependency chain
3. ⏳ Investigate Platform Host dependency chain
4. ⏳ Classify: Owned / Legitimate / Leak
5. ⏳ Fix repository layer (Cluster B) if no more scope leaks found
6. ⏳ Verify cascade resolution in contracts

---

**Status:** Re-clustering complete, dependency investigation next

**Evidence quality:** HIGH
- 177 baseline verified
- Error/file distribution analyzed
- Ownership classified
- New scope leak candidates identified
- Cascade patterns mapped

**DO NOT fix source code until dependency chains investigated.**
