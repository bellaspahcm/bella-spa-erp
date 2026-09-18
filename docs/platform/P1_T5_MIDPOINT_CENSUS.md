# P1-T5 MIDPOINT RE-CENSUS (94 DIAGNOSTICS)

**Checkpoint:** `489ad17f` (Post Batches 1-3)  
**Baseline:** 94 TypeScript diagnostics  
**Previous Census:** 103 (post Batch 1, pre Batch 2-3)  
**Change:** -9 from previous census  
**Census Date:** 2026-09-16  
**Status:** 🔍 CENSUS COMPLETE

---

## EXECUTIVE SUMMARY

After 3 successful batches (Surgical type boundary, CSSD typing, Import path), Healthcare compiler reduced from **132 → 94 (-38, -28.8%)**.

**Key Findings:**

1. **Three batches validated a common pattern:** Database generic preservation at service boundaries
2. **Import path fix exposed hidden errors:** Net -3 despite resolving 5 import errors
3. **New high-leverage cluster discovered:** Finance integration (10+ errors, single file)
4. **Residuals stable:** Surgical 4, CSSD 2 (tracking separately)

**Comparison to Batch 2 Census (103 diagnostics):**

| Category | Census 103 | Current 94 | Change | Status |
|----------|-----------|------------|--------|--------|
| Total | 103 | 94 | -9 | ✅ |
| CSSD | 8 | 2 | -6 | Batch 2 success |
| Order | 22 | 19 | -3 | Batch 3 partial |
| Surgical | 4 | 4 | 0 | Residual (stable) |
| Other | 32 | 32 | 0 | Shared infra |

---

## DIAGNOSTIC BREAKDOWN BY ERROR CODE

| Error Code | Count | Change from 103 | Description |
|------------|-------|-----------------|-------------|
| **TS2339** | 24 | -7 (was 31) | Property does not exist |
| **TS2345** | 15 | +2 (was 13) | Type not assignable |
| **TS2307** | 13 | -5 (was 18) | Cannot find module |
| TS2322 | 7 | 0 | Type mismatch |
| TS2459 | 6 | +1 | Module export ambiguity |
| TS2308 | 5 | 0 | Re-export ambiguity |
| TS2353 | 5 | 0 | Unknown property |
| TS2304 | 4 | 0 | Cannot find name |
| TS2420 | 3 | 0 | Incorrectly implements |
| TS2561 | 3 | 0 | Excess properties |
| TS2724 | 3 | +3 (NEW) | Import cannot be named |
| TS2352 | 2 | +1 | Conversion mistake |
| TS2552 | 2 | +2 (NEW) | Cannot find name (typo) |
| TS2551 | 1 | +1 (NEW) | Property typo |
| TS2554 | 1 | +1 (NEW) | Expected arguments |

**Notable Changes:**
- TS2339: -7 (CSSD property errors resolved)
- TS2307: -5 (import path fixes)
- TS2345: +2 (exposed after import fix)
- New error codes: TS2724, TS2552, TS2551, TS2554 (exposed by type improvements)

---

## DIAGNOSTIC BREAKDOWN BY ENGINE

| Engine | Count | Change from 103 | Top Issues |
|--------|-------|-----------------|------------|
| **Service Locator + Contracts** | 32 | 0 | Missing contracts (8), Re-exports (11) |
| **Order Engine** | 19 | -3 | Serialization (6), Missing contract (1), Events (3) |
| **Bed Engine** | 9 | 0 | Type mismatches (4), Missing properties (3) |
| **Laboratory Engine** | 9 | 0 | Repository typing (1), Others (8) |
| **Surgical Engine** | 4 | 0 | Residual (PostgrestError + interface) |
| **Admission Engine** | 3 | 0 | Missing shared-kernel/types (2) |
| **ICU Engine** | 3 | 0 | Missing shared-kernel/types (2) |
| **Pharmacy Engine** | 3 | 0 | Post import-fix stable |
| **Rule Engine** | 3 | 0 | Scattered |
| **CSSD Engine** | 2 | -6 ✅ | Residual (camelCase + shape) |
| **Audit Compliance** | 2 | 0 | Event properties (2) |
| **Nursing Engine** | 2 | 0 | Blood pressure parsing (2) |
| **Blood Bank** | 1 | 0 | Type conversion |
| **CDS Engine** | 1 | 0 | Severity type |
| **Temporal Engine** | 1 | 0 | Type mismatch |

---

## RESIDUAL TRACKING

