# P1-T5 Healthcare Rebaseline

**Status:** COMPLETE  
**Checkpoint:** `da57dc69`  
**Date:** 2026-09-16  
**Scope:** Ownership census of Healthcare TypeScript diagnostics  

---

## Executive Summary

**Compiler Baseline:** 133 diagnostics (confirmed)  
**Healthcare-owned:** 132 diagnostics (99.2%)  
**Shared-owned:** 1 diagnostic (0.8% - Platform Host)  

**Critical Discovery:** Previous census at `8989f31e` claimed 211 diagnostics but actual compiler count was **157**. After P1-T3R removed 24 Platform Host errors, baseline is now **133**.

```text
Checkpoint Timeline:
─────────────────────────────────
8989f31e   157 (actual)  ← P1-T5 Census (claimed 211 ❌)
           211 (claimed)    Census document ERROR
              ↓
da57dc69   133 (actual)  ← P1-T3R (-24 Platform Host)
           187 (expected)   Based on wrong 211 base

Reconciliation:
157 - 24 = 133 ✅ CORRECT
211 - 24 = 187 ❌ WRONG (bad census base)
```

---

## Baseline Verification

### Compiler Output
```bash
npx tsc --project tsconfig.healthcare.json --noEmit
# Result: 133 diagnostics
```

### Ownership Distribution

| Owner | Count | % | Status |
|-------|-------|---|--------|
| Healthcare | 132 | 99.2% | HEALTHCARE-OWNED |
| Platform Host | 1 | 0.8% | SHARED (new discovery) |
| **Total** | **133** | **100%** | |

**Remaining Platform Host Error:**
```typescript
src/platform/host/contract-registry/contract-registry.service.ts(521,27)
error TS2345: Argument of type 'string' is not assignable to parameter of type 'JSONSchemaType'
```

This indicates P1-T3R did not achieve full Platform Host cleanup. Gate coverage gap remains.

---

## Root Cause Clusters

### Cluster Analysis Method
- Group by **file × root cause**, not just error codes
- Identify cascade relationships (one contract → multiple error types)
- Measure impact by file concentration

### Top 10 Root Cause Files

| Rank | File | Errors | Primary Cause | Ownership |
|------|------|--------|---------------|-----------|
| 1 | `surgical-engine.service.ts` | 23 | Surgical repository typing | Healthcare |
| 2 | `finance-integration/example-usage.ts` | 16 | FinanceOutboxWriteResult contract | Healthcare |
| 3 | `supabase-surgery.repository.ts` | 10 | DB schema mismatch | Healthcare |
| 4 | `service-locator.ts` | 10 | Missing contract files | Healthcare |
| 5 | `bed-engine.service.ts` | 8 | BedEngineContract interface | Healthcare |
| 6 | `cssd-engine.service.ts` | 8 | TraceabilityReport typing | Healthcare |
| 7 | `order-engine.service.ts` | 6 | CreateOrderResult contract | Healthcare |
| 8 | `laboratory-engine.service.ts` | 6 | Lab order event typing | Healthcare |
| 9 | `host-event-bus-bridge.ts` | 4 | EventBus interface | Healthcare |
| 10 | `index.ts` | 4 | Re-export ambiguity | Healthcare |

**Top 10 concentration:** 95/133 = 71.4% of all diagnostics

---

## Error Code Distribution

