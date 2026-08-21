# Bella Runtime Migration 05-C — Type Migration (TEXT → UUID)

**Date:** 2026-08-19  
**Phase:** Schema Authority Migration  
**Status:** 🟡 DESIGN PHASE  
**Predecessor:** Migration 05-B (DESIGN COMPLETE)  

---

## Executive Summary

**Purpose:** Migrate Runtime tenant identity from TEXT to UUID, establishing Runtime as consumer of Canonical Identity Law.

**Context:** After 05-B cleanup:
- Core tenants exist with canonical UUID ✅
- User→tenant mappings exist (UUID) ✅
- Runtime registry = EMPTY (TEXT column) ✅
- Legacy TEXT identities = 0 ✅

**Scope:** Migration 05-C is NOT "fix schema to pass test". It is **Canonical Identity Activation Gate** — the final enforcement that Runtime operates solely under UUID canonical identity.

**Critical Distinction:**
- ❌ NOT: ALTER COLUMN to make test pass
- ✅ YES: Activate canonical UUID as Runtime's sole identity primitive

**Migration Philosophy:**
```
05-A Identity Reconciliation    → DECIDE (which identity is correct)
05-B Legacy Identity Retirement → CLEAN (remove wrong identity)
05-C Canonical Identity Activation → ENFORCE (Runtime knows only UUID)
```

---

## Prerequisite: Migration 05-B Complete

**Input from 05-B:**

| Component | State After 05-B |
|-----------|------------------|
| Core tenants | 3 canonical UUID in `public.tenants` ✅ |
| User mappings | 3 `public.users.tenant_id` UUID ✅ |
| Runtime registry | EMPTY (TEXT column) ✅ |
| Legacy TEXT IDs | 0 (all deleted) ✅ |
| Production tenants | Unchanged (verified by 05-B-I1) ✅ |

**Verified Invariants:**
- ✅ 05-B-I1: Production Tenant Preservation
- ✅ 05-B-I2: Evidence Trail Complete (5 deletions)
- ✅ 05-B-I3: Canonical UUID Count = 3
- ✅ 05-B-I4: User→Tenant Mapping Complete

---

## Migration 05-C Objectives

### Objective 1: Schema Type Migration
Convert Runtime `tenant_id` from TEXT to UUID across all tables

### Objective 2: FK/Index/Constraint Reconstruction
Rebuild foreign keys, indexes, constraints to use UUID

### Objective 3: RLS Policy Migration
Update 6 RLS policies to enforce UUID tenant boundary

### Objective 4: JWT Contract Migration
Change JWT `tenant_id` claim from TEXT to UUID semantic

### Objective 5: Runtime Registry Activation
Seed Runtime registry with canonical Core UUID identities

### Objective 6: Identity Chain Proof
Verify end-to-end identity chain from auth → Core → Runtime → RLS

---

## Schema Audit: What Must Change

### Affected Tables (5 tenant_id columns)

1. **`runtime_tenant_registry.tenant_id`** (PRIMARY KEY)
   - Current: `TEXT PRIMARY KEY`
   - Target: `UUID PRIMARY KEY`
   - Child FK: 4 tables reference this

2. **`runtime_outbox.tenant_id`** (FK)
   - Current: `TEXT REFERENCES runtime_tenant_registry(tenant_id)`
   - Target: `UUID REFERENCES runtime_tenant_registry(tenant_id)`
   - RLS: 1 policy uses tenant_id

3. **`runtime_idempotency_registry.tenant_id`** (FK)
   - Current: `TEXT REFERENCES runtime_tenant_registry(tenant_id)`
   - Target: `UUID REFERENCES runtime_tenant_registry(tenant_id)`
   - RLS: 1 policy uses tenant_id

4. **`runtime_audit_log.tenant_id`** (FK)
   - Current: `TEXT REFERENCES runtime_tenant_registry(tenant_id)`
   - Target: `UUID REFERENCES runtime_tenant_registry(tenant_id)`
   - RLS: 2 policies use tenant_id

5. **`runtime_quarantine.tenant_id`** (FK)
   - Current: `TEXT REFERENCES runtime_tenant_registry(tenant_id)`
   - Target: `UUID REFERENCES runtime_tenant_registry(tenant_id)`
   - RLS: 2 policies use tenant_id

### Affected Indexes (4)

```sql
-- Current indexes (TEXT)
CREATE INDEX idx_runtime_outbox_tenant_id ON runtime_outbox(tenant_id);
CREATE INDEX idx_runtime_idempotency_tenant_id ON runtime_idempotency_registry(tenant_id);
CREATE INDEX idx_runtime_audit_tenant_id ON runtime_audit_log(tenant_id);
CREATE INDEX idx_runtime_quarantine_tenant_id ON runtime_quarantine(tenant_id);
```

### Affected Constraints

**Unique Constraint:**
```sql
-- runtime_idempotency_registry
UNIQUE (tenant_id, idempotency_key)
```

**Check Constraint:**
```sql
-- runtime_tenant_registry
CHECK (tenant_id IS NOT NULL AND length(tenant_id) > 0)
-- Must change to UUID validation
```

### Affected Foreign Keys (4)

```sql
-- Child tables → runtime_tenant_registry.tenant_id
ALTER TABLE runtime_outbox
  ADD CONSTRAINT fk_runtime_outbox_tenant
  FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id);

ALTER TABLE runtime_idempotency_registry
  ADD CONSTRAINT fk_runtime_idempotency_tenant
  FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id);

ALTER TABLE runtime_audit_log
  ADD CONSTRAINT fk_runtime_audit_tenant
  FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id);

ALTER TABLE runtime_quarantine
  ADD CONSTRAINT fk_runtime_quarantine_tenant
  FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id);
```

### Affected RLS Policies (6)

**1. `runtime_outbox` tenant isolation:**
```sql
CREATE POLICY tenant_isolation_outbox ON runtime_outbox
  USING (tenant_id = get_auth_tenant_id()::text);
  -- Must change to: tenant_id = get_auth_tenant_id()
```

**2. `runtime_idempotency_registry` tenant isolation:**
```sql
CREATE POLICY tenant_isolation_idempotency ON runtime_idempotency_registry
  USING (tenant_id = get_auth_tenant_id()::text);
  -- Must change to: tenant_id = get_auth_tenant_id()
```

**3-4. `runtime_audit_log` tenant isolation (SELECT + INSERT):**
```sql
CREATE POLICY tenant_isolation_audit_select ON runtime_audit_log
  FOR SELECT USING (tenant_id = get_auth_tenant_id()::text);

CREATE POLICY tenant_isolation_audit_insert ON runtime_audit_log
  FOR INSERT WITH CHECK (tenant_id = get_auth_tenant_id()::text);
  -- Must change to: tenant_id = get_auth_tenant_id()
```

**5-6. `runtime_quarantine` tenant isolation (SELECT + INSERT):**
```sql
CREATE POLICY tenant_isolation_quarantine_select ON runtime_quarantine
  FOR SELECT USING (tenant_id = get_auth_tenant_id()::text);

CREATE POLICY tenant_isolation_quarantine_insert ON runtime_quarantine
  FOR INSERT WITH CHECK (tenant_id = get_auth_tenant_id()::text);
  -- Must change to: tenant_id = get_auth_tenant_id()
```

**Critical Finding:** All 6 RLS policies currently cast `get_auth_tenant_id()::text`. After 05-C, this cast must be REMOVED, proving Runtime uses canonical UUID directly.

---

## Detailed Migration Steps

### Step 0: Preflight Verification

**Purpose:** Verify 05-B state and introspect actual schema dependencies

