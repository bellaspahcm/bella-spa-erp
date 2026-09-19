# P1-T5 BATCH 2: HEALTHCARE RE-CENSUS (103 DIAGNOSTICS)

**Checkpoint:** `7764fe6a` (Post Batch 1)  
**Baseline:** 103 TypeScript diagnostics  
**Surgical Residual:** 4 (tracked separately, not included in new clusters)  
**Census Date:** 2026-09-16  
**Status:** 🔍 CENSUS COMPLETE — Batch 2 candidate selection in progress

---

## EXECUTIVE SUMMARY

After Batch 1 service boundary fix (132 → 103), Healthcare compiler stabilized at **103 diagnostics** across **15 engines + shared infrastructure**.

**Key Finding:**  
Unlike Batch 1 where 29/33 Surgical errors shared a single root cause (type boundary loss), the remaining 103 diagnostics are **more fragmented** across multiple patterns:

1. **Missing module imports** (TS2307): 18 errors — infrastructure gaps
2. **Property access errors** (TS2339): 31 errors — distributed across 5 engines
3. **Type assignment mismatches** (TS2345): 13 errors — domain object serialization

**Highest Concentration:**
- Order Engine: 22 diagnostics (21% of total)
- Service Locator + Contracts: 32 "other" (31% — shared infrastructure)
- Bed Engine: 9 diagnostics
- Laboratory Engine: 9 diagnostics

---

## DIAGNOSTIC BREAKDOWN BY ERROR CODE

| Error Code | Count | Description | Impact |
|------------|-------|-------------|--------|
| **TS2307** | 18 | Cannot find module | 🔴 HIGH (blocks compilation) |
| **TS2339** | 31 | Property does not exist | 🟡 MEDIUM (runtime safe but type incomplete) |
| **TS2345** | 13 | Type not assignable | 🟡 MEDIUM (serialization/boundary) |
| TS2322 | 7 | Type mismatch assignment | 🟡 MEDIUM |
| TS2459 | 6 | Module export ambiguity | 🟢 LOW (duplicate exports) |
| TS2308 | 5 | Re-export ambiguity | 🟢 LOW |
| TS2353 | 5 | Unknown property in object literal | 🟡 MEDIUM |
| TS2304 | 4 | Cannot find name | 🟡 MEDIUM |
| TS2420 | 3 | Class incorrectly implements interface | 🟡 MEDIUM |
| TS2561 | 3 | Object literal excess properties | 🟢 LOW |
| Others | 7 | Scattered | 🟢 LOW |

---

## DIAGNOSTIC BREAKDOWN BY ENGINE

| Engine | Count | % of Total | Top Error Codes |
|--------|-------|------------|-----------------|
| **Service Locator + Contracts** | 32 | 31.1% | TS2307 (8), TS2308 (5), TS2459 (6) |
| **Order Engine** | 22 | 21.4% | TS2345 (6), TS2307 (4), TS2339 (3) |
| **Bed Engine** | 9 | 8.7% | TS2339 (3), TS2345 (2), TS2304 (1) |
| **Laboratory Engine** | 9 | 8.7% | TS2345 (1), TS2339 (1), others |
| **CSSD Engine** | 8 | 7.8% | TS2339 (7), TS2322 (1) |
| **Surgical Engine** | 4 | 3.9% | TS2345 (2), TS2420 (1), TS2322 (1) |
| **Admission Engine** | 3 | 2.9% | TS2307 (2), others |
| **ICU Engine** | 3 | 2.9% | TS2307 (2), others |
| **Pharmacy Engine** | 3 | 2.9% | TS2307 (2), others |
| **Rule Engine** | 3 | 2.9% | Mixed |
| **Audit Compliance** | 2 | 1.9% | TS2353 (2) |
| **Nursing Engine** | 2 | 1.9% | TS2339 (2) |
| **Blood Bank** | 1 | 1.0% | TS2352 (1) |
| **CDS Engine** | 1 | 1.0% | TS2322 (1) |
| **Temporal Engine** | 1 | 1.0% | TS2322 (1) |

---

## CLUSTER ANALYSIS

### CLUSTER 1: Missing Module Imports (TS2307) — 18 errors

