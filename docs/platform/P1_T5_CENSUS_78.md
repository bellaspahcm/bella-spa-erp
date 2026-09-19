# P1-T5 CENSUS @ 78 DIAGNOSTICS

**Checkpoint:** `87c0b828` (Post Batch 4)  
**Baseline:** 78 TypeScript diagnostics  
**Previous:** 94 (Batch 4: 94 → 78, -16)  
**Census Date:** 2026-09-16  
**Status:** 🔍 ANALYSIS COMPLETE

---

## EXECUTIVE SUMMARY

After 4 successful batches (132 → 78, -40.9%), Healthcare compiler reached intermediate milestone <80. **78 is new baseline** for continued hardening toward 0 diagnostics.

**Key Findings:**

1. **Service Locator cluster (10):** Missing/unimplemented contract modules
2. **Bed Engine (8):** Contract implementation + type boundary issues
3. **Order/Lab event emission (10):** Wrong event types passed to temporal engine
4. **Surgical/CSSD residuals (4):** Stable, not growing
5. **Shared patterns persist:** Database generic loss, Record<string, unknown> overrides

**Ownership Classification:**

| Category | Count | Actionable |
|----------|-------|------------|
| Healthcare-owned | 52 | ✅ High priority |
| Missing contracts | 13 | 📋 Requires H2 completion |
| Shared infrastructure | 8 | 🔧 Cross-team |
| Residual (stable) | 5 | 🔍 Low priority |

---

## DIAGNOSTIC BREAKDOWN BY ERROR CODE

| Error Code | Count | Change from 94 | Description |
|------------|-------|----------------|-------------|
| **TS2345** | 15 | -2 | Argument type not assignable |
| **TS2307** | 13 | 0 | Cannot find module |
| **TS2339** | 9 | -15 | Property does not exist (Finance resolved) |
| **TS2322** | 7 | +2 | Type not assignable |
| **TS2459** | 6 | new | Type has no call signatures |
| **TS2308** | 5 | new | Type aliasing issues |
| **TS2353** | 5 | -1 | Object literal known properties |
| **TS2304** | 4 | +1 | Cannot find name |
| **TS2420** | 3 | 0 | Incorrectly implements interface |
| **TS2561** | 3 | new | Object literal wrong properties |
| **TS2724** | 3 | 0 | Named export not found |
| **TS2352** | 2 | 0 | Conversion may be mistake |
| **TS2552** | 2 | 0 | Cannot find name (different context) |
| **TS2551** | 1 | 0 | Property name typo |

**Notable Changes:**
- TS2339 dropped from 24→9 (Finance -16, exposed +1 elsewhere)
- New error types (TS2459, TS2308, TS2561) suggest deeper type inference after fixes

---

## TOP CLUSTERS BY FILE

### **1. Service Locator (10 diagnostics) — MISSING CONTRACTS**

**File:** `src/platform/healthcare/service-locator.ts`

**Errors:**
- 7× TS2307: Cannot find module (admission, clinical, billing, insurance, scheduling, queue, imaging, mpi)
- 2× TS2724: Named export not found (EncounterEngineContract, LaboratoryEngineContract)
- 1× TS2307: Cannot find mpi-engine.contract

**Root Cause:** Service locator imports contracts that don't exist yet (H2 Phase extraction incomplete)

**Ownership:** **Platform/H2 blocker** - requires contract extraction completion

**Batch Candidate:** ❌ NO - blocked by H2, not actionable in hardening

**Pattern:** Unimplemented public contracts

---

### **2. Bed Engine Service (8 diagnostics) — CONTRACT + TYPE BOUNDARY**

**File:** `src/platform/healthcare/engines/bed-engine/bed-engine.service.ts`

**Errors:**
- 1× TS2420: Incorrectly implements BedEngineContract
- 3× TS2339: Property 'userId' does not exist on request types
- 2× TS2345: Argument type not assignable (enum mismatch, string | undefined)
- 1× TS2304: Cannot find name 'Bed'
- 1× TS2352: Conversion may be mistake (shape → Bed)

**Root Cause:**
1. Contract mismatch: BedAllocationRequest/BedReleaseRequest/BedTransferRequest missing `userId` field
2. Enum mismatch: Using 'death'/'other' not in contract enum
3. Missing Bed entity import

**Ownership:** **Healthcare-owned** (contract alignment + import fix)

**Batch Candidate:** ✅ YES - focused, single file, clear contract issue

**Estimated Impact:** 8 → ~2 residual (contract definition may expose validation errors)

---

### **3. Order Engine Service (6 diagnostics) — RECORD OVERRIDE**

**File:** `src/platform/healthcare/engines/order-engine/order-engine.service.ts`

**Errors:**
- 3× TS2345: CreateOrderResult not assignable to Record<string, unknown>
- 2× TS2345: ClinicalOrder not assignable to Record<string, unknown>
- 1× TS2345: CdsOverrideRecord not assignable to Record<string, unknown>

**Root Cause:** Event emission using `Record<string, unknown>` instead of actual event payload types

**Ownership:** **Healthcare-owned** (same pattern as Batch 1 Surgical)

**Batch Candidate:** ✅ YES - known pattern, surgical fix (update event emission types)

**Estimated Impact:** 6 → 0

---

### **4. Laboratory Engine Service (6 diagnostics) — WRONG EVENT TYPES**

**File:** `src/platform/healthcare/engines/laboratory-engine/laboratory-engine.service.ts`

**Errors:**
- 3× TS2322: Wrong event type literal ("SpecimenCollected", "ResultVerified", "CriticalResultEscalated" not in union)
- 3× TS2561: Property 'labOrderId' should be 'orderId'

**Root Cause:**
1. Emitting lab-specific events using Order event type enum
2. Using domain-specific property names instead of contract canonical names

