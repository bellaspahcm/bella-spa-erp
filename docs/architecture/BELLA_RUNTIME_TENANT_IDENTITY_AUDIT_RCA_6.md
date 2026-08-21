# Bella Runtime Tenant Identity Audit — RCA #6

**Date:** 2026-08-19  
**Status:** 🔴 IN PROGRESS  
**Purpose:** Comprehensive audit before Runtime Identity Normalization  
**Decision:** Canonical tenant_id = UUID (Architect approved)  

---

## Executive Summary

**Issue:** Runtime tables use `tenant_id TEXT` while Core uses `tenant_id UUID`  
**Root Cause:** Schema boundary inconsistency between Core ↔ Runtime domains  
**Impact:** Test v1.6 blocked, Migration 04 v1.1 incompatible with Runtime schema  
**Classification:** Architectural schema-boundary issue (not test fixture issue)  

---

## Canonical Identity Law (Approved)

**Decision:** `tenant_id` is UUID throughout Bella platform

**Evidence:**
1. ✅ `public.tenants.id = UUID` (canonical tenant registry)
2. ✅ `public.users.tenant_id = UUID` (user→tenant mapping)
3. ✅ `auth.uid() = UUID` (authentication identity)
4. ✅ `get_auth_tenant_id() RETURNS UUID` (tenant resolution)
5. ✅ Migration 04 v1.1 designed with `v_tenant_id UUID`
6. ❌ Runtime tables use TEXT (outlier)

**Principle:**
```
                 ┌─────────────────────┐
                 │    auth.users.id    │
                 │        UUID         │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   public.users      │
                 │ tenant_id = UUID    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ get_auth_tenant_id  │
                 │   RETURNS UUID      │
                 └──────────┬──────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │      Runtime Kernel      │
              │  tenant_id = UUID ✅     │
              └──────────────────────────┘
```

**NOT Allowed:**
- UUID → TEXT → UUID conversion at identity boundary
- Dual type system (Core UUID, Runtime TEXT)
- Per-OS identity type variations

---

## Audit Requirements

### 1. Runtime Data Audit ⏳

**Objective:** Verify existing tenant_id values before ALTER COLUMN

**Queries:**
```sql
-- Count tenants in runtime_tenant_registry
SELECT COUNT(*) FROM runtime_tenant_registry;

-- Check if values are UUID-parseable
SELECT 
  tenant_id,
  tenant_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AS is_uuid
FROM runtime_tenant_registry;

-- Find non-UUID values
SELECT tenant_id
FROM runtime_tenant_registry
WHERE tenant_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- Count records in child tables
SELECT 
  'runtime_outbox' AS table_name, COUNT(*) AS record_count 
FROM runtime_outbox
UNION ALL
SELECT 'runtime_idempotency_registry', COUNT(*) FROM runtime_idempotency_registry
UNION ALL
SELECT 'runtime_audit_log', COUNT(*) FROM runtime_audit_log
UNION ALL
SELECT 'runtime_quarantine', COUNT(*) FROM runtime_quarantine;
```

**Expected:**
- If empty: ✅ Safe to ALTER COLUMN TYPE UUID
- If TEXT values exist: ❌ Requires data migration strategy

---

### 2. Tenant Orphan Audit ⏳

**Objective:** Verify referential integrity with Core

```sql
-- Find runtime tenants not in public.tenants
SELECT rt.tenant_id
FROM runtime_tenant_registry rt
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id::text = rt.tenant_id
);

-- Find public.tenants not in runtime registry
SELECT t.id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM runtime_tenant_registry rt
  WHERE rt.tenant_id = t.id::text
);
```

---

### 3. JWT Producer/Consumer Audit ⏳

**Objective:** Identify all code generating or validating tenant_id JWT claim

**Locations to audit:**
- [ ] `tests/utils/test-jwt-helper.ts` (test JWT generation)
- [ ] `src/lib/auth/*` (production JWT helpers)
- [ ] `tests/e2e/runtime/3c-security-gate.e2e.test.ts` (test JWT usage)
- [ ] Migration 02 RLS policies (JWT consumption)

**Current Contract:**
```typescript
// JWT payload
{
  "sub": "uuid-string",
  "tenant_id": "text-string"  // ❌ Currently TEXT
}

// RLS policy
USING (tenant_id = auth.jwt() ->> 'tenant_id')  // TEXT = TEXT
```

**Target Contract:**
```typescript
// JWT payload
{
  "sub": "uuid-string",
  "tenant_id": "uuid-string"  // ✅ UUID-formatted string
}

// RLS policy after Migration 05
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)  // UUID = UUID
```