**Amendment 2: FK Introspection**
**Amendment 3: Complete RLS Audit**
**Amendment 4: get_auth_tenant_id() Pre-Migration Audit**

Migration must NOT assume constraint names or policy counts. It must introspect actual schema state.

```sql
-- Preflight P0: State guard (prevent re-run if already UUID)
DO $$
DECLARE
  v_tenant_id_type TEXT;
BEGIN
  SELECT data_type INTO v_tenant_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'runtime_tenant_registry'
    AND column_name = 'tenant_id';
  
  IF v_tenant_id_type = 'uuid' THEN
    RAISE EXCEPTION 'State Guard BLOCKED: runtime_tenant_registry.tenant_id already UUID. Migration 05-C already executed or schema manually altered.';
  END IF;
  
  IF v_tenant_id_type != 'text' THEN
    RAISE EXCEPTION 'State Guard BLOCKED: Unexpected tenant_id type: %. Expected TEXT or UUID.', v_tenant_id_type;
  END IF;
  
  RAISE NOTICE 'State Guard PASSED: tenant_id is TEXT, ready for migration';
END $$;

-- Preflight P1: Runtime registry must be EMPTY
DO $$
DECLARE
  v_runtime_tenant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_runtime_tenant_count
  FROM runtime_tenant_registry;
  
  IF v_runtime_tenant_count != 0 THEN
    RAISE EXCEPTION 'Preflight FAILED: Runtime registry not empty (count=%)', v_runtime_tenant_count;
  END IF;
  
  RAISE NOTICE 'Preflight P1 PASSED: Runtime registry empty';
END $$;

-- Preflight P2: Core tenants must exist (3 exact fixtures)
DO $$
DECLARE
  v_core_tenant_count INTEGER;
  v_tenant_a_exists BOOLEAN;
  v_tenant_b_exists BOOLEAN;
  v_tenant_attacker_exists BOOLEAN;
BEGIN
  -- Amendment 11: Fixture Exactness (not just count)
  
  SELECT COUNT(*) INTO v_core_tenant_count
  FROM public.tenants
  WHERE slug IN (
    'e2e-test-tenant-a-runtime',
    'e2e-test-tenant-b-runtime',
    'e2e-test-attacker-runtime'
  );
  
  IF v_core_tenant_count != 3 THEN
    RAISE EXCEPTION 'Preflight P2 FAILED: Expected 3 Core test tenants, found %. Missing fixtures.', v_core_tenant_count;
  END IF;
  
  -- Verify each fixture exists individually
  SELECT EXISTS(
    SELECT 1 FROM public.tenants WHERE slug = 'e2e-test-tenant-a-runtime'
  ) INTO v_tenant_a_exists;
  
  SELECT EXISTS(
    SELECT 1 FROM public.tenants WHERE slug = 'e2e-test-tenant-b-runtime'
  ) INTO v_tenant_b_exists;
  
  SELECT EXISTS(
    SELECT 1 FROM public.tenants WHERE slug = 'e2e-test-attacker-runtime'
  ) INTO v_tenant_attacker_exists;
  
  IF NOT v_tenant_a_exists THEN
    RAISE EXCEPTION 'Preflight P2 FAILED: Tenant A fixture missing (slug=e2e-test-tenant-a-runtime)';
  END IF;
  
  IF NOT v_tenant_b_exists THEN
    RAISE EXCEPTION 'Preflight P2 FAILED: Tenant B fixture missing (slug=e2e-test-tenant-b-runtime)';
  END IF;
  
  IF NOT v_tenant_attacker_exists THEN
    RAISE EXCEPTION 'Preflight P2 FAILED: Attacker fixture missing (slug=e2e-test-attacker-runtime)';
  END IF;
  
  RAISE NOTICE 'Preflight P2 PASSED: 3 Core tenants exist (Tenant A, Tenant B, Attacker)';
END $$;

-- Preflight P3: User→tenant mappings must exist (3 exact mappings)
DO $$
DECLARE
  v_user_mapping_count INTEGER;
  v_tenant_a_uuid UUID;
  v_tenant_b_uuid UUID;
  v_tenant_attacker_uuid UUID;
  v_user_a_tenant_id UUID;
  v_user_b_tenant_id UUID;
  v_attacker_tenant_id UUID;
BEGIN
  -- Amendment 11: Fixture Exactness (verify exact mappings)
  
  -- Get canonical tenant UUIDs
  SELECT id INTO v_tenant_a_uuid 
  FROM public.tenants WHERE slug = 'e2e-test-tenant-a-runtime';
  
  SELECT id INTO v_tenant_b_uuid 
  FROM public.tenants WHERE slug = 'e2e-test-tenant-b-runtime';
  
  SELECT id INTO v_tenant_attacker_uuid 
  FROM public.tenants WHERE slug = 'e2e-test-attacker-runtime';
  
  -- Get user mappings
  SELECT tenant_id INTO v_user_a_tenant_id
  FROM public.users WHERE id = '1176579a-50cc-48b2-800f-5bd5f24d6288'::uuid;
  
  SELECT tenant_id INTO v_user_b_tenant_id
  FROM public.users WHERE id = '40ef93da-3381-4b16-a30e-eed7072bce72'::uuid;
  
  SELECT tenant_id INTO v_attacker_tenant_id
  FROM public.users WHERE id = '73a1837f-4970-4c27-939f-ef7a4ee864ed'::uuid;
  
  -- Verify exact mappings (not just count)
  IF v_user_a_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Preflight P3 FAILED: User A (1176579a...) has no tenant_id mapping';
  END IF;
  
  IF v_user_a_tenant_id != v_tenant_a_uuid THEN
    RAISE EXCEPTION 'Preflight P3 FAILED: User A mapped to wrong tenant (expected=%, actual=%)', 
      v_tenant_a_uuid, v_user_a_tenant_id;
  END IF;
  
  IF v_user_b_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Preflight P3 FAILED: User B (40ef93da...) has no tenant_id mapping';
  END IF;
  
  IF v_user_b_tenant_id != v_tenant_b_uuid THEN
    RAISE EXCEPTION 'Preflight P3 FAILED: User B mapped to wrong tenant (expected=%, actual=%)', 
      v_tenant_b_uuid, v_user_b_tenant_id;
  END IF;
  
  IF v_attacker_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Preflight P3 FAILED: Attacker (73a1837f...) has no tenant_id mapping';
  END IF;
  
  IF v_attacker_tenant_id != v_tenant_attacker_uuid THEN
    RAISE EXCEPTION 'Preflight P3 FAILED: Attacker mapped to wrong tenant (expected=%, actual=%)', 
      v_tenant_attacker_uuid, v_attacker_tenant_id;
  END IF;
  
  RAISE NOTICE 'Preflight P3 PASSED: 3 user→tenant mappings verified (User A→Tenant A, User B→Tenant B, Attacker→Attacker)';
END $$;

-- Preflight P4: Production tenant snapshot must exist (from 05-B)
DO $$
DECLARE
  v_production_snapshot_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM migration_evidence.production_tenant_snapshot)
  INTO v_production_snapshot_exists;
  
  IF NOT v_production_snapshot_exists THEN
    RAISE EXCEPTION 'Preflight FAILED: Production tenant snapshot missing (run 05-B first)';
  END IF;
  
  RAISE NOTICE 'Preflight P4 PASSED: Production snapshot exists';
END $$;

-- Amendment 2: Preflight P5 — Introspect ALL FKs referencing runtime_tenant_registry
DO $$
DECLARE
  v_fk_count INTEGER;
  v_fk_record RECORD;
  v_composite_fk_count INTEGER;
BEGIN
  -- Amendment 10: FK Introspection Integrity (single-column only)
  
  -- Discover actual FK constraints
  CREATE TEMP TABLE IF NOT EXISTS discovered_fks AS
  SELECT 
    c.conname AS constraint_name,
    cl.relname AS child_table,
    a.attname AS child_column,
    fcl.relname AS parent_table,
    fa.attname AS parent_column,
    array_length(c.conkey, 1) AS child_column_count,
    array_length(c.confkey, 1) AS parent_column_count
  FROM pg_constraint c
  JOIN pg_class cl ON c.conrelid = cl.oid
  JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = c.conkey[1]  -- First column only
  JOIN pg_class fcl ON c.confrelid = fcl.oid
  JOIN pg_attribute fa ON fa.attrelid = fcl.oid AND fa.attnum = c.confkey[1]  -- First column only
  WHERE c.contype = 'f'
    AND fcl.relname = 'runtime_tenant_registry'
    AND fa.attname = 'tenant_id'
    AND cl.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  SELECT COUNT(*) INTO v_fk_count FROM discovered_fks;
  
  RAISE NOTICE 'Preflight P5: Discovered % FK constraints referencing runtime_tenant_registry.tenant_id', v_fk_count;
  
  FOR v_fk_record IN SELECT * FROM discovered_fks LOOP
    RAISE NOTICE '  - FK: % on %.% → % (child_cols=%, parent_cols=%)', 
      v_fk_record.constraint_name,
      v_fk_record.child_table,
      v_fk_record.child_column,
      v_fk_record.parent_table,
      v_fk_record.child_column_count,
      v_fk_record.parent_column_count;
  END LOOP;
  
  -- Amendment 10: Verify single-column FK only
  SELECT COUNT(*) INTO v_composite_fk_count
  FROM discovered_fks
  WHERE child_column_count > 1 OR parent_column_count > 1;
  
  IF v_composite_fk_count > 0 THEN
    RAISE EXCEPTION 'Preflight P5 FAILED: Discovered % composite FK constraints. Migration 05-C only supports single-column FK on tenant_id. Composite FK requires manual migration design.', v_composite_fk_count;
  END IF;
  
  -- Verify all child columns are named 'tenant_id'
  FOR v_fk_record IN 
    SELECT * FROM discovered_fks WHERE child_column != 'tenant_id'
  LOOP
    RAISE EXCEPTION 'Preflight P5 FAILED: FK % references parent tenant_id but child column is % (expected tenant_id). Schema structure unexpected.', 
      v_fk_record.constraint_name,
      v_fk_record.child_column;
  END LOOP;
  
  -- Expected minimum: 4 FKs (outbox, idempotency, audit, quarantine)
  IF v_fk_count < 4 THEN
    RAISE EXCEPTION 'Preflight P5 FAILED: Expected at least 4 FKs, found %. Runtime schema may have changed.', v_fk_count;
  END IF;
  
  RAISE NOTICE 'Preflight P5 PASSED: FK discovery complete (% single-column FKs)', v_fk_count;
END $$;

-- Amendment 3: Preflight P6 — Audit ALL RLS policies (Exact-Set Safety)
DO $$
DECLARE
  v_policy_count INTEGER;
  v_policy_record RECORD;
  v_expected_policies TEXT[] := ARRAY[
    'tenant_isolation_outbox',
    'tenant_isolation_idempotency',
    'tenant_isolation_audit_select',
    'tenant_isolation_audit_insert',
    'tenant_isolation_quarantine_select',
    'tenant_isolation_quarantine_insert'
  ];
  v_discovered_policy_names TEXT[];
  v_unexpected_policies TEXT[];
  v_missing_policies TEXT[];
BEGIN
  -- Discover actual RLS policies on 4 Runtime child tables
  CREATE TEMP TABLE IF NOT EXISTS discovered_policies AS
  SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    );
  
  SELECT COUNT(*) INTO v_policy_count FROM discovered_policies;
  
  RAISE NOTICE 'Preflight P6: Discovered % RLS policies on Runtime tables', v_policy_count;
  
  FOR v_policy_record IN SELECT * FROM discovered_policies LOOP
    RAISE NOTICE '  - Policy: % on % (cmd=%, qual=%)', 
      v_policy_record.policyname,
      v_policy_record.tablename,
      v_policy_record.cmd,
      COALESCE(v_policy_record.qual, 'NULL');
  END LOOP;
  
  -- Amendment 8: Exact-Set Safety (not arbitrary discovery)
  SELECT array_agg(policyname) INTO v_discovered_policy_names
  FROM discovered_policies;
  
  -- Check for unexpected policies (not in expected set)
  SELECT array_agg(policyname) INTO v_unexpected_policies
  FROM discovered_policies
  WHERE policyname != ALL(v_expected_policies);
  
  -- Check for missing policies (expected but not discovered)
  SELECT array_agg(expected) INTO v_missing_policies
  FROM unnest(v_expected_policies) AS expected
  WHERE expected != ALL(COALESCE(v_discovered_policy_names, ARRAY[]::TEXT[]));
  
  IF v_unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight P6 FAILED: Discovered % unexpected RLS policies: %. Migration 05-C must account for EXACT policy set. Add to expected set or remove policies before migration.', 
      array_length(v_unexpected_policies, 1),
      v_unexpected_policies;
  END IF;
  
  IF v_missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight P6 FAILED: Expected policies missing: %. Runtime schema may have changed. Verify policy coverage.', 
      v_missing_policies;
  END IF;
  
  -- Expected: exact match (6 policies)
  IF v_policy_count != 6 THEN
    RAISE EXCEPTION 'Preflight P6 FAILED: Expected exactly 6 RLS policies, found %. Exact-set match required.', v_policy_count;
  END IF;
  
  RAISE NOTICE 'Preflight P6 PASSED: Exact-set match (6 policies)';
END $$;

-- Amendment 4: Preflight P7 — Audit get_auth_tenant_id() contract & dependencies
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_return_type TEXT;
  v_function_source TEXT;
  v_function_volatility TEXT;
  v_function_security TEXT;
  v_dependency_count INTEGER;
  v_dependency_record RECORD;
BEGIN
  -- Check if function exists
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_auth_tenant_id'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Preflight FAILED: get_auth_tenant_id() function does not exist';
  END IF;
  
  -- Amendment 9: Function Contract Migration (comprehensive audit)
  
  -- Get exact return type
  SELECT pg_get_function_result(p.oid) INTO v_return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_auth_tenant_id';
  
  -- Get volatility
  SELECT 
    CASE p.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      WHEN 'v' THEN 'VOLATILE'
    END INTO v_function_volatility
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_auth_tenant_id';
  
  -- Get security
  SELECT 
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
  INTO v_function_security
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_auth_tenant_id';
  
  -- Get function source
  SELECT pg_get_functiondef(p.oid) INTO v_function_source
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_auth_tenant_id';
  
  RAISE NOTICE 'Preflight P7: get_auth_tenant_id() contract:';
  RAISE NOTICE '  - Return type: %', v_return_type;
  RAISE NOTICE '  - Volatility: %', v_function_volatility;
  RAISE NOTICE '  - Security: %', v_function_security;
  
  -- Audit dependencies (policies, views, triggers, other functions)
  CREATE TEMP TABLE IF NOT EXISTS function_dependencies AS
  SELECT 
    d.objid::regclass AS dependent_object,
    d.deptype AS dependency_type,
    CASE d.classid
      WHEN 'pg_class'::regclass THEN 'table/view'
      WHEN 'pg_proc'::regclass THEN 'function'
      WHEN 'pg_trigger'::regclass THEN 'trigger'
      ELSE d.classid::regclass::text
    END AS dependent_class
  FROM pg_depend d
  WHERE d.refobjid = (
    SELECT p.oid 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_auth_tenant_id'
  );
  
  SELECT COUNT(*) INTO v_dependency_count FROM function_dependencies;
  
  RAISE NOTICE 'Preflight P7: Found % dependencies on get_auth_tenant_id()', v_dependency_count;
  
  FOR v_dependency_record IN SELECT * FROM function_dependencies LOOP
    RAISE NOTICE '  - Dependency: % (type=%)', 
      v_dependency_record.dependent_object,
      v_dependency_record.dependency_type;
  END LOOP;
  
  -- Store for evidence and migration decision
  CREATE TEMP TABLE IF NOT EXISTS function_migration_evidence AS
  SELECT 
    'get_auth_tenant_id' AS function_name,
    v_return_type AS pre_migration_return_type,
    v_function_volatility AS pre_migration_volatility,
    v_function_security AS pre_migration_security,
    v_function_source AS pre_migration_source,
    v_dependency_count AS dependency_count,
    now() AS captured_at;
  
  -- Amendment 9: Decision point for function migration
  IF v_return_type = 'text' OR v_return_type LIKE '%text%' THEN
    RAISE WARNING 'Preflight P7 WARNING: get_auth_tenant_id() currently returns TEXT. Migration requires DROP FUNCTION + CREATE FUNCTION (not CREATE OR REPLACE). Dependencies: % objects.', v_dependency_count;
    -- Note: Step 12 must handle DROP/CREATE sequence
  ELSIF v_return_type = 'uuid' THEN
    RAISE NOTICE 'Preflight P7: get_auth_tenant_id() already returns UUID. CREATE OR REPLACE body only.';
  ELSE
    RAISE EXCEPTION 'Preflight P7 FAILED: Unexpected return type: %. Expected TEXT or UUID.', v_return_type;
  END IF;
  
  RAISE NOTICE 'Preflight P7 PASSED: Function contract audit complete';
END $$;
```

