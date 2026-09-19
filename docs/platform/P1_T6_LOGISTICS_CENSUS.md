# P1-T6 Logistics TypeScript Census

**Date:** 2026-09-16  
**Checkpoint:** 60220ed8  
**Scope:** Logistics Platform (Domain module)  
**Status:** 🔴 282 diagnostics measured

---

## Executive Summary

**Total diagnostics:** 282 (Domain module only)  
**Root cause:** snake_case/camelCase mismatch between type definitions and usage  
**Complexity:** Mechanical fix (high volume, low complexity)  
**Estimated fix time:** 3-4 hours (single systematic pass)

---

## Error Code Distribution

| Error Code | Count | % | Description |
|------------|-------|---|-------------|
| **TS2551** | **182** | **65%** | Property does not exist (suggests correct snake_case name) |
| TS2305 | 32 | 11% | Module has no exported member |
| TS2339 | 30 | 11% | Property does not exist on type |
| TS2561 | 17 | 6% | Object literal may only specify known properties |
| TS2322 | 7 | 2% | Type not assignable to type |
| TS2724 | 6 | 2% | Has no exported member (suggests alternative) |
| TS2353 | 3 | 1% | Object literal may only specify known properties |
| TS7006 | 2 | 1% | Parameter implicitly has 'any' type |
| TS2345 | 1 | <1% | Argument not assignable to parameter |
| TS2459 | 1 | <1% | Type has no call signatures |

**Key insight:** 182/282 (65%) are TS2551 - compiler already suggests correct property name

---

## File Distribution

| File | Diagnostics | % of Total |
|------|-------------|------------|
| inventory.domain.ts | 64 | 23% |
| movement.domain.ts | 58 | 21% |
| item.domain.ts | 49 | 17% |
| index.ts | 26 | 9% |
| location.domain.ts | 26 | 9% |
| traceability.domain.ts | 25 | 9% |
| inventory-operations.domain.ts | 19 | 7% |
| rules/traceability.rule.ts | 10 | 4% |
| uom.domain.ts | 4 | 1% |
| rules/traceability.operations.ts | 1 | <1% |

**Top 3 files = 171/282 (61%)**

---

## Root Cause Analysis

### Primary Issue: snake_case/camelCase Mismatch (182 errors, 65%)

**Pattern:** Type definitions use `snake_case` (matching database schema), but code uses `camelCase`

**Example (TS2551):**
```typescript
// Type definition (inventory.types.ts)
export interface Inventory {
  tenant_id: string;        // snake_case
  item_id: ItemId;
  quantity_on_hand: number;
  quantity_reserved: number;
  // ...
}

// Usage (inventory.domain.ts)
const tenantId = inventory.tenantId;  // ❌ Error: did you mean 'tenant_id'?
const itemId = inventory.itemId;      // ❌ Error: did you mean 'item_id'?
const qty = inventory.quantityOnHand; // ❌ Error: did you mean 'quantity_on_hand'?
```

**Affected properties (sample from TS2551 errors):**
- `tenantId` → `tenant_id`
- `itemId` → `item_id`
- `locationId` → `location_id`
- `quantityOnHand` → `quantity_on_hand`
- `quantityReserved` → `quantity_reserved`
- `quantityAvailable` → `quantity_available`
- `serialNumber` → `serial_number`
- `lotNumber` → `lot_number`
- `expiryDate` → `expiry_date`
- `locationType` → `location_type`
- ~20+ more properties

### Secondary Issue: Wrong Export Sources (32 errors, 11%)

**Pattern:** Barrel export (index.ts) imports from wrong type files

**Example:**
```typescript
// domain/index.ts
export {
  Inventory,                    // ❌ Error: not in './item.types'
  InventoryMovement,            // ❌ Error: not in './item.types'
  Traceability,                 // ❌ Error: not in './item.types'
  Location,                     // ❌ Error: not in './item.types'
  // ...
} from './item.types';
```

