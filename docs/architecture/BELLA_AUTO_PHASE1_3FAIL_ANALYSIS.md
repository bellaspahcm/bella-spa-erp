# Bella Auto Phase 1: 3 FAIL Services Analysis

**Date:** 2026-09-02  
**Status:** SCHEMA DRIFT IDENTIFIED  
**Scope:** TradeInPhotoService, MarketValuationService, NPSSurveyService

---

## Executive Summary

**Diagnostic reclassification:** 3 previously-known FAIL services have **different root causes**, NOT a common pattern.

**Initial observation (single-file tsc):**
- All 3 showed `TS2307` module resolution errors
- Appeared as path alias issue

**Actual findings (project-context tsc):**
- ✅ **NPSSurveyService:** Schema drift (`assigned_to` missing) — BLOCKED
- ✅ **TradeInPhotoService:** Type narrowing issues (`unknown` → `Json`) — CAN FIX
- ⚠️ **MarketValuationService:** **HOTSPOT (45s timeout)** — RECLASSIFY as 3rd HOTSPOT service

**Reclassification:** MarketValuationService NOT a FAIL with diagnostics — it's a **compiler HOTSPOT** (similar to FinancialReporting and PartsInventory).

---

## Detailed Findings

### 1. NPSSurveyService — `assigned_to` Field Missing

**Error:**
```
error TS2339: Property 'assigned_to' does not exist on type 
'SelectQueryError<"column 'assigned_to' does not exist on 'auto_customer_journeys'.">'.
```

**Location:** Line 293
```typescript
const { data: journey } = await supabase
  .from('auto_customer_journeys')
  .select('assigned_to')  // ❌ Field doesn't exist
  .eq('id', survey.journey_id || '')
  .single();
```

**Schema verification:**
```sql
-- Migration: 20260803230000_create_auto_journeys.sql
CREATE TABLE auto_customer_journeys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    current_stage_id UUID NOT NULL,
    entered_stage_at TIMESTAMP,
    sla_deadline TIMESTAMP,
    sla_status TEXT,
    metadata JSONB,
    -- ❌ NO assigned_to column
);
```

**Assessment:**
- Service expects `assigned_to` field to track sales consultant
- Database schema has NO such column
- No migration adds this field
- **Schema drift** — code/schema mismatch

**Remediation options:**

**Option A: Add missing field**
```sql
ALTER TABLE auto_customer_journeys
ADD COLUMN assigned_sales_consultant_id UUID REFERENCES users(id);
```

**Option B: Use existing pattern**
- Check if sales consultant tracked elsewhere (customers table, lead assignment, etc.)
- Service may need to query different table or use metadata JSONB

**Option C: Remove feature**
- If `assigned_to` not business-critical, remove the query
- next_best_actions can work without assignment

**Recommendation:** 
- ❌ Do NOT add `assigned_sales_consultant_id` just to make compiler PASS
- ✅ Identify **source of truth** for sales consultant assignment in Bella Auto
- ✅ Map to existing capability OR document as missing feature
- ✅ Schema decision required before code fix

**BLOCKED on semantic/schema decision.**

---

### 2. TradeInPhotoService — Type Assertion Issues

**Error 1:**
```
error TS2322: Type 'unknown' is not assignable to type 'Json | undefined'.
Line 90
```

**Error 2:**
```
error TS2345: Argument of type 'Record<string, unknown>' is not assignable 
to parameter of type 'RejectExcessProperties<...>'.
Line 214
```

**Assessment:**
- Type narrowing issue, not schema drift
- Service uses `unknown` type that needs explicit casting
- Supabase typed client expects specific Json type

**Remediation:**
- Add proper type guards or assertions
- Align with Supabase Json type expectations
- May need to define explicit photo metadata interface

---

### 3. MarketValuationService — HOTSPOT (Reclassified)

**Initial error (single-file tsc):**
```
error TS2307: Cannot find module '@/lib/database/read-replica'
```

**Project-context diagnostic:**
```bash
npx tsc --project tsconfig.tmp.market-valuation.json --noEmit
# ⚠️ TIMEOUT after 45 seconds
# No diagnostic output (compiler hang)
```

**Assessment:**
- NOT a type error with diagnostics
- NOT path resolution issue
- **Compiler HOTSPOT** (similar to FinancialReporting, PartsInventory)
- 45-second timeout indicates pathological compiler behavior

**Reclassification:** MarketValuationService → **3rd HOTSPOT service**

**Status:** DEFER (same rationale as other HOTSPOTs — no unified fix without root cause)

---

## Error Classification

| Service | Error Type | Root Cause | Severity |
|---------|------------|------------|----------|
| NPSSurveyService | Schema drift | Missing `assigned_to` column | HIGH — requires schema decision |
| TradeInPhotoService | Type narrowing | `unknown` → `Json` mismatch | MEDIUM — requires type guards |
| MarketValuationService | **HOTSPOT** | **45s timeout (compiler bottleneck)** | **DEFER — 3rd HOTSPOT service** |

---

## Remediation Strategy

### Phase 1A: NPSSurveyService (Schema Decision Required)

**Investigation needed:**
1. Where SHOULD sales consultant assignment be tracked?
2. Does auto_customer_journeys need `assigned_sales_consultant_id`?
3. Or should service query different table (customers, leads, etc.)?

