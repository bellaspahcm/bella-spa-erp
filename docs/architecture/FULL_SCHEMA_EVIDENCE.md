# Full Schema Evidence: 3 Confirmed Tables

**Date:** 2026-09-05  
**Purpose:** Complete schema extraction for migration restoration  
**Status:** Evidence collection complete - NO REMEDIATION YET

---

## TABLE 1: `packages` ✅ CONFIRMED EXISTS

### Generated Types Evidence (Line 8856, generated 2026-08-04)

**Columns:** 33 total

```
id                              UUID (PK, default gen_random_uuid())
tenant_id                       UUID (FK → tenants.id, nullable)
name                            TEXT (NOT NULL)
module_key                      TEXT (NOT NULL)
service_kind                    TEXT (NOT NULL)
full_price                      NUMERIC (NOT NULL)
total_sessions                  INTEGER (NOT NULL, default inferred)
default_duration_minutes        INTEGER (NOT NULL)
price                           NUMERIC (nullable)
duration                        TEXT (nullable)
description                     TEXT (nullable)
details                         TEXT[] (nullable)
offer                           TEXT (nullable)
ktv_commission                  NUMERIC (nullable)
session_multiplier              NUMERIC (nullable)
status                          TEXT (nullable)
is_hq_template                  BOOLEAN (nullable)
template_id                     UUID (FK → packages.id, self-reference, nullable)
before_after_required           BOOLEAN (NOT NULL, default inferred)
requires_resource               BOOLEAN (NOT NULL, default inferred)
default_resource_type           TEXT (nullable)
care_note_template              TEXT (nullable)
service_category                TEXT (nullable)
estimated_duration              INTEGER (nullable)
required_workers                INTEGER (nullable)
price_floor                     NUMERIC (nullable)
price_cap                       NUMERIC (nullable)
allowed_franchise_override      BOOLEAN (nullable)
metadata                        JSONB (nullable)
product_usage                   JSONB (nullable) -- Critical for inventory forecasting
created_at                      TIMESTAMPTZ (nullable, default NOW() inferred)
updated_at                      TIMESTAMPTZ (nullable, default NOW() inferred)
```

### Foreign Keys (from Generated Types)

```sql
-- Self-reference for template inheritance
FOREIGN KEY (template_id) REFERENCES packages(id)

-- Tenant isolation
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
```

###

 Indexes (from Migrations)

```sql
-- From 20260608110000_create_beauty_spa_phase2_foundation.sql:80
CREATE INDEX idx_packages_tenant_module_kind 
  ON public.packages (tenant_id, module_key, service_kind, status);

-- From 20260522040000_brand_service_master.sql:12-13
CREATE INDEX idx_packages_template_id ON public.packages(template_id);
CREATE INDEX idx_packages_is_hq_template ON public.packages(is_hq_template);

-- From 20260716000000_add_product_usage_to_packages.sql:23
CREATE INDEX idx_packages_product_usage ON packages USING GIN (product_usage);
```

### RLS Policies (from Migrations)

```sql
-- From 20260819040000_fix_legacy_spa_rls_policies.sql:13-20
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read packages" ON public.packages
    FOR SELECT TO authenticated
    USING (
      public.get_auth_tenant_id() IS NULL OR 
      tenant_id = public.get_auth_tenant_id() OR 
      is_hq_template = true  -- Allow reading HQ templates across tenants
    );

CREATE POLICY "Tenant admin manage packages" ON public.packages
    FOR ALL TO authenticated
    USING (
      public.get_auth_tenant_id() IS NULL OR 
      (public.is_admin() AND tenant_id = public.get_auth_tenant_id())
    );
```

### Check Constraints (Inferred from Usage)

```sql
-- status values seen in application code
CHECK (status IN ('active', 'inactive', 'archived', ...))  -- Exact values TBD

-- module_key values (from application)
-- 'beauty_spa', 'industrial_cleaning', etc.

-- service_kind values (from application)  
-- 'service', 'package', etc.
```

### Defaults (Inferred)

```sql
id: gen_random_uuid()
created_at: NOW()
updated_at: NOW()
before_after_required: false  -- Insert shows optional
requires_resource: false  -- Insert shows optional
total_sessions: 1  -- Insert shows optional
```

### Application Usage

**15+ files, critical paths:**
- Pricing: `src/services/customer-actions.ts:181`
- Inventory forecasting: `src/app/api/inventory/forecast/route.ts:162` (product_usage)
- KTV assignment: `src/modules/bookings/actions/ktv-suggestion-actions.ts:126`
- Order processing: `src/core/services/order/query-actions.ts:107`

### Missing Information

⚠️ **Need to verify:**
- Exact CHECK constraint values for status, module_key, service_kind
- Trigger for updated_at auto-update (if exists)
- ON DELETE behavior for FKs (CASCADE? SET NULL?)

---

## TABLE 2: `inventory_items` ✅ CONFIRMED EXISTS

### Generated Types Evidence (Line 7449)

**Columns:** 12 total

```
id                  UUID (PK, default gen_random_uuid())
tenant_id           UUID (FK → tenants.id, NOT NULL)
name                TEXT (NOT NULL)
sku                 TEXT (nullable)
category            TEXT (nullable)
price_per_unit      NUMERIC (NOT NULL, default inferred)
stock_level         INTEGER (NOT NULL, default inferred)
min_stock_level     INTEGER (NOT NULL, default inferred)
unit                TEXT (NOT NULL, default inferred)
notes               TEXT (nullable)
created_at          TIMESTAMPTZ (nullable, default NOW())
updated_at          TIMESTAMPTZ (nullable, default NOW())
```

