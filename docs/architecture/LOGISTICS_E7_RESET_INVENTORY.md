# E7 Controlled Rebuild - Reset Inventory

**Date:** 2026-09-03  
**Phase:** ① FREEZE CANONICAL TRUTH + ② RESET INVENTORY  
**Status:** 🟡 AWAITING APPROVAL  
**Next:** ③ CANONICAL → IMPLEMENTATION MAP (after approval)

---

## MISSION STATEMENT

> **"Xác định chính xác cái gì đang có, cái gì canonical, cái gì drift, cái gì được giữ/xóa/rebuild"**

**Protection principle:**
> **"RESET INVENTORY phải đến trước RESET CODE"**

This prevents Controlled Reset from becoming "rewrite theo cảm giác"

---

## ① CANONICAL TRUTH (FROZEN)

### 1.1 E7 DB Schema (CANONICAL - DO NOT MODIFY)

**Source:** `supabase/migrations/20260822_logistics_os_domain_kernel.sql`

**Status:** 🔒 FROZEN (21,962 bytes, 455 lines)

**Canonical tables (6):**

| Table | Purpose | Key Fields | Invariants |
|-------|---------|-----------|-----------|
| **items** | SKU master data | id, tenant_id, sku_code, name, base_uom | • lot/serial/expiry tracking flags<br>• serial_tracked → lot_tracked<br>• standard_cost ≥ 0<br>• RLS: tenant isolation |
| **locations** | Generic location abstraction | id, tenant_id, location_code, location_type | • Hierarchy via parent_location_id<br>• 11 location types<br>• RLS: tenant isolation |
| **inventory** | Balance by item/location | id, tenant_id, item_id, location_id, quantity_on_hand, quantity_reserved | • quantity_available = computed<br>• reserved ≤ on_hand<br>• lot/serial/expiry fields<br>• RLS: tenant isolation |
| **inventory_movements** | Immutable transaction log | id, movement_number, tenant_id, item_id, movement_type, direction, quantity | • IMMUTABLE (no updates)<br>• Positive quantity always<br>• direction: IN/OUT/NEUTRAL<br>• 16 movement types<br>• RLS: tenant isolation |
| **traceability** | Lot/serial tracking, recalls | id, tenant_id, item_id, lot_number, serial_number, custody_events | • Requires lot OR serial<br>• custody_events JSONB array<br>• recall_status tracking<br>• RLS: tenant isolation |
| **uom** | Unit of measure | id, tenant_id, uom_code, uom_name, category | • 6 UOM categories<br>• Conversion support (future)<br>• RLS: tenant isolation |

**Design principles (CANONICAL):**
1. ✅ Separate `logistics` schema (not warehouse-specific)
2. ✅ Zero Warehouse dependencies
3. ✅ Zero Finance dependencies
4. ✅ Products reference OS (Warehouse → Logistics), not reverse
5. ✅ RLS enforces tenant isolation (P0 Gate)
6. ✅ Domain invariants at DB level

**Canonical constraints:**
- 6 tables with RLS enabled
- 40+ indexes for performance
- Audit triggers (except movements - immutable)
- CHECK constraints for data integrity
- Foreign keys within logistics schema only

---

### 1.2 Generated Contract (CANONICAL - REFLECTS DB)

**Source:** `src/shared/database.types.ts`

**Status:** 🔒 FROZEN (generated 2026-09-03, 969 KB)

**Canonical TypeScript contract:**
```typescript
Database['logistics'] = {
  Tables: {
    inventory: { Row, Insert, Update, Relationships }
    inventory_movements: { Row, Insert, Update, Relationships }
    items: { Row, Insert, Update, Relationships }
    locations: { Row, Insert, Update, Relationships }
    traceability: { Row, Insert, Update, Relationships }
    uom: { Row, Insert, Update, Relationships }
  }
  Views: {}
  Functions: {}
  Enums: {}
  CompositeTypes: {}
}
```

**Evidence:** Generated via `supabase gen types --project-id lvnvkpyxtuilhrabtlwv`

---

### 1.3 Architecture Boundaries (CANONICAL)

**Logistics OS boundaries:**

