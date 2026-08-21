# Bella Runtime Migration 05-A — Identity Reconciliation

**Date:** 2026-08-19  
**Phase:** Identity Reconciliation (before type migration)  
**Status:** 🔴 DESIGN PHASE  
**Blocker:** Phase 3C Security Gate  

---

## Executive Summary

**Purpose:** Reconcile Runtime TEXT tenant identifiers with canonical Core UUID tenant identity

**Context:** RCA #6 discovered architectural boundary inconsistency
- Core: `tenant_id UUID`
- Runtime: `tenant_id TEXT`
- Cannot ALTER COLUMN before identity mapping validated

**Scope:** Migration 05-A reconciles identity, does NOT change schema types

---

## Canonical Identity Law (Approved)

**Decision:** `tenant_id` is UUID throughout Bella platform

**Law:**
> Canonical tenant identity is UUID. Runtime does not own independent tenant identity. All Runtime tenant references must derive from Core `public.tenants.id`.

**Identity Chain:**
```
auth.users.id (UUID)
    ↓
public.users.tenant_id (UUID)
    ↓
public.tenants.id (UUID)  ← CANONICAL SOURCE OF TRUTH
    ↓
get_auth_tenant_id() (UUID)
    ↓
Runtime tenant_id (currently TEXT) ← MUST ALIGN
```

---

## Migration 05 Architecture

**3-Phase Strategy:**

### Phase 05-A: Identity Reconciliation ⏳ THIS PHASE
- Map existing Runtime TEXT → Core UUID
- Classify all tenant records
- NO schema changes
- Gate: ZERO unresolved mappings

### Phase 05-B: Cleanup / Backfill
- Resolve orphan/test fixtures
- Backfill missing Core references
- Prepare data for type migration

### Phase 05-C: Type Migration
- ALTER COLUMN TEXT → UUID
- Recreate indexes, constraints, policies
- Update JWT contract

**Critical Rule:** Cannot proceed to 05-B until 05-A complete. Cannot proceed to 05-C until 05-B complete.

---

## Current Runtime Data (Audit Results)

**Runtime Tenant Registry:**
| TEXT ID | Tenant Name | Core UUID | Classification |
|---------|-------------|-----------|----------------|
| `test-quarantine-tenant-a` | null | NULL | ⏳ PENDING |
| `test-quarantine-tenant-b` | null | NULL | ⏳ PENDING |
| `test-e2e-tenant-a` | E2E Test Tenant A | NULL | ⏳ PENDING |
| `test-e2e-tenant-b` | E2E Test Tenant B | NULL | ⏳ PENDING |
| `test-e2e-tenant-attacker` | E2E Test Attacker | NULL | ⏳ PENDING |

**Child Tables:**
- `runtime_outbox`: 0 records ✅
- `runtime_idempotency_registry`: 0 records ✅
- `runtime_audit_log`: 0 records ✅
- `runtime_quarantine`: 0 records ✅

**Risk Assessment:**
- Production data: NONE ✅
- Data loss risk: ZERO ✅
- Referential integrity: No child records ✅

---

## Classification Framework

### Classification Categories

**VALID_MAPPING**
- Runtime TEXT identifier maps to Core UUID tenant
- Mapping is unambiguous (1:1)
- Core tenant exists and is active

**TEST_FIXTURE**
- Runtime TEXT identifier is test artifact
- No corresponding Core tenant intended
- Created for test/dev purposes only

**ORPHAN**
- Runtime TEXT identifier has no Core mapping
- May have been valid but Core tenant deleted
- Requires investigation/reconciliation

**UNKNOWN**
- Mapping ambiguous (multiple Core matches)
- Cannot determine canonical Core UUID
- **BLOCKING** (must resolve before 05-B)

**DUPLICATE**
- Multiple Runtime TEXT → same Core UUID
- Data quality issue
- **BLOCKING** (must resolve before 05-B)

---

## Classification Process

### Step 1: Attempt Automatic Mapping

**Query:**
```sql
-- Attempt to map Runtime TEXT → Core UUID
SELECT 
  rt.tenant_id AS runtime_text_id,
  rt.tenant_name AS runtime_name,
  ct.id AS core_uuid,
  ct.name AS core_name,
  CASE
    WHEN ct.id IS NULL THEN 'ORPHAN'
    WHEN COUNT(*) OVER (PARTITION BY rt.tenant_id) > 1 THEN 'DUPLICATE'
    WHEN rt.tenant_id LIKE 'test-%' THEN 'TEST_FIXTURE'
    ELSE 'VALID_MAPPING'
  END AS classification
FROM runtime_tenant_registry rt
LEFT JOIN public.tenants ct 
  ON ct.id::text = rt.tenant_id  -- Attempt UUID cast
  OR ct.name = rt.tenant_name    -- Attempt name match
  OR ct.slug = rt.tenant_id      -- Attempt slug match (if exists)
ORDER BY classification, rt.tenant_id;
```