### Foreign Keys

```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  -- ON DELETE behavior TBD (likely CASCADE for tenant isolation)
```

### RLS Policies (from Migrations)

```sql
-- From 20260819040000_fix_legacy_spa_rls_policies.sql:45-49
-- ⚠️ COMMENTED OUT in current migrations with note "table never created"
-- But table DOES exist per generated types!

-- Should be:
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for inventory items" ON public.inventory_items
    FOR ALL TO authenticated
    USING (
      public.get_auth_tenant_id() IS NULL OR 
      tenant_id = public.get_auth_tenant_id()
    );
```

### Application Usage

**Critical:** Used in inventory forecasting via `packages.product_usage` JSONB field
- Maps product_id → quantity consumed per session
- `src/app/api/inventory/forecast/route.ts:162`

### Missing Information

⚠️ **Need to verify:**
- Indexes (none found in migrations)
- Unique constraints on SKU?
- Check constraints on stock_level >= 0?
- Defaults for stock_level, min_stock_level, unit

---

## TABLE 3: `inventory_logs` ✅ CONFIRMED EXISTS

### Generated Types Evidence (Line 7509)

**Columns:** 13 total

```
id                          UUID (PK, default gen_random_uuid())
tenant_id                   UUID (FK → tenants.id, NOT NULL)
item_id                     UUID (FK → inventory_items.id, NOT NULL)
change_amount               NUMERIC (NOT NULL) -- positive = stock in, negative = consumption
reason                      TEXT (NOT NULL)
notes                       TEXT (nullable)
session_log_id              UUID (FK → session_logs.id, nullable)
created_by                  UUID (FK → users.id, nullable)
created_at                  TIMESTAMPTZ (nullable, default NOW())

-- Accounting integration
business_event_type         TEXT (nullable)
accounting_review_status    TEXT (NOT NULL, default inferred)
accounting_template_id      UUID (FK → accounting_event_templates.id, nullable)
accounting_metadata         JSONB (NOT NULL, default '{}' inferred)
```

### Foreign Keys

```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
FOREIGN KEY (item_id) REFERENCES inventory_items(id)
FOREIGN KEY (session_log_id) REFERENCES session_logs(id)
FOREIGN KEY (created_by) REFERENCES users(id)
FOREIGN KEY (accounting_template_id) REFERENCES accounting_event_templates(id)
```

### Indexes

```sql
-- From 20260530050000_accounting_templates_and_readiness.sql:118
CREATE INDEX idx_inventory_logs_business_event
  ON public.inventory_logs (tenant_id, business_event_type, accounting_review_status);
```

### RLS Policies

```sql
-- From 20260819040000_fix_legacy_spa_rls_policies.sql:53-56
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for inventory logs" ON public.inventory_logs
    FOR ALL TO authenticated
    USING (
      public.get_auth_tenant_id() IS NULL OR 
      tenant_id = public.get_auth_tenant_id()
    );
```

### Application Usage

**Heavily integrated with accounting system:**
- Accounting backfills: 44 migration references
- Business event tracking
- MVs for inventory status (commented out due to missing inventory_items)
- Session-based consumption tracking via session_log_id FK

### Missing Information

⚠️ **Need to verify:**
- Check constraint on accounting_review_status values
- Default for accounting_metadata
- Trigger for accounting integration?

---

## ⚠️ UNRESOLVED: `sessions` References

### Evidence Summary

**Generated Types:** ❌ NOT FOUND

**Migration References:** 54 migrations reference `public.sessions`

**Actual Table:** `session_logs` exists (created in 20260511000000_initial_schema.sql:75)

### Critical Schema Mismatch

**MVs reference columns that DON'T exist in session_logs:**

```sql
-- MV queries use:
s.check_in_time      -- ❌ NOT in session_logs
s.check_out_time     -- ❌ NOT in session_logs  
s.customer_id        -- ❌ NOT in session_logs
s.booking_id         -- ✅ EXISTS in session_logs

-- session_logs ACTUAL schema:
id, booking_id, session_number, assigned_date, completed_date,
completed_by_ktv_id, address, status, tenant_id, created_at
```

### Classification

⚠️ **This is NOT a simple typo `sessions → session_logs`**

**Possible scenarios:**
1. `sessions` was planned as a VIEW wrapping session_logs + booking data
2. `sessions` was a separate table that was never created
3. MVs are broken and were never actually used in production

**Action Required:** Semantic analysis of each MV to determine if they can be fixed or should be removed

**Status:** UNRESOLVED - requires deeper investigation

---

## REMEDIATION SCOPE (After Review)

### Phase 1: Restore CREATE TABLE for 3 Confirmed Tables

```
packages (33 columns, 4 indexes, 2 RLS policies, 1 self-FK)
inventory_items (12 columns, RLS policy currently disabled)
inventory_logs (13 columns, 1 index, 1 RLS policy, 5 FKs)
```

### Phase 2: Fix Broken MV References

```
sessions → Investigate semantic mapping
         → May require VIEW creation or MV removal
```

### Phase 3: Dead Code Cleanup (Low Priority)

```
employees, profiles, services, projects
→ Remove references after usage verification
```

---

**Status:** ✅ EVIDENCE COMPLETE for 3 tables  
**Next:** Review evidence → Create canonical CREATE TABLE migrations  
**Blocked:** Manufacturing Phase 3.5 (pending migration history restoration)