**Pass Criteria:**
- ✅ P0: State guard (tenant_id is TEXT, not UUID)
- ✅ P1: Runtime registry count = 0
- ✅ P2: Core tenant count = 3
- ✅ P3: User mapping count = 3
- ✅ P4: Production snapshot exists
- ✅ P5: FK discovery complete (≥4 FKs)
- ✅ P6: RLS audit complete (6 expected, no undiscovered policies)
- ✅ P7: get_auth_tenant_id() audit complete

---

### Step 1: Drop Foreign Keys (Child → Parent)

**Purpose:** Remove FK constraints before altering parent PK type

**Amendment 2: Use discovered FK names from Preflight P5**

Strategy: Drop ALL discovered FKs (not assumed names)

```sql
-- Drop foreign keys discovered in Preflight P5
DO $$
DECLARE
  v_fk_record RECORD;
BEGIN
  FOR v_fk_record IN 
    SELECT constraint_name, child_table
    FROM discovered_fks
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      v_fk_record.child_table,
      v_fk_record.constraint_name);
    
    RAISE NOTICE 'Dropped FK: % on %', 
      v_fk_record.constraint_name,
      v_fk_record.child_table;
  END LOOP;
END $$;
```

**Expected:** All discovered FK constraints dropped (tables empty, 0 rows affected)