**Actual locations:**
- `Inventory` → should be from `'./inventory.types'`
- `Movement` → should be from `'./movement.types'`
- `Traceability` → should be from `'./traceability.types'`
- `Location` → should be from `'./location.types'`

**Impact:** 26 errors in barrel export are NOT real domain errors - just wrong import paths

---

## Comparison to Healthcare

| Metric | Healthcare | Logistics | Comparison |
|--------|------------|-----------|------------|
| Baseline | 132 | 282 | 2.1× larger |
| Primary error | TS2339 (property access) | TS2551 (property suggestion) | Similar category |
| Root cause | Contract drift | Naming convention mismatch | Different |
| Frozen Kernel | H1-H12 | E7.1-E7.3 | Both frozen |
| Complexity | High (architectural) | Low (mechanical rename) | Logistics simpler |
| Fix approach | Contract redesign | Systematic property rename | Different strategy |

**Key difference:** Healthcare required contract/EventBus redesign. Logistics requires systematic property rename to match type definitions.

---

## Fix Strategy

### Approach: Align Code with Type Definitions (NOT Change Types)

**Rationale:**
- Type definitions use `snake_case` matching database schema ✅ CORRECT
- Code uses `camelCase` ❌ INCONSISTENT
- Changing types would break database layer
- Must change code to match types

### Batch Plan

**Batch L1: Fix Barrel Export (index.ts) - 26 errors**
- Update import paths to correct type files
- Estimate: 15 minutes

**Batch L2: inventory.domain.ts - 64 errors**
- Rename all property accesses to snake_case
- Pattern: `inventory.tenantId` → `inventory.tenant_id`
- Estimate: 45 minutes

**Batch L3: movement.domain.ts - 58 errors**
- Same pattern as Batch L2
- Estimate: 45 minutes

**Batch L4: item.domain.ts - 49 errors**
- Same pattern
- Estimate: 30 minutes

**Batch L5: Remaining files - 85 errors**
- location.domain.ts (26)
- traceability.domain.ts (25)
- inventory-operations.domain.ts (19)
- rules/traceability.rule.ts (10)
- uom.domain.ts (4)
- rules/traceability.operations.ts (1)
- Estimate: 60 minutes

**Total estimate:** 3-4 hours (systematic, mechanical work)

---

## Verification Plan

After each batch:
1. Compile Domain module
2. Measure diagnostic reduction
3. Run Architecture Guard: `npm run logistics:verify`
4. Run Logistics regression: 547/547 tests must PASS
5. Commit with evidence

**Success criteria:**
- Domain diagnostics: 282 → 0
- Architecture Guard: PASS
- Regression tests: 547/547 PASS
- No `any` types introduced
- No `as unknown as` casts
- No suppressions (`@ts-ignore`, `@ts-expect-error`)

---

## Risk Assessment

### Low Risk
- Changes are mechanical (property rename only)
- TypeScript compiler provides exact correction in each error
- No architectural redesign required

### Medium Risk
- 282 changes = high volume (potential for typos)
- Must verify ALL domain operations still work

### Mitigation
- Use compiler suggestions (embedded in errors)
- Batch approach with verification after each
- 547 regression tests provide safety net
- Architecture Guard ensures Kernel integrity

---

## Next Steps

1. **Start Batch L1:** Fix barrel exports (index.ts) - 26 errors
2. **Verify:** Domain compilation, count reduction
3. **Continue Batch L2-L5:** Systematic property renames
4. **Final verification:** 547/547 tests, Architecture Guard
5. **Document:** P1-T6 completion evidence

---

**Census Date:** 2026-09-16  
**Measured Scope:** Domain module (24 files)  
**Total Diagnostics:** 282  
**Root Cause:** Identified (snake_case/camelCase mismatch)  
**Fix Complexity:** Low (mechanical, systematic)  
**Ready for:** Batch L1 execution
