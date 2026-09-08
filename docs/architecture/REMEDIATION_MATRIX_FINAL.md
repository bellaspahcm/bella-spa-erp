# Final Remediation Matrix

**Date:** 2026-09-05  
**Purpose:** Evidence-based remediation classification before migration creation  
**Status:** Review required - NO MIGRATIONS CREATED YET

---

## CLASSIFICATION METHODOLOGY

**Evidence sources:**
1. Generated types (schema at 2026-08-04)
2. Application code usage
3. Migration references
4. FK/constraint definitions
5. Runtime dependencies

**Classification criteria:**
- **RESTORE:** Strong evidence table exists + active usage + schema known
- **INVESTIGATE:** Conflicting/insufficient evidence
- **REMOVE:** Confirmed dead code with no usage

---

## CATEGORY A: RESTORE (3 tables) ✅ APPROVED FOR CANONICAL MIGRATION

### TABLE 1: `packages` ✅ HIGH CONFIDENCE

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ✅ Line 8856, 33 columns | CONFIRMED |
| **Application Usage** | ✅ 15+ files, critical paths | ACTIVE |
| **Owner** | Bella Spa / Shared | CORE CAPABILITY |
| **Runtime** | ✅ Pricing, forecasting, booking | PRODUCTION |
| **Schema Complete** | ✅ Columns + FKs + indexes + RLS | YES |

**Schema Details:**
```sql
-- Columns: 33 (id, tenant_id, name, module_key, service_kind, full_price, etc.)

-- Primary Key
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Foreign Keys  
tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE  -- Pattern confirmed
template_id UUID REFERENCES packages(id)  -- Self-reference

-- Check Constraints (from 20260608110000_create_beauty_spa_phase2_foundation.sql)
CONSTRAINT packages_module_key_check 
  CHECK (module_key IN ('babycare', 'beauty_spa'))
  
CONSTRAINT packages_service_kind_check
  CHECK (service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation'))
  
CONSTRAINT packages_default_duration_minutes_check
  CHECK (default_duration_minutes BETWEEN 1 AND 1440)
  
CONSTRAINT packages_default_resource_type_check
  CHECK (default_resource_type IS NULL OR ...)

-- Indexes (4 total)
CREATE INDEX idx_packages_tenant_module_kind 
  ON packages (tenant_id, module_key, service_kind, status);
CREATE INDEX idx_packages_template_id ON packages(template_id);
CREATE INDEX idx_packages_is_hq_template ON packages(is_hq_template);
CREATE INDEX idx_packages_product_usage ON packages USING GIN (product_usage);

-- RLS (2 policies)
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read packages"
  FOR SELECT TO authenticated
  USING (
    public.get_auth_tenant_id() IS NULL OR 
    tenant_id = public.get_auth_tenant_id() OR 
    is_hq_template = true  -- Cross-tenant template sharing
  );

CREATE POLICY "Tenant admin manage packages"
  FOR ALL TO authenticated
  USING (
    public.get_auth_tenant_id() IS NULL OR 
    (public.is_admin() AND tenant_id = public.get_auth_tenant_id())
  );

-- Defaults
created_at: NOW()
updated_at: NOW()
before_after_required: DEFAULT false (inferred from Insert optional)
requires_resource: DEFAULT false (inferred from Insert optional)
```

**Dependency Order:**
```
tenants (must exist first)
  ↓
packages (self-referential OK)
  ↓
bookings, waitlist, etc. (dependent tables)
```

**Application Usage Evidence:**
- `src/services/customer-actions.ts:181` - Pricing calculations
- `src/app/api/inventory/forecast/route.ts:162` - Inventory forecasting via product_usage
- `src/modules/bookings/actions/ktv-suggestion-actions.ts:126` - Service resolution
- `src/core/services/order/query-actions.ts:107` - Order processing
- Plus 11 more files

**Action:** CREATE canonical migration with full schema (33 cols + 4 indexes + 2 RLS + 4 checks + 2 FKs)

---

### TABLE 2: `inventory_items` ✅ HIGH CONFIDENCE

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ✅ Line 7449, 12 columns | CONFIRMED |
| **Application Usage** | ✅ HEAVY - 50+ operations | ACTIVE |
| **Owner** | **Bella Spa + Healthcare + Shared** | CORE CAPABILITY |
| **Runtime** | ✅ Stock management, transfers, consumption | PRODUCTION |
| **Schema Complete** | ✅ Columns + FKs, ⚠️ missing indexes/checks | PARTIAL |