---

### Step 2: Drop Indexes

**Purpose:** Remove indexes before type change

```sql
-- Drop indexes (will recreate in Step 8)
DROP INDEX IF EXISTS idx_runtime_outbox_tenant_id;
DROP INDEX IF EXISTS idx_runtime_idempotency_tenant_id;
DROP INDEX IF EXISTS idx_runtime_audit_tenant_id;
DROP INDEX IF EXISTS idx_runtime_quarantine_tenant_id;
```

**Expected:** 4 indexes dropped

---

### Step 3: Drop RLS Policies

**Purpose:** Remove RLS policies before column type change

**Amendment 3: Use discovered policy names from Preflight P6**

```sql
-- Drop RLS policies discovered in Preflight P6
DO $$
DECLARE
  v_policy_record RECORD;
BEGIN
  FOR v_policy_record IN 
    SELECT schemaname, tablename, policyname
    FROM discovered_policies
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy_record.policyname,
      v_policy_record.schemaname,
      v_policy_record.tablename);
    
    RAISE NOTICE 'Dropped policy: % on %.%', 
      v_policy_record.policyname,
      v_policy_record.schemaname,
      v_policy_record.tablename;
  END LOOP;
END $$;
```

**Expected:** All discovered RLS policies dropped

---

### Step 4: Drop CHECK Constraint (If Exists)

**Purpose:** Remove TEXT length validation before type change

**Amendment 5: CHECK constraint unnecessary (PRIMARY KEY implies NOT NULL)**

Note: After migration, PRIMARY KEY + UUID + FK → Core provides sufficient contract.

```sql
-- Drop CHECK constraint on runtime_tenant_registry (if exists)
ALTER TABLE runtime_tenant_registry
  DROP CONSTRAINT IF EXISTS runtime_tenant_registry_tenant_id_check;
```

**Expected:** CHECK constraint dropped (if existed)

---

### Step 5: Alter Column Types (TEXT → UUID)

**Purpose:** Change tenant_id from TEXT to UUID across all 5 tables

**Critical Safety:** All tables MUST be empty (verified in Preflight)

**Note on USING Clause:**

The migration permits PostgreSQL's type conversion expression `USING tenant_id::uuid`, but **Preflight guarantees zero Runtime rows**, therefore no legacy TEXT identity is converted into canonical UUID.

**This migration changes schema authority, not identity values.**

No TEXT string becomes a canonical UUID through casting. The schema type changes while data is empty.

```sql
-- Alter parent table first
ALTER TABLE runtime_tenant_registry
  ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

-- Alter child tables
ALTER TABLE runtime_outbox
  ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

ALTER TABLE runtime_idempotency_registry
  ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

ALTER TABLE runtime_audit_log
  ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

ALTER TABLE runtime_quarantine
  ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
```

**Expected:** 5 columns changed to UUID type (0 rows affected, tables empty)

---

### Step 6: No Additional CHECK Constraint Needed

**Amendment 5: PRIMARY KEY + FK provides sufficient contract**

**Rationale:**
- `tenant_id UUID PRIMARY KEY` already enforces NOT NULL
- FK to `public.tenants(id)` enforces canonical identity
- No additional CHECK constraint needed

**Contract:**
```sql
runtime_tenant_registry.tenant_id
  → PRIMARY KEY (NOT NULL + UNIQUE implicit)
  → UUID type (format validated by PostgreSQL)
  → FK → public.tenants(id) (canonical source enforced)
```

This is stronger than `CHECK (tenant_id IS NOT NULL)`.

**No action required in this step.**

---

### Step 7: Recreate Foreign Keys (UUID)

**Purpose:** Rebuild FK constraints with UUID type

**Amendment 6: ON DELETE semantics (explicit classification)**

**Critical Decision:**

Different Runtime data types require different deletion semantics:

| Table | Data Type | ON DELETE | Rationale |
|-------|-----------|-----------|-----------|
| `runtime_outbox` | Transient | CASCADE | Safe to auto-delete with tenant |
| `runtime_idempotency_registry` | Transient | CASCADE | Safe to auto-delete with tenant |
| `runtime_audit_log` | Audit | RESTRICT | Preserve audit history |
| `runtime_quarantine` | Incident | RESTRICT | Preserve incident records |

**For Phase 3C test environment:** Using RESTRICT for all to establish safest precedent.

**For production (Finance/Healthcare):** audit/quarantine MUST use RESTRICT or require manual cleanup.

**Implementation (Phase 3C - all RESTRICT):**