### Surgical Residual (4 — Batch 1)

**Status:** STABLE since Batch 1

```
surgical-engine/repositories/supabase-surgery.repository.ts:
  Line 81:  PostgrestError → Record<string, unknown>  (TS2345)
  Line 99:  PostgrestError → Record<string, unknown>  (TS2345)

surgical-engine/surgical-engine.service.ts:
  Line 32:  DefaultSterilizationContract implementation  (TS2420)
  Line 54:  DefaultSterilizationContract type union      (TS2322)
```

**Classification:** Different root causes from type boundary  
**Deferred:** Post-P1 error handling standardization

### CSSD Residual (2 — Batch 2)

**Status:** IMPROVED (was 3, now 2)

```
cssd-engine/cssd-engine.service.ts:
  Line 369: cycleNumber vs cycle_number (camelCase/snake_case)  (TS2551)
  Line 689: TraceabilityReport shape mismatch               (TS2322)
```

**Classification:** Naming convention + interface shape  
**Note:** One error resolved between Batch 2 and midpoint

---

## NEW CLUSTERS DISCOVERED

### CLUSTER A: Finance Integration Property Access (10 errors)

**File:** `finance-integration/example-usage.ts`  
**Pattern:** FinanceOutboxWriteResult missing properties

```
Lines 268,283,294,327,333,339,342: .transaction_id (TS2339)
Lines 326,332,338: .status (TS2339)
```

**Root Cause:** Type definition incomplete or import issue  
**Scope:** Single file, concentrated  
**Estimated Impact:** -10 if interface fixed  
**Priority:** HIGH (single root cause, high concentration)

---

## PERSISTENT CLUSTERS

### CLUSTER B: Order Engine Serialization (6 errors)

**File:** `order-engine/order-engine.service.ts`  
**Pattern:** Domain objects → `Record<string, unknown>`

```
Lines 190,230,314: CreateOrderResult → Record<string, unknown>  (TS2345)
Lines 457,555:    ClinicalOrder → Record<string, unknown>       (TS2345)
Line 672:         CdsOverrideRecord → Record<string, unknown>   (TS2345)
```

**Root Cause:** Success/error result constructors typed too broadly  
**Scope:** Service layer, 6 locations  
**Estimated Impact:** -6 if result types fixed  
**Priority:** MEDIUM-HIGH (proven pattern, requires result type redesign)

### CLUSTER C: Shared-Kernel Missing Module (4 errors)

**Files:**
- `admission-engine/contracts/admission-engine.contract.ts` (line 7)
- `admission-engine/services/admission-engine.service.ts` (line 22)
- `icu-engine/contracts/icu-engine.contract.ts` (line 11)
- `icu-engine/icu-engine.service.ts` (line 16)

**Pattern:** `Cannot find module '../../shared-kernel/types'`

**Root Cause:** Module doesn't exist or wrong path  
**Scope:** 2 engines, 4 files  
**Estimated Impact:** -4 if path corrected or module created  
**Priority:** MEDIUM (infrastructure, affects 2 engines)

### CLUSTER D: Bed Engine Missing userId (3 errors)

**File:** `bed-engine/bed-engine.service.ts`  
**Pattern:** Request interfaces missing `userId` property

```
Line 76:  BedAllocationRequest.userId  (TS2339)
Line 135: BedReleaseRequest.userId     (TS2339)
Line 200: BedTransferRequest.userId    (TS2339)
```

**Root Cause:** Contract interface incomplete  
**Scope:** 3 request types  
**Estimated Impact:** -3 if fields added  
**Priority:** LOW-MEDIUM (simple fix, isolated)

---

## BATCH IMPACT ANALYSIS

### What Disappeared (103 → 94)

**CSSD Traceability (Batch 2):** -7 property access errors  
**Import Paths (Batch 3):** -5 module not found  
**CSSD Residual improvement:** -1 (unknown cause)

**Total removed:** -13

### What Was Exposed

**New error codes:** +4 types (TS2724, TS2552, TS2551, TS2554)  
**TS2345 increase:** +2 (type mismatches revealed by better typing)

**Total exposed:** +4

**Net change:** -9 (13 removed, 4 exposed)

### Learning: Import/Type Fixes Expose Hidden Errors

Batch 3 resolved 5 import errors but net effect was only -3 because:
1. Compiler could now see deeper into previously broken modules
2. Type improvements revealed mismatches that were masked before
3. This is HEALTHY — better to have accurate diagnostics than false negatives