**CRITICAL FINDING: This is Bella's PRIMARY inventory storage**

**Usage Evidence:**
- `src/services/inventory-actions.ts` - 20+ operations (CRUD, stock adjustments)
- `src/services/inventory-transfer-actions.ts` - HQ↔Branch transfers
- `src/services/healthcare/healthcare-actions.ts` - Drug inventory (lines 2352, 3448)
- `src/platform/healthcare/engines/pharmacy-engine` - Medication stock management
- `src/services/ai/agents/cpo.ts` - AI inventory analysis

**This answers the original question:**
> **"Bella/Babycare đang lưu inventory ở đâu?"**
> → **Answer: `inventory_items` table (confirmed via generated schema + 50+ application operations)**

**Schema Details:**
```sql
-- Columns: 12
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id UUID NOT NULL  -- FK to tenants
name TEXT NOT NULL
sku TEXT
category TEXT
price_per_unit NUMERIC NOT NULL DEFAULT 0
stock_level INTEGER NOT NULL DEFAULT 0
min_stock_level INTEGER NOT NULL DEFAULT 0
unit TEXT NOT NULL DEFAULT 'unit'
notes TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()

-- Foreign Keys
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE

-- RLS (currently DISABLED in migrations but should be ENABLED)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for inventory items"
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

-- Missing (need to add):
-- Index on tenant_id for performance
-- Index on SKU for lookups
-- Check constraint: stock_level >= 0
-- Check constraint: min_stock_level >= 0
-- Unique constraint on (tenant_id, sku) if SKU is used as identifier
```

**Action:** CREATE canonical migration + ADD missing indexes/constraints

---

### TABLE 3: `inventory_logs` ✅ HIGH CONFIDENCE

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ✅ Line 7509, 13 columns | CONFIRMED |
| **Application Usage** | ✅ HEAVY - audit trail + accounting | ACTIVE |
| **Owner** | Bella Spa + Healthcare + Accounting | CORE CAPABILITY |
| **Runtime** | ✅ Movement tracking, accounting integration | PRODUCTION |
| **Schema Complete** | ✅ Columns + FKs + index + RLS | YES |

**Schema Details:**
```sql
-- Columns: 13
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id UUID NOT NULL
item_id UUID NOT NULL  -- FK to inventory_items
change_amount NUMERIC NOT NULL  -- positive=in, negative=out
reason TEXT NOT NULL
notes TEXT
session_log_id UUID  -- FK to session_logs (links to service consumption)
created_by UUID  -- FK to users
created_at TIMESTAMPTZ DEFAULT NOW()

-- Accounting integration
business_event_type TEXT
accounting_review_status TEXT NOT NULL DEFAULT 'needs_review'
accounting_template_id UUID  -- FK to accounting_event_templates
accounting_metadata JSONB NOT NULL DEFAULT '{}'

-- Foreign Keys (5 total)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
FOREIGN KEY (item_id) REFERENCES inventory_items(id) -- ON DELETE?
FOREIGN KEY (session_log_id) REFERENCES session_logs(id) -- ON DELETE SET NULL?
FOREIGN KEY (created_by) REFERENCES users(id) -- ON DELETE SET NULL?
FOREIGN KEY (accounting_template_id) REFERENCES accounting_event_templates(id) -- ON DELETE SET NULL?

-- Index
CREATE INDEX idx_inventory_logs_business_event
  ON inventory_logs (tenant_id, business_event_type, accounting_review_status);

-- RLS
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for inventory logs"
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());
```

**Usage Evidence:**
- `src/services/inventory-actions.ts` - 15+ audit operations
- Accounting backfills - 44 migration references
- Session consumption tracking via session_log_id FK
- Multi-branch inventory transfers

**Action:** CREATE canonical migration (need to verify ON DELETE behavior for FK constraints)

---

## CATEGORY B: INVESTIGATE (5 objects) ⚠️ DO NOT RESTORE YET

### OBJECT 1: `sessions` ⚠️ UNRESOLVED - BROKEN MVs

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ❌ NOT FOUND | NO TABLE |
| **Migration References** | ⚠️ 54 migrations (MVs/functions) | BROKEN CODE |
| **Actual Table** | ✅ `session_logs` exists | DIFFERENT SCHEMA |
| **Schema Match** | ❌ Column mismatch | NOT COMPATIBLE |