**Note:** JSON has no UUID primitive, so claim is always string. Semantic type is UUID.

---

### 4. RLS Policy Dependency Audit ✅

**Completed in Schema Impact Audit**

6 RLS policies affected:
- `tenant_isolation_policy_registry_jwt`
- `tenant_isolation_policy_idempotency_jwt`
- `tenant_isolation_policy_outbox_jwt`
- `tenant_isolation_policy_audit_jwt`
- `audit_append_only_policy_jwt`
- `tenant_isolation_policy_quarantine_jwt`

All use: `tenant_id = auth.jwt() ->> 'tenant_id'`

After Migration 05: Must update to `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`

---

### 5. RPC/Function Dependency Audit ⏳

**Functions to audit:**

```sql
-- Find all functions with tenant_id TEXT parameters
SELECT 
  routine_schema,
  routine_name,
  parameter_name,
  data_type
FROM information_schema.parameters
WHERE parameter_name LIKE '%tenant%'
  AND routine_schema = 'public'
ORDER BY routine_name;
```

**Known functions:**
- ✅ `get_auth_tenant_id() RETURNS UUID` (no changes needed)
- ✅ `submit_financial_intent()` (no tenant parameter, uses get_auth_tenant_id())

---

### 6. Application TypeScript Audit ⏳

**Objective:** Find TypeScript code assuming `tenant_id: string` as business ID

**Locations:**
- [ ] `src/platform/integration-runtime/types/*.ts`
- [ ] `tests/utils/e2e-fixtures.ts`
- [ ] Any runtime client code

**Current E2E_TENANTS:**
```typescript
export const E2E_TENANTS = {
  TENANT_A: {
    tenantId: 'test-e2e-tenant-a',  // ❌ TEXT business ID
    userId: '1176579a-...',         // ✅ UUID
  }
};
```

**Target:**
```typescript
export const E2E_TENANTS = {
  TENANT_A: {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',  // ✅ UUID
    userId: '1176579a-...',                             // ✅ UUID
  }
};
```

---

### 7. Migration 05 Impact Map ⏳

**Objects Requiring Changes:**

| Category | Count | Objects |
|----------|-------|---------|
| Tables | 5 | runtime_tenant_registry, runtime_outbox, runtime_idempotency_registry, runtime_audit_log, runtime_quarantine |
| Foreign Keys | 4 | idempotency_tenant_fk, outbox_tenant_fk, audit_tenant_fk, quarantine_tenant_fk |
| Unique Constraints | 1 | idempotency_tenant_key_unique |
| Indexes | 4 | idx_runtime_idempotency_tenant_key, idx_runtime_outbox_tenant_status, idx_runtime_audit_tenant, idx_runtime_quarantine_tenant |
| CHECK Constraints | 1 | tenant_id_not_empty |
| RLS Policies | 6 | All JWT-based tenant isolation policies |
| RPCs | 0 | (Migration 04 already uses UUID) |
| Functions | 0 | (get_auth_tenant_id already returns UUID) |

**Total affected objects:** 21

---

### 8. Rollback Strategy ⏳

**Migration 05 Classification:** HIGH RISK (schema-level identity change)

**Rollback Considerations:**
- Forward-only migration (cannot rollback after data in production)
- Must maintain Phase 3A/3B test compatibility
- Cannot break existing Core→Runtime references
- RLS policies must maintain tenant isolation during migration

**Strategy:**
1. **Pre-migration validation** (verify no TEXT tenant data)
2. **Atomic migration** (single transaction if possible)
3. **Post-migration verification** (regression 181/181 + new 10/10)
4. **No rollback** (destructive schema change)

---

### 9. Migration 05 Constitution ⏳

**Not yet drafted** - requires completion of audits 1-8

**Must include:**
1. Pre-flight validation (data audit SQL)
2. Ordered DDL operations (FK drop → ALTER → FK recreate)
3. RLS policy updates
4. Index recreation
5. Post-migration verification
6. Rollback impossibility acknowledgment

---

### 10. Architecture v1.2 Amendment ⏳

**Required changes to Architecture v1.1:**

- [ ] Add "Canonical Identity Contract" section
- [ ] Specify `tenant_id UUID` throughout
- [ ] Document Core ↔ Runtime identity bridge
- [ ] Update Migration 04 v1.1 schema compatibility note
- [ ] Add JWT tenant claim semantic type specification

---

## NOT AUTHORIZED (Architecture Gate)