**Root Causes:**

**A. Non-existent `@/types/supabase` import (6 files)**
```
order-engine/order-engine.factory.ts
order-engine/repositories/supabase-encounter-reader.ts
order-engine/repositories/supabase-order-repository.ts
pharmacy-engine/repositories/supabase-clinical-order-reader.ts
pharmacy-engine/repositories/supabase-pharmacy.repository.ts
```
**Pattern:** Legacy import path expecting `@/types/supabase` but canonical is `@/types/database.types`  
**Fix Strategy:** Replace import path (same as Batch 1 Surgical fix)  
**Estimated Impact:** -6 diagnostics

**B. Missing contract files in service-locator (8 files)**
```
./contracts/admission-engine.contract
./contracts/clinical-engine.contract
./contracts/billing-engine.contract
./contracts/insurance-engine.contract
./contracts/scheduling-engine.contract
./contracts/queue-engine.contract
./contracts/imaging-engine.contract
./contracts/mpi-engine.contract
```
**Pattern:** Service locator references contracts that don't exist yet  
**Fix Strategy:** Requires contract extraction (H2-style) or stub creation  
**Risk:** HIGH — these are planned engines not yet implemented  
**Estimated Impact:** Cannot fix until contracts exist

**C. Missing `shared-kernel/types` (4 files)**
```
admission-engine/contracts/admission-engine.contract.ts
admission-engine/services/admission-engine.service.ts
icu-engine/contracts/icu-engine.contract.ts
icu-engine/icu-engine.service.ts
```
**Pattern:** Shared types module doesn't exist or wrong path  
**Fix Strategy:** Investigate if types should be in contracts or create shared-kernel  
**Estimated Impact:** -4 diagnostics if path corrected

**Cluster 1 Summary:**
- **Fixable immediately:** 6 (wrong import path)
- **Requires investigation:** 4 (shared-kernel path)
- **Requires architecture work:** 8 (missing contracts)
- **Leverage:** LOW-MEDIUM (scattered causes)

---

### CLUSTER 2: Property Access (TS2339) — 31 errors

**Distribution:**
- CSSD Engine: 7 errors (equipment property access from `{}` type)
- Order Engine: 3 errors (OrderEvent properties)
- Bed Engine: 3 errors (`userId` property missing from request types)
- Nursing Engine: 2 errors (`.split()` on blood pressure object)
- Laboratory Engine: 1 error (`.status` property)
- Others: 15 errors (distributed across contracts/index, etc.)

**Subclusters:**

**A. CSSD Traceability Report (7 errors in cssd-engine.service.ts:693-699)**
```typescript
// Lines 693-699: equipment properties accessed from `{}` type
equipment.name
equipment.serial_number
equipment.id
cycle.cycle_number
cycle.started_at
cycle.completed_at
cycle.indicator_result
```
**Pattern:** Database query result typed as `{}` instead of proper row type  
**Root Cause:** Missing `.from()` type inference or explicit typing  
**Fix Strategy:** Similar to Surgical repository fix — preserve Database typing  
**Estimated Impact:** -7 diagnostics (concentrated in 7 lines)

**B. Bed Engine `userId` properties (3 errors)**
```
BedAllocationRequest.userId
BedReleaseRequest.userId
BedTransferRequest.userId
```
**Pattern:** Contract interface missing `userId` field  
**Fix Strategy:** Add field to contract interfaces  
**Estimated Impact:** -3 diagnostics

**C. Nursing Engine blood pressure parsing (2 errors)**
```typescript
// Attempting .split() on { systolic: number; diastolic: number }
vitalSigns.bloodPressure.split('/')
```
**Pattern:** Type mismatch between stored structure and parsing logic  
**Fix Strategy:** Fix logic or type definition  
**Estimated Impact:** -2 diagnostics

**Cluster 2 Summary:**
- **High leverage subcluster:** CSSD (7 errors, 1 root cause)
- **Medium leverage:** Bed Engine (3 errors, 1 root cause)
- **Low leverage:** Nursing (2 errors, logic issue)
- **Scattered:** 19 others

---