| Error Code | Count | Pattern | Cascade Risk |
|------------|-------|---------|--------------|
| **TS2339** | 48 | Property does not exist | ⚠️ HIGH - Often cascades from missing types |
| **TS2345** | 19 | Argument type mismatch | ✅ LOW - Usually independent |
| **TS2307** | 18 | Cannot find module | 🔴 CRITICAL - Blocks downstream |
| **TS2353** | 10 | Unknown object properties | ✅ LOW - Localized |
| **TS2322** | 9 | Type assignment | ✅ LOW - Direct fixes |
| **TS2459** | 6 | Not exported | ⚠️ MEDIUM - Cascade within file |
| **TS2308** | 5 | Duplicate exports | ✅ LOW - Structural |
| **TS2304** | 4 | Cannot find name | ⚠️ MEDIUM - Type definition |
| **TS2420** | 3 | Incorrect interface impl | ✅ LOW - Contract mismatch |
| **TS2561** | 3 | Object literal property | ✅ LOW - Typo/rename |
| **TS2724** | 3 | Wrong export name | ✅ LOW - Import fix |
| **TS2352** | 2 | Unsafe conversion | ⚠️ MEDIUM - Type assertion |
| **TS2552** | 2 | Cannot find name (typo) | ✅ LOW - Rename |
| **TS2554** | 1 | Wrong argument count | ✅ LOW - Function signature |

**Cascade Analysis:**
- **TS2307 (18):** Missing modules block 18+ downstream errors
- **TS2339 (48):** Many cascade from TS2307 or contract mismatches
- **Independent errors:** ~55/133 (41%) can be fixed without dependencies

---

## Missing Module Analysis (TS2307 - 18 diagnostics)

### Root Cause: Missing Contract Files

| Missing Module | Occurrences | Impact |
|----------------|-------------|--------|
| `@/types/supabase` | 5 | Order/Pharmacy/Lab repositories |
| `../../shared-kernel/types` | 3 | Admission/ICU engines |
| Missing contract files | 9 | Service locator blocking |

**Missing Contract Files in service-locator.ts:**
```typescript
./contracts/admission-engine.contract     ❌
./contracts/billing-engine.contract       ❌
./contracts/clinical-engine.contract      ❌
./contracts/imaging-engine.contract       ❌
./contracts/insurance-engine.contract     ❌
./contracts/mpi-engine.contract          ❌
./contracts/queue-engine.contract        ❌
./contracts/scheduling-engine.contract   ❌
```

**Analysis:**
- These contracts likely **exist but not exported** OR
- Service locator has **stale imports** for engines not yet implemented OR
- Contracts need to be **extracted** from engines

**Frozen Kernel Check:** None of these affect H1-H12 logic. All are contract/boundary issues.

---

## Healthcare-Owned Root Clusters

### Cluster 1: Surgical Engine DB Boundary (33 diagnostics)

**Files:**
- `surgical-engine.service.ts` (23)
- `supabase-surgery.repository.ts` (10)

**Root Cause:** Repository returns `never[]` type instead of typed surgical case entities

**Error Patterns:**
- TS2339: Property access on `never` (16)
- TS2345: Argument type `never` (6)
- TS2353: Object literal on `never[]` (5)
- TS2322: Type assignment mismatch (4)
- TS2420: Interface implementation (1)
- TS2304: Cannot find name (1)

**Ownership:** Healthcare Engine H5 (Surgical)

**Frozen Kernel Impact:** None - surgical repository is Product-level implementation

**Fix Strategy:** Type surgical repository query return types explicitly

**Estimated Impact:** 33 → 0 (single fix point)

---

### Cluster 2: Finance Integration Contract (16 diagnostics)

**Files:**
- `finance-integration/example-usage.ts` (16)

**Root Cause:** `FinanceOutboxWriteResult` missing properties `transaction_id` and `status`

**Error Patterns:**
- TS2339: Property does not exist (16)

**Ownership:** Healthcare Platform (Finance Integration Layer)

**Frozen Kernel Impact:** None - finance integration is Product boundary

**Fix Strategy:** Add missing properties to FinanceOutboxWriteResult type

**Estimated Impact:** 16 → 0 (single type fix)

---

### Cluster 3: Missing Contracts (18 diagnostics)

**Files:**
- `service-locator.ts` (10)
- Order/Admission/ICU engines (8)

**Root Cause:** 
- Service locator imports non-existent contract files (10)
- Engines import missing `@/types/supabase` (5)
- Engines import missing `shared-kernel/types` (3)