```
Platform Core (shared primitives)
        ↓
Logistics Kernel (E7.1-E7.3)
        ├── E7.1: Domain Kernel (6 tables)
        ├── E7.2: Business Rules
        └── E7.3: Compliance/Traceability
        ↓
Products (Warehouse/Real-Estate/etc)
```

**Canonical dependencies (ALLOWED):**
- ✅ Logistics → Platform Core (tenants, primitives)
- ✅ Logistics → Generated types (Database['logistics'])
- ✅ Products → Logistics (Warehouse uses Item/Location)

**Forbidden dependencies:**
- ❌ Logistics → Warehouse (reverse dependency)
- ❌ Logistics → Finance (accounting concerns)
- ❌ Logistics → Real-Estate (product-specific)
- ❌ Logistics → Any Industry Product

---

### 1.4 Approved Principles (CANONICAL)

**From AGENTS.md:**
1. ✅ Kernel-First, Not Kernel-Perfect
2. ✅ Kernel Is an Asset, Not a Goal
3. ✅ Freeze Good-Enough Kernels
4. ✅ Reuse Before Rebuild
5. ✅ Optimize for Time-to-Industry

**From AI_CODING_CONTRACT.md:**
1. ✅ No Claim Without Evidence
2. ✅ Canonical Truth First
3. ✅ No Bypass, No Shortcuts

**Governance principles:**
1. ✅ G0.5: DB truth → Generated contract → Compiler → Gate
2. ✅ RLS mandatory for all domain tables
3. ✅ Tenant isolation P0 requirement
4. ✅ Migration provenance required

---

## ② CURRENT IMPLEMENTATION STATE

### 2.1 Directory Structure

```
src/platform/logistics/
├── domain/
│   ├── core/
│   │   └── result.ts                           [119 bytes, 2026-08-23]
│   ├── rules/
│   │   ├── rule.composition.ts                 [6,543 bytes, 2026-08-23]
│   │   ├── rule.helpers.ts                     [3,023 bytes, 2026-08-23]
│   │   └── rule.types.ts                       [4,558 bytes, 2026-08-23]
│   └── __tests__/                              [10 test files]
└── (NO OTHER DIRECTORIES)
```

**Total non-test files:** 4
**Total test files:** 15 (9 domain tests + 6 rule tests)

---

### 2.2 Implementation Inventory

#### 2.2.1 Core Utilities

| File | Size | Purpose | Status | Action |
|------|------|---------|--------|--------|
| `domain/core/result.ts` | 119 bytes | Result monad pattern | 🟡 UNKNOWN | INSPECT |

**Evidence needed:**
- Does this match Platform Core Result pattern?
- Is it canonical or drift?
- Used by E7 domain logic?

---

#### 2.2.2 Rule System (E7.3 Compliance)

| File | Size | Purpose | Status | Action |
|------|------|---------|--------|--------|
| `domain/rules/rule.types.ts` | 4,558 bytes | Rule contract types | 🟡 UNKNOWN | INSPECT |
| `domain/rules/rule.helpers.ts` | 3,023 bytes | Rule factory functions | 🟡 UNKNOWN | INSPECT |
| `domain/rules/rule.composition.ts` | 6,543 bytes | Rule composition logic | 🟡 UNKNOWN | INSPECT |

**Exports identified:**
- `Rule<TContext>` interface
- `RuleResult` type (RulePass | RuleViolation)
- `CompositeRuleResult` interface
- `RuleViolationCodes` constants
- Helper functions: `pass()`, `violation()`, `createViolation()`, `createEvidence()`
- Composition functions: `composeRules()`, `evaluateAll()`, `evaluateUntilViolation()`, `createCompositeRule()`

**Evidence needed:**
- Does this align with E7.3 compliance requirements?
- Is it canonical implementation or product-specific?
- Used by domain logic?

---

#### 2.2.3 Domain Layer

| Component | Files | Status | Evidence |
|-----------|-------|--------|----------|
| **Item** | NONE | 🔴 MISSING | No domain/item.ts, no types, no repository |
| **Location** | NONE | 🔴 MISSING | No domain/location.ts, no types, no repository |
| **Inventory** | NONE | 🔴 MISSING | No domain/inventory.ts, no types, no repository |
| **Inventory Movement** | NONE | 🔴 MISSING | No domain/movement.ts, no types, no repository |
| **Traceability** | NONE | 🔴 MISSING | No domain/traceability.ts, no types, no repository |
| **UOM** | NONE | 🔴 MISSING | No domain/uom.ts, no types, no repository |