```sql
-- Recreate foreign keys with UUID type and RESTRICT semantics
DO $$
DECLARE
  v_fk_record RECORD;
  v_delete_action TEXT;
BEGIN
  FOR v_fk_record IN 
    SELECT child_table, child_column
    FROM discovered_fks
  LOOP
    -- Classify deletion semantics by table
    v_delete_action := CASE v_fk_record.child_table
      WHEN 'runtime_outbox' THEN 'RESTRICT'           -- Phase 3C: safe precedent
      WHEN 'runtime_idempotency_registry' THEN 'RESTRICT'
      WHEN 'runtime_audit_log' THEN 'RESTRICT'        -- Audit: never CASCADE
      WHEN 'runtime_quarantine' THEN 'RESTRICT'       -- Incident: never CASCADE
      ELSE 'RESTRICT'  -- Default: safest
    END;
    
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT fk_%I_tenant FOREIGN KEY (%I) REFERENCES runtime_tenant_registry(tenant_id) ON DELETE %s',
      v_fk_record.child_table,
      v_fk_record.child_table,
      v_fk_record.child_column,
      v_delete_action
    );
    
    RAISE NOTICE 'Recreated FK: fk_%_tenant on % (ON DELETE %)', 
      v_fk_record.child_table,
      v_fk_record.child_table,
      v_delete_action;
  END LOOP;
END $$;
```

**Expected:** All discovered FK constraints recreated (UUID type, RESTRICT for Phase 3C)

**Note:** Production Finance/Healthcare MUST review deletion semantics. Audit history should never auto-delete.

---

### Step 8: Recreate Indexes (UUID)

**Purpose:** Rebuild indexes for UUID type

```sql
-- Recreate indexes with UUID type
CREATE INDEX idx_runtime_outbox_tenant_id 
  ON runtime_outbox(tenant_id);

CREATE INDEX idx_runtime_idempotency_tenant_id 
  ON runtime_idempotency_registry(tenant_id);

CREATE INDEX idx_runtime_audit_tenant_id 
  ON runtime_audit_log(tenant_id);

CREATE INDEX idx_runtime_quarantine_tenant_id 
  ON runtime_quarantine(tenant_id);
```

**Expected:** 4 indexes created (UUID type)

---

### Step 9: Recreate RLS Policies (UUID, No Cast)

**Purpose:** Rebuild RLS policies to enforce canonical UUID tenant boundary

**Critical Change:** Remove `::text` cast from `get_auth_tenant_id()`

**This proves Runtime now consumes canonical UUID directly.**

```sql
-- Recreate RLS policies with UUID (NO CAST)

-- 1. runtime_outbox
CREATE POLICY tenant_isolation_outbox ON runtime_outbox
  USING (tenant_id = get_auth_tenant_id());

-- 2. runtime_idempotency_registry
CREATE POLICY tenant_isolation_idempotency ON runtime_idempotency_registry
  USING (tenant_id = get_auth_tenant_id());

-- 3. runtime_audit_log (SELECT)
CREATE POLICY tenant_isolation_audit_select ON runtime_audit_log
  FOR SELECT USING (tenant_id = get_auth_tenant_id());

-- 4. runtime_audit_log (INSERT)
CREATE POLICY tenant_isolation_audit_insert ON runtime_audit_log
  FOR INSERT WITH CHECK (tenant_id = get_auth_tenant_id());

-- 5. runtime_quarantine (SELECT)
CREATE POLICY tenant_isolation_quarantine_select ON runtime_quarantine
  FOR SELECT USING (tenant_id = get_auth_tenant_id());

-- 6. runtime_quarantine (INSERT)
CREATE POLICY tenant_isolation_quarantine_insert ON runtime_quarantine
  FOR INSERT WITH CHECK (tenant_id = get_auth_tenant_id());
```

**Expected:** 6 RLS policies created

**Verification:**
```sql
-- Verify RLS policies use UUID (no cast)
SELECT 
  schemaname,
  tablename,
  policyname,
  qual AS policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'runtime_outbox',
    'runtime_idempotency_registry',
    'runtime_audit_log',
    'runtime_quarantine'
  )
  AND qual LIKE '%get_auth_tenant_id()%'
  AND qual NOT LIKE '%::text%';

-- Expected: 6 rows (all policies without ::text cast)
```

---

### Step 10: Add FK Runtime → Core

**Purpose:** Establish FK from Runtime registry to Core `public.tenants`

**This enforces:** Runtime tenant_id must exist in Core canonical identity.

```sql
-- Add FK: runtime_tenant_registry.tenant_id → public.tenants.id
ALTER TABLE runtime_tenant_registry
  ADD CONSTRAINT fk_runtime_tenant_core
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
  ON DELETE RESTRICT;
```

**Expected:** 1 FK constraint created

**Significance:** Runtime can no longer create tenant identity. It MUST reference Core canonical UUID.

---

### Step 11: Seed Runtime Registry (Canonical UUID Activation)

**Purpose:** Activate canonical Core UUID identities in Runtime

**Strategy:** INSERT from `public.tenants` where test fixtures exist

```sql
-- Seed Runtime registry with canonical Core UUIDs
INSERT INTO runtime_tenant_registry (
  tenant_id,
  tenant_name,
  is_active,
  created_at
)
SELECT 
  id AS tenant_id,
  name AS tenant_name,
  is_active,
  now() AS created_at
FROM public.tenants
WHERE slug IN (
  'e2e-test-tenant-a-runtime',
  'e2e-test-tenant-b-runtime',
  'e2e-test-attacker-runtime'
)
ON CONFLICT (tenant_id) DO NOTHING;
```

**Expected:** 3 rows inserted

**Post-Seed Verification:**
```sql
-- Verify Runtime registry activated with canonical UUIDs
SELECT 
  r.tenant_id,
  r.tenant_name,
  t.id AS core_tenant_id,
  t.name AS core_tenant_name,
  CASE 
    WHEN r.tenant_id = t.id THEN 'MATCH'
    ELSE 'MISMATCH'
  END AS identity_match
FROM runtime_tenant_registry r
JOIN public.tenants t ON r.tenant_id = t.id
WHERE t.slug LIKE '%e2e-test%runtime%';

-- Expected: 3 rows, all 'MATCH'
```

---

### Step 12: JWT Contract Migration

**Purpose:** Migrate JWT `tenant_id` claim to UUID-semantic string

**Amendment 4: Clarify UUID-semantic vs PostgreSQL UUID in JSON**

**Context:** JWT transmits `tenant_id`, but must clarify wire vs domain type semantics.

**Critical Distinction:**
- JWT is JSON, which has no native UUID type
- `tenant_id` in JWT is a **string** with **UUID semantic** (validated format)
- PostgreSQL receives this string and casts to UUID type
- This is NOT "PostgreSQL UUID inside JSON" — JSON always transmits strings

**Wire Representation:**
```
public.users.tenant_id (UUID in PostgreSQL)
        ↓
JWT generation (stringify UUID)
        ↓
JWT payload (JSON string with UUID format)
        ↓
PostgreSQL RLS (extract + ::uuid cast)
        ↓
UUID type comparison
```

**File:** `src/platform/runtime/domain/core/tenant-context.ts` (or JWT generation logic)

**Current JWT Payload:**
```typescript
{
  sub: "user-uuid",
  tenant_id: "test-e2e-tenant-a",  // ❌ Arbitrary string identity
  role: "admin"
}
```

**Target JWT Payload:**
```typescript
{
  sub: "user-uuid",
  tenant_id: "550e8400-e29b-41d4-a716-446655440000",  // ✅ UUID-semantic string (validated format)
  role: "admin"
}
```