**Error Patterns:**
- TS2307: Cannot find module (18)

**Ownership:** Healthcare Platform (Contract Layer)

**Frozen Kernel Impact:** None - contracts are boundary definitions

**Fix Strategy:**
1. Either create missing contract files OR
2. Remove stale imports from service-locator OR
3. Use existing contract paths

**Estimated Impact:** 18 → 0 (contract organization)

---

### Cluster 4: Bed Engine Contract (8 diagnostics)

**Files:**
- `bed-engine.service.ts` (8)

**Root Cause:** BedEngineContract interface mismatch + userId property missing

**Error Patterns:**
- TS2420: Missing healthCheck implementation (1)
- TS2339: userId property missing (3)
- TS2345: Enum/type mismatch (2)
- TS2304/TS2352: Bed type casting (2)

**Ownership:** Healthcare Engine H3 (Bed Management)

**Frozen Kernel Impact:** None - bed engine is Product implementation

**Fix Strategy:** 
1. Implement missing healthCheck method
2. Add userId to request DTOs
3. Fix BedStatus enum references

**Estimated Impact:** 8 → 0 (interface compliance)

---

### Cluster 5: CSSD Traceability (8 diagnostics)

**Files:**
- `cssd-engine.service.ts` (8)

**Root Cause:** TraceabilityReport type mismatch in equipment query

**Error Patterns:**
- TS2322: Type incompatibility (1)
- TS2339: Property access on {} (7)

**Ownership:** Healthcare Engine H12 (CSSD)

**Frozen Kernel Impact:** ⚠️ **CSSD is frozen H12** - Need to verify if this is contract fix or logic change

**Fix Strategy:** Verify repository query types. If contract-only, fix repository typing. If logic change needed, ACR required.

**Estimated Impact:** 8 → 0 if contract fix; BLOCKED if logic change

---

### Cluster 6: Order Engine Events (17 diagnostics)

**Files:**
- `order-engine.service.ts` (6)
- `host-event-bus-bridge.ts` (4)
- `order-events.ts` (3)
- `clinical-order.service.ts` (4)

**Root Cause:** 
- EventBus interface incomplete (missing subscribe)
- OrderEvent types not exported
- CreateOrderResult index signature

**Error Patterns:**
- TS2420: Interface mismatch (2)
- TS2459: Not exported (6)
- TS2345: Argument mismatch (7)
- TS2339: Property access (2)

**Ownership:** Healthcare Engine H6 (Order Management)

**Frozen Kernel Impact:** None - order engine boundary typing

**Fix Strategy:**
1. Complete EventBus interface
2. Export OrderType/OrderStatus/OrderPriority
3. Add index signature to CreateOrderResult

**Estimated Impact:** 17 → 0 (contract typing)

---

### Cluster 7: Laboratory Events (6 diagnostics)

**Files:**
- `laboratory-engine.service.ts` (6)

**Root Cause:** Lab-specific event types not recognized by order event union

**Error Patterns:**
- TS2322: Event type mismatch (3)
- TS2561: Wrong property name (3)

**Ownership:** Healthcare Engine H8 (Laboratory)

**Frozen Kernel Impact:** None - laboratory event contracts

**Fix Strategy:** Extend order event types to include laboratory-specific events OR separate event hierarchies

**Estimated Impact:** 6 → 0 (event type extension)

---

### Cluster 8: Re-export Ambiguity (9 diagnostics)

**Files:**
- `contracts/index.ts` (1)
- `index.ts` (4)
- `audit-compliance.service.ts` (2)
- `rule-engine.service.ts` (2)

**Root Cause:** 
- Duplicate exports via barrel files (5)
- eventId property not in base event type (4)

**Error Patterns:**
- TS2308: Duplicate export (5)
- TS2353: Unknown property (4)

**Ownership:** Healthcare Platform (Export Organization + Event Schema)

**Frozen Kernel Impact:** None - export structure