**Gap analysis:**
- ❌ No domain entities/value objects
- ❌ No domain types (beyond Database['logistics'])
- ❌ No domain services
- ❌ No repositories
- ❌ No API layer
- ❌ No routes

**BUT:** ✅ 15 comprehensive test files exist

---

#### 2.2.4 Test Infrastructure

| Category | Files | Status | Evidence |
|----------|-------|--------|----------|
| **Domain tests** | 10 files | 🟢 EXISTS | Tests exist without implementation |
| **Rule tests** | 5 files | 🟢 EXISTS | Tests for rule system |

**Test files (domain):**
1. `inventory-coordination.test.ts`
2. `inventory-operations.test.ts`
3. `inventory.domain.test.ts`
4. `item.domain.test.ts`
5. `location-operations.test.ts`
6. `location.domain.test.ts`
7. `movement.domain.test.ts`
8. `operational-invariants.test.ts`
9. `traceability.domain.test.ts`
10. `uom.domain.test.ts`

**Test files (rules):**
1. `compliance-evaluation.test.ts`
2. `generic-rules.test.ts`
3. `rule-composition.test.ts`
4. `rule-contract.test.ts`
5. `traceability-operations.test.ts`

**Observation:** Tests written BEFORE implementation (TDD approach)

---

### 2.3 What Was Deleted (Previous Reset)

**From LOGISTICS_CONTROLLED_RESET_COMPLETE.md:**

**Deleted structure (44+ files, 8 directories):**
```
src/platform/logistics/
├── api/                    [DELETED]
├── contracts/              [DELETED]
├── engines/                [DELETED]
├── repositories/           [DELETED]
├── services/               [DELETED]
├── types/                  [DELETED]
├── utils/                  [DELETED]
└── index.ts                [DELETED]
```

**Preserved structure:**
```
src/platform/logistics/
├── domain/
│   ├── core/               [KEPT - 1 file]
│   ├── rules/              [KEPT - 3 files]
│   └── __tests__/          [KEPT - 15 files]
```

**Rationale:** Previous reset removed 609-diagnostic drift, preserved tests + rule primitives

---

## ③ CANONICAL → IMPLEMENTATION MAP

### 3.1 E7 Domain Components (Canonical)

**From E7 migration:**

| Canonical Component | DB Table | TypeScript Types | Domain Entity | Repository | Service | API | Tests |
|-------------------|----------|-----------------|---------------|------------|---------|-----|-------|
| **Item** | ✅ items | ✅ Database['logistics']['Tables']['items'] | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Location** | ✅ locations | ✅ Database['logistics']['Tables']['locations'] | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Inventory** | ✅ inventory | ✅ Database['logistics']['Tables']['inventory'] | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Movement** | ✅ inventory_movements | ✅ Database['logistics']['Tables']['inventory_movements'] | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Traceability** | ✅ traceability | ✅ Database['logistics']['Tables']['traceability'] | ❌ | ❌ | ❌ | ❌ | ✅ |
| **UOM** | ✅ uom | ✅ Database['logistics']['Tables']['uom'] | ❌ | ❌ | ❌ | ❌ | ✅ |

**Summary:**
- ✅ DB layer: COMPLETE (6 tables, RLS, indexes, triggers)
- ✅ Contract layer: COMPLETE (Database['logistics'] generated)
- ✅ Test layer: COMPLETE (15 comprehensive tests)
- ❌ Domain layer: MISSING (no entities, no repositories, no services)
- ❌ API layer: MISSING (no routes, no controllers)

---

### 3.2 E7.3 Rule System (Partial Implementation)

| Component | Status | Evidence |
|-----------|--------|----------|
| Rule types | 🟡 EXISTS | `rule.types.ts` - 4.5 KB |
| Rule helpers | 🟡 EXISTS | `rule.helpers.ts` - 3 KB |
| Rule composition | 🟡 EXISTS | `rule.composition.ts` - 6.5 KB |
| Rule tests | ✅ EXISTS | 5 test files |
| Rule integration | ❌ MISSING | No domain entity usage |