### CLUSTER 3: Type Assignment Mismatch (TS2345) — 13 errors

**Distribution:**
- Order Engine: 6 errors
- Surgical Engine: 2 errors (residual — PostgrestError)
- Bed Engine: 2 errors
- Laboratory Engine: 1 error
- Bootstrap: 1 error
- Pharmacy: 1 error

**Subclusters:**

**A. Order Engine Domain Object Serialization (6 errors)**
```
order-engine.service.ts(190,58): CreateOrderResult → Record<string, unknown>
order-engine.service.ts(230,58): CreateOrderResult → Record<string, unknown>
order-engine.service.ts(314,54): CreateOrderResult → Record<string, unknown>
order-engine.service.ts(457,54): ClinicalOrder → Record<string, unknown>
order-engine.service.ts(555,54): ClinicalOrder → Record<string, unknown>
order-engine.service.ts(672,54): CdsOverrideRecord → Record<string, unknown>
```
**Pattern:** Domain objects being passed to functions expecting `Record<string, unknown>`  
**Root Cause:** Success/error result constructors typed too broadly  
**Fix Strategy:** Generic result types or explicit serialization  
**Estimated Impact:** -6 diagnostics (all same pattern)

**B. Surgical PostgrestError (2 errors — RESIDUAL)**
```
surgical-engine/repositories/supabase-surgery.repository.ts(81,26)
surgical-engine/repositories/supabase-surgery.repository.ts(99,26)
```
**Status:** Already classified in Batch 1 residual  
**Action:** Skip in Batch 2

**Cluster 3 Summary:**
- **High leverage:** Order Engine (6 errors, 1 pattern)
- **Surgical residual:** 2 (excluded)
- **Scattered:** 5 others

---

## TOP 5 CLUSTERS BY LEVERAGE

| Rank | Cluster | Errors | Root Causes | Fix Complexity | Leverage Score |
|------|---------|--------|-------------|----------------|----------------|
| **1** | CSSD Property Access (TS2339) | 7 | 1 | LOW | ⭐⭐⭐⭐⭐ |
| **2** | Order Engine Serialization (TS2345) | 6 | 1 | MEDIUM | ⭐⭐⭐⭐ |
| **3** | Order/Pharmacy Wrong Import Path (TS2307) | 6 | 1 | LOW | ⭐⭐⭐⭐ |
| **4** | Shared-Kernel Missing Module (TS2307) | 4 | 1 | MEDIUM | ⭐⭐⭐ |
| **5** | Bed Engine userId Missing (TS2339) | 3 | 1 | LOW | ⭐⭐⭐ |

**Leverage Score Calculation:**
- Number of errors fixed
- Root cause count (fewer = better)
- Fix complexity (lower = better)
- Risk of cascade (lower = better)

---

## BATCH 2 CANDIDATE RECOMMENDATION

### OPTION 1: CSSD Traceability Typing (RECOMMENDED)

**Target:** 7 diagnostics in `cssd-engine.service.ts`  
**Pattern:** Same as Batch 1 Surgical — Database type preservation  
**Scope:** Single file, concentrated lines 693-699  
**Risk:** LOW (isolated to traceability report query)  
**Expected Outcome:** 103 → 96 (-7, -6.8%)

**Rationale:**
- Highest single-file concentration
- Proven fix pattern from Batch 1
- Low risk of cascade
- Does not require contract changes

**Investigation needed:**
1. Trace `.from()` query that produces equipment/cycle objects
2. Verify Database type includes required tables
3. Apply same pattern as Surgical repository fix

---

### OPTION 2: Order/Pharmacy Import Path Fix

**Target:** 6 diagnostics in order-engine + pharmacy-engine  
**Pattern:** Replace `@/types/supabase` → `@/types/database.types`  
**Scope:** 5 files (factory + repositories)  
**Risk:** MEDIUM (Order Engine is large, 22 total diagnostics)  
**Expected Outcome:** 103 → 97 (-6, -5.8%)

**Rationale:**
- Mechanical find-replace
- Proven safe (same as Surgical v2)
- May reveal additional type issues in Order Engine

**Concern:**  
Order Engine has 22 total diagnostics. Fixing import might expose more issues before solving all 22. Better as **Batch 3** after CSSD.