**Fix Strategy:**
1. Deduplicate exports (already done for ICU in P1-T3R)
2. Add eventId to base event type OR remove from event creation

**Estimated Impact:** 9 → 0 (export cleanup)

---

### Remaining Small Clusters (18 diagnostics)

**Files with <5 errors each:**
- `nursing-engine.service.ts` (2) - Blood pressure type
- `blood-bank-engine` (1) - Record type
- `cds-engine.service.ts` (1) - Severity enum
- `icu-engine.service.ts` (2) - Missing types + ScoringResult
- `pharmacy-engine.service.ts` (1) - PrescriptionRow name
- `temporal-engine.service.ts` (1) - eventId property
- `healthcare-platform.bootstrap.ts` (1) - undefined check
- `laboratory` repositories (3) - Status property + null handling
- `contract-registry.service.ts` (1) - JSONSchemaType (Platform Host) ⚠️

**Ownership:** Mixed (17 Healthcare + 1 Platform Host)

**Estimated Impact:** 18 → 0 (independent fixes)

---

## Cascade Detection

### Primary Cascade Chains

**Chain 1: Missing Modules → Property Access**
```
TS2307 (18 missing modules)
    ↓ blocks type inference
TS2339 (~10-15 property errors cascade)
```
Fixing Cluster 3 (Missing Contracts) will eliminate ~28-33 diagnostics total.

**Chain 2: Repository Typing → Never Propagation**
```
Repository returns never[]
    ↓
TS2339 (property on never)
TS2345 (argument type never)
TS2353 (object literal on never)
```
Fixing Cluster 1 (Surgical DB) eliminates 33 diagnostics from single type fix.

**Chain 3: EventBus → Event Handling**
```
TS2420 (missing subscribe)
    ↓ incomplete interface
TS2339 (property access)
TS2459 (not exported)
```
Fixing Cluster 6 (Order Events) eliminates 17 diagnostics.

### Independent Errors (No Cascade)

- Cluster 2: Finance Integration (16) ✅
- Cluster 4: Bed Engine (8) ✅
- Cluster 5: CSSD (8) ⚠️ Frozen check needed
- Cluster 7: Lab Events (6) ✅
- Cluster 8: Re-exports (9) ✅
- Small clusters (18) ✅

**Total independent:** 65/133 = 48.9%

---

## Frozen Kernel Analysis

### H1-H12 Impact Check

| Engine | Frozen? | Errors in Scope | Contract Fix OK? | ACR Needed? |
|--------|---------|-----------------|------------------|-------------|
| H1 Patient | ✅ | 0 | N/A | ❌ |
| H2 Doctor | ✅ | 0 | N/A | ❌ |
| H3 Bed | ✅ | 8 | ✅ Yes | ❌ |
| H4 Encounter | ✅ | 0 | N/A | ❌ |
| H5 Surgical | ✅ | 33 | ✅ Yes | ❌ |
| H6 Order | ✅ | 17 | ✅ Yes | ❌ |
| H7 Queue | ✅ | 1 (missing contract) | ✅ Yes | ❌ |
| H8 Laboratory | ✅ | 6 | ✅ Yes | ❌ |
| H9 Pharmacy | ✅ | 1 | ✅ Yes | ❌ |
| H10 Imaging | ✅ | 1 (missing contract) | ✅ Yes | ❌ |
| H11 Nursing | ✅ | 2 | ✅ Yes | ❌ |
| H12 CSSD | ✅ | 8 | ⚠️ **VERIFY** | ⚠️ **TBD** |

**⚠️ CSSD Cluster 5 Requires Investigation:**

CSSD (H12) is frozen. The 8 diagnostics are in `cssd-engine.service.ts` line 688-699 related to TraceabilityReport typing. Need to determine:

1. Is this a **repository contract typing issue** (OK to fix)?
2. Or does it require **query logic changes** (ACR needed)?