**Gap:** Rules exist but NOT integrated with domain entities

---

### 3.3 Dependency Map

**Current dependencies:**

```
database.types.ts (canonical)
        ↓
??? (NO DOMAIN LAYER)
        ↓
rule.types.ts (isolated)
        ↓
__tests__/ (comprehensive but no implementation)
```

**Expected dependencies:**

```
database.types.ts (canonical)
        ↓
Domain entities (Item, Location, Inventory, Movement, Traceability, UOM)
        ↓
Repositories (data access)
        ↓
Services (business logic)
        ↓
API layer (routes/controllers)
        ↓
Products (Warehouse uses Logistics)
```

**Gap:** Entire domain → service → API stack missing

---

## ④ DRIFT ANALYSIS

### 4.1 Classification

| Component | Canonical? | Current State | Drift? | Reason |
|-----------|-----------|---------------|--------|--------|
| **DB schema** | 🟢 YES | EXISTS | ✅ NO DRIFT | Migration applied, RLS enabled |
| **Generated types** | 🟢 YES | EXISTS | ✅ NO DRIFT | Generated 2026-09-03, reflects DB |
| **Tests** | 🟡 PARTIAL | EXISTS | ⚠️ ORPHANED | Tests without implementation |
| **Rule system** | 🟡 UNKNOWN | EXISTS | ⚠️ ISOLATED | Not integrated with domain |
| **Result monad** | 🟡 UNKNOWN | EXISTS | ⚠️ UNKNOWN | Need Platform Core comparison |
| **Domain entities** | 🔴 MISSING | NONE | 🔴 GAP | Entire layer missing |
| **Repositories** | 🔴 MISSING | NONE | 🔴 GAP | Entire layer missing |
| **Services** | 🔴 MISSING | NONE | 🔴 GAP | Entire layer missing |
| **API layer** | 🔴 MISSING | NONE | 🔴 GAP | Entire layer missing |

---

### 4.2 Evidence-Based Assessment

#### 4.2.1 KEEP (With Evidence)

**Database schema:**
- ✅ Evidence: Dashboard query shows 6 tables, RLS enabled
- ✅ Evidence: Migration 20260822000000 recorded
- ✅ Reason: Canonical truth, production data
- ✅ Action: **KEEP - DO NOT MODIFY**

**Generated types:**
- ✅ Evidence: File size 969 KB, logistics schema present
- ✅ Evidence: G0.5 typecheck PASS (2.7s)
- ✅ Reason: Reflects DB canonical state
- ✅ Action: **KEEP - REGENERATE ONLY IF DB CHANGES**

**Test files:**
- ✅ Evidence: 15 comprehensive test files
- ✅ Evidence: Tests align with E7 domain model
- ✅ Reason: Valuable specification of expected behavior
- ✅ Action: **KEEP - UPDATE WHEN IMPLEMENTATION EXISTS**

---

#### 4.2.2 INSPECT (Need Investigation)

**Rule system (3 files):**
- ⚠️ Question: Does this conform to Platform Core patterns?
- ⚠️ Question: Is this E7.3 canonical implementation?
- ⚠️ Question: Should this be generic (Platform Core) vs E7-specific?
- ⚠️ Action: **INSPECT - DEFER DECISION**

**Result monad:**
- ⚠️ Question: Duplicate of Platform Core Result?
- ⚠️ Question: 119 bytes suggests minimal implementation
- ⚠️ Action: **INSPECT - COMPARE WITH PLATFORM CORE**

---

#### 4.2.3 MISSING (Need Building)

**6 E7 Domain components:**
- 🔴 Item domain entity/types
- 🔴 Location domain entity/types
- 🔴 Inventory domain entity/types
- 🔴 Movement domain entity/types
- 🔴 Traceability domain entity/types
- 🔴 UOM domain entity/types

**Infrastructure:**
- 🔴 Repositories (6 components)
- 🔴 Services (business logic)
- 🔴 API routes/controllers

**Total gap:** ~20-30 files needed

---