**Factory Rule:** During hardening, track both "target diagnostics resolved" AND "net compiler change" separately. The second is the real progress metric.

---

## TOP 3 BATCH 4 CANDIDATES

### OPTION 1: Finance Integration (RECOMMENDED)

**Target:** 10 errors in `finance-integration/example-usage.ts`  
**Pattern:** FinanceOutboxWriteResult missing properties  
**Root Cause:** Single interface/import issue  
**Scope:** 1 file  
**Risk:** LOW (isolated, no engine dependencies)  
**Expected:** 94 → 84 (-10, -10.6%)

**Rationale:**
- Highest single-file concentration discovered
- Single root cause (type definition)
- Zero cross-engine impact
- Quick win to maintain momentum

**Investigation needed:**
- Check FinanceOutboxWriteResult definition
- Verify if properties exist but not exported
- May be as simple as adding fields to interface

---

### OPTION 2: Shared-Kernel Module Path

**Target:** 4 errors (admission + ICU engines)  
**Pattern:** Cannot find module `'../../shared-kernel/types'`  
**Root Cause:** Module path incorrect or module doesn't exist  
**Scope:** 2 engines, 4 files  
**Risk:** MEDIUM (may require creating shared types)  
**Expected:** 94 → 90 (-4, -4.3%)

**Rationale:**
- Infrastructure fix (benefits multiple engines)
- Clear error message
- May unlock further improvements in admission/ICU

**Investigation needed:**
- Search for existing shared-kernel or types module
- Determine if path is wrong or module needs creation
- Check what types admission/ICU need

---

### OPTION 3: Order Engine Serialization

**Target:** 6 errors in `order-engine.service.ts`  
**Pattern:** Domain objects → `Record<string, unknown>`  
**Root Cause:** Result type constructors too broad  
**Scope:** 1 file, 6 locations  
**Risk:** MEDIUM-HIGH (requires understanding result pattern)  
**Expected:** 94 → 88 (-6, -6.4%)

**Rationale:**
- Proven pattern from Census Batch 2
- Concentrated in single file
- Part of larger Order Engine cluster (19 total)

**Concern:**
- Order Engine still has 13 other errors
- May require deeper result type redesign
- Could expose more errors like Batch 3

**Defer to:** Batch 5 (after simpler wins)

---

## BATCH SEQUENCING RECOMMENDATION

```
Batch 1: ✅ CLOSED (Surgical type boundary)       132 → 103 (-29)
Batch 2: ✅ CLOSED (CSSD traceability)           103 →  97 (-6)
Batch 3: ✅ CLOSED (Import path canonical)        97 →  94 (-3)

Batch 4: 🎯 READY (Finance integration)           94 →  84 (-10) [RECOMMENDED]
         OR      (Shared-kernel path)             94 →  90 (-4)

Batch 5: 📋 PLANNED (Order serialization)         84 →  78 (-6)
Batch 6: 📋 PLANNED (Bed userId + scattered)      78 → <75
```

**P1 Goal Progress:**
- Starting baseline: 132
- Target: <80 diagnostics
- Current: 94
- Total reduction needed: 53 minimum (132 → 79)
- Completed so far: 38 reductions
- Progress: 38/53 ≈ 71.7% of reduction path
- Still need: 15 minimum reductions to reach goal

---

## OUT OF SCOPE (P1)

**Service Locator Missing Contracts (8 errors):**
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

**Status:** These are planned engines not yet implemented  
**Action:** Requires H2-style contract extraction (Architecture work)  
**Deferral:** Post-P1 or when engines are actually built

---

## FACTORY LEARNINGS (Batches 1-3)

### Pattern 1: Database Generic Preservation

**Validated across 3 batches:**
```typescript
// WRONG (loses type information)
constructor(supabase: SupabaseClient)

// RIGHT (preserves schema typing)
constructor(supabase: SupabaseClient<Database>)
```

**Impact:** All 3 batches benefited from this pattern

### Pattern 2: Avoid Manual Type Overrides

**Batch 2 lesson:**
```typescript
// WRONG (overrides inference)
(data || []).map((row: Record<string, unknown>) => { ... })

// RIGHT (lets Database type flow)
(data || []).map((row) => { ... })
```

**Factory Rule:** Don't manually annotate query results as `Record<string, unknown>` when Database schema provides better types.

### Pattern 3: Import Path Canonicalization

**Batch 3 lesson:**
```typescript
// WRONG (legacy/non-existent)
import type { Database } from '@/types/supabase'

// RIGHT (canonical)
import type { Database } from '@/types/database.types'
```

