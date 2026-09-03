# Phase 1M Cluster 1: Type Ownership Resolution Matrix

**Status:** � DEPENDENCY DIRECTION VERIFIED - REMEDIATION BLOCKED  
**Date:** 2026-09-03  
**Scope:** 14 TS2305 errors (Module export missing)

---

## ⚠️ CRITICAL ARCHITECTURAL FINDING

**Dependency Direction Evidence:**
- ❌ **Domain → Contracts imports: PROHIBITED** (zero instances across Healthcare, Finance, Logistics)
- ❌ **Contracts → Domain imports: PROHIBITED** (zero instances across all Platforms)
- ✅ Contracts → Contracts: Allowed
- ✅ Contracts → Shared-kernel: Allowed

**UOM Vocabulary Conflict:**
- ✅ **E7 DB Schema (Level 3 - CANONICAL):** `base_uom CHECK ... IN ('PLT', ...)`
- ✅ **Domain `StandardUOM`:** `'PLT'` - **CORRECT** (matches schema)
- ❌ **Contract `UnitOfMeasure.PALLET`:** `'PL'` - **INCORRECT** (violates schema)

**Conclusion:** Domain types are canonical and schema-aligned. Contract enum has wrong value and cannot be imported by domain due to architectural boundary.

---

## Type Ownership Matrix

### 1. UnitOfMeasure (9 instances)

**Consumer requests:** `UnitOfMeasure`, `CreateUOMProps`, `UpdateUOMProps`, `UOMStatus`

**Evidence Level 1 (Canonical Contract):**
```typescript
// contracts/item.contract.ts
export enum UnitOfMeasure {
  EACH = 'EA',
  CASE = 'CS',
  PALLET = 'PL',
  // ... 11 more values
}
```

**Evidence Level 2 (Domain):**
```typescript
// domain/uom.types.ts
export type StandardUOM = 'EA' | 'CS' | 'PLT' | 'KG' | ...
export type UOMCategory = 'QUANTITY' | 'WEIGHT' | ...
export interface UOMDefinition { ... }
```

**Canonical owner:** `domain/uom.types.ts` (E7 schema + domain alignment)

**Root cause:** 
1. Domain consumers expect `UnitOfMeasure` but domain exports `StandardUOM`
2. Contract has `UnitOfMeasure` enum but with WRONG values (`'PL'` vs schema `'PLT'`)
3. Domain → Contracts import PROHIBITED by architecture

**Current state:**
- ❌ Contract `UnitOfMeasure` has INCORRECT value (`PALLET = 'PL'` violates E7 schema `'PLT'`)
- ✅ Domain `StandardUOM` is CORRECT (`'PLT'` matches E7 schema)
- ❌ Domain exports `StandardUOM`, consumers expect `UnitOfMeasure`
- ❌ Missing: `CreateUOMProps`, `UpdateUOMProps`, `UOMStatus` (not in any layer)
- 🛑 Domain CANNOT import from contracts (architectural boundary)

**Classification:** � **Type D - Vocabulary Conflict + Architectural Boundary Violation**

**Remediation BLOCKED - Requires architectural decision:**

**Option A:** Rename domain type to match consumer expectations
1. Rename `StandardUOM` → `UnitOfMeasure` in `domain/uom.types.ts`
2. Export from `domain/index.ts`
3. Fix contract enum values to match E7 schema (separate issue)
4. Create missing props types in domain if genuinely needed

**Option B:** Keep domain type name, fix consumer expectations
1. Update all consumers to use `StandardUOM` instead of `UnitOfMeasure`
2. Fix contract enum values to match E7 schema
3. Accept that contract and domain have different type names

**Evidence for Option A:**
- Domain is canonical (schema-aligned)
- `UnitOfMeasure` is better semantic name than `StandardUOM`
- Consumers already expect this name
- Contract type is wrong anyway, needs correction

**Blocked:** Cannot proceed without user decision on naming strategy

**Affected files:**
- `domain/index.ts` (3 instances)
- `domain/uom.domain.ts` (3 instances)
- `repositories/uom.repository.interface.ts` (1 instance)

---

### 2. InventoryMovement / Movement (1 instance)

**Consumer requests:** `Movement` from `inventory.types`

**Evidence Level 1 (Canonical Contract):**
```typescript
// contracts/inventory.contract.ts
export interface IInventoryMovement { ... } // Service interface
```

**Evidence Level 2 (Domain):**
```typescript
// domain/movement.types.ts
export interface InventoryMovement {
  id: string;
  tenant_id: string;
  // ... complete movement entity
}
```

**Canonical owner:** `domain/movement.types.ts` (entity) + `contracts/inventory.contract` (service interface)

**Root cause:** Consumer requesting wrong type name (`Movement` instead of `InventoryMovement`) from wrong module

**Current state:**
- ✅ Canonical type EXISTS (`InventoryMovement`)
- ❌ Consumer uses abbreviated name (`Movement`)
- ❌ Importing from wrong module (`inventory.types` instead of `movement.types`)

**Classification:** 🟢 **Type A - Canonical exists, wrong name + wrong import**

