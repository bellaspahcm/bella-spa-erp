# P1-T6 Logistics ACR Scope Investigation

**Date:** 2026-09-16  
**Checkpoint:** 27e6e98f  
**Status:** READ-ONLY INVESTIGATION (no frozen files modified)  
**Objective:** Determine full scope of E7.1 Domain type contract defect

---

## Executive Summary

**Finding:** Systematic architectural defect across ALL E7.1 Domain entities, not isolated to inventory.

**Recommendation:** Expand ACR-2026-001 scope to cover all affected entities BEFORE approval, avoiding multiple freeze/unfreeze cycles.

---

## Investigation Results

### Pattern Verification

Checked all E7.1 Domain entities for same defect pattern (type definitions use snake_case, implementation uses camelCase):

| Entity | Diagnostics | TS2551 Errors | Snake_case Confirmed | Status |
|--------|-------------|---------------|---------------------|---------|
| **inventory** | 64 → 0* | Yes | ✅ tenant_id, quantity_on_hand, etc. | L1 VERIFIED (stashed) |
| **movement** | 58 | Yes | ✅ movement_type, from_location_id, unit_cost | CONFIRMED |
| **item** | 49 | Yes | ✅ sku_code, base_uom, serial_tracked | CONFIRMED |
| **location** | 26 | Yes | ✅ location_code, location_name, location_type | CONFIRMED |
| **traceability** | 25 | Yes | ✅ lot_number, serial_number, expiry_date | CONFIRMED |

\* Batch L1 verified reduction after fix applied (in stash)

**Conclusion:** ALL 5 core E7.1 Domain entities have identical architectural defect.

---

## Error Sample Evidence

### movement.domain.ts (58 errors)
```
error TS2551: Property 'movementType' does not exist on type 
'CreateMovementProps'. Did you mean 'movement_type'?

error TS2551: Property 'fromLocationId' does not exist on type 
'CreateMovementProps'. Did you mean 'from_location_id'?

error TS2551: Property 'toLocationId' does not exist on type 
'CreateMovementProps'. Did you mean 'to_location_id'?

error TS2551: Property 'unitCost' does not exist on type 
'CreateMovementProps'. Did you mean 'unit_cost'?
```

### item.domain.ts (49 errors)
```
error TS2551: Property 'skuCode' does not exist on type 
'CreateItemProps'. Did you mean 'sku_code'?

error TS2551: Property 'baseUom' does not exist on type 
'CreateItemProps'. Did you mean 'base_uom'?

error TS2551: Property 'serialTracked' does not exist on type 
'CreateItemProps'. Did you mean 'serial_tracked'?
```

### location.domain.ts (26 errors)
```
error TS2551: Property 'locationCode' does not exist on type 
'CreateLocationProps'. Did you mean 'location_code'?

error TS2551: Property 'locationName' does not exist on type 
'CreateLocationProps'. Did you mean 'location_name'?

error TS2551: Property 'locationType' does not exist on type 
'CreateLocationProps'. Did you mean 'location_type'?
```

### traceability.domain.ts (25 errors)
```
error TS2551: Property 'lotNumber' does not exist on type 
'CreateTraceabilityProps'. Did you mean 'lot_number'?

error TS2551: Property 'serialNumber' does not exist on type 
'CreateTraceabilityProps'. Did you mean 'serial_number'?

error TS2551: Property 'expiryDate' does not exist on type 
'CreateTraceabilityProps'. Did you mean 'expiry_date'?
```

---

## Diagnostic Breakdown

### Current State (with L1 in stash)

```
Total Domain diagnostics: 211

By file:
movement.domain.ts          58  (27%) - SAME DEFECT
item.domain.ts              49  (23%) - SAME DEFECT
index.ts (barrel)           26  (12%) - NOT FROZEN
location.domain.ts          26  (12%) - SAME DEFECT
traceability.domain.ts      25  (12%) - SAME DEFECT
Others                      27  (13%) - TBD
```

### Projected Impact if All Fixed

```
Current baseline:           282 diagnostics

If all entity types fixed:
- inventory (L1):           -64
- movement:                 -58 (estimated)
- item:                     -49 (estimated)
- location:                 -26 (estimated)
- traceability:             -25 (estimated)
                            ────
Subtotal:                   -222

Remaining:
- index.ts (barrel):        26 (not frozen, fixable separately)
- Others:                   ~34

Projected after ACR:        ~60 diagnostics
                            (79% reduction from 282)
```

---

## Affected Artifacts (Expanded Scope)

### E7.1 Domain Kernel (FROZEN - requires ACR)

**Type definitions:**
```
src/platform/logistics/domain/inventory.types.ts      ✅ L1 verified
src/platform/logistics/domain/movement.types.ts       🔴 needs fix
src/platform/logistics/domain/item.types.ts           🔴 needs fix
src/platform/logistics/domain/location.types.ts       🔴 needs fix
src/platform/logistics/domain/traceability.types.ts   🔴 needs fix
```

**Domain implementations:**
```
src/platform/logistics/domain/inventory.domain.ts     ✅ L1 verified
src/platform/logistics/domain/movement.domain.ts      🔴 needs fix
src/platform/logistics/domain/item.domain.ts          🔴 needs fix
src/platform/logistics/domain/location.domain.ts      🔴 needs fix
src/platform/logistics/domain/traceability.domain.ts  🔴 needs fix
```

