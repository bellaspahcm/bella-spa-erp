# Bella Runtime Schema Impact Audit — Migration 05

**Date:** 2026-08-19  
**Purpose:** Audit schema impact before TEXT→UUID migration  
**Decision:** Canonical tenant_id = UUID (RCA #6)  
**Status:** 🔴 IN PROGRESS  

---

## Executive Summary

**Issue:** Runtime tables use `tenant_id TEXT` while Core uses `tenant_id UUID`  
**Decision:** UUID is canonical identity type across platform  
**Action:** Migrate Runtime schema TEXT → UUID  
**Risk:** Schema changes affect Runtime Kernel, must audit all dependencies  

---

## Audit Scope

### 1. Runtime Tables with `tenant_id TEXT`

**From Migration 01-03 (2026-08-18):**

| Table | Column | Type | Constraint | Impact |
|-------|--------|------|------------|--------|
| `runtime_tenant_registry` | `tenant_id` | TEXT PRIMARY KEY | NOT NULL, CHECK length > 0 | HIGH |
| `runtime_outbox` | `tenant_id` | TEXT | NOT NULL | HIGH |
| `runtime_idempotency_registry` | `tenant_id` | TEXT | NOT NULL, part of composite unique | HIGH |
| `runtime_audit_log` | `tenant_id` | TEXT | NOT NULL | HIGH |
| `runtime_quarantine` | `tenant_id` | TEXT | NOT NULL | MEDIUM |

**Total:** 5 tables

---

## Audit Checklist

### ✅ Completed
- [x] Identify Runtime tables with TEXT tenant_id
- [x] Verify Core tables use UUID tenant_id
- [x] Confirm `get_auth_tenant_id()` returns UUID
- [x] Identify schema mismatch blocking test execution

### ✅ Completed
- [x] Audit all indexes on `tenant_id TEXT`
- [x] Audit all unique constraints involving `tenant_id`
- [x] Audit all RLS policies referencing `tenant_id`
- [x] Audit all foreign key relationships
- [x] Catalog all affected objects
- [x] Identify SECURITY DEFINER functions using `tenant_id`

### ⏳ Pending
- [ ] Audit existing runtime data
- [ ] Audit test fixtures using TEXT tenant
- [ ] Design data migration strategy

---

## Detailed Audit Results

### 1. Indexes on `tenant_id TEXT`

**From Migration 01 (20260818000001):**

| Table | Index Name | Definition | Impact |
|-------|-----------|------------|--------|
| `runtime_tenant_registry` | `idx_runtime_tenant_active` | `(is_active) WHERE is_active = true` | LOW - no tenant_id |
| `runtime_tenant_registry` | `idx_runtime_tenant_created` | `(created_at)` | LOW - no tenant_id |
| `runtime_idempotency_registry` | `idx_runtime_idempotency_tenant_key` | `(tenant_id, idempotency_key)` | **HIGH** - composite |
| `runtime_idempotency_registry` | `idx_runtime_idempotency_correlation` | `(correlation_id)` | LOW - no tenant_id |
| `runtime_idempotency_registry` | `idx_runtime_idempotency_expires` | `(expires_at)` | LOW - no tenant_id |
| `runtime_idempotency_registry` | `idx_runtime_idempotency_processed` | `(processed_at)` | LOW - no tenant_id |
| `runtime_outbox` | `idx_runtime_outbox_status` | `(status) WHERE status IN (...)` | LOW - no tenant_id |
| `runtime_outbox` | `idx_runtime_outbox_tenant_status` | `(tenant_id, status)` | **HIGH** - composite |
| `runtime_outbox` | `idx_runtime_outbox_next_retry` | `(next_retry_at) WHERE ...` | LOW - no tenant_id |
| `runtime_outbox` | `idx_runtime_outbox_correlation` | `(correlation_id)` | LOW - no tenant_id |
| `runtime_outbox` | `idx_runtime_outbox_created` | `(created_at)` | LOW - no tenant_id |
| `runtime_audit_log` | `idx_runtime_audit_tenant` | `(tenant_id)` | **HIGH** - single column |
| `runtime_audit_log` | `idx_runtime_audit_correlation` | `(correlation_id)` | LOW - no tenant_id |
| `runtime_audit_log` | `idx_runtime_audit_timestamp` | `(timestamp DESC)` | LOW - no tenant_id |
| `runtime_audit_log` | `idx_runtime_audit_status` | `(status)` | LOW - no tenant_id |
| `runtime_audit_log` | `idx_runtime_audit_entity` | `(entity_type, entity_id)` | LOW - no tenant_id |
| `runtime_quarantine` | `idx_runtime_quarantine_tenant` | `(tenant_id)` | **HIGH** - single column |
| `runtime_quarantine` | `idx_runtime_quarantine_reviewed` | `(reviewed) WHERE ...` | LOW - no tenant_id |
| `runtime_quarantine` | `idx_runtime_quarantine_correlation` | `(correlation_id)` | LOW - no tenant_id |
| `runtime_quarantine` | `idx_runtime_quarantine_quarantined` | `(quarantined_at DESC)` | LOW - no tenant_id |

**Total indexes requiring recreation:** 4  
- `idx_runtime_idempotency_tenant_key`
- `idx_runtime_outbox_tenant_status`
- `idx_runtime_audit_tenant`
- `idx_runtime_quarantine_tenant`

---

### 2. Unique Constraints

| Table | Constraint | Definition | Impact |
|-------|-----------|------------|--------|
| `runtime_idempotency_registry` | `idempotency_tenant_key_unique` | UNIQUE(`tenant_id`, `idempotency_key`) | **CRITICAL** - composite unique |

**Migration Strategy:** DROP → ALTER COLUMN → RECREATE constraint

---

### 3. Foreign Key Relationships

| Child Table | Column | References | Constraint Name | Impact |
|-------------|--------|------------|-----------------|--------|
| `runtime_idempotency_registry` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | `idempotency_tenant_fk` | **CRITICAL** |
| `runtime_outbox` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | `outbox_tenant_fk` | **CRITICAL** |
| `runtime_audit_log` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | `audit_tenant_fk` | **CRITICAL** |
| `runtime_quarantine` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | `quarantine_tenant_fk` | **CRITICAL** |

**Total FK constraints:** 4

**Migration Strategy:**
1. DROP all 4 FK constraints
2. ALTER `runtime_tenant_registry.tenant_id` TEXT → UUID (parent table first)
3. ALTER child tables `tenant_id` TEXT → UUID
4. RECREATE all 4 FK constraints

---

### 4. RLS Policies Referencing `tenant_id`

**From Migration 02 (20260818000002):**

| Table | Policy Name | Condition | Impact |
|-------|------------|-----------|--------|
| `runtime_tenant_registry` | `tenant_isolation_policy_registry_jwt` | `tenant_id = auth.jwt() ->> 'tenant_id'` | **HIGH** - JWT claim TEXT |
| `runtime_idempotency_registry` | `tenant_isolation_policy_idempotency_jwt` | `tenant_id = auth.jwt() ->> 'tenant_id'` | **HIGH** - JWT claim TEXT |
| `runtime_outbox` | `tenant_isolation_policy_outbox_jwt` | `tenant_id = auth.jwt() ->> 'tenant_id'` | **HIGH** - JWT claim TEXT |
| `runtime_audit_log` | `tenant_isolation_policy_audit_jwt` | `tenant_id = auth.jwt() ->> 'tenant_id'` | **HIGH** - JWT claim TEXT |
| `runtime_audit_log` | `audit_append_only_policy_jwt` | `tenant_id = auth.jwt() ->> 'tenant_id'` | **HIGH** - JWT claim TEXT |
| `runtime_quarantine` | `tenant_isolation_policy_quarantine_jwt` | `tenant_id = auth.jwt() ->> 'tenant_id'` | **HIGH** - JWT claim TEXT |

**Total RLS policies:** 6

**CRITICAL FINDING:** All RLS policies compare `tenant_id TEXT` with JWT claim `auth.jwt() ->> 'tenant_id'` (also TEXT)

**After Migration 05:**
- Table column becomes UUID
- JWT claim remains TEXT (or becomes UUID - requires decision)
- RLS policies must use `tenant_id::text` or JWT claim must become UUID

**⚠️ JWT CONTRACT DECISION REQUIRED:**
```sql
-- Option A: Cast column to TEXT for comparison
USING (tenant_id::text = auth.jwt() ->> 'tenant_id')

-- Option B: JWT claim changes to UUID, cast claim
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

---

### 5. CHECK Constraints

| Table | Constraint | Definition | Impact |
|-------|-----------|------------|--------|
| `runtime_tenant_registry` | `tenant_id_not_empty` | `CHECK (length(trim(tenant_id)) > 0)` | **HIGH** - TEXT-specific |

**Migration Strategy:** DROP CHECK constraint (UUID cannot be empty by definition)

---

### 6. SECURITY DEFINER Functions

**From RCA #5:**

```sql
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$  -- ✅ Already returns UUID
DECLARE
    t_id UUID;
BEGIN
    SELECT tenant_id INTO t_id FROM public.users WHERE id = auth.uid();
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Impact:** ✅ NO CHANGES NEEDED - already returns UUID

---

### 7. RPC Parameters

**Migration 04 v1.1:**
```sql
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;  -- ✅ Already UUID
    v_actor_id UUID;
BEGIN
    v_tenant_id := public.get_auth_tenant_id();  -- ✅ Returns UUID
    
    INSERT INTO runtime_outbox (tenant_id, ...)  -- ❌ Column currently TEXT
    VALUES (v_tenant_id, ...);
```

**Impact:** ✅ RPC already uses UUID - Migration 05 fixes table mismatch

---

### 8. Triggers

**From Migration 01:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Impact:** ✅ NO CHANGES NEEDED - doesn't reference tenant_id

---

## Migration 05 Complexity Estimate

### High-Risk Operations (Order Matters)

1. **DROP 4 Foreign Keys** (child → parent dependency)
2. **DROP 1 Unique Constraint** (idempotency)
3. **DROP 1 CHECK Constraint** (tenant_id_not_empty)
4. **ALTER 5 Tables** (parent first, then children)
5. **RECREATE 4 Foreign Keys**
6. **RECREATE 1 Unique Constraint**
7. **DROP + RECREATE 4 Indexes** (composite with tenant_id)
8. **UPDATE 6 RLS Policies** (JWT claim comparison)

### Data Migration Risk

**⚠️ CRITICAL: Must audit existing data before ALTER COLUMN**

```sql
-- Check if runtime_tenant_registry contains UUID-parseable values
SELECT tenant_id,
       tenant_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AS is_uuid
FROM runtime_tenant_registry;
```

**If TEXT values exist (e.g., `test-e2e-tenant-a`):**
- Cannot use `ALTER COLUMN TYPE UUID`
- Must map TEXT → UUID first
- Requires lookup table or hardcoded mapping

---

## JWT Contract Decision

### Issue
RLS policies currently compare:
```sql
tenant_id (soon UUID) = auth.jwt() ->> 'tenant_id' (TEXT)
```

### Options

**Option A: Keep JWT claim as TEXT, cast column**
```sql
-- RLS policy after Migration 05
USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
```
- ✅ No JWT changes required
- ✅ Test fixtures unchanged
- ❌ Type cast on every RLS check (performance)
- ❌ Violates canonical UUID principle

**Option B: Change JWT claim to UUID (RECOMMENDED)**
```sql
-- JWT generation
{
  "sub": "uuid-here",
  "tenant_id": "uuid-here"  -- ✅ Now UUID string
}

-- RLS policy after Migration 05
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```
- ✅ Canonical UUID throughout
- ✅ Type-safe comparison
- ❌ Requires JWT helper changes
- ❌ Test fixtures must use UUID tenants

**Decision:** Option B aligns with Canonical Identity Law

---

## Next Actions

1. **Audit existing runtime data** (check for TEXT tenant values)
2. **Design data migration strategy** (if TEXT values exist)
3. **Update JWT helper** (emit UUID tenant_id claim)
4. **Design Migration 05 SQL** (ordered operations)
5. **Architecture Gate Review**
6. **Freeze Migration 05**

---

**Status:** Schema audit COMPLETE — Awaiting data audit + JWT decision