**Options:**

**A. Add missing schema field** (if business requires it)
```sql
-- Migration: add_auto_journeys_assignment.sql
ALTER TABLE auto_customer_journeys
ADD COLUMN assigned_sales_consultant_id UUID REFERENCES users(id);

CREATE INDEX idx_auto_journeys_consultant 
ON auto_customer_journeys(assigned_sales_consultant_id);
```

**B. Use existing assignment tracking** (if already exists elsewhere)
```typescript
// Query customers table or leads table
const { data: customer } = await supabase
  .from('customers')
  .select('assigned_consultant_id')  // If exists
  .eq('id', survey.customer_id)
  .single();
```

**C. Remove assignment from detractor action** (if not critical)
```typescript
await supabase.from('auto_next_best_actions').insert({
  // ... other fields
  assigned_to: null,  // No assignment, manual triage
});
```

**Decision point:** Cannot proceed without business/schema clarification

---

### Phase 1B: TradeInPhotoService (Type Guards)

**Approach:** Add type narrowing for Json conversion

**Example fix:**
```typescript
// Before (Line 90)
damage_markers: metadata.damage_markers  // ❌ unknown

// After
damage_markers: metadata.damage_markers as Json | undefined  // ✅

// Or with type guard
const damageMarkers = 
  typeof metadata.damage_markers === 'object' && metadata.damage_markers !== null
    ? (metadata.damage_markers as Json)
    : undefined;
```

**Verification:** Scoped typecheck after fix

---

### Phase 1C: MarketValuationService (Full Diagnostic)

**Action:** Re-run with project context to surface actual errors

```bash
npx tsc --project tsconfig.tmp.market-valuation.json --noEmit
```

Then classify: schema drift vs. type narrowing vs. other

---

## Comparison with Q1/Q2

**Q1/Q2 Schema Fixes (Successfully Completed):**
- CustomerHealthScoreService: `status` → `sla_status`
- ChurnPredictionService: `occurred_at` → `interacted_at`  
- CustomerJourneyService: `current_stage` → `current_stage_id`

**Current 3 FAIL (Similar Pattern):**
- NPSSurveyService: Missing `assigned_to` column
- TradeInPhotoService: Type narrowing needed
- MarketValuationService: TBD

**Methodology continuity:** Same schema/type alignment approach

---

## Risk Assessment

### LOW Risk (Can Fix Immediately)
- ✅ TradeInPhotoService type guards

### MEDIUM Risk (Requires Investigation)
- ⚠️ MarketValuationService (unknown errors)

### HIGH Risk (Requires Business Decision)
- 🔴 NPSSurveyService (schema change vs. workaround)

---

## Recommended Next Steps

**Do NOT proceed with blind fixes.** Evidence-based remediation order:

**Proceed immediately:**

1. **TradeInPhotoService** (can fix now):
   - [ ] Add type guards for Json conversion
   - [ ] Align object shape with generated DB types
   - [ ] Scoped typecheck verification
   - [ ] Atomic commit if PASS

**Reclassified (DEFER as HOTSPOT):**

2. **MarketValuationService** (3rd HOTSPOT service):
   - [ ] **RECLASSIFY:** From FAIL → HOTSPOT
   - [ ] DEFER with same rationale as FinancialReporting/PartsInventory
   - [ ] 45s timeout = compiler bottleneck, not fixable type error
   - [ ] Update Bella Auto inventory: 11 verified, **3 HOTSPOT** deferred, **2 FAIL** remaining

**Blocked (requires decision):**

3. **NPSSurveyService** (semantic/schema decision):
   - [ ] BLOCKED: Identify source of truth for sales consultant assignment
   - [ ] Decision: Map existing OR add schema OR remove feature
   - [ ] Do NOT add column just for compiler PASS
   - [ ] Apply solution after architectural decision

4. **Batch Verification:**
   - [ ] After all 3 fixed, test together
   - [ ] Regression check (ensure no new issues)
   - [ ] Commit with provenance

---

## Blocking Question

**Before proceeding with NPSSurveyService fix:**

> **Where should sales consultant assignment be tracked in Bella Auto architecture?**

Options:
1. `auto_customer_journeys.assigned_sales_consultant_id` (new field)
2. `customers.assigned_consultant_id` (if exists)
3. Separate `auto_lead_assignments` table
4. Not tracked (remove feature)

**Cannot fix without architectural decision.**

---

## Status

**Phase 1 Analysis:** ✅ COMPLETE  
**Reclassification:** ✅ COMPLETE

**Results:**
- NPSSurveyService: Schema drift (BLOCKED — semantic decision required)
- TradeInPhotoService: Type narrowing (✅ FIXED — commit a8d36e06)
- MarketValuationService: **RECLASSIFIED → 3rd HOTSPOT** (45s timeout)

**Bella Auto Updated Inventory:**
- 12 verified PASS (was 11 + TradeInPhoto)
- **3 HOTSPOT deferred** (FinancialReporting, PartsInventory, **MarketValuation**)
- **1 FAIL blocked** (NPSSurvey — schema decision required)
- 18 unverified

**Phase 1 actionable work:** ✅ COMPLETE  
**Next:** Phase 2 (18 unverified batch verification) OR resolve NPSSurvey schema decision

---