**Expected Result (Current Data):**
All 5 records → `TEST_FIXTURE` or `ORPHAN` (no Core mapping)

---

### Step 2: Manual Review

**For each UNKNOWN or ambiguous record:**
1. Review tenant creation context
2. Check Core tenant history
3. Consult application logs
4. Make classification decision

**For TEST_FIXTURE:**
1. Determine if still needed for E2E tests
2. If needed: create real Core tenant → VALID_MAPPING
3. If not needed: mark for deletion → proceed to 05-B cleanup

---

### Step 3: Classification Report

**Output:** `migration_05a_classification_report.json`

```json
{
  "migration": "05-A Identity Reconciliation",
  "date": "2026-08-19",
  "total_runtime_tenants": 5,
  "classification": {
    "VALID_MAPPING": 0,
    "TEST_FIXTURE": 5,
    "ORPHAN": 0,
    "UNKNOWN": 0,
    "DUPLICATE": 0
  },
  "mappings": [
    {
      "runtime_text_id": "test-e2e-tenant-a",
      "classification": "TEST_FIXTURE",
      "core_uuid": null,
      "action": "CREATE_CORE_TENANT_OR_DELETE",
      "notes": "E2E fixture for Phase 3C security gate"
    }
  ],
  "gate_status": {
    "unknown_count": 0,
    "duplicate_count": 0,
    "ready_for_05b": true
  }
}
```

---

## Migration 05-A Gate Requirements

**MUST be ZERO before proceeding to 05-B:**
- ✅ `UNKNOWN` records = 0
- ✅ `DUPLICATE` records = 0
- ✅ Unresolved mappings = 0

**MUST be documented:**
- ✅ All `TEST_FIXTURE` decisions (delete or convert)
- ✅ All `ORPHAN` resolutions
- ✅ All `VALID_MAPPING` verified

---

## Invariant Verification

**Pre-Migration Invariant:**
```
Runtime tenant_id values ⊆ (Core public.tenants.id OR documented_test_fixtures)
```

**Post-05-B Invariant:**
```
Runtime tenant_id values ⊆ Core public.tenants.id
```

**Post-05-C Invariant:**
```
∀ t ∈ runtime_tenant_registry : 
  ∃ ct ∈ public.tenants : t.tenant_id = ct.id
```

**Verification Query:**
```sql
-- Check no orphan Runtime tenants
SELECT rt.tenant_id
FROM runtime_tenant_registry rt
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants ct
  WHERE ct.id = rt.tenant_id
);

-- Expected: 0 rows after 05-B
```

---

## NOT AUTHORIZED in Phase 05-A

**DO NOT:**
- ❌ ALTER COLUMN types
- ❌ Generate fake UUIDs
- ❌ Delete tenant records without approval
- ❌ Modify Core `public.tenants`
- ❌ Modify Runtime schema
- ❌ Execute type migration
- ❌ Skip classification

**AUTHORIZED:**
- ✅ Query Runtime and Core data
- ✅ Generate classification report
- ✅ Document mapping decisions
- ✅ Propose 05-B strategy

---

## Recommended Strategy for 5 Current Records

**All 5 are TEST_FIXTURE / ORPHAN**

### Option A: Clean Slate (Recommended)
1. Delete all 5 TEXT tenant records
2. Create real Core tenants for E2E (UUID)
3. Seed `runtime_tenant_registry` with Core UUIDs
4. Update E2E_TENANTS fixture to use real UUIDs
5. Proceed to 05-C (type migration)

**Rationale:**
- Aligns test fixtures with production identity contract
- Proves end-to-end UUID identity chain
- No fake UUID generation
- Clean separation: Core owns identity, Runtime consumes

### Option B: Selective Cleanup
1. Keep E2E tenant fixtures, delete quarantine fixtures
2. Create Core tenants for E2E only
3. Map E2E TEXT → Core UUID
4. Proceed to 05-B backfill

**Rationale:**
- Preserves some test continuity
- Less disruptive to existing tests

### Option C: Full Orphan Cleanup
1. Delete all 5 records (no Core mapping)
2. Do NOT create test tenants
3. Proceed directly to 05-C with empty registry
4. Seed Runtime tenant activation during Week 2

**Rationale:**
- Cleanest state
- Runtime registry truly empty until capability activated

---

---

## 🟢 ARCHITECT DECISION — RCA #6

**Date:** 2026-08-19  
**Decision:** Option A — Clean Slate (APPROVED)  
**Authority:** Platform Architect  

### Decision Statement

**Canonical tenant identity:** UUID

