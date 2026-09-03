# Logistics G0.5: Canonical Truth Gate

**Date:** 2026-09-03  
**Status:** 🔴 BLOCKED  
**Purpose:** Verify E7 canonical implementation surface before reset authorization

---

## G0.5 VERDICT: 🔴 BLOCKED

**Canonical Schema:** ✅ VERIFIED  
**Generated Types:** 🔴 BLOCKED (E6 only, missing E7)  
**Vocabulary Alignment:** 🔴 BLOCKED (Contract drift from E7)  
**Type Ownership:** ⚠️ REVIEW (cross-platform pattern)  
**Dependency Direction:** ✅ PASS (inherited from G0)

**Reset Authorization:** ❌ CANNOT GRANT

**Reason:** Canonical implementation surface incomplete/inconsistent. Must reconcile before reset.

---

## G0.5.1: E7 Schema Verification ✅ VERIFIED

### Canonical Source

**File:** `migrations/logistics/20260822_logistics_os_domain_kernel.sql`  
**Size:** 455 lines  
**Date:** 2026-08-22 (newest Logistics migration)

### E7 Tables (Canonical)

| Table | Purpose | Status |
|-------|---------|--------|
| `logistics.items` | SKU/item master data | ✅ Defined |
| `logistics.locations` | Location abstraction | ✅ Defined |
| `logistics.inventory` | Inventory balances | ✅ Defined |
| `logistics.inventory_movements` | Transaction log | ✅ Defined |
| `logistics.traceability` | Lot/serial tracking | ✅ Defined |
| `logistics.uom` | Unit of measure master | ✅ Defined |

### E7 Canonical Vocabulary

**UnitOfMeasure (from schema):**
```sql
base_uom TEXT NOT NULL DEFAULT 'EA',
  CHECK (base_uom IN ('EA', 'CS', 'PLT', 'KG', 'G', 'LB', 'OZ', 
                      'L', 'ML', 'GAL', 'QT', 'M', 'CM', 'MM', 
                      'FT', 'IN', 'SQM', 'SQFT', 'HR', 'DAY', 'WK'))
```

**Key finding:** ✅ E7 schema defines **'PLT'** as canonical PALLET value

**G0.5.1 Verdict:** ✅ PASS - E7 schema is canonical source

---

## G0.5.2: Generated Types Verification 🔴 BLOCKED

### Current State

**File:** `src/types/database.types.ts`

**Current content:**
```typescript
Database['logistics'] = {
  // E6 Warehouse tables (Product layer)
  logistics_warehouse_bins: { ... }
  logistics_warehouse_inventory_on_hand: { ... }
  logistics_warehouse_movements: { ... }
  logistics_warehouse_receipt_line_items: { ... }
  logistics_warehouse_receipts: { ... }
  logistics_warehouse_skus: { ... }
  logistics_warehouse_vendors: { ... }
  
  // ❌ MISSING: E7 canonical tables
  // items: { ... }
  // locations: { ... }
  // inventory: { ... }
  // inventory_movements: { ... }
  // traceability: { ... }
  // uom: { ... }
}
```

### Problem

**E7 migrations exist, but generated types don't reflect them.**

**Root causes (from P0/R0 analysis):**
1. No established type generation mechanism
2. No `supabase:gen-types` script in package.json
3. Supabase CLI timeout (may not be installed/configured)
4. Database may not have E7 tables applied (migration state unknown)

### What's Missing

**For E7 rebuild, generated types MUST contain:**
```typescript
Database['logistics']['Tables'] = {
  items: {
    Row: { id: string, tenant_id: string, sku_code: string, ... }
    Insert: { ... }
    Update: { ... }
  },
  locations: { ... },
  inventory: { ... },
  inventory_movements: { ... },
  traceability: { ... },
  uom: { ... }
}
```

### G0.5.2 Verdict: 🔴 BLOCKED

**Cannot rebuild E7 implementation without generated types reflecting E7 schema.**

**Required action:**
1. Establish canonical type generation mechanism (P0 identified this blocker)
2. Verify E7 migrations applied to database
3. Regenerate `database.types.ts` with E7 tables
4. Verify `Database['logistics']` contains 6 E7 tables

**DO NOT:**
- ❌ Manually create fake types
- ❌ Use `any` or unsafe casts
- ❌ Weaken tsconfig
- ❌ Proceed with reset without generated types

---

## G0.5.3: Vocabulary Alignment 🔴 BLOCKED

### UnitOfMeasure Definitions (Current State)

**THREE conflicting definitions found:**

#### 1. E7 Schema (CANONICAL)
```sql
-- migrations/logistics/20260822_logistics_os_domain_kernel.sql
CHECK (base_uom IN ('EA', 'CS', 'PLT', ...))
```
**PALLET value:** `'PLT'` ✅ **CANONICAL**