**Recommendation:** Investigate CSSD cluster BEFORE attempting fix. If repository typing only, proceed. If logic change, create ACR.

**All other clusters:** Contract/boundary/typing fixes only. No H1-H12 logic changes required.

---

## Recommended Fix Sequence

### Phase 1: High-Impact Contract Fixes (67 → 0)

**Rationale:** Largest clusters with clear ownership and no cascade dependencies

| Batch | Target | Files | Diagnostics | Ownership | Risk |
|-------|--------|-------|-------------|-----------|------|
| 1A | Surgical DB | 2 | 33 | Healthcare H5 | ✅ LOW |
| 1B | Finance Integration | 1 | 16 | Healthcare Platform | ✅ LOW |
| 1C | Missing Contracts | ~3 | 18 | Healthcare Platform | ⚠️ MEDIUM |

**Expected:** 133 → 66

**Constraints:**
- No Kernel logic changes
- Contract typing only
- Verify CSSD before touching H12

---

### Phase 2: Engine Contract Compliance (31 → 0)

**Rationale:** Interface compliance and event typing

| Batch | Target | Files | Diagnostics | Ownership | Risk |
|-------|--------|-------|-------------|-----------|------|
| 2A | Order Events | 4 | 17 | Healthcare H6 | ✅ LOW |
| 2B | Bed Engine | 1 | 8 | Healthcare H3 | ✅ LOW |
| 2C | Lab Events | 1 | 6 | Healthcare H8 | ✅ LOW |

**Expected:** 66 → 35

---

### Phase 3: Export Organization (9 → 0)

**Rationale:** Structural cleanup, no logic

| Batch | Target | Files | Diagnostics | Ownership | Risk |
|-------|--------|-------|-------------|-----------|------|
| 3A | Re-export Dedup | 2 | 5 | Healthcare Platform | ✅ LOW |
| 3B | Event Schema | 2 | 4 | Healthcare Platform | ✅ LOW |

**Expected:** 35 → 26

---

### Phase 4: CSSD Investigation + Remaining (26 → 0)

**Rationale:** Verify frozen constraints before fix

| Batch | Target | Files | Diagnostics | Ownership | Risk |
|-------|--------|-------|-------------|-----------|------|
| 4A | CSSD Analysis | 1 | 8 | Healthcare H12 | ⚠️ **VERIFY** |
| 4B | Small Clusters | ~10 | 17 | Healthcare Mixed | ✅ LOW |
| 4C | Platform Host | 1 | 1 | Platform Host | ⚠️ MEDIUM |

**Expected:** 26 → 0 (if CSSD is contract fix) OR 26 → 8 (if CSSD blocked)

---

## First Bounded Fix Recommendation

### Target: Cluster 1 - Surgical Engine DB Boundary

**Justification:**
1. **Highest impact:** 33/133 = 24.8% of all diagnostics
2. **Single root cause:** Repository typing issue
3. **Clear ownership:** Healthcare Engine H5 (Surgical)
4. **No cascade dependencies:** Independent of other clusters
5. **Frozen Kernel:** Surgical is frozen H5, but this is repository contract typing, not logic
6. **Low risk:** Type annotation fix, no behavioral change

**Files:**
- `src/platform/healthcare/engines/surgical-engine/surgical-engine.service.ts` (23 errors)
- `src/platform/healthcare/engines/surgical-engine/repositories/supabase-surgery.repository.ts` (10 errors)

**Root Cause:**
Repository query methods return `never[]` instead of typed `SurgicalCase[]` and `SurgicalSafetyChecklist[]`.

**Fix Strategy:**
1. Add explicit return types to repository methods:
   ```typescript
   async getSurgicalCase(id: string): Promise<SurgicalCase | null>
   async createSurgicalCase(data: CreateSurgicalCaseRequest): Promise<SurgicalCase>
   async createSafetyChecklist(caseId: string): Promise<SurgicalSafetyChecklist>
   ```

2. Type assertion or schema validation for Supabase query results

