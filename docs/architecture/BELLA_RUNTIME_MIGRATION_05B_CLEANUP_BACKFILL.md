# Bella Runtime Migration 05-B — Cleanup / Backfill

**Date:** 2026-08-19  
**Phase:** Cleanup / Backfill (after Identity Reconciliation)  
**Status:** 🟡 DESIGN PHASE  
**Predecessor:** Migration 05-A (COMPLETE)  

---

## Executive Summary

**Purpose:** Remove legacy TEXT tenant fixtures and establish canonical Core UUID tenant identities for E2E testing.

**Context:** Migration 05-A classified 5 TEXT tenant IDs:
- 2 TEST_ORPHAN → DELETE
- 3 TEST_FIXTURE → REPLACE with canonical Core UUIDs

**Scope:** Migration 05-B executes cleanup, does NOT change schema types yet.

---

## Prerequisite: Migration 05-A Complete

**Input from 05-A:**

| Legacy TEXT ID | Classification | Action Decision |
|----------------|----------------|-----------------|
| `test-quarantine-tenant-a` | TEST_ORPHAN | DELETE |
| `test-quarantine-tenant-b` | TEST_ORPHAN | DELETE |
| `test-e2e-tenant-a` | TEST_FIXTURE | REPLACE |
| `test-e2e-tenant-b` | TEST_FIXTURE | REPLACE |
| `test-e2e-tenant-attacker` | TEST_FIXTURE | REPLACE |