## ⑤ RESET PLAN (PROPOSED)

### 5.1 Phase Classification

#### Phase 1: INSPECT (Before Any Reset)

**Goal:** Understand rule system + result monad before decisions

**Tasks:**
1. ✅ Compare `domain/core/result.ts` with Platform Core Result
2. ✅ Analyze rule system design (types → helpers → composition)
3. ✅ Check if rule system is E7-specific or should be Platform Core
4. ✅ Review test expectations for canonical behavior
5. ✅ Document findings

**Output:** INSPECT_REPORT.md with KEEP/RESET/REFACTOR decisions

**Duration:** 1-2 hours investigation

**NO CODE CHANGES IN THIS PHASE**

---

#### Phase 2: TARGETED RESET (If Needed)

**Conditions for RESET:**
- Rule system is drift (not canonical)
- Result monad duplicates Platform Core
- Any files violate Architecture Guard

**Conditions for KEEP:**
- Rule system conforms to canonical E7.3
- Result monad is E7-specific extension
- Tests validate canonical behavior

**Decision:** PENDING Phase 1 inspection results

---

#### Phase 3: REBUILD FROM CANONICAL

**Goal:** Implement E7 domain layer from canonical schema

**Build order (dependency-driven):**

```
1. Domain Types (from Database['logistics'])
        ↓
2. Domain Entities (Item, Location, Inventory, Movement, Traceability, UOM)
        ↓
3. Domain Services (business logic, invariant enforcement)
        ↓
4. Repositories (data access, Supabase integration)
        ↓
5. Integration (rule system + domain entities)
        ↓
6. API Layer (routes, controllers, DTOs)
        ↓
7. Tests Update (connect to implementation)
```

**Principles:**
- Build incrementally (1 component at a time)
- G0.5 typecheck after each component
- Tests pass before next component
- No architectural drift

---

### 5.2 Approval Gates

**Phase 1 → Phase 2:**
- [ ] INSPECT_REPORT.md reviewed
- [ ] Rule system classification: KEEP/RESET/REFACTOR
- [ ] Result monad classification: KEEP/RESET/USE_PLATFORM
- [ ] User approval: PENDING

**Phase 2 → Phase 3:**
- [ ] Reset complete (if needed)
- [ ] G0.5 typecheck PASS
- [ ] Architecture Guard PASS
- [ ] User approval: PENDING

**Phase 3 completion:**
- [ ] All 6 domain components implemented
- [ ] All 15 tests passing
- [ ] G0.5 typecheck PASS
- [ ] Architecture Guard PASS
- [ ] Runtime verification PASS
- [ ] User approval: PENDING

---

## ⑥ RISK ASSESSMENT

### 6.1 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Rule system is drift** | MEDIUM | HIGH | Inspect first, compare with canonical, decide with evidence |
| **Tests expect non-canonical behavior** | LOW | MEDIUM | Tests align with E7 schema, likely canonical |
| **Rebuild introduces new drift** | LOW | HIGH | Follow canonical schema strictly, G0.5 gates |
| **Missing E7 capabilities** | LOW | LOW | E7 schema is frozen baseline, extension later |

### 6.2 Protection Mechanisms

1. ✅ **INSPECT before RESET** - No guessing
2. ✅ **Evidence-based decisions** - No assumptions
3. ✅ **Incremental rebuild** - Component by component
4. ✅ **G0.5 after each step** - Continuous verification
5. ✅ **Tests as specification** - Expected behavior documented
6. ✅ **User approval gates** - No autonomous architectural decisions

---

## ⑦ DEPENDENCIES & BLOCKERS

### 7.1 Dependencies

**Must have before rebuild:**
- ✅ E7 DB schema (COMPLETE)
- ✅ Generated types (COMPLETE)
- ✅ G0.5 typecheck (PASSING)
- ✅ Test specifications (COMPLETE)

**Need for rebuild:**
- ⚠️ Platform Core patterns (for consistency)
- ⚠️ Repository pattern guidance
- ⚠️ Service layer pattern guidance
- ⚠️ API layer pattern guidance

### 7.2 Current Blockers

**NONE** - Ready for Phase 1 (INSPECT)

---

## ⑧ SUCCESS CRITERIA