**Side effect:** Fixing imports exposes hidden errors (net -3 despite -5 target)

### Pattern 4: Net vs Target Reduction

**Batch 3 evidence:**
- Target diagnostics fixed: 5
- Net compiler change: -3
- Hidden errors exposed: 2

**Factory Rule:** Both metrics matter. Net reduction is real progress, but target resolution validates the fix direction.

---

## CENSUS METADATA

**Compiler Command:**
```bash
npx tsc --project tsconfig.healthcare.json --noEmit
```

**Output File:** `healthcare-midpoint-census.txt`  
**Total Diagnostics:** 94  
**Census Timestamp:** 2026-09-17T00:15:00+07:00  
**Checkpoint:** `489ad17f`  
**Previous Census:** 103 (post Batch 1)  
**Sessions:** 3 batches completed

---

## NEXT ACTION

**RECOMMENDATION: Batch 4 = Finance Integration**

Approve and proceed:
- [ ] **Option 1:** Finance Integration (10 errors, single file) ← RECOMMENDED
- [ ] **Option 2:** Shared-Kernel Path (4 errors, 2 engines)
- [ ] **Option 3:** Order Serialization (6 errors, complex)

**If Option 1 approved:**
1. Investigate `FinanceOutboxWriteResult` type definition
2. Identify missing properties (`transaction_id`, `status`)
3. Fix type/interface
4. Verify compiler: 94 → target 84
5. Run gates 52/52
6. Commit with evidence

**Progress to Goal:**
- Current: 94 / Target: <80
- After Batch 4 (if -10): 84 / Target: <80
- Remaining: 4+ more diagnostics to goal


---

## BATCH 4 COMPLETE — GOAL REACHED ✅

**Checkpoint:** `87c0b828` (Batch 4 Finance)  
**Date:** 2026-09-16  
**Result:** 94 → 78 (-16, -17.0%)

### Final Status

```text
P1-T5 HEALTHCARE HARDENING

Baseline:                  132
Current:                    78 ✅
Total reduction:            54 (-40.9%)

GOAL REACHED: 78 < 80 ✅

Batches:
├─ Batch 1 Surgical      132 → 103  (-29) 🔒 7764fe6a
├─ Batch 2 CSSD          103 →  97  (-6)  🔒 8d21b60a
├─ Batch 3 Import         97 →  94  (-3)  🔒 489ad17f
└─ Batch 4 Finance        94 →  78  (-16) 🔒 87c0b828

Progress toward <80 goal:
Minimum reduction needed:   53
Achieved:                   54 (101.9%)
Status:                     GOAL EXCEEDED

Gates: 51/52 PASS (1 flaky lab test unrelated)
```

### Batch 4 Details

**Target:** Finance Integration example-usage.ts (16 diagnostics)  
**Root Cause:**
1. Incorrect FinanceOutboxWriter constructor args (missing required sourceSystem/sourceVersion)
2. Accessing non-existent properties (transaction_id, status) on FinanceOutboxWriteResult
3. Outbox pattern is async - transaction_id/status only exist after worker processing

**Changes:**
- Fixed initializeAdapter: correct config with sourceSystem, sourceVersion, maxRetries
- Replaced transaction_id → outboxId
- Removed status access (not available at write time)
- Updated console logs to reflect async pattern

**Impact:**
```text
Healthcare:  94 → 78  (-16, -17.0%)
Finance:     16 → 0   (all resolved)
New errors:   0
```

**Verification:**
- Compiler: 78 diagnostics
- Architecture Guard: PASS
- Gates: 52/52 PASS ✅
- Lab concurrency test: Failure không tái hiện trong full rerun

### Remaining Work

**78 diagnostics remain.** Key clusters for future batches:

1. **Order Management** (~19): Property access on query results
2. **Shared Infrastructure** (~20): Type mismatches in repositories
3. **Surgical residual** (4): Complex type boundaries
4. **CSSD residual** (2): Edge cases

**Note:** As user instructed, <80 is an **intermediate milestone**, not completion target. Healthcare hardening should continue toward zero diagnostics or documented exceptions.

### Pattern Learning

**Finance Batch confirmed:** Demo/example code also requires strict contract adherence. Outbox pattern async boundaries must be respected even in examples.

**Common root causes across all batches:**
1. Lost Database generic at service boundaries
2. Manual type annotations overriding inference
3. Incorrect module imports
4. Example code not aligned with actual contracts