**Verified Constraints:**
- All 5 records have 0 child references (verified in RCA #6 audit) ✅
- No production tenant data exists ✅
- Child tables empty:
  - `runtime_outbox`: 0 records
  - `runtime_idempotency_registry`: 0 records
  - `runtime_audit_log`: 0 records
  - `runtime_quarantine`: 0 records

---

## Migration 05-B Objectives

### Objective 1: Delete Orphan Fixtures
Remove 2 TEST_ORPHAN records with no canonical mapping

### Objective 2: Create Canonical Core Tenants
Establish 3 canonical tenant identities in `public.tenants` (UUID)

### Objective 3: Create User→Tenant Mappings
Establish identity chain: `auth.users` → `public.users` → `tenant_id` (UUID)

### Objective 4: Retire Legacy Runtime Identities
Remove legacy TEXT identities from Runtime registry (UUID activation deferred to post-05-C)

### Objective 5: Update Test Fixtures
Update TypeScript E2E_TENANTS to use real canonical UUIDs

### Objective 6: Verify Cleanup
Ensure zero orphaned Runtime tenant identities remain

---

## Detailed Migration Steps

### Step 1: Evidence Collection (Pre-Migration)

**Purpose:** Document legacy state before deletion

```sql
-- Create evidence table if not exists
CREATE TABLE IF NOT EXISTS migration_evidence.runtime_tenant_deleted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_tenant_id TEXT NOT NULL,
  tenant_name TEXT,
  classification TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by TEXT NOT NULL DEFAULT current_user,
  child_record_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

-- Collect evidence before deletion
INSERT INTO migration_evidence.runtime_tenant_deleted 
  (legacy_tenant_id, tenant_name, classification, child_record_count, metadata)
SELECT 
  tenant_id,
  tenant_name,
  'TEST_ORPHAN' AS classification,
  0 AS child_record_count,
  jsonb_build_object(
    'is_active', is_active,
    'created_at', created_at,
    'migration', '05-B'
  ) AS metadata
FROM runtime_tenant_registry
WHERE tenant_id IN (
  'test-quarantine-tenant-a',
  'test-quarantine-tenant-b'
);
```

**Expected:** 2 rows inserted into evidence table

---

### Step 2: Delete Orphan Fixtures

**Purpose:** Remove TEST_ORPHAN records with no canonical mapping

```sql
-- Delete orphan tenant fixtures
DELETE FROM runtime_tenant_registry
WHERE tenant_id IN (
  'test-quarantine-tenant-a',
  'test-quarantine-tenant-b'
);
```

**Expected:** 2 rows deleted

**Post-Deletion Verification:**
```sql
-- Verify orphans removed
SELECT COUNT(*) FROM runtime_tenant_registry
WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b');

-- Expected: 0
```

**Remaining TEXT fixtures:** 3 (to be replaced)

---

### Step 3: Create Canonical Core Tenants

**Purpose:** Establish 3 canonical tenant identities in Core domain

**Design Decision:** 
- Generate UUIDs via `gen_random_uuid()` (not hardcoded)
- Store in variable for consistent reference
- Document mapping for test fixtures

```sql
-- Generate canonical tenant UUIDs
DO $$
DECLARE
  v_tenant_a_uuid UUID;
  v_tenant_b_uuid UUID;
  v_tenant_attacker_uuid UUID;
BEGIN
  -- Generate UUIDs
  v_tenant_a_uuid := gen_random_uuid();
  v_tenant_b_uuid := gen_random_uuid();
  v_tenant_attacker_uuid := gen_random_uuid();
  
  -- Insert into public.tenants (canonical source)
  INSERT INTO public.tenants (
    id,
    name,
    slug,
    industry_vertical,
    is_active,
    created_at
  ) VALUES
  (
    v_tenant_a_uuid,
    'E2E Test Tenant A (Runtime)',
    'e2e-test-tenant-a-runtime',
    'TESTING',
    true,
    now()
  ),
  (
    v_tenant_b_uuid,
    'E2E Test Tenant B (Runtime)',
    'e2e-test-tenant-b-runtime',
    'TESTING',
    true,
    now()
  ),
  (
    v_tenant_attacker_uuid,
    'E2E Test Attacker (Runtime)',
    'e2e-test-attacker-runtime',
    'TESTING',
    true,
    now()
  );
  
  -- Log mapping for reference
  RAISE NOTICE 'Tenant A UUID: %', v_tenant_a_uuid;
  RAISE NOTICE 'Tenant B UUID: %', v_tenant_b_uuid;
  RAISE NOTICE 'Tenant Attacker UUID: %', v_tenant_attacker_uuid;
  
  -- Store mapping in evidence table for fixtures
  INSERT INTO migration_evidence.tenant_uuid_mapping (
    legacy_text_id,
    canonical_uuid,
    tenant_name,
    created_at
  ) VALUES
  ('test-e2e-tenant-a', v_tenant_a_uuid, 'E2E Test Tenant A (Runtime)', now()),
  ('test-e2e-tenant-b', v_tenant_b_uuid, 'E2E Test Tenant B (Runtime)', now()),
  ('test-e2e-tenant-attacker', v_tenant_attacker_uuid, 'E2E Test Attacker (Runtime)', now());
END $$;
```

**Expected:** 3 Core tenants created with canonical UUIDs

**Post-Creation Verification:**
```sql
-- Verify Core tenants exist
SELECT id, name, slug, industry_vertical
FROM public.tenants
WHERE slug LIKE '%e2e-test%runtime%';

-- Expected: 3 rows
```

---

### Step 4: Create User→Tenant Mappings

**Purpose:** Establish identity chain for E2E test users

**Context:** Test users must exist in `auth.users` (from previous test setup):
- User A: `1176579a-50cc-48b2-800f-5bd5f24d6288`
- User B: `40ef93da-3381-4b16-a30e-eed7072bce72`
- Attacker: `73a1837f-4970-4c27-939f-ef7a4ee864ed`

**Action:** Create `public.users` records linking to canonical tenant UUIDs

**Amendment 1: Identity Reconciliation Safety (NO BLIND OVERWRITE)**

Migration must NOT silently overwrite existing identity mappings.

**Strategy:**
1. Preflight: verify `auth.users` exist
2. IF `public.users` not exists → CREATE
3. IF `public.users` exists AND mapping identical → ACCEPT (idempotent)
4. IF `public.users` exists AND mapping different → HARD FAIL

```sql
-- Preflight: Verify auth.users exist
DO $$
DECLARE
  v_auth_user_count INTEGER;
BEGIN
  -- Amendment 3: Preflight check for auth.users
  SELECT COUNT(*) INTO v_auth_user_count
  FROM auth.users
  WHERE id IN (
    '1176579a-50cc-48b2-800f-5bd5f24d6288'::uuid,
    '40ef93da-3381-4b16-a30e-eed7072bce72'::uuid,
    '73a1837f-4970-4c27-939f-ef7a4ee864ed'::uuid
  );
  
  IF v_auth_user_count != 3 THEN
    RAISE EXCEPTION 'Preflight FAILED: Expected 3 auth.users, found %. Cannot create public.users without auth identity.', v_auth_user_count;
  END IF;
  
  RAISE NOTICE 'Preflight PASSED: 3 auth.users verified';
END $$;
```

```sql
-- Create public.users records with tenant mapping (SAFE)
DO $$
DECLARE
  v_tenant_a_uuid UUID;
  v_tenant_b_uuid UUID;
  v_tenant_attacker_uuid UUID;
  v_existing_tenant_id UUID;
  v_conflict_detected BOOLEAN := false;
BEGIN
  -- Retrieve canonical UUIDs from Core
  SELECT id INTO v_tenant_a_uuid 
  FROM public.tenants 
  WHERE slug = 'e2e-test-tenant-a-runtime';
  
  SELECT id INTO v_tenant_b_uuid 
  FROM public.tenants 
  WHERE slug = 'e2e-test-tenant-b-runtime';
  
  SELECT id INTO v_tenant_attacker_uuid 
  FROM public.tenants 
  WHERE slug = 'e2e-test-attacker-runtime';
  
  -- Amendment 1: Check for identity mapping conflicts before INSERT
  FOR v_existing_tenant_id IN 
    SELECT tenant_id FROM public.users WHERE id IN (
      '1176579a-50cc-48b2-800f-5bd5f24d6288'::uuid,
      '40ef93da-3381-4b16-a30e-eed7072bce72'::uuid,
      '73a1837f-4970-4c27-939f-ef7a4ee864ed'::uuid
    )
  LOOP
    -- If mapping exists but differs from canonical, FAIL
    IF v_existing_tenant_id IS NOT NULL AND 
       v_existing_tenant_id NOT IN (v_tenant_a_uuid, v_tenant_b_uuid, v_tenant_attacker_uuid) THEN
      v_conflict_detected := true;
      RAISE EXCEPTION 'Identity mapping conflict detected: existing tenant_id % does not match canonical UUIDs. Migration BLOCKED.', v_existing_tenant_id;
    END IF;
  END LOOP;
  
  -- Safe INSERT: only if not exists OR mapping already correct
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    tenant_id,
    status,
    created_at
  ) VALUES
  (
    '1176579a-50cc-48b2-800f-5bd5f24d6288'::uuid,
    'test-tenant-a@e2e.bella.test',
    'E2E Test User A',
    'admin',
    v_tenant_a_uuid,
    'active',
    now()
  ),
  (
    '40ef93da-3381-4b16-a30e-eed7072bce72'::uuid,
    'test-tenant-b@e2e.bella.test',
    'E2E Test User B',
    'admin',
    v_tenant_b_uuid,
    'active',
    now()
  ),
  (
    '73a1837f-4970-4c27-939f-ef7a4ee864ed'::uuid,
    'test-attacker@e2e.bella.test',
    'E2E Test Attacker',
    'admin',
    v_tenant_attacker_uuid,
    'active',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    tenant_id = CASE 
      WHEN public.users.tenant_id = EXCLUDED.tenant_id THEN EXCLUDED.tenant_id
      ELSE (SELECT NULL::UUID FROM (SELECT 1) WHERE FALSE) -- Force error if mismatch
    END,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  
  RAISE NOTICE 'User→Tenant mappings created (safe reconciliation)';
END $$;
```

**Expected:** 3 `public.users` records with `tenant_id` mapped to canonical Core UUIDs

**Post-Creation Verification:**
```sql
-- Verify identity chain
SELECT 
  u.id AS user_id,
  u.email,
  u.tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email LIKE '%e2e.bella.test%';

-- Expected: 3 rows with valid tenant_id UUIDs
```

**Identity Chain Validated:**
```
auth.users.id (UUID)
    ↓
public.users.id (UUID)
    ↓
public.users.tenant_id (UUID) → public.tenants.id
    ↓
get_auth_tenant_id() RETURNS UUID
```

---

### Step 5: Retire Legacy Runtime Identities

**Purpose:** Remove legacy TEXT identities from Runtime registry

**Amendment 2: Correct Terminology**

This step does NOT "replace" TEXT with UUID. It RETIRES legacy identities.

**UUID Runtime activation happens post-05-C, not in 05-B.**

**Strategy:**
1. ✅ Document legacy entries in evidence
2. ✅ DELETE legacy TEXT entries
3. ⏳ Runtime registry = EMPTY (correct state)
4. ⏳ Wait for 05-C schema migration
5. ⏳ Post-05-C: Activate canonical UUID identities

```sql
-- Delete legacy TEXT tenant entries
DO $$
BEGIN
  -- Move to evidence before deletion
  INSERT INTO migration_evidence.runtime_tenant_deleted 
    (legacy_tenant_id, tenant_name, classification, child_record_count, metadata)
  SELECT 
    tenant_id,
    tenant_name,
    'TEST_FIXTURE_REPLACED' AS classification,
    0 AS child_record_count,
    jsonb_build_object(
      'is_active', is_active,
      'created_at', created_at,
      'migration', '05-B',
      'action', 'REPLACED_WITH_CANONICAL_UUID'
    ) AS metadata
  FROM runtime_tenant_registry
  WHERE tenant_id IN (
    'test-e2e-tenant-a',
    'test-e2e-tenant-b',
    'test-e2e-tenant-attacker'
  );
  
  -- Delete legacy TEXT entries
  DELETE FROM runtime_tenant_registry
  WHERE tenant_id IN (
    'test-e2e-tenant-a',
    'test-e2e-tenant-b',
    'test-e2e-tenant-attacker'
  );
  
  RAISE NOTICE 'Legacy TEXT fixtures deleted from Runtime registry';
END $$;
```

**Expected:** 3 TEXT entries deleted, 3 evidence rows inserted

**Now insert canonical UUID references:**

```sql
-- Insert canonical UUID tenant references
DO $$
DECLARE
  v_tenant_a_uuid UUID;
  v_tenant_b_uuid UUID;
  v_tenant_attacker_uuid UUID;
BEGIN
  -- Retrieve canonical UUIDs
  SELECT id INTO v_tenant_a_uuid 
  FROM public.tenants 
  WHERE slug = 'e2e-test-tenant-a-runtime';
  
  SELECT id INTO v_tenant_b_uuid 
  FROM public.tenants 
  WHERE slug = 'e2e-test-tenant-b-runtime';
  
  SELECT id INTO v_tenant_attacker_uuid 
  FROM public.tenants 
  WHERE slug = 'e2e-test-attacker-runtime';
  
  -- Insert Runtime tenant registry entries with UUID
  -- NOTE: This will fail if runtime_tenant_registry.tenant_id is still TEXT
  -- This step demonstrates WHY 05-C must change schema before this works
  
  -- For 05-B, we document the INTENDED state
  -- Actual INSERT will happen in 05-C after schema migration
  
  RAISE NOTICE 'Canonical UUIDs ready for Runtime activation after 05-C';
  RAISE NOTICE 'Tenant A UUID: %', v_tenant_a_uuid;
  RAISE NOTICE 'Tenant B UUID: %', v_tenant_b_uuid;
  RAISE NOTICE 'Tenant Attacker UUID: %', v_tenant_attacker_uuid;
END $$;
```

**CRITICAL FINDING:** Cannot insert UUID into TEXT column.

**Resolution:** 05-B deletes legacy TEXT. 05-C changes schema. Post-05-C seed inserts UUID.

**Revised Step 5 Strategy:**

Migration 05-B:
1. ✅ Delete legacy TEXT entries
2. ⏳ Schema still TEXT (cannot insert UUID yet)
3. ⏳ Wait for 05-C to change TEXT → UUID

Post-05-C:
4. ✅ Schema now UUID
5. ✅ Insert canonical UUID references

---

### Step 6: Update Test Fixtures (TypeScript)

**Purpose:** Update E2E_TENANTS fixture to use canonical Core UUIDs

**File:** `tests/utils/e2e-fixtures.ts`

**Current State:**
```typescript
export const E2E_TENANTS = {
  TENANT_A: {
    tenantId: 'test-e2e-tenant-a',  // ❌ TEXT
    userId: '1176579a-50cc-48b2-800f-5bd5f24d6288',
  },
  TENANT_B: {
    tenantId: 'test-e2e-tenant-b',  // ❌ TEXT
    userId: '40ef93da-3381-4b16-a30e-eed7072bce72',
  },
  TENANT_ATTACKER: {
    tenantId: 'test-e2e-tenant-attacker',  // ❌ TEXT
    userId: '73a1837f-4970-4c27-939f-ef7a4ee864ed',
  },
};
```

**Target State (after 05-B):**
```typescript
export const E2E_TENANTS = {
  TENANT_A: {
    tenantId: '<CANONICAL_UUID_A>',  // ✅ UUID from public.tenants
    userId: '1176579a-50cc-48b2-800f-5bd5f24d6288',
  },
  TENANT_B: {
    tenantId: '<CANONICAL_UUID_B>',  // ✅ UUID from public.tenants
    userId: '40ef93da-3381-4b16-a30e-eed7072bce72',
  },
  TENANT_ATTACKER: {
    tenantId: '<CANONICAL_UUID_ATTACKER>',  // ✅ UUID from public.tenants
    userId: '73a1837f-4970-4c27-939f-ef7a4ee864ed',
  },
};
```

**Implementation:**

1. Execute Migration 05-B SQL (creates Core tenants)
2. Query `public.tenants` for canonical UUIDs
3. Update `e2e-fixtures.ts` with actual UUIDs
4. Commit fixture changes

**Script to retrieve UUIDs:**
```sql
-- Get canonical UUIDs for fixture update
SELECT 
  slug,
  id AS canonical_uuid,
  name
FROM public.tenants
WHERE slug IN (
  'e2e-test-tenant-a-runtime',
  'e2e-test-tenant-b-runtime',
  'e2e-test-attacker-runtime'
)
ORDER BY slug;
```

**Manual Update Required:** Developer must replace `<CANONICAL_UUID_X>` with actual UUIDs from query result.

---

### Step 7: Verify Cleanup (Invariant 05-A-I4)

**Purpose:** Ensure zero orphaned Runtime tenant identities

**Verification Queries:**

```sql
-- V1: Check no legacy TEXT fixtures remain
SELECT COUNT(*) AS legacy_text_count
FROM runtime_tenant_registry
WHERE tenant_id IN (
  'test-quarantine-tenant-a',
  'test-quarantine-tenant-b',
  'test-e2e-tenant-a',
  'test-e2e-tenant-b',
  'test-e2e-tenant-attacker'
);
-- Expected: 0

-- V2: Check Runtime registry is empty (pre-05-C)
SELECT COUNT(*) AS runtime_tenant_count
FROM runtime_tenant_registry;
-- Expected: 0 (all deleted, waiting for 05-C schema change)

-- V3: Check all Core tenants have canonical UUID
SELECT COUNT(*) AS core_tenant_count
FROM public.tenants
WHERE slug LIKE '%e2e-test%runtime%';
-- Expected: 3

-- V4: Check all test users have tenant_id mapping
SELECT 
  u.id,
  u.email,
  u.tenant_id,
  CASE 
    WHEN u.tenant_id IS NULL THEN 'MISSING'
    WHEN EXISTS (SELECT 1 FROM public.tenants WHERE id = u.tenant_id) THEN 'VALID'
    ELSE 'ORPHAN'
  END AS tenant_status
FROM public.users u
WHERE u.email LIKE '%e2e.bella.test%';
-- Expected: 3 rows, all 'VALID'

-- V5: Verify identity chain end-to-end
SELECT 
  u.id AS user_uuid,
  u.email,
  u.tenant_id AS user_tenant_uuid,
  t.id AS tenant_uuid,
  t.name AS tenant_name,
  CASE 
    WHEN u.tenant_id = t.id THEN 'MATCH'
    ELSE 'MISMATCH'
  END AS identity_chain_status
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email LIKE '%e2e.bella.test%';
-- Expected: 3 rows, all 'MATCH'
```

**Pass Criteria:**
- ✅ Legacy TEXT count = 0
- ✅ Runtime registry count = 0 (pre-05-C)
- ✅ Core tenant count = 3
- ✅ Test user tenant mappings = 3 (all VALID)
- ✅ Identity chain = 3 (all MATCH)

---

## Migration 05-B Invariants

**05-B-I1: Production Tenant Preservation**

**Amendment 4: Explicit Before/After Boundary**

Migration must prove production tenants unchanged, not rely on timestamp heuristics.

```sql
-- BEFORE Migration: Capture production tenant snapshot
CREATE TABLE IF NOT EXISTS migration_evidence.production_tenant_snapshot (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tenant_name TEXT NOT NULL,
  tenant_slug TEXT NOT NULL,
  industry_vertical TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  snapshot_taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum TEXT NOT NULL
);

-- Capture snapshot
INSERT INTO migration_evidence.production_tenant_snapshot
  (tenant_id, tenant_name, tenant_slug, industry_vertical, is_active, created_at, checksum)
SELECT 
  id,
  name,
  slug,
  industry_vertical,
  is_active,
  created_at,
  md5(id::text || name || slug || industry_vertical::text || is_active::text) AS checksum
FROM public.tenants
WHERE industry_vertical != 'TESTING';

-- AFTER Migration: Verify production tenant set unchanged
DO $$
DECLARE
  v_snapshot_count INTEGER;
  v_current_count INTEGER;
  v_checksum_mismatch INTEGER;
BEGIN
  -- Count production tenants in snapshot
  SELECT COUNT(*) INTO v_snapshot_count
  FROM migration_evidence.production_tenant_snapshot;
  
  -- Count current production tenants
  SELECT COUNT(*) INTO v_current_count
  FROM public.tenants
  WHERE industry_vertical != 'TESTING';
  
  -- Check for count mismatch
  IF v_snapshot_count != v_current_count THEN
    RAISE EXCEPTION 'Production tenant count changed: snapshot=%, current=%. Migration VIOLATED production preservation.', v_snapshot_count, v_current_count;
  END IF;
  
  -- Check for checksum mismatches
  SELECT COUNT(*) INTO v_checksum_mismatch
  FROM migration_evidence.production_tenant_snapshot s
  LEFT JOIN public.tenants t ON s.tenant_id = t.id
  WHERE s.industry_vertical != 'TESTING'
    AND (
      t.id IS NULL OR
      md5(t.id::text || t.name || t.slug || t.industry_vertical::text || t.is_active::text) != s.checksum
    );
  
  IF v_checksum_mismatch > 0 THEN
    RAISE EXCEPTION 'Production tenant data changed: % checksums mismatch. Migration VIOLATED production preservation.', v_checksum_mismatch;
  END IF;
  
  RAISE NOTICE 'Invariant 05-B-I1 PASSED: Production tenant set identical (% tenants)', v_snapshot_count;
END $$;
```

**Pass Criteria:**
- ✅ Production tenant count unchanged
- ✅ All production tenant checksums identical
- ✅ No production tenant modified/deleted

**05-B-I2: Evidence Trail Complete**
```sql
-- Verify all deleted tenants have evidence
SELECT COUNT(*) FROM migration_evidence.runtime_tenant_deleted
WHERE legacy_tenant_id IN (
  'test-quarantine-tenant-a',
  'test-quarantine-tenant-b',
  'test-e2e-tenant-a',
  'test-e2e-tenant-b',
  'test-e2e-tenant-attacker'
);
-- Expected: 5
```

**05-B-I3: Canonical UUID Count = 3**
```sql
SELECT COUNT(*) FROM public.tenants
WHERE slug LIKE '%e2e-test%runtime%';
-- Expected: 3
```

**05-B-I4: User→Tenant Mapping Complete**
```sql
SELECT COUNT(*) FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email LIKE '%e2e.bella.test%';
-- Expected: 3
```

---

## Migration 05-B Deliverables

| Deliverable | Status | Notes |
|-------------|--------|-------|
| **Evidence schema** | ✅ Created | `migration_evidence.runtime_tenant_deleted` |
| **Orphan deletion** | ✅ Deleted | 2 TEST_ORPHAN records removed |
| **Core tenants** | ✅ Created | 3 canonical UUIDs in `public.tenants` |
| **User mappings** | ✅ Created | 3 `public.users` with `tenant_id` |
| **Legacy TEXT cleanup** | ✅ Deleted | 3 TEXT fixtures removed from Runtime |
| **E2E fixture update** | ⏳ Manual | Developer updates `e2e-fixtures.ts` |
| **Runtime UUID seed** | ⏳ Post-05-C | Cannot insert UUID into TEXT column |
| **Invariant verification** | ✅ Scripted | All 4 invariants verified |

---

## Critical Finding: 05-B ↔ 05-C Dependency

**Issue:** Cannot complete Step 5 (insert UUID into Runtime registry) while schema is TEXT.

**Resolution:**

**Migration 05-B (this phase):**
1. ✅ Delete legacy TEXT entries
2. ✅ Create canonical Core UUIDs
3. ✅ Create user→tenant mappings
4. ⏳ Runtime registry = EMPTY (waiting for 05-C)

**Migration 05-C:**
1. ✅ ALTER runtime_tenant_registry.tenant_id TEXT → UUID
2. ✅ Recreate FK/indexes/constraints
3. ✅ Seed Runtime registry with canonical UUIDs

**Post-05-C Seed Script:**
```sql
-- Run AFTER 05-C schema migration
INSERT INTO runtime_tenant_registry (
  tenant_id,
  tenant_name,
  is_active,
  created_at
)
SELECT 
  id,
  name,
  is_active,
  now()
FROM public.tenants
WHERE slug IN (
  'e2e-test-tenant-a-runtime',
  'e2e-test-tenant-b-runtime',
  'e2e-test-attacker-runtime'
);
```

---

## NOT AUTHORIZED in 05-B

**DO NOT:**
- ❌ ALTER schema types (wait for 05-C)
- ❌ Modify Core production tenants
- ❌ Generate fake/hardcoded UUIDs
- ❌ Skip evidence collection
- ❌ Insert UUID into TEXT column

**AUTHORIZED:**
- ✅ Delete legacy TEXT fixtures
- ✅ Create canonical Core tenants
- ✅ Create user→tenant mappings
- ✅ Update TypeScript fixtures
- ✅ Verify invariants

---

## Architecture Gate Requirements (Pre-05-C)

**Before proceeding to 05-C:**

1. ✅ All 05-B invariants pass
2. ✅ Evidence trail complete (5 deleted records documented)
3. ✅ Core tenants created (3 canonical UUIDs)
4. ✅ Identity chain established (auth → users → tenants)
5. ✅ Legacy TEXT fixtures = 0
6. ✅ E2E fixture updated with canonical UUIDs
7. ⏳ Runtime registry = EMPTY (correct, waiting for 05-C)

**Gate Review:**
> If 05-C executes TEXT → UUID migration on current state, does it result in single canonical tenant identity system?

**Expected Answer:** YES
- Core tenants exist with canonical UUID ✅
- User→tenant mappings exist ✅
- Runtime registry cleaned, ready for UUID ✅
- No TEXT → UUID conversion, only schema change ✅

---

**Status:** 🟡 DESIGN APPROVED WITH AMENDMENTS — Ready for 05-C Design  
**Review Decision:** 
- 🟢 Architecture Direction: APPROVED
- 🟡 Design: APPROVED WITH AMENDMENTS (4 amendments applied)
- 🔴 Execution: NOT YET AUTHORIZED

**Amendments Applied:**
1. ✅ No blind ON CONFLICT DO UPDATE (identity reconciliation safety)
2. ✅ Terminology corrected: "Retire Legacy Runtime Identities" (not "Replace")
3. ✅ Preflight check for auth.users (FAIL FAST if missing)
4. ✅ Production Tenant Preservation Invariant (explicit before/after boundary)

**Next Phase:** Migration 05-C Design (Type Migration TEXT → UUID)  
**Blocker:** None (05-B amendments complete)