**Remediation:**
1. Change consumer to import `InventoryMovement` from `movement.types`
2. Update variable/property names using `Movement` → `InventoryMovement`

**Affected files:**
- `domain/inventory-operations.domain.ts` (1 instance)

---

### 3. LocationStatus (2 instances)

**Consumer requests:** `LocationStatus` from `location.types`

**Evidence Level 2 (Domain):**
```typescript
// domain/location.types.ts
export interface Location {
  // ...
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED'; // Inline type
}
```

**Evidence Level 3 (E7 DB Schema):**
```sql
-- migrations/logistics/20260822_logistics_os_domain_kernel.sql
CREATE TABLE logistics.locations (
  status TEXT NOT NULL DEFAULT 'ACTIVE',
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'CLOSED')),
  -- ...
);
```

**Canonical owner:** Domain layer (NOT contract - no evidence in contracts)

**Root cause:** Type expected by domain consumers but not exported

**Current state:**
- ❌ Type does NOT exist as exported type
- ✅ Values defined inline in `Location` interface
- ✅ DB schema confirms valid values

**Classification:** 🔵 **Type C - Type needs creation at canonical owner**

**Remediation:**
1. Create `LocationStatus` type in `domain/location.types.ts`:
   ```typescript
   export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
   ```
2. Update `Location` interface to use new type
3. Re-export from `domain/index.ts`

**Affected files:**
- `domain/index.ts` (1 instance)
- `domain/location.domain.ts` (1 instance)

---

### 4. CustodyEvent (1 instance)

**Consumer requests:** `CustodyEvent` from `movement.types`

**Evidence Level 2 (Domain):**
```typescript
// domain/traceability.types.ts
export interface CustodyEvent {
  timestamp: Date;
  location_id: string;
  location_type: LocationType;
  action: 'RECEIVED' | 'MOVED' | 'QUARANTINED' | ...;
  user_id?: string;
  notes?: string;
}
```

**Canonical owner:** `domain/traceability.types.ts` (custody is traceability concept, not movement)

**Root cause:** Consumer importing from wrong module

**Current state:**
- ✅ Canonical type EXISTS in `traceability.types.ts`
- ❌ Consumer importing from `movement.types`

**Classification:** 🟢 **Type A - Canonical exists, wrong import**

**Remediation:**
1. Change import from `movement.types` → `traceability.types`

**Affected files:**
- `domain/rules/traceability.operations.ts` (1 instance)

---

### 5. AddCustodyEventProps (1 instance)

**Consumer requests:** `AddCustodyEventProps` from `traceability.types`

**Evidence Level 2 (Domain):**
```typescript
// domain/traceability.types.ts
export interface CreateTraceabilityProps { ... } // Exists
// AddCustodyEventProps - NOT FOUND
```

**Evidence Level 1 (Contract):**
```typescript
// contracts/traceability.contract.ts
// No AddCustodyEventProps found
```

**Canonical owner:** Domain layer (traceability operations)

**Root cause:** Type genuinely missing OR consumer should use different operation pattern

**Current state:**
- ❌ Type does NOT exist
- ✅ `CreateTraceabilityProps` exists (different operation)
- ⚠️ May indicate incomplete implementation

**Classification:** 🟡 **Type B - REVIEW REQUIRED**

**Evidence needed:**
1. Check traceability domain operations to understand custody event addition pattern
2. Verify if `CustodyEvent` is added directly to `TraceabilityRecord` or needs dedicated props
3. Review E7 schema for custody event model

**Blocked:** Requires semantic review before creating type

**Affected files:**
- `domain/traceability.domain.ts` (1 instance)

---

## Summary by Classification

### 🟢 Type A: Canonical exists, clear import fix (2/14)
- **InventoryMovement** (1 instance) - Import from `domain/movement.types.ts`, fix name
- **CustodyEvent** (1 instance) - Import from `domain/traceability.types.ts`, not `movement.types`

**Remediation:** Straightforward import corrections - **AUTHORIZED**

---

### 🔵 Type C: Type needs creation (2/14)
- **LocationStatus** (2 instances) - Create in `domain/location.types.ts`

**Remediation:** Low-risk type creation (values defined inline, DB schema confirms) - **AUTHORIZED**

---

### � Type D: Vocabulary conflict + architectural boundary (9/14)
- **UnitOfMeasure** / `StandardUOM` (9 instances) - Domain canonical but name mismatch + contract has wrong values

**Remediation:** **BLOCKED** - Requires naming strategy decision

---

### 🟡 Type B: Missing, needs review (1/14)
- **AddCustodyEventProps** (1 instance) - Missing, needs semantic review

**Remediation:** **BLOCKED** - Pending domain pattern review

---

## Remediation Plan

### Phase 1: Authorized low-risk fixes (4/14 errors) ✅

**Batch M1.1: InventoryMovement fix (1 error) - AUTHORIZED**
1. Update `domain/inventory-operations.domain.ts`:
   ```typescript
   import { InventoryMovement } from './movement.types';
   ```
2. Update variable names `Movement` → `InventoryMovement`

**Expected:** TS2305 × 1 → 0