---

### OPTION 3: Combined Quick Wins (CSSD + Bed userId)

**Target:** 10 diagnostics (7 CSSD + 3 Bed)  
**Pattern:** Type preservation + contract field addition  
**Scope:** 2 engines, 4 files  
**Risk:** LOW-MEDIUM  
**Expected Outcome:** 103 → 93 (-10, -9.7%)

**Rationale:**
- Two independent fixes
- Both proven patterns
- No interference between changes

**Concern:**  
Mixing two root causes in one batch. Prefer focused batch.

---

## BATCH 2 EXECUTION PLAN (RECOMMENDED)

**Selection:** OPTION 1 — CSSD Traceability Typing

**Justification:**
1. Highest single-root-cause concentration (7 errors, 1 cause)
2. Proven fix pattern from Batch 1 (Database type preservation)
3. Lowest risk profile (isolated to traceability report)
4. Does not block other batches

**Approach:**
1. Trace CSSD traceability query that produces equipment/cycle results
2. Verify tables exist in `database.types.ts`
3. Apply Database generic to repository/service boundary
4. Verify no cascade to other CSSD operations

**Exit Criteria:**
- Healthcare compiler: 103 → 96 (or better)
- CSSD diagnostics: 8 → 1 (or better)
- Gates: 52/52 pass maintained
- No new diagnostics introduced

**Deferral:**
- Order Engine (22 diagnostics): Batch 3 (larger cluster, requires deeper investigation)
- Service locator missing contracts (8 diagnostics): Architecture work (out of P1 scope)
- Scattered diagnostics: Batch 4+ (after major clusters resolved)

---

## BATCH SEQUENCING STRATEGY

**P1-T5 Batch Roadmap:**

```
Batch 1: ✅ CLOSED (Surgical type boundary)
         132 → 103 (-29)

Batch 2: 🎯 READY (CSSD traceability typing)
         Target: 103 → 96 (-7)
         
Batch 3: 📋 PLANNED (Order/Pharmacy import paths)
         Target: 96 → 90 (-6)
         
Batch 4: 📋 PLANNED (Order Engine serialization)
         Target: 90 → 84 (-6)
         
Batch 5: 📋 PLANNED (Bed Engine userId + scattered)
         Target: 84 → <80
```

**P1 Goal:** Reduce Healthcare from 132 to <80 (-40% minimum)  
**Current Progress:** 132 → 103 (-22%)  
**Remaining to Goal:** 23+ more diagnostics

---

## SURGICAL RESIDUAL TRACKING

**Status:** 4 diagnostics tracked separately, not included in Batch 2+ counts

```
surgical-engine/repositories/supabase-surgery.repository.ts:
  - Line 81: PostgrestError → Record<string, unknown>
  - Line 99: PostgrestError → Record<string, unknown>

surgical-engine/surgical-engine.service.ts:
  - Line 32: DefaultSterilizationContract implementation
  - Line 54: DefaultSterilizationContract type union
```

**Classification:** Different root causes from type boundary  
**Deferred to:** Error handling standardization pass (post-P1)

---

## CENSUS METADATA

**Compiler Command:**
```bash
npx tsc --project tsconfig.healthcare.json --noEmit
```

**Output File:** `healthcare-batch2-census.txt`  
**Total Diagnostics:** 103  
**Census Timestamp:** 2026-09-16T23:50:00+07:00  
**Checkpoint:** `7764fe6a`  
**Previous Baseline:** 132 (pre-Batch 1)  
**Change:** -29 (-22.0%)

---

## NEXT ACTION

**DECISION REQUIRED:**

Approve Batch 2 execution:
- [ ] **Option 1:** CSSD Traceability (7 errors, LOW risk) ← RECOMMENDED
- [ ] **Option 2:** Order/Pharmacy imports (6 errors, MEDIUM risk)
- [ ] **Option 3:** Combined (10 errors, MEDIUM risk)
- [ ] **Defer:** Re-investigate Order Engine first

**If Option 1 approved, proceed to:**
`P1_T5_BATCH2_CSSD_INVESTIGATION.md`