**The following are blocked until audits 1-10 complete:**

- ❌ Create Migration 05
- ❌ Modify Migration 04 v1.1
- ❌ Modify RLS policies
- ❌ Modify JWT generators
- ❌ Execute test v1.6
- ❌ Regression 191/191
- ❌ Week 2 implementation
- ❌ Create UUID↔TEXT conversion layer

---

## Audit Execution Sequence

```
1. Runtime Data Audit          ⏳ NEXT
   ↓
2. Tenant Orphan Audit         ⏳
   ↓
3. JWT Producer/Consumer       ⏳
   ↓
4. TypeScript Dependency       ⏳
   ↓
5. RPC/Function Audit          ⏳
   ↓
6. Impact Map Finalization     ⏳
   ↓
7. Rollback Strategy           ⏳
   ↓
8. Migration 05 Constitution   ⏳
   ↓
9. Architecture v1.2           ⏳
   ↓
10. Architecture Gate Review   🔒
   ↓
Migration 05 Approval          🔒
```

---

## ✅ Runtime Data Audit Complete

**Execution Date:** 2026-08-19  
**Result:** 🔴 MIGRATION BLOCKED  

### Audit Findings

**Runtime Tenant Registry:**
- Total tenants: 5
- UUID-compliant: 0
- TEXT (non-UUID): 5

**TEXT Tenant IDs Found:**
1. `test-quarantine-tenant-a` (null name)
2. `test-quarantine-tenant-b` (null name)
3. `test-e2e-tenant-a` (E2E Test Tenant A)
4. `test-e2e-tenant-b` (E2E Test Tenant B)
5. `test-e2e-tenant-attacker` (E2E Test Attacker)

**Child Table Status:**
- `runtime_outbox`: 0 records ✅
- `runtime_idempotency_registry`: 0 records ✅
- `runtime_audit_log`: 0 records ✅
- `runtime_quarantine`: 0 records ✅

**Orphan Audit:**
- ❌ All 5 Runtime tenants are orphans (NOT in `public.tenants`)
- ⚠️ 1000+ Core tenants NOT in Runtime registry

**Classification:**
- All 5 TEXT tenant IDs: **TEST_FIXTURE / ORPHAN**
- No production tenant data at risk
- Runtime registry is test-only state

---

## 🔴 ARCHITECTURE GATE DECISION

**Date:** 2026-08-19  
**Status:** APPROVED  

### Canonical Tenant Identity Law

**Decision:** `tenant_id` is canonical UUID identity across Bella Platform

**Law:**
> Canonical tenant identity is UUID. Any JWT tenant claim must conform to UUID representation and must not become an independent source of tenant authority.

**Evidence Chain:**
```
auth.users.id           UUID ✅
    ↓
public.users.id         UUID ✅
    ↓
public.users.tenant_id  UUID ✅
    ↓
public.tenants.id       UUID ✅
    ↓
get_auth_tenant_id()    UUID ✅
    ↓
Runtime tenant_id       TEXT ❌  ← OUTLIER
```

**Conclusion:**
- Runtime `TEXT` is not an alternative canonical identity
- Runtime `TEXT` is a boundary mismatch requiring correction
- UUID is the single source of tenant identity truth

---

## Identity Reconciliation vs Type Migration

**Two Separate Issues:**

### Issue 1: Type Migration
```
Runtime schema: tenant_id TEXT → tenant_id UUID
```

### Issue 2: Identity Reconciliation
```
Runtime TEXT identifier → Canonical Core UUID mapping
```

**Order of Resolution:**
1. ✅ Identity reconciliation (classify and map existing data)
2. ⏳ Type migration (ALTER COLUMN after reconciliation)

**NOT Allowed:**
- ❌ `ALTER COLUMN TYPE UUID` before identity reconciliation
- ❌ `::uuid` cast without mapping validation
- ❌ Convert TEXT test fixtures to fake UUIDs

---

## Runtime Registry Design Principle

**Runtime is Capability Registry, NOT Mirror of Core**

```
public.tenants (1000+ tenants)
      │
      │ Core tenant identity
      ▼
Runtime Capability
      │
      ├── Finance enabled
      ├── Healthcare enabled
      ├── Runtime enabled  ────→ runtime_tenant_registry
      │
      └── Runtime disabled (not in registry)
```

**Implication:**
- Runtime registry contains ONLY tenants with Runtime capability activated
- NOT all Core tenants require Runtime records
- 1000+ Core tenants without Runtime records: ✅ EXPECTED
- 5 TEXT orphans in Runtime: ❌ TEST FIXTURES (no Core mapping)