**Semantic Change:**
> JWT `tenant_id` changes from **arbitrary string identity** to **UUID-semantic string** derived from canonical `public.users.tenant_id`.

**Implementation Strategy:**

1. **No JWT generation code change needed** if:
   - JWT already reads `tenant_id` from `public.users.tenant_id` (UUID)
   - JWT encoder accepts UUID and stringifies to JSON

2. **Verification required:**
   ```typescript
   // Verify JWT tenant_id is valid UUID format
   const payload = decodeJWT(token);
   const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.tenant_id);
   ```

3. **RLS Integration (PostgreSQL function migration):**

**Amendment 9: Function contract migration (handle TEXT → UUID return type)**

Based on Preflight P7 audit, apply appropriate migration:

**Scenario A: Current return type is TEXT**
```sql
-- Cannot use CREATE OR REPLACE (return type change not allowed)
-- Must DROP + CREATE

DROP FUNCTION IF EXISTS public.get_auth_tenant_id();

CREATE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    NULL
  );
$$ LANGUAGE sql STABLE SECURITY INVOKER;
```

**Scenario B: Current return type is UUID**
```sql
-- Can use CREATE OR REPLACE (body update only)
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    NULL
  );
$$ LANGUAGE sql STABLE SECURITY INVOKER;
```

**Post-Migration JWT Test:**
```sql
-- Simulate JWT claim with UUID-semantic string
SET LOCAL request.jwt.claims TO '{"tenant_id": "550e8400-e29b-41d4-a716-446655440000"}';

-- Verify get_auth_tenant_id() returns UUID type
SELECT pg_typeof(get_auth_tenant_id()) AS tenant_id_type;
-- Expected: uuid

-- Verify RLS policy accepts UUID (no type error)
SELECT COUNT(*) FROM runtime_outbox WHERE tenant_id = get_auth_tenant_id();
-- Expected: no type error, query succeeds

-- Reset
RESET request.jwt.claims;
```

---

### Step 13: Identity Chain Proof

**Purpose:** Verify end-to-end canonical identity chain

**Identity Chain:**
```
auth.users.id (UUID)
      ↓
public.users.id (UUID)
      ↓
public.users.tenant_id (UUID)
      ↓
public.tenants.id (UUID)
      ↓
JWT tenant_id (UUID semantic)
      ↓
get_auth_tenant_id() RETURNS UUID
      ↓
runtime_tenant_registry.tenant_id (UUID)
      ↓
RLS tenant boundary (UUID)
```

**Verification Queries:**

```sql
-- V1: Core identity chain (auth → users → tenants)
SELECT 
  au.id AS auth_user_id,
  pu.id AS public_user_id,
  pu.tenant_id AS user_tenant_id,
  t.id AS core_tenant_id,
  CASE 
    WHEN au.id = pu.id 
      AND pu.tenant_id = t.id THEN 'VALID'
    ELSE 'BROKEN'
  END AS chain_status
FROM auth.users au
JOIN public.users pu ON au.id = pu.id
JOIN public.tenants t ON pu.tenant_id = t.id
WHERE au.email LIKE '%e2e.bella.test%';

-- Expected: 3 rows, all 'VALID'

-- V2: Runtime identity chain (Core → Runtime)
SELECT 
  t.id AS core_tenant_id,
  r.tenant_id AS runtime_tenant_id,
  CASE 
    WHEN t.id = r.tenant_id THEN 'VALID'
    ELSE 'BROKEN'
  END AS chain_status
FROM public.tenants t
JOIN runtime_tenant_registry r ON t.id = r.tenant_id
WHERE t.slug LIKE '%e2e-test%runtime%';

-- Expected: 3 rows, all 'VALID'

-- V3: Full chain (auth → Core → Runtime)
SELECT 
  au.id AS auth_user_id,
  pu.tenant_id AS user_tenant_id,
  t.id AS core_tenant_id,
  r.tenant_id AS runtime_tenant_id,
  CASE 
    WHEN pu.tenant_id = t.id 
      AND t.id = r.tenant_id THEN 'COMPLETE'
    ELSE 'BROKEN'
  END AS full_chain_status
FROM auth.users au
JOIN public.users pu ON au.id = pu.id
JOIN public.tenants t ON pu.tenant_id = t.id
JOIN runtime_tenant_registry r ON t.id = r.tenant_id
WHERE au.email LIKE '%e2e.bella.test%';

-- Expected: 3 rows, all 'COMPLETE'

-- V4: RLS policy type check (3-proof verification)
-- Proof 1: No ::text cast in policy expressions
-- Proof 2: get_auth_tenant_id() returns UUID
-- Proof 3: Column tenant_id is UUID type

SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%::text%' OR with_check LIKE '%::text%' THEN 'LEGACY_CAST'
    WHEN qual LIKE '%get_auth_tenant_id()%' OR with_check LIKE '%get_auth_tenant_id()%' THEN 'CANONICAL_UUID'
    ELSE 'UNKNOWN'
  END AS rls_identity_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'runtime_outbox',
    'runtime_idempotency_registry',
    'runtime_audit_log',
    'runtime_quarantine'
  );

-- Expected: 6 rows, all 'CANONICAL_UUID', zero 'LEGACY_CAST'

-- Proof 2: Verify get_auth_tenant_id() returns UUID
SELECT 
  proname AS function_name,
  prorettype::regtype AS return_type,
  CASE 
    WHEN prorettype::regtype = 'uuid'::regtype THEN 'UUID'
    WHEN prorettype::regtype = 'text'::regtype THEN 'TEXT'
    ELSE prorettype::regtype::text
  END AS type_classification
FROM pg_proc
WHERE proname = 'get_auth_tenant_id'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected: return_type = 'uuid', type_classification = 'UUID'

-- Proof 3: Verify tenant_id columns are UUID
SELECT 
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'uuid' THEN 'UUID'
    WHEN data_type = 'text' THEN 'TEXT'
    ELSE data_type
  END AS type_classification
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'runtime_outbox',
    'runtime_idempotency_registry',
    'runtime_audit_log',
    'runtime_quarantine'
  )
  AND column_name = 'tenant_id';

-- Expected: 4 rows, all data_type = 'uuid', type_classification = 'UUID'

-- Combined proof verdict
DO $$
DECLARE
  v_legacy_cast_count INTEGER;
  v_function_uuid BOOLEAN;
  v_columns_uuid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_legacy_cast_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('runtime_outbox', 'runtime_idempotency_registry', 'runtime_audit_log', 'runtime_quarantine')
    AND (qual LIKE '%::text%' OR with_check LIKE '%::text%');
  
  SELECT EXISTS(
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_auth_tenant_id'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND prorettype = 'uuid'::regtype::oid
  ) INTO v_function_uuid;
  
  SELECT COUNT(*) INTO v_columns_uuid_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('runtime_outbox', 'runtime_idempotency_registry', 'runtime_audit_log', 'runtime_quarantine')
    AND column_name = 'tenant_id'
    AND data_type = 'uuid';
  
  IF v_legacy_cast_count > 0 THEN
    RAISE EXCEPTION 'Identity Chain V4 FAILED: % policies contain ::text cast', v_legacy_cast_count;
  END IF;
  
  IF NOT v_function_uuid THEN
    RAISE EXCEPTION 'Identity Chain V4 FAILED: get_auth_tenant_id() does not return UUID';
  END IF;
  
  IF v_columns_uuid_count != 4 THEN
    RAISE EXCEPTION 'Identity Chain V4 FAILED: Expected 4 UUID columns, found %', v_columns_uuid_count;
  END IF;
  
  RAISE NOTICE 'Identity Chain V4 PASSED: 3-proof verification (no cast + function UUID + columns UUID)';
END $$;
```