**Critical Mismatch:**
```sql
-- MVs reference (from 20260622273000_create_mv_customer_item_interactions.sql):
s.check_in_time      -- ❌ NOT in session_logs
s.check_out_time     -- ❌ NOT in session_logs
s.customer_id        -- ❌ NOT in session_logs
s.booking_id         -- ✅ EXISTS in session_logs

-- session_logs ACTUAL schema:
id, booking_id, session_number, assigned_date, completed_date,
completed_by_ktv_id, address, status, tenant_id, created_at
```

**Analysis:**
- `sessions` is NOT a typo for `session_logs`
- These are BROKEN materialized views/functions
- MVs expect a different schema that never existed

**Possible scenarios:**
1. Planned VIEW wrapping session_logs + booking data (never created)
2. Separate table planned but never created
3. MVs were never tested/used in production

**Action Required:**
1. ❌ Do NOT create `sessions` table to fix MVs
2. ✅ Investigate each MV individually:
   - Can it be rewritten to use session_logs + JOIN bookings?
   - Is it actually used in production?
   - Should it be removed as dead code?
3. ✅ Check if these MVs are referenced in application code
4. ✅ Check git history for context on when/why they were created

**Status:** UNRESOLVED - requires semantic analysis before action

---

### OBJECT 2: `employees` ⚠️ LIKELY DEAD CODE

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ❌ NOT FOUND | NO TABLE |
| **Migration References** | 13 migrations | LEGACY |
| **Git History** | ✅ Deleted in The Great Purge (20260515010000) | REMOVED |
| **Replacement** | ✅ `people_directory` (Foundation Org Schema) | REFACTORED |

**Evidence:**
```sql
-- 20260515010000_the_great_purge.sql:41
DROP TABLE IF EXISTS public.employees CASCADE;

-- 20260709140001_booking_engine_schema_v2.sql:5
-- Fix: Removed `employees` table reference (not available in current schema)
```

**Action Required:**
1. ✅ Verify no active application code references `employees`
2. ✅ Confirm all functionality migrated to `people_directory`
3. ✅ Remove dangling references in 13 migrations (comment out or remove)

**Status:** Likely safe to remove references, but verify usage first

---

### OBJECT 3: `profiles` ⚠️ AUTH TABLE CONFUSION

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ❌ NOT FOUND | NO TABLE |
| **Migration References** | 4 (all RLS policies) | MINIMAL |
| **Context** | May be `auth.users` or Supabase Auth managed | AMBIGUOUS |

**Evidence:**
```sql
-- 20260701000004_create_policy_rls.sql
SELECT 1 FROM profiles 
WHERE id = auth.uid() AND role IN ('admin', 'manager')
```

**Action Required:**
1. ✅ Check if this should be `auth.users` or `public.users`
2. ✅ Verify Supabase Auth configuration
3. ✅ Check if profiles is a Supabase-managed table in auth schema

**Status:** Ambiguous - may be incorrect schema reference

---

### OBJECT 4: `services` ⚠️ SANDBOX vs PUBLIC CONFUSION

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ❌ NOT in public schema | NOT FOUND |
| **Migration Evidence** | ✅ `CREATE TABLE sandbox.services` | EXISTS IN SANDBOX |
| **References** | 12 migrations reference `public.services` | WRONG SCHEMA |

**Evidence:**
```sql
-- 20260617010000_api_gateway_sandbox_environment.sql:50
CREATE TABLE IF NOT EXISTS sandbox.services (...)

-- But MVs reference:
FROM public.services  -- ❌ Wrong schema
```

**Action Required:**
1. ✅ Verify if `public.services` ever existed
2. ✅ Check if migrations should reference `sandbox.services`
3. ✅ Determine if this is test/development-only code

**Status:** Schema confusion - investigate before action

---

### OBJECT 5: `projects` ⚠️ REAL ESTATE DEMO DATA

| Criterion | Evidence | Status |
|-----------|----------|---------|
| **Generated Schema** | ❌ NOT FOUND | NO TABLE |
| **References** | 17 (mostly seed data) | DEMO/SEED ONLY |
| **Context** | Real Estate partner portal demo | TEST DATA |

**Action Required:**
1. ✅ Check if Real Estate Industry OS has this table
2. ✅ Verify if this is demo-only or production schema
3. ✅ Check application code for references