**Batch M1.2: CustodyEvent fix (1 error) - AUTHORIZED**
1. Update `domain/rules/traceability.operations.ts`:
   ```typescript
   import { CustodyEvent } from '../traceability.types';
   ```

**Expected:** TS2305 × 1 → 0

**Batch M1.3: LocationStatus creation (2 errors) - AUTHORIZED**
1. Add to `domain/location.types.ts`:
   ```typescript
   export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
   ```
2. Update `Location` interface:
   ```typescript
   export interface Location {
     // ...
     status: LocationStatus;
   }
   ```
3. Export from `domain/index.ts`

**Expected:** TS2305 × 2 → 0

---

### Phase 2: UOM vocabulary resolution (9/14 errors) 🛑 BLOCKED

**Batch M1.4: UnitOfMeasure vocabulary - REQUIRES USER DECISION**

**Problem:**
- Domain consumers expect `UnitOfMeasure` type
- Domain exports `StandardUOM` type (E7 schema-aligned)
- Contract has `UnitOfMeasure` enum but WRONG values (`'PL'` vs `'PLT'`)
- Domain CANNOT import from contracts (architectural boundary)

**Decision needed:**
- **Option A:** Rename `StandardUOM` → `UnitOfMeasure` in domain (align with consumer expectations)
- **Option B:** Update consumers to use `StandardUOM` (align with current domain export)

**Affected:** 9 TS2305 errors

---

### Phase 3: Review-required types (1/14 errors) 🛑 BLOCKED

**Batch M1.5: AddCustodyEventProps - DEFERRED**
- Requires domain pattern review
- May indicate incomplete implementation
- Cannot fix without semantic clarity

**Expected:** TS2305 × 1 remains (acceptable for now)

---

## Success Metrics

**Current:** TS2305: 14 errors (Cluster 1)

**Phase 1 authorized:** TS2305: 14 → 10 (4 errors resolved)
**Phase 2 blocked:** 9 errors (UOM vocabulary decision)
**Phase 3 blocked:** 1 error (AddCustodyEventProps review)

**Measurement after Phase 1:**
```bash
npx tsc -p tsconfig.platform-logistics.json --noEmit --pretty false
```

Record:
- Total diagnostics
- TS2305 count  
- Duration
- New diagnostic types (if any)

**Gates:**
- Architecture Guard (no boundary violations)
- No new TS2589 (deep instantiation)
- Duration remains < 5s

---

## Risk Assessment

### ✅ Authorized - Low Risk (Phase 1: Batches M1.1-M1.3)
- ✅ Import corrections from canonical domain types
- ✅ Type extraction from inline union (DB schema-aligned)
- ✅ No cross-layer dependencies
- ✅ No semantic changes

### 🛑 Blocked - Architectural Risk (Phase 2: Batch M1.4)
- ⚠️ Vocabulary mismatch between layers
- ⚠️ Contract has wrong values (violates E7 schema)
- ⚠️ Naming strategy unclear
- 🛑 STOP condition - requires architectural decision

### 🛑 Blocked - Semantic Risk (Phase 3: Batch M1.5)
- ⚠️ Type doesn't exist
- ⚠️ No canonical pattern evident
- ⚠️ May indicate incomplete implementation
- 🛑 STOP condition - requires domain review

---

## Next Action

**✅ AUTHORIZED: Execute Phase 1 (Batches M1.1-M1.3)**
- M1.1: InventoryMovement import fix
- M1.2: CustodyEvent import fix
- M1.3: LocationStatus type creation

Expected: 4/14 errors resolved (TS2305: 14 → 10)

**🛑 BLOCKED: Phase 2 (Batch M1.4) - UOM Vocabulary**

**User decision required:**

**Question:** Should domain `StandardUOM` be renamed to `UnitOfMeasure` to match consumer expectations?

**Context:**
- Domain `StandardUOM` values are CORRECT (match E7 schema `'PLT'`)
- Contract `UnitOfMeasure` values are WRONG (`'PL'` violates E7 schema)
- Consumers expect name `UnitOfMeasure`
- Domain cannot import from contracts (architectural boundary)

**Option A (Recommended):** Rename `StandardUOM` → `UnitOfMeasure` in domain
- ✅ Aligns with consumer expectations
- ✅ Better semantic name
- ✅ Fixes 9 TS2305 errors
- ⚠️ Requires updating domain types file

**Option B:** Keep `StandardUOM`, update consumers
- ✅ No domain changes
- ❌ All 9 consumers must change
- ❌ Less intuitive name

**🛑 BLOCKED: Phase 3 (Batch M1.5) - AddCustodyEventProps review deferred**

---

**DO NOT:**
- Execute Phase 2 without user decision on UOM naming
- Import from contracts in domain layer
- Create types to silence errors without canonical owner verification

---

**Status:** ✅ DEPENDENCY DIRECTION VERIFIED  
**Remediation:** 🟢 4/14 AUTHORIZED, 🔴 10/14 BLOCKED  
**Risk:** LOW (authorized fixes), HIGH (blocked items require decisions)

**Last Updated:** 2026-09-03