The five existing TEXT tenant identifiers are classified as `TEST_FIXTURE / ORPHANED_RUNTIME_DATA` and **SHALL NOT** be promoted, cast, or converted into canonical tenant identities.

Canonical E2E tenants **SHALL** be created in the Core `public.tenants` domain and **SHALL** receive UUID identities. Runtime **SHALL** reference those canonical UUIDs.

Migration 05 **SHALL** proceed strictly in the sequence:
1. 05-A Identity Reconciliation
2. 05-B Cleanup/Backfill
3. 05-C Type Migration

**Migration 04 v1.1 remains immutable.**

No test v1.7, security proof, regression, or Week 2 execution is permitted until Migration 05-C and its post-migration integrity gates pass.

---

## Mapping Ledger (Approved)

**Legacy Runtime Reconciliation:**

| Legacy Runtime ID | Classification | Canonical Core UUID | Action |
|-------------------|----------------|---------------------|--------|
| `test-quarantine-tenant-a` | TEST_ORPHAN | N/A | **DELETE** |
| `test-quarantine-tenant-b` | TEST_ORPHAN | N/A | **DELETE** |
| `test-e2e-tenant-a` | TEST_FIXTURE | ⏳ CREATE NEW UUID | **REPLACE** |
| `test-e2e-tenant-b` | TEST_FIXTURE | ⏳ CREATE NEW UUID | **REPLACE** |
| `test-e2e-tenant-attacker` | TEST_FIXTURE | ⏳ CREATE NEW UUID | **REPLACE** |

**Audit Trail Principle:**
> Legacy TEXT IDs are not converted into canonical IDs. They are retired. Canonical UUIDs are created from the Core domain and then activated in Runtime.

---

## Migration 05-A Invariants

**05-A-I1: No Production Tenant Mutation**
> Migration SHALL NOT modify any Core production tenant. Only test/E2E tenants may be created.

**05-A-I2: One Canonical UUID per E2E Tenant**
> Each E2E tenant = exactly one `public.tenants.id` (UUID). No duplicates, no aliases.

**05-A-I3: No Legacy Fixture Promotion**
> Legacy TEXT identifiers SHALL NOT be converted to UUID representation. Canonical Core identity SHALL be created fresh.

Example of **NOT ALLOWED:**
```
test-e2e-tenant-a 
    → 
generate UUID from hash("test-e2e-tenant-a")
    →
promote as canonical
```

Example of **REQUIRED:**
```
public.tenants
    ↓
INSERT (id = gen_random_uuid(), name = 'E2E Test Tenant A')
    ↓
canonical UUID established
    ↓
Runtime references this UUID
```

**05-A-I4: Zero Unresolved Runtime Identities**
> Before 05-C execution is permitted: `orphaned_runtime_tenant_ids = 0`

**Verification:**
```sql
-- Must return 0 rows before 05-C
SELECT tenant_id 
FROM runtime_tenant_registry
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants 
  WHERE id = runtime_tenant_registry.tenant_id
);
```

---

## Approved Sequence

```
05-A: Identity Reconciliation
    ↓
Canonical Core UUIDs established
    ↓
05-B: Cleanup + Backfill
    ↓
Legacy TEXT fixtures = 0
    ↓
Integrity Gate (verify invariants)
    ↓
05-C: TEXT → UUID schema migration
    ↓
RLS / FK / indexes recreated
    ↓
Runtime Identity Contract PROVEN
    ↓
Test v1.7 (with canonical UUIDs)
    ↓
10/10 Security Proof
    ↓
191/191 Regression
    ↓
Week 2 Unblocked
```

---

## Platform Identity Primitive

**Strategic Importance:**

From this point forward, `tenant_id` is not a "field used by each module" but a **Platform Identity Primitive**.

All future Bella OS domains SHALL use the same canonical tenant identity:
- ✅ Finance OS
- ✅ Healthcare OS
- ✅ Education OS
- ✅ Real Estate OS
- ✅ Automotive OS
- ✅ [Future OS domains]

**No domain-specific tenant identity types are permitted.**

---

## Next Steps (Approved)

1. ✅ **Create Core E2E Tenants** (3 UUIDs in `public.tenants`)
2. ✅ **Document UUID mapping** (ledger with evidence)
3. ✅ **Design Migration 05-B** (cleanup + backfill strategy)
4. ✅ **Architecture Gate Review** (3-phase approval)
5. ⏳ **Execute Migration 05-B**
6. ⏳ **Integrity verification** (05-A-I1 through I4)
7. ⏳ **Execute Migration 05-C**
8. ⏳ **Test v1.7 execution**

---

**Status:** � ARCHITECT DECISION APPROVED  
**Next Phase:** Migration 05-B Design (Cleanup / Backfill)  
**Blocker Removed:** Classification decision complete