**Status:** Likely demo/seed data artifact

---

## REMEDIATION SEQUENCE (AFTER APPROVAL)

### ❌ DO NOT PROCEED WITHOUT APPROVAL

**Prerequisites:**
1. ✅ Review this matrix
2. ✅ Approve 3 tables for RESTORE
3. ✅ Decide on 5 INVESTIGATE objects
4. ✅ Verify dependency order
5. ✅ Confirm ON DELETE behaviors

### Phase 1: Restore 3 Core Tables (HIGH PRIORITY)

**Order matters - tenant dependency:**
```
1. Verify tenants table exists (dependency)
2. Create packages (depends on tenants)
3. Create inventory_items (depends on tenants)
4. Create inventory_logs (depends on inventory_items + session_logs)
```

**Migration file:** `20260510000000_restore_spa_core_schema.sql`
**Position:** BEFORE `20260511000000_initial_schema.sql` (which already references packages)

**Contents:**
- CREATE TABLE packages (33 columns, 4 indexes, 2 RLS, 4 checks, 2 FKs)
- CREATE TABLE inventory_items (12 columns, RLS, indexes, checks)
- CREATE TABLE inventory_logs (13 columns, 1 index, RLS, 5 FKs)

### Phase 2: Fix Broken MVs (AFTER INVESTIGATION)

**Do NOT auto-fix - requires case-by-case analysis:**
- Rewrite to use session_logs + JOIN?
- Remove as dead code?
- Create VIEW wrapper?

### Phase 3: Dead Code Cleanup (LOW PRIORITY)

**Only after verification:**
- Comment out employees references
- Fix profiles → auth.users
- Resolve services schema confusion
- Handle projects references

---

## CRITICAL VERIFICATION CHECKLIST

Before creating ANY migrations:

**packages:**
- [ ] Verify all 4 CHECK constraints are correct
- [ ] Confirm ON DELETE CASCADE for tenant_id
- [ ] Confirm self-FK behavior for template_id
- [ ] Verify all 33 columns match generated types exactly
- [ ] Test RLS policies don't break existing functionality

**inventory_items:**
- [ ] Add missing indexes (tenant_id, sku)
- [ ] Add missing checks (stock_level >= 0)
- [ ] Verify this won't break Healthcare/Spa/Babycare
- [ ] Confirm ON DELETE CASCADE for tenant_id

**inventory_logs:**
- [ ] Verify ON DELETE behavior for all 5 FKs
- [ ] Confirm accounting integration won't break
- [ ] Verify session_log_id FK is optional (nullable)

---

## SUCCESS CRITERIA

**After remediation:**
```bash
# Test 1: Fresh DB initialization
npx supabase db reset
# Expected: ✅ ALL migrations pass

# Test 2: Bella Spa regression
# Run Spa smoke tests
# Expected: ✅ No regression

# Test 3: Babycare regression
# Test inventory operations
# Expected: ✅ No regression

# Test 4: Manufacturing Phase 3.5
npx tsx scripts/governance/factory-build.ts manufacturing
# Expected: ✅ UNBLOCKED
```

---

**Status:** ⏸️ AWAITING APPROVAL  
**Next:** Review matrix → Approve 3 tables → Create canonical migration  
**Blocked:** Manufacturing Phase 3.5 (until migration history restored)

---

## KEY INSIGHTS

### 1. Bella DOES have inventory capability
**Question answered:** "Bella/Babycare đang lưu inventory ở đâu?"
- ✅ `inventory_items` - Product/stock master
- ✅ `inventory_logs` - Audit trail + accounting
- ✅ Active usage: 50+ operations across Spa/Healthcare/Babycare
- ❌ Problem: CREATE TABLE statements missing from migration history

### 2. This is migration history drift, not lost capability
- Tables exist in production (confirmed via generated types)
- Application code actively uses them
- Migration history incomplete (missing CREATE statements)
- Fresh DB init fails, but production works

### 3. Manufacturing implementation is correct
- Manufacturing schema is properly designed
- Manufacturing is BLOCKED by pre-existing Spa defect
- NOT a Manufacturing problem

### 4. Some "missing tables" are actually broken code
- `sessions` - Broken MVs referencing non-existent schema
- `employees` - Intentionally deleted, replaced by people_directory
- `services` - Schema confusion (sandbox vs public)

---

**This is database archaeology + schema recovery, not new feature development.**