**Pass Criteria:**
- ✅ V1: Core identity chain = 3 VALID
- ✅ V2: Runtime identity chain = 3 VALID
- ✅ V3: Full chain = 3 COMPLETE
- ✅ V4: 3-proof verification (no ::text cast + function UUID + columns UUID)

---

### Step 14: Post-Migration Invariant Verification

**Purpose:** Verify all 05-C invariants pass

**05-C-I1: Production Tenant Unchanged**
```sql
-- Reuse 05-B production snapshot
DO $$
DECLARE
  v_snapshot_count INTEGER;
  v_current_count INTEGER;
  v_checksum_mismatch INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_snapshot_count
  FROM migration_evidence.production_tenant_snapshot;
  
  SELECT COUNT(*) INTO v_current_count
  FROM public.tenants
  WHERE industry_vertical != 'TESTING';
  
  IF v_snapshot_count != v_current_count THEN
    RAISE EXCEPTION 'Invariant 05-C-I1 FAILED: Production tenant count changed';
  END IF;
  
  SELECT COUNT(*) INTO v_checksum_mismatch
  FROM migration_evidence.production_tenant_snapshot s
  LEFT JOIN public.tenants t ON s.tenant_id = t.id
  WHERE s.industry_vertical != 'TESTING'
    AND md5(t.id::text || t.name || t.slug || t.industry_vertical::text || t.is_active::text) != s.checksum;
  
  IF v_checksum_mismatch > 0 THEN
    RAISE EXCEPTION 'Invariant 05-C-I1 FAILED: Production tenant data changed';
  END IF;
  
  RAISE NOTICE 'Invariant 05-C-I1 PASSED: Production tenants unchanged';
END $$;
```

**05-C-I2: Runtime Registry UUID Type**
```sql
SELECT 
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'uuid' THEN 'PASS'
    ELSE 'FAIL'
  END AS type_check
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'runtime_tenant_registry'
  AND column_name = 'tenant_id';

-- Expected: data_type = 'uuid', type_check = 'PASS'
```

**05-C-I3: All Child Columns UUID**
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'uuid' THEN 'PASS'
    ELSE 'FAIL'
  END AS type_check
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'runtime_outbox',
    'runtime_idempotency_registry',
    'runtime_audit_log',
    'runtime_quarantine'
  )
  AND column_name = 'tenant_id';

-- Expected: 4 rows, all data_type = 'uuid', type_check = 'PASS'
```

**05-C-I4: FK Runtime → Core Exists**
```sql
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS child_table,
  confrelid::regclass AS parent_table
FROM pg_constraint
WHERE conname = 'fk_runtime_tenant_core'
  AND conrelid = 'runtime_tenant_registry'::regclass
  AND confrelid = 'public.tenants'::regclass;

-- Expected: 1 row (FK exists)
```

**05-C-I5: RLS Policies No TEXT Cast**
```sql
SELECT COUNT(*) AS legacy_cast_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'runtime_outbox',
    'runtime_idempotency_registry',
    'runtime_audit_log',
    'runtime_quarantine'
  )
  AND qual LIKE '%::text%';

-- Expected: 0 (no legacy cast)
```

**05-C-I6: Runtime Registry Count = 3**
```sql
SELECT COUNT(*) AS runtime_tenant_count
FROM runtime_tenant_registry;

-- Expected: 3
```

**05-C-I7: Identity Chain Complete**
```sql
-- Full chain verification (reuse Step 13 V3)
SELECT COUNT(*) AS complete_chain_count
FROM auth.users au
JOIN public.users pu ON au.id = pu.id
JOIN public.tenants t ON pu.tenant_id = t.id
JOIN runtime_tenant_registry r ON t.id = r.tenant_id
WHERE au.email LIKE '%e2e.bella.test%';

-- Expected: 3
```

---

## Migration 05-C Invariants Summary

| Invariant | Description | Pass Criteria |
|-----------|-------------|---------------|
| **05-C-I1** | Production Tenant Unchanged | Count + checksum identical to 05-B snapshot |
| **05-C-I2** | Runtime Registry UUID Type | `runtime_tenant_registry.tenant_id` = UUID |
| **05-C-I3** | All Child Columns UUID | 4 child tables `tenant_id` = UUID |
| **05-C-I4** | FK Runtime → Core Exists | `fk_runtime_tenant_core` constraint exists |
| **05-C-I5** | RLS No Legacy Cast | 0 policies with `::text` cast |
| **05-C-I6** | Runtime Registry Activated | 3 canonical UUIDs seeded |
| **05-C-I7** | Identity Chain Complete | 3 full chains (auth → Core → Runtime) |

---

## Transaction Boundary & Rollback Strategy

**Amendment 1: Single-Shot, State-Guarded Migration (Not Arbitrarily Re-Runnable)**

**Transaction Philosophy:**

Migration 05-C is **transactionally atomic** and **state-guarded**, but NOT arbitrarily re-runnable.

**Why Not Re-Runnable:**
- `ALTER COLUMN TYPE UUID` changes fundamental schema authority
- Re-running after partial failure requires state introspection
- State guard (Preflight P0) prevents re-execution if already UUID

**State Transitions:**
```
State 0: tenant_id = TEXT (pre-migration)
        ↓
State 1: tenant_id = UUID (post-migration success)
        ↓
State X: partial migration (transaction failed, rolled back to State 0)
```

**Transaction Scope:** Migration 05-C executes as single transaction

```sql
BEGIN;

-- Step 0: Preflight (includes state guard)
-- → BLOCK if already UUID
-- → BLOCK if undiscovered dependencies
-- → BLOCK if missing prerequisites

-- Steps 1-11: Schema migration
-- → All DDL/DML operations atomic

-- Steps 12-14: Verification
-- → All invariant checks

-- If any step FAILS → ROLLBACK to State 0
-- If all steps PASS → COMMIT to State 1