---

## Migration 05 Strategy: 3-Phase Approach

### Phase 05-A: Identity Reconciliation ⏳

**Objective:** Map existing Runtime TEXT identifiers to Core UUID

**Steps:**
1. Query all `runtime_tenant_registry.tenant_id` (TEXT)
2. Attempt mapping to `public.tenants.id` (UUID)
3. Classify each record:
   - `VALID_MAPPING`: TEXT matches Core tenant name/slug → UUID found
   - `TEST_FIXTURE`: test-* identifiers → orphan, no Core mapping
   - `ORPHAN`: no Core tenant match
   - `UNKNOWN`: ambiguous mapping
   - `DUPLICATE`: multiple Core matches

**Gate Requirement:**
- `UNKNOWN` records = 0 for production data
- All records classified

**Current Classification:**
| Runtime TEXT ID | Core UUID | Classification |
|-----------------|-----------|----------------|
| `test-quarantine-tenant-a` | NULL | TEST_FIXTURE / ORPHAN |
| `test-quarantine-tenant-b` | NULL | TEST_FIXTURE / ORPHAN |
| `test-e2e-tenant-a` | NULL | TEST_FIXTURE / ORPHAN |
| `test-e2e-tenant-b` | NULL | TEST_FIXTURE / ORPHAN |
| `test-e2e-tenant-attacker` | NULL | TEST_FIXTURE / ORPHAN |

---

### Phase 05-B: Cleanup / Backfill ⏳

**Objective:** Resolve TEST_FIXTURE and ORPHAN records

**Strategy for 5 Existing Records:**

**Option 1: Controlled Delete** (if no longer needed)
```sql
-- Quarantine → Evidence → Delete
INSERT INTO migration_evidence.runtime_tenant_deleted ...;
DELETE FROM runtime_tenant_registry 
WHERE tenant_id IN ('test-e2e-tenant-a', ...);
```

**Option 2: E2E Fixture Correction** (if still needed)
```
1. Create Core tenant in public.tenants (UUID)
2. Create public.users with tenant_id mapping
3. Update E2E_TENANTS fixture to use real UUID
4. Replace TEXT with UUID in runtime_tenant_registry
```

**Recommended:** Option 2 (align test fixtures with production identity chain)

**Result:**
- All Runtime tenant_id values are UUID-parseable
- E2E tests use real Core tenant UUIDs
- Identity contract proven end-to-end

---

### Phase 05-C: Type Migration ⏳

**Objective:** Migrate schema TEXT → UUID after data clean

**Precondition:** Phase 05-B complete, all tenant_id values UUID-parseable

**DDL Operations (Order Matters):**

1. **DROP Foreign Keys** (4 constraints)
   ```sql
   ALTER TABLE runtime_idempotency_registry DROP CONSTRAINT idempotency_tenant_fk;
   ALTER TABLE runtime_outbox DROP CONSTRAINT outbox_tenant_fk;
   ALTER TABLE runtime_audit_log DROP CONSTRAINT audit_tenant_fk;
   ALTER TABLE runtime_quarantine DROP CONSTRAINT quarantine_tenant_fk;
   ```

2. **DROP Unique Constraint**
   ```sql
   ALTER TABLE runtime_idempotency_registry DROP CONSTRAINT idempotency_tenant_key_unique;
   ```

3. **DROP CHECK Constraint**
   ```sql
   ALTER TABLE runtime_tenant_registry DROP CONSTRAINT tenant_id_not_empty;
   ```

4. **ALTER COLUMN TYPE** (parent first, then children)
   ```sql
   -- Parent
   ALTER TABLE runtime_tenant_registry 
     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
   
   -- Children
   ALTER TABLE runtime_outbox 
     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
   
   ALTER TABLE runtime_idempotency_registry 
     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
   
   ALTER TABLE runtime_audit_log 
     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
   
   ALTER TABLE runtime_quarantine 
     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
   ```

5. **RECREATE Foreign Keys**
   ```sql
   ALTER TABLE runtime_idempotency_registry 
     ADD CONSTRAINT idempotency_tenant_fk 
     FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id);
   
   -- (repeat for 3 other FKs)
   ```

6. **RECREATE Unique Constraint**
   ```sql
   ALTER TABLE runtime_idempotency_registry 
     ADD CONSTRAINT idempotency_tenant_key_unique 
     UNIQUE (tenant_id, idempotency_key);
   ```

