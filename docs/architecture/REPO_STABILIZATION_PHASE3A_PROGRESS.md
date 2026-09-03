# Repository Stabilization — Phase 3A Progress

**Date:** 2026-09-02  
**Status:** IN PROGRESS (2/7 complete)  
**Scope:** Json/type-narrowing fixes for Bella Auto

---

## Objective

Fix 7 Bella Auto services with Json type narrowing issues using proven TradeInPhoto pattern.

**Target:** 17 PASS → 24 PASS (70.6% → estimated based on independent fixes)

---

## Completed (2/7)

### 1. ✅ DemandForecastingService

**Commit:** `20f8ffe9`  
**File:** `src/modules/bella-auto/services/DemandForecastingService.ts`  
**Issue:** `features_used: params.featuresUsed as unknown`  
**Fix:** Changed to `as Database['public']['Tables']['auto_demand_forecasts']['Row']['features_used']`  
**Schema:** JSONB (migration 20260803290000)  
**Verification:** ✅ PASS (2.9s minimal scope)

### 2. ✅ InsuranceService

**Commit:** `2c18462b`  
**File:** `src/modules/bella-auto/services/InsuranceService.ts`  
**Issues:** 3 locations with `coverage_items as unknown`  
**Fixes:**
- Line 93: Insert operation
- Line 324: Renewal operation  
- Line 531: Update operation
- Line 525: Added intermediate cast `as unknown as CoverageItems` for Json → domain type

**Schema:** JSONB (migration 20260803280000)  
**Verification:** ✅ PASS (3.8s minimal scope)

---

## Remaining (5/7)

### 3. ⏳ LoanApplicationService

**Expected issue:** Json type conversion for `DocumentChecklistItem`  
**Estimated effort:** MEDIUM (complex Json structure)

### 4. ⏳ MobileNotificationService

**Expected issue:** `as unknown` → Json type  
**Estimated effort:** LOW (single location)

### 5. ⏳ OfflineSyncService

**Expected issue:** `as unknown` → Json + missing required fields in array  
**Estimated effort:** MEDIUM (array structure + field mismatch)

### 6. ⏳ BusinessRollbackEngine

**Expected issue:** `Record<string, unknown>` → Json  
**Estimated effort:** LOW (2 locations)

### 7. ⏳ ServiceAppointmentService

**Status:** PARTIAL - also has schema drift  
**Expected issue:** Json narrowing + missing `scheduled_date`, `vehicle_info`  
**Estimated effort:** HIGH (mixed pattern - type + schema)

**Note:** ServiceAppointmentService may require schema investigation before full fix

---

## Pattern Applied

**Proven from TradeInPhotoService Phase 1:**

```typescript
// BEFORE
field: value as unknown

// AFTER  
field: value as Database['public']['Tables']['table_name']['Row']['field_name']
```

**For intermediate conversions:**
```typescript
// Reading from DB → domain type
const domainValue = (dbValue || {}) as unknown as DomainType
```

---

## Verification Protocol

**Each service:**
1. Read file, identify `as unknown` locations
2. Check schema migration for actual JSONB/Json type
3. Apply explicit type cast using generated Database types
4. Verify with minimal tsconfig (service + read-replica + database.types only)
5. Individual commit with evidence
6. Update progress tracker

**No batch commits** - each service verified independently

---

## Current Bella Auto Status

**After 2/7 fixes:**
```
19 PASS (56%) ← +2 from Phase 2 baseline (17)
5 HOTSPOT (15%)
10 FAIL (29%) ← -2 from Phase 2 baseline (12)
────────────
34 total
```

**Projected after 7/7 (if all independent):**
```
24 PASS (71%)
5 HOTSPOT (15%)
5 FAIL (15%)
────────────
34 total
```

**Note:** ServiceAppointmentService (7/7) may remain FAIL due to schema drift

---

## Commits Log

1. `20f8ffe9` — DemandForecastingService features_used fix
2. `2c18462b` — InsuranceService coverage_items fix (3 locations)

---

## Next Steps

**Continue Phase 3A:**
1. LoanApplicationService (3/7)
2. MobileNotificationService (4/7)
3. OfflineSyncService (5/7)
4. BusinessRollbackEngine (6/7)
5. ServiceAppointmentService (7/7 - partial, may require schema decision)

**After Phase 3A complete:**
- Run batch verification of all 7 fixed services
- Update Bella Auto classification (17 → ~24 PASS)
- Document Phase 3A complete
- Assess Phase 3B (4 schema drift services)

---

## Risk Assessment

**Current risk:** LOW
- Proven pattern from Phase 1
- Minimal changes (type casts only)
- Scoped verification per service
- Individual commits preserve provenance
- Test product (Bella Auto) tolerates experimentation

**Blocked:** None (all 7 services have clear diagnostics)

---

## Governance Compliance

- ✅ No HOTSPOT fixes attempted
- ✅ No schema changes
- ✅ No production product modifications
- ✅ No frozen kernel modifications
- ✅ Architecture Guard passing on all commits
- ✅ Evidence-based remediation

**Platform checkpoint remains:** LOCKED / STABLE