**Verification:**
```bash
npx tsc --project tsconfig.healthcare.json --noEmit
# Expected: 133 → 100
```

**Gate Check:**
```bash
npm run gate:education-no-new-debt    # Should stay PASS
npm run gate:platform-host-no-new-debt # Should stay PASS
npm run gate:payroll-no-new-debt       # Should stay PASS
```

**Frozen Kernel Compliance:**
✅ Repository typing is contract-level fix
✅ No changes to H5 Surgical Engine logic
✅ No ACR required

---

## Platform Host Remaining Debt

**File:** `src/platform/host/contract-registry/contract-registry.service.ts:521`

**Error:**
```
TS2345: Argument of type 'string' is not assignable to parameter of type 'JSONSchemaType'
```

**Analysis:**
- P1-T3R claimed to close Platform Host debt
- This error was NOT in the 24 duplicate exports removed
- This indicates **P1-T3R was incomplete** OR **new error introduced**

**Ownership:** Platform Host

**Impact:** 1 diagnostic, but indicates gate coverage gap

**Recommendation:** 
1. Do NOT fix in P1-T5 (Healthcare scope)
2. Create **P1-T3R-FOLLOWUP** to complete Platform Host cleanup
3. Verify Platform Host gate coverage includes contract-registry.service.ts

---

## Summary

### Baseline Status
✅ **Compiler baseline confirmed:** 133 diagnostics  
✅ **Ownership classified:** 132 Healthcare + 1 Platform Host  
✅ **Previous census corrected:** 211 claimed → 157 actual  
✅ **P1-T3R validated:** 157 - 24 = 133 ✅  

### Root Cause Analysis
✅ **10 major clusters identified:** 95/133 = 71.4% concentration  
✅ **Cascade chains mapped:** 3 primary chains affecting ~68 diagnostics  
✅ **Independent errors:** 65/133 = 48.9%  
✅ **Frozen Kernel check:** 1 cluster needs verification (CSSD)  

### Recommended First Fix
🎯 **Cluster 1: Surgical Engine DB Boundary**
- 33 diagnostics (24.8% of total)
- Single root cause
- Clear ownership
- No cascade dependencies
- Frozen Kernel compliant (contract fix)

### Blocked Items
⚠️ **CSSD Cluster (8 diagnostics):** Requires investigation to determine contract vs logic fix  
⚠️ **Platform Host (1 diagnostic):** Out of Healthcare scope, needs P1-T3R followup  

### Phase Estimates
- **Phase 1 (Contract Fixes):** 133 → 66 (-67)
- **Phase 2 (Engine Compliance):** 66 → 35 (-31)
- **Phase 3 (Export Organization):** 35 → 26 (-9)
- **Phase 4 (CSSD + Remaining):** 26 → 0 (-26, if CSSD OK)

**Total Path to Zero:** 4 phases, ~5-8 bounded fixes

---

## Next Steps

1. ✅ **Rebaseline complete** - Ownership census documented
2. 🎯 **Execute Cluster 1 fix** - Surgical Engine DB typing (33 → 0)
3. ⚠️ **Investigate CSSD Cluster** - Verify contract vs logic before fixing
4. ⚠️ **Create P1-T3R Followup** - Platform Host remaining debt (1 diagnostic)
5. 🔄 **Repeat census** - After Cluster 1, verify no new errors introduced

**Do NOT:**
- Fix code during this census ✅ COMPLIED
- Assume 211 or 187 baselines ✅ CORRECTED
- Modify frozen H1-H12 logic without ACR ✅ VERIFIED
- Mix Platform Host and Healthcare fixes ✅ SEPARATED

---

**Checkpoint:** `da57dc69`  
**Census Status:** COMPLETE  
**Healthcare Baseline:** 133 diagnostics (proven)  
**Ownership:** 132 Healthcare + 1 Platform Host  
**First Fix Ready:** Cluster 1 - Surgical Engine (33 diagnostics)