7. **RECREATE Indexes** (4 indexes with tenant_id)
   ```sql
   DROP INDEX idx_runtime_idempotency_tenant_key;
   CREATE INDEX idx_runtime_idempotency_tenant_key 
     ON runtime_idempotency_registry(tenant_id, idempotency_key);
   
   -- (repeat for 3 other indexes)
   ```

8. **UPDATE RLS Policies** (6 policies)
   ```sql
   -- Update policy condition
   DROP POLICY tenant_isolation_policy_registry_jwt ON runtime_tenant_registry;
   CREATE POLICY tenant_isolation_policy_registry_jwt ON runtime_tenant_registry
     FOR ALL
     USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
   
   -- (repeat for 5 other policies)
   ```

9. **UPDATE JWT Generators**
   ```typescript
   // E2E test helper
   {
     "sub": "uuid-string",
     "tenant_id": "uuid-string"  // ✅ UUID-formatted
   }
   ```

10. **UPDATE E2E Fixtures**
    ```typescript
    export const E2E_TENANTS = {
      TENANT_A: {
        tenantId: '550e8400-...',  // ✅ Real Core tenant UUID
        userId: '1176579a-...',    // ✅ Real auth.users UUID
      }
    };
    ```

---

## JWT Contract Clarification

**NOT:** "JWT claim must change from TEXT → UUID"

**CORRECT:** 
> Canonical tenant identity is UUID. Any JWT tenant claim must conform to UUID representation and must not become an independent source of tenant authority.

**Rationale:**
- JSON has no UUID primitive (claim is always string)
- Semantic type is UUID (not TEXT business identifier)
- JWT is derived claim, not canonical authority
- Canonical authority: `auth.uid() → public.users → tenant_id UUID`

**If JWT Contains tenant_id:**
- Must be UUID-formatted string
- Must derive from `public.users.tenant_id`
- RLS policy casts: `(auth.jwt() ->> 'tenant_id')::uuid`

**If JWT Does NOT Contain tenant_id:**
- Architecture remains valid
- Use `get_auth_tenant_id()` for tenant resolution

---

## Architecture Gate Status

| Component | Status | Notes |
|-----------|--------|-------|
| Canonical Tenant Identity | UUID | ✅ DECIDED |
| Runtime TEXT tenant_id | LEGACY | 🔴 BLOCKED |
| Existing runtime data | 5 records | 🔴 RECONCILIATION REQUIRED |
| Core → Runtime mapping | Partial | 🟡 DESIGN REQUIRED |
| Migration 05-A | NOT CREATED | 🔴 IDENTITY RECONCILIATION |
| Migration 05-B | NOT CREATED | 🔴 CLEANUP / BACKFILL |
| Migration 05-C | NOT CREATED | 🔴 TYPE MIGRATION |
| Migration 04 v1.1 | IMMUTABLE | 🟢 CORRECT (UUID design) |
| Test v1.6 | QUARANTINED | 🔴 BLOCKED BY SCHEMA |
| Security Gate 3C | BLOCKED | 🔴 0/10 PROVEN |
| 191/191 Regression | BLOCKED | 🔴 |
| Week 2 | BLOCKED | 🔴 |

---

## Value of RCA #6

**Critical Discovery:**

Phase 3C Security Gate uncovered an architectural defect that, if bypassed to make tests pass, would create:
- Dual tenant identity systems (Core UUID, Runtime TEXT)
- Identity boundary conversion layer (technical debt)
- Per-OS identity type variations (platform fragmentation)

**This is precisely the type of defect that should be caught at Architecture Gate.**

---

## NOT AUTHORIZED

**Do NOT proceed with:**
- ❌ Create test v1.7 (issue not in test artifact)
- ❌ Modify Migration 04 v1.1 to accommodate TEXT
- ❌ Add UUID↔TEXT conversion layer
- ❌ Cast `tenant_id::text` to "fix" RLS policies
- ❌ Generate fake UUIDs for test fixtures
- ❌ Skip identity reconciliation

**AUTHORIZED Next Steps:**
1. ✅ Design Migration 05-A (Identity Reconciliation)
2. ✅ Design Migration 05-B (Cleanup / Backfill)
3. ✅ Design Migration 05-C (Type Migration)
4. ✅ Update Architecture v1.1 → v1.2 (add Identity Contract)
5. ✅ Architecture Gate Review (3-phase migration)

---

**Status:** 🔴 BLOCKED — Awaiting Migration 05-A design (Identity Reconciliation)  
**Blocker:** 5 TEXT tenant records require classification and mapping before type migration