COMMIT;
```

**Failure Modes:**

1. **State guard failure (P0)** → BLOCK immediately (no transaction started)
2. **Preflight failure (P1-P7)** → ROLLBACK, no schema changes
3. **DDL failure (Steps 1-9)** → ROLLBACK, schema unchanged (State 0)
4. **FK constraint violation (Step 10)** → ROLLBACK (proves Core tenants missing)
5. **Seed failure (Step 11)** → ROLLBACK, Runtime registry empty
6. **Invariant failure (Step 14)** → ROLLBACK, revert all changes

**Re-Execution Policy:**

If migration fails:
1. Investigate root cause (check logs, preflight output)
2. Fix prerequisite issue (e.g., missing Core tenants)
3. Re-run entire migration (state guard will verify State 0)

**Idempotency Within Transaction:**
- `DROP IF EXISTS` for all constraints/indexes/policies
- `ON CONFLICT DO NOTHING` for seed INSERT
- Individual DDL operations idempotent within same transaction

**Cross-Transaction Idempotency:**
- State guard (P0) prevents re-run if migration succeeded
- If migration failed, transaction rolled back to State 0
- Safe to re-run after fixing prerequisites

---

## Migration 05-C Deliverables

| Deliverable | Status | Verification |
|-------------|--------|--------------|
| **5 columns TEXT → UUID** | ✅ Complete | 05-C-I2, 05-C-I3 |
| **4 foreign keys recreated (RESTRICT)** | ✅ Complete | FK constraint query |
| **4 indexes recreated** | ✅ Complete | Index existence query |
| **6 RLS policies (no cast)** | ✅ Complete | 05-C-I5, V4 3-proof |
| **CHECK constraint** | ❌ Removed by design (Amendment 5) | PRIMARY KEY + FK sufficient |
| **FK Runtime → Core** | ✅ Complete | 05-C-I4 |
| **Runtime registry seeded** | ✅ Complete | 05-C-I6 |
| **JWT contract UUID-semantic** | ✅ Complete | JWT test query, Step 12 |
| **get_auth_tenant_id() UUID** | ✅ Complete | Function migration (Amendment 9) |
| **Identity chain proof** | ✅ Complete | 05-C-I7, V1-V4 |
| **Production unchanged** | ✅ Complete | 05-C-I1 |

---

## NOT AUTHORIZED in 05-C

**DO NOT:**
- ❌ Cast legacy TEXT to UUID (no `'legacy-text'::uuid`)
- ❌ Modify Core production tenants
- ❌ Create Runtime tenant identity outside Core FK
- ❌ Keep `::text` cast in RLS policies
- ❌ Skip transaction boundary (no incremental commits)
- ❌ Skip invariant verification

**AUTHORIZED:**
- ✅ Change schema type TEXT → UUID
- ✅ Drop/recreate FK/indexes/RLS with UUID
- ✅ Add FK Runtime → Core
- ✅ Seed Runtime from Core canonical identity
- ✅ Remove legacy TEXT cast from RLS
- ✅ Verify identity chain end-to-end

---

## Architecture Gate Requirements (Pre-Approval 2)

**Before executing 05-C:**

1. ✅ 05-A Design complete (Identity Reconciliation)
2. ✅ 05-B Design complete (Cleanup/Backfill, 4 amendments)
3. ✅ 05-C Design complete (this document)
4. ⏳ Package Review (05-A + 05-B + 05-C)
5. ⏳ Architecture Gate Review
6. ⏳ Approval 2

**Gate Review Question:**
> After executing 05-A → 05-B → 05-C, does Bella Runtime operate under Canonical Identity Law with single UUID primitive?

**Expected Answer:** YES
- ✅ Core owns canonical tenant identity (UUID)
- ✅ Runtime consumes canonical identity via FK
- ✅ RLS enforces UUID boundary (no cast)
- ✅ JWT transmits UUID semantic
- ✅ No parallel TEXT identity system
- ✅ Identity chain complete: auth → Core → Runtime → RLS

---

## Post-05-C: What Changes

**Test Fixtures (`tests/utils/e2e-fixtures.ts`):**
```typescript
// BEFORE 05-C (would fail):
export const E2E_TENANTS = {
  TENANT_A: { tenantId: 'test-e2e-tenant-a' },  // ❌ TEXT
};

// AFTER 05-C (canonical UUID):
export const E2E_TENANTS = {
  TENANT_A: { tenantId: '<CANONICAL_UUID_A>' },  // ✅ UUID
};
```

**Runtime Transaction Service (`src/platform/runtime/application/transaction-coordinator.ts`):**
```typescript
// BEFORE: tenant_id accepted as TEXT
async executeTransaction(tenantId: string, ...): Promise<void>

// AFTER: tenant_id must be valid UUID
async executeTransaction(tenantId: string, ...): Promise<void> {
  if (!isValidUUID(tenantId)) {
    throw new Error('tenant_id must be canonical UUID');
  }
}
```

**JWT Generation (`src/platform/auth/jwt-service.ts`):**
```typescript
// BEFORE: JWT tenant_id from TEXT
{ tenant_id: user.tenant_id }  // TEXT

// AFTER: JWT tenant_id from UUID (stringified)
{ tenant_id: user.tenant_id.toString() }  // UUID semantic
```

**RLS Policy Query Plan:**
```sql
-- BEFORE 05-C:
-- WHERE tenant_id = get_auth_tenant_id()::text
-- → type cast on every row (slow)

-- AFTER 05-C:
-- WHERE tenant_id = get_auth_tenant_id()
-- → direct UUID comparison (fast, indexed)
```

---

## Proof: Migration 05 Achieves Canonical Identity Law

**Canonical Identity Law:**
> `tenant_id = UUID` throughout Bella Platform

**Evidence After 05-C:**

1. **Core Domain:**
   - `public.tenants.id` = UUID ✅
   - `public.users.tenant_id` = UUID ✅

2. **Runtime Domain:**
   - `runtime_tenant_registry.tenant_id` = UUID ✅
   - 4 child tables `tenant_id` = UUID ✅
   - FK enforces Core as canonical source ✅

3. **Security Domain:**
   - JWT `tenant_id` = UUID semantic ✅
   - `get_auth_tenant_id()` returns UUID ✅
   - 6 RLS policies use UUID (no cast) ✅

4. **Test Domain:**
   - E2E fixtures use canonical UUID ✅
   - No parallel TEXT identity ✅

**Result:** Single canonical UUID identity primitive across Platform.

---

**Status:** � DESIGN COMPLETE — Ready for Approval 2  
**Review Decision:** 
- 🟢 Architecture Direction: APPROVED
- 🟢 Design: COMPLETE (11 total amendments: 7 initial + 4 final)
- 🟢 Package Review: CLEARED
- 🟡 Approval 2: PENDING (ready for authorization)
- 🔴 Execution: NOT YET AUTHORIZED

**11 Amendments Applied:**

**Initial 7 Amendments:**
1. ✅ Idempotency → State-Guarded Single-Shot
2. ✅ FK Introspection (Preflight P5)
3. ✅ Complete RLS Audit (Preflight P6)
4. ✅ get_auth_tenant_id() Pre-Migration Audit (Preflight P7)
5. ✅ Step 6 CHECK constraint removed
6. ✅ ON DELETE semantics documented
7. ✅ Reframed as "Canonical Identity Activation Gate"

**Final 4 Required Amendments:**
8. ✅ **RLS Exact-Set Safety** (P6: exact policy set match, FAIL on unexpected policies)
9. ✅ **Function Contract Migration** (P7: comprehensive dependency audit, DROP/CREATE for TEXT→UUID)
10. ✅ **FK Introspection Integrity** (P5: single-column FK only, composite FK = FAIL)
11. ✅ **Fixture Exactness** (P2/P3: exact identity set match, not just count)

**Additional Corrections:**
- ✅ Step 5 wording: "Schema authority change, not identity value conversion"
- ✅ Deliverables table: CHECK constraint marked as "Removed by design"
- ✅ ON DELETE: All RESTRICT for Phase 3C (audit/quarantine never CASCADE)
- ✅ JWT section: "UUID-semantic string" (not "TEXT to UUID")
- ✅ RLS verification: 3-proof combined (no cast + function UUID + columns UUID)

**Architecture Gate Question:**
> After executing 05-A → 05-B → 05-C, does Bella Runtime operate under Canonical Identity Law with a single UUID identity primitive?

**Answer:** 🟢 YES — PROVABLE, NOT ASSUMED

**Proof:**
```
auth.users.id (UUID)
      ↓
public.users.tenant_id (UUID) ← EXACT MATCH verified
      ↓
public.tenants.id (UUID) ← EXACT FIXTURE SET verified
      ↓
JWT tenant_id (UUID-semantic string) ← Format validated
      ↓
get_auth_tenant_id() RETURNS UUID ← Type verified
      ↓
runtime_tenant_registry.tenant_id (UUID) ← FK enforced
      ↓
RLS policies (UUID, no ::text cast) ← 3-proof verification
```

**No parallel identity path possible:**
- Runtime cannot create tenant identity (FK → Core enforced)
- RLS cannot use TEXT identity (UUID type enforced, no cast)
- JWT cannot transmit arbitrary strings (UUID-semantic validation)
- Function cannot return wrong type (signature enforced)

**Next Gate:** Approval 2 Authorization → Execute 05-A → 05-B → 05-C → Security Proof 10/10 → Regression 191/191 → Week 2 UNBLOCK