### 8.1 Inventory Phase Success

- ✅ Canonical truth frozen (this document)
- ✅ Current implementation inventoried (this document)
- ✅ Drift analysis complete (this document)
- ✅ Reset plan proposed (this document)
- [ ] User approval received: **PENDING**

### 8.2 Reset Phase Success (If Applicable)

- [ ] Drift removed (evidence-based)
- [ ] G0.5 typecheck PASS
- [ ] Architecture Guard PASS
- [ ] No regressions introduced
- [ ] User approval: PENDING

### 8.3 Rebuild Phase Success

- [ ] 6 domain components implemented
- [ ] All canonical from E7 schema
- [ ] All 15 tests passing
- [ ] G0.5 typecheck PASS
- [ ] Architecture Guard PASS
- [ ] Runtime verification PASS
- [ ] Zero architectural drift
- [ ] User approval: PENDING

---

## ⑨ NEXT STEPS

### Immediate Action: WAIT FOR APPROVAL

**This inventory is COMPLETE and AWAITING USER REVIEW.**

**User must approve:**
1. ✅ Canonical truth freeze
2. ✅ Implementation inventory accuracy
3. ✅ Drift analysis
4. ✅ Proposed reset plan

**After approval, agent may proceed to:**
1. Phase 1: INSPECT (rule system + result monad)
2. Phase 2: TARGETED RESET (if needed)
3. Phase 3: REBUILD FROM CANONICAL

**Until approval:**
- ❌ NO code modifications
- ❌ NO file deletions
- ❌ NO architectural decisions
- ✅ ONLY answer clarifying questions

---

## ⑩ APPENDICES

### A. File Inventory (Complete)

**Non-test files (4):**
1. `src/platform/logistics/domain/core/result.ts` - 119 bytes
2. `src/platform/logistics/domain/rules/rule.types.ts` - 4,558 bytes
3. `src/platform/logistics/domain/rules/rule.helpers.ts` - 3,023 bytes
4. `src/platform/logistics/domain/rules/rule.composition.ts` - 6,543 bytes

**Test files (15):**
1. `domain/__tests__/inventory-coordination.test.ts`
2. `domain/__tests__/inventory-operations.test.ts`
3. `domain/__tests__/inventory.domain.test.ts`
4. `domain/__tests__/item.domain.test.ts`
5. `domain/__tests__/location-operations.test.ts`
6. `domain/__tests__/location.domain.test.ts`
7. `domain/__tests__/movement.domain.test.ts`
8. `domain/__tests__/operational-invariants.test.ts`
9. `domain/__tests__/traceability.domain.test.ts`
10. `domain/__tests__/uom.domain.test.ts`
11. `domain/rules/__tests__/compliance-evaluation.test.ts`
12. `domain/rules/__tests__/generic-rules.test.ts`
13. `domain/rules/__tests__/rule-composition.test.ts`
14. `domain/rules/__tests__/rule-contract.test.ts`
15. `domain/rules/__tests__/traceability-operations.test.ts`

**Total:** 19 files (4 implementation + 15 tests)

---

### B. Canonical Sources

1. **E7 migration:** `supabase/migrations/20260822_logistics_os_domain_kernel.sql`
2. **Generated types:** `src/shared/database.types.ts` (logistics schema)
3. **Architecture rules:** `AGENTS.md`, `AI_CODING_CONTRACT.md`
4. **Governance gates:** G0.5, Architecture Guard
5. **Test specifications:** 15 test files in `domain/__tests__/`

---

### C. Evidence Documents

1. `LOGISTICS_E7_CHECKPOINT_G05_GREEN.md` - G0.5 PASS evidence
2. `LOGISTICS_E7_TYPES_GENERATED.md` - Type generation success
3. `LOGISTICS_E7_SESSION_CLOSURE.md` - Session closure
4. `LOGISTICS_CONTROLLED_RESET_COMPLETE.md` - Previous reset (609 diagnostics → 0)

---

**Document status:** 🟡 COMPLETE - AWAITING APPROVAL  
**Created:** 2026-09-03  
**Agent:** Kiro  
**Approval required from:** User  
**Next phase:** Phase 1 INSPECT (after approval)