#### 2. Domain Types (E7-aligned)
```typescript
// src/platform/logistics/domain/uom.types.ts
export type StandardUOM =
  | 'EA' | 'CS' | 'PLT'  // Quantity
  | ...
```
**PALLET value:** `'PLT'` ✅ **Consistent with E7**

```typescript
// src/platform/logistics/domain/item.types.ts
export type UnitOfMeasure =
  | 'EA' | 'CS' | 'PLT'
  | ...
```
**PALLET value:** `'PLT'` ✅ **Consistent with E7**

#### 3. Contract Enum (STALE ARTIFACT)
```typescript
// src/platform/logistics/contracts/item.contract.ts
export enum UnitOfMeasure {
  EACH = 'EA',
  CASE = 'CS',
  PALLET = 'PL',  // ❌ WRONG - Should be 'PLT'
  ...
}
```
**PALLET value:** `'PL'` ❌ **Inconsistent with E7**

**R0 Evidence:** Contract `UnitOfMeasure` has **ZERO consumers** outside Logistics

### Vocabulary Reconciliation Matrix

| Source | Type | PALLET | Canonical? | Consumers | Action |
|--------|------|--------|------------|-----------|--------|
| **E7 Schema** | SQL | `'PLT'` | ✅ YES | Database | **PRESERVE** |
| **Domain** | Type | `'PLT'` | ✅ Aligned | Domain logic | **PRESERVE** |
| **Contract** | Enum | `'PL'` | ❌ Drift | **ZERO** | **REPLACE** |

### G0.5.3 Verdict: 🔴 BLOCKED

**Contract vocabulary drifted from E7 canonical schema.**

**Required action:**
1. Acknowledge E7 schema as canonical vocabulary source
2. Delete stale Contract `UnitOfMeasure` enum during reset
3. Rebuild contracts aligned with E7 vocabulary (`'PLT'` not `'PL'`)
4. Ensure domain types remain aligned with E7 schema

**DO NOT:**
- ❌ Change E7 schema to match old contract
- ❌ Change domain types to match old contract
- ❌ Create vocabulary mapping/alias layer
- ❌ Blindly rename `PL → PLT` without canonical evidence

**Canonical principle:**
> **E7 schema is truth. Contracts must align with schema, not vice versa.**

---

## G0.5.4: Type Ownership ⚠️ REVIEW

### EngineResponse Pattern (Cross-Platform Issue)

**Status:** ⚠️ NOTED FOR CROSS-PLATFORM GOVERNANCE

**Evidence:**
```
Healthcare:  EngineResponse<T>         (healthcare/shared-kernel/types.ts)
Finance:     FinanceEngineResponse<T>  (finance/shared-kernel/types.ts)
Logistics:   EngineResponse<T>         (logistics/shared-kernel/types.ts)
```

**This is NOT a Logistics-specific error or blocker.**

**G0.5 Classification:**
- Logistics `EngineResponse` has ZERO external consumers (R0 verified)
- Logistics can rebuild with own response type
- Pattern collision requires **separate cross-platform governance decision**

**G0.5 Action:**
- ⚠️ Note for cross-platform review (not blocking Logistics reset)
- ✅ Logistics can proceed with its own engine response pattern
- ❌ **DO NOT modify Healthcare/Finance to fix Logistics**

---

### UnitOfMeasure Ownership (Resolved)

**Ownership matrix:**

| Artifact | Owner | Type | Canonical Source | Action |
|----------|-------|------|------------------|--------|
| E7 Schema `base_uom` | Logistics OS | SQL constraint | ✅ Schema | PRESERVE |
| Domain `StandardUOM` | Logistics OS | TypeScript type | E7 schema | PRESERVE |
| Domain `UnitOfMeasure` (item.types) | Logistics OS | TypeScript type | E7 schema | PRESERVE |
| Contract `UnitOfMeasure` enum | Logistics OS | TypeScript enum | ❌ Stale | REPLACE |

**Conclusion:** E7 schema owns canonical vocabulary. Contracts must align.

---

## G0.5.5: Dependency Direction ✅ PASS

**Inherited from G0 Architecture Guard:**
- ✅ No reverse imports to Platform Core
- ✅ No imports to Product layer
- ✅ No Domain → Contract violations

**G0.5 confirms:** Dependency direction will remain valid after reset

---

## G0.5.6: Scope Boundaries ⚠️ NOTED

### E3 Freight Audit

**Status:** Outside E7 reset scope (ownership unclear)

**G0 Classification:** ⚠️ REVIEW  
**G0.5 Action:** ✅ Confirmed OUT OF SCOPE for E7 reset

**Recommendation:** Do NOT rebuild E3 during E7 reset unless ownership proven

---

### Shipment/Route

**Status:** Outside E7 canonical schema

**Evidence:**
- E7 schema does NOT define `shipments` or `routes` tables
- `log_shipments`, `log_tracking_events` are pre-E7 (not in E7 migration)
- E7 Construction Plan does NOT list Shipment/Route as core primitives