**Tests (may need assertion updates):**
```
src/platform/logistics/domain/__tests__/inventory.domain.test.ts     ✅ L1 verified
src/platform/logistics/domain/__tests__/movement.domain.test.ts      🔴 may need updates
src/platform/logistics/domain/__tests__/item.domain.test.ts          🔴 may need updates
src/platform/logistics/domain/__tests__/location.domain.test.ts      🔴 may need updates
src/platform/logistics/domain/__tests__/traceability.domain.test.ts  🔴 may need updates
```

### NOT Frozen (can fix after ACR)

```
src/platform/logistics/domain/index.ts                ⚪ barrel exports (26 errors)
```

---

## Recommendations

### Option 1: Expand ACR-2026-001 Scope (RECOMMENDED)

**Rationale:**
- All 5 entities have SAME architectural defect
- Single-pass fix avoids multiple freeze/unfreeze cycles
- Comprehensive solution addresses root cause systematically
- Evidence already strong from L1 verification

**Revised ACR scope:**
- All 5 E7.1 Domain entity types + implementations + tests
- Estimated impact: 282 → ~60 (79% reduction)
- Single approval, single unlock, single verification, single re-seal

**Process:**
1. Update ACR-2026-001 with expanded scope and evidence
2. Get Architecture Review approval for full scope
3. Unlock all 5 entity artifacts
4. Apply systematic fix (same pattern as L1)
5. Verify: compile + 547 regression + Architecture Guard
6. Commit all changes together
7. Update baseline, re-seal E7.1

**Pros:**
- ✅ Single governance cycle
- ✅ Systematic solution
- ✅ Pattern already proven (L1)
- ✅ Clear before/after evidence

**Cons:**
- Larger change set (but mechanical, low risk)
- Longer initial review time

### Option 2: Incremental ACR per Entity (NOT RECOMMENDED)

**Process:**
1. Approve ACR-2026-001 for inventory only
2. Apply L1, re-seal
3. Create ACR-2026-002 for movement
4. Unlock, fix, re-seal
5. Repeat for item, location, traceability

**Pros:**
- Smaller individual changes

**Cons:**
- ❌ 5 separate governance cycles
- ❌ 5 unlock/re-seal operations
- ❌ Inefficient use of review time
- ❌ Kernel unsealed multiple times
- ❌ Known defect left partially unfixed

### Option 3: Hybrid - Fix Inventory Now, Bundle Rest (NOT RECOMMENDED)

**Process:**
1. Approve ACR-2026-001 for inventory
2. Apply L1, re-seal
3. Create ACR-2026-002 for remaining 4 entities

**Cons:**
- ❌ Still 2 governance cycles when 1 would suffice
- ❌ Known systematic defect treated as separate issues

---

## Risk Assessment

### Expanded Scope Risk: LOW

**Why low risk:**
1. ✅ **Pattern proven:** L1 already validated fix approach (282 → 211, 547/547 PASS)
2. ✅ **Mechanical change:** Snake_case → camelCase property renames (no logic change)
3. ✅ **Same defect:** All 5 entities have identical root cause
4. ✅ **Test coverage:** 547 regression tests provide safety net
5. ✅ **Architecture Guard:** Enforces kernel integrity
6. ✅ **Repository mappers:** Already correct (expect camelCase)

**Mitigation:**
- Apply same verification standard to each entity as L1
- Compile after each entity fix to verify diagnostic reduction
- Run full 547 regression before final commit
- Architecture Guard verification mandatory

---

## Implementation Strategy (if Option 1 approved)

### Batch Order

1. **Batch L1 (inventory):** Apply stashed changes ✅ READY
2. **Batch L2 (movement):** Same pattern, 58 errors
3. **Batch L3 (item):** Same pattern, 49 errors
4. **Batch L4 (location):** Same pattern, 26 errors
5. **Batch L5 (traceability):** Same pattern, 25 errors
6. **Final verification:** 282 → ~60, 547/547 PASS, Architecture Guard
7. **Commit:** Single commit with full evidence
8. **Re-seal E7.1:** Update baseline to new clean state

### After ACR Implementation

**Fix barrel exports (index.ts):**
- NOT frozen, can fix independently
- 26 errors (wrong import paths)
- Does not require ACR
- Target: 282 → ~34 (88% reduction)

---

## Evidence Summary

**Systematic defect confirmed:**
- 5/5 E7.1 Domain entities affected
- Same architectural pattern violation
- 222/282 diagnostics (79%) from this single root cause

**L1 proof-of-concept:**
- Inventory fix: 64 → 0 ✅
- Domain compile: 282 → 211 ✅
- Regression: 547/547 PASS ✅
- Architecture Guard: PASS ✅
- Code quality: No suppressions, no unsafe casts ✅

**Recommendation:**
Expand ACR-2026-001 scope to all affected E7.1 entities before approval. Single systematic fix with strong evidence base is preferable to multiple incremental ACRs for same architectural defect.

---

**Investigation Status:** COMPLETE ✅  
**Next Step:** Update ACR-2026-001 with expanded scope and submit for Architecture Review  
**Official Baseline:** 282 diagnostics (unchanged until ACR approved and applied)