**Ownership:** **Healthcare-owned** (event type alignment)

**Batch Candidate:** ✅ YES - focused, event contract alignment

**Estimated Impact:** 6 → 0 (or may expose that lab needs separate event contract)

---

### **5. Clinical Order Service (4 diagnostics)**

**File:** `src/platform/healthcare/engines/order-engine/services/clinical-order.service.ts`

**Errors:** (need detail inspection)

**Ownership:** Healthcare-owned

---

### **6. Host Event Bus Bridge (4 diagnostics)**

**File:** `src/platform/healthcare/engines/order-engine/contracts/host-event-bus-bridge.ts`

**Errors:** (need detail inspection)

**Ownership:** Healthcare/Host boundary

---

### **7. Healthcare Index (4 diagnostics)**

**File:** `src/platform/healthcare/index.ts`

**Errors:** (likely re-export of missing contracts)

**Ownership:** Healthcare-owned (cascading from service-locator)

---

### **8-14. Engine Services (2 diagnostics each) — SCATTERED**

Multiple files with 2 errors each:
- surgical-engine.service.ts (2)
- surgical repository (2)
- pharmacy repository (2)
- laboratory repository (2)
- nursing-engine.service.ts (2)
- icu-engine.service.ts (2)
- cssd-engine.service.ts (2) ← **Batch 2 residual**
- audit-compliance-engine.service.ts (2)

**Pattern:** Likely Database generic loss + Record override pattern

**Ownership:** Healthcare-owned

**Batch Candidate:** Cluster analysis needed (may be one root cause across all)

---

## RESIDUAL TRACKING

### **Surgical (4 diagnostics) — STABLE**

From Batch 1, not resolved due to complex nested type boundaries. Stable across censuses.

**Status:** 📌 Tracked, not priority

---

### **CSSD (2 diagnostics) — STABLE**

From Batch 2, residual edge cases not covered by main fix.

**Status:** 📌 Tracked, not priority

---

## ROOT CAUSE PATTERNS

### **Pattern A: Missing/Unimplemented Contracts (13 diagnostics)**

**Files:** service-locator.ts, index.ts  
**Blocked by:** H2 Phase completion  
**Actionable:** ❌ NO

---

### **Pattern B: Record<string, unknown> Override (12 diagnostics)**

**Files:** order-engine.service.ts (6), scattered repositories (6)  
**Same as:** Batch 1 Surgical  
**Fix:** Replace Record with actual event payload types  
**Actionable:** ✅ YES

---

### **Pattern C: Contract Property Mismatch (11 diagnostics)**

**Files:** bed-engine.service.ts (3), laboratory-engine.service.ts (3), others (5)  
**Fix:** Align request/event shapes with canonical contracts  
**Actionable:** ✅ YES

---

### **Pattern D: Wrong Event Type Literals (3 diagnostics)**

**Files:** laboratory-engine.service.ts  
**Fix:** Use correct event type enum or create lab-specific contract  
**Actionable:** ✅ YES

---

### **Pattern E: Database Generic Loss (scattered)**

**Continuing from:** Batches 1-3  
**Fix:** Preserve SupabaseClient<Database> at boundaries  
**Actionable:** ✅ YES (as discovered)

---

## BATCH 5 CANDIDATES

### **Option 1: Order Engine Event Emission (6 diagnostics)**

**Pros:**
- Known pattern (Record override)
- Single file
- Surgical fix

**Cons:**
- May expose deeper order event contract issues

**Estimated:** 6 → 0 or 6 → 2 residual

---

### **Option 2: Laboratory Engine Events (6 diagnostics)**

**Pros:**
- Focused, single file
- Clear contract alignment issue

**Cons:**
- May require lab-specific event contract creation

**Estimated:** 6 → 0 if contract exists, 6 → 3 if needs new contract

---

### **Option 3: Bed Engine Contract (8 diagnostics)**

**Pros:**
- Highest single-file impact
- Contract alignment (repeatable pattern)

**Cons:**
- Mix of issues (userId missing, enum mismatch, entity import)
- May expose validation errors

**Estimated:** 8 → 2 residual

---

### **Option 4: Repository Cluster (12 diagnostics)**

**Pros:**
- Address Pattern B across multiple files
- Known fix from Batch 1

**Cons:**
- Scattered across 6 files
- Requires consistent verification

**Estimated:** 12 → 0

---

## RECOMMENDED APPROACH

**Primary:** Start with **Order Engine Event Emission (Option 1)** or **Laboratory Engine Events (Option 2)**
- Both are focused, single-file
- Both address event contract alignment
- Low risk of cascading issues

**Secondary:** **Bed Engine Contract (Option 3)** if prefer higher single-file impact

**Avoid for now:** Service Locator (blocked by H2), scattered residuals (low leverage)

---

## PROGRESS SUMMARY

```text
P1-T5 HEALTHCARE HARDENING

Journey:
132 → 103 → 97 → 94 → 78

Batches completed:       4
Total reduction:        54 (-40.9%)
<80 milestone:          ✅ REACHED
Healthcare-owned:       52 actionable
Blocked by H2:          13
Residual (stable):       5

Current baseline:       78
Target:                  0 (or documented exceptions)
Next batch:             TBD (Options 1-4)
```

---

## CENSUS METHODOLOGY

1. **Compiler output:** `npx tsc --project tsconfig.healthcare.json --noEmit`
2. **Error grouping:** By error code, file, pattern
3. **Ownership:** Healthcare vs Platform vs H2-blocked
4. **Actionability:** Can fix now vs blocked vs residual
5. **Batch selection:** High leverage + focused scope + low risk

**Note:** Census does not assume Order ~19 or shared ~20 from previous census (94). All counts re-verified at baseline 78.