**G0 Classification:** ⚠️ REVIEW  
**G0.5 Action:** ✅ Confirmed OUT OF SCOPE for E7 reset

**Recommendation:** Do NOT rebuild Shipment/Route during E7 reset unless ownership proven

---

## G0.5 FINAL VERDICT: 🔴 BLOCKED

### Blockers

| Check | Status | Blocker | Impact |
|-------|--------|---------|--------|
| **E7 Schema** | ✅ PASS | None | Can proceed |
| **Generated Types** | 🔴 BLOCKED | E7 tables missing from `database.types.ts` | **CANNOT rebuild without types** |
| **Vocabulary** | 🔴 BLOCKED | Contract drift from E7 (`'PL'` vs `'PLT'`) | **Must reconcile before rebuild** |
| **Type Ownership** | ⚠️ REVIEW | `EngineResponse` cross-platform | Non-blocking (note for governance) |
| **Dependency** | ✅ PASS | None | Can proceed |
| **Scope** | ⚠️ NOTED | E3/Shipment/Route out of scope | Non-blocking (exclude from rebuild) |

### Reset Authorization Status

**❌ CANNOT GRANT RESET AUTHORIZATION**

**Reasons:**
1. 🔴 **Critical:** Generated types don't reflect E7 schema (cannot rebuild repositories without types)
2. 🔴 **Critical:** Contract vocabulary drifted from canonical E7 schema (must reconcile)

---

## Required Actions Before Reset

### Action 1: Establish Type Generation (**P0 Priority**)

**Problem:** No reliable mechanism to generate `database.types.ts` from E7 schema

**Required:**
1. Establish Supabase type generation tooling
2. Verify E7 migrations applied to database
3. Generate types with `Database['logistics']` containing E7 tables
4. Verify generated types match E7 schema

**Success criteria:**
```typescript
// database.types.ts MUST contain:
Database['logistics']['Tables'] = {
  items: { Row, Insert, Update },
  locations: { Row, Insert, Update },
  inventory: { Row, Insert, Update },
  inventory_movements: { Row, Insert, Update },
  traceability: { Row, Insert, Update },
  uom: { Row, Insert, Update }
}
```

**DO NOT proceed with reset until this is resolved.**

---

### Action 2: Vocabulary Reconciliation

**Problem:** Contract `UnitOfMeasure` uses `'PL'`, E7 schema uses `'PLT'`

**Decision:**
- ✅ E7 schema is canonical truth (`'PLT'`)
- ✅ Domain types already aligned with E7
- ❌ Contract enum is stale artifact (ZERO consumers)

**Action during reset:**
1. Delete stale Contract `UnitOfMeasure` enum
2. Rebuild contracts aligned with E7 vocabulary
3. Use `'PLT'` for PALLET (not `'PL'`)
4. Verify domain types remain E7-aligned

**Success criteria:**
- Contract vocabulary matches E7 schema
- Domain vocabulary matches E7 schema
- No vocabulary mapping/alias layers

---

## G0.5 Recommendations

### For Reset Execution (When Unblocked)

**1. E7 Canonical Scope (REBUILD):**
- ✅ Items (master data)
- ✅ Locations (generic abstraction)
- ✅ Inventory (balances)
- ✅ Inventory Movements (transactions)
- ✅ Traceability (lot/serial/custody)
- ✅ UOM (measurement standards)

**2. E6 Warehouse (DELETE/LEGACY):**
- ❌ Do NOT rebuild E6 warehouse implementation
- ✅ Mark E6 as Product layer legacy
- ✅ Preserve E6 schema as historical evidence

**3. E3 Freight Audit (EXCLUDE):**
- ❌ Do NOT rebuild during E7 reset
- ⏸️ Requires separate ownership verification

**4. Shipment/Route (EXCLUDE):**
- ❌ Do NOT rebuild during E7 reset
- ⏸️ Requires separate ownership verification
- ⏸️ Not in E7 canonical schema

---

## Summary

**G0.5 Status:** 🔴 BLOCKED

**Critical blockers:**
1. Generated types missing E7 tables
2. Contract vocabulary drift from E7 schema

**Non-blocking notes:**
- EngineResponse pattern (cross-platform governance)
- E3/Shipment/Route scope (exclude from E7 reset)

**Reset cannot proceed until:**
- ✅ Generated types reflect E7 schema
- ✅ Vocabulary aligned with E7 canonical source

**Next steps:**
1. Resolve type generation blocker
2. Reconcile vocabulary (E7 schema is truth)
3. Re-run G0.5
4. If GREEN → Grant reset authorization

---

**Last Updated:** 2026-09-03  
**Status:** 🔴 BLOCKED  
**Authorization:** ❌ RESET NOT AUTHORIZED  
**Next:** Resolve blockers → Re-run G0.5
