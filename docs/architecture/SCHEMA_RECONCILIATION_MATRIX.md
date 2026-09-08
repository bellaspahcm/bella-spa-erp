# Schema Reconciliation Matrix

**Date:** 2026-09-05  
**Purpose:** Evidence collection for migration remediation - NO CHANGES YET  
**Status:** In progress

---

## ⚠️ CRITICAL CORRECTION TO INITIAL FINDINGS

**Initial claim:** 4 tables found in generated types  
**Actual verification:** ONLY 3 tables found

| Table | Generated Types | Status |
|-------|----------------|---------|
| `packages` | ✅ Line 8856 | CONFIRMED EXISTS |
| `inventory_items` | ✅ Line 7449 | CONFIRMED EXISTS |
| `inventory_logs` | ✅ Line 7509 | CONFIRMED EXISTS |
| `sessions` | ❌ NOT FOUND | **DEAD CODE or renamed** |

**Critical learning:** Must verify each table individually, not assume based on pattern.

---

## UPDATED CLASSIFICATION

### Category A: Tables CONFIRMED in Generated Schema (3 tables)

| Table | Line | Columns | Status |
|-------|------|---------|---------|
| `packages` | 8856 | 33 | ✅ RESTORE CREATE migration |
| `inventory_items` | 7449 | ~10 | ✅ RESTORE CREATE migration |
| `inventory_logs` | 7509 | ~15 | ✅ RESTORE CREATE migration |

### Category B: Tables NOT in Generated Schema (5 tables)

| Table | Migration Refs | Status |
|-------|---------------|---------|
| `sessions` | 54 | ⚠️ INVESTIGATE - heavily referenced but missing |
| `employees` | 13 | 🟢 Dead code (confirmed deleted) |
| `profiles` | 4 | 🟢 Dead code or auth.users alias |
| `services` | 12 | 🟢 Dead code (sandbox only) |
| `projects` | 17 | 🟢 Dead code (Real Estate demo) |

---

## TABLE 1: `packages`

### Generated Types Evidence (Line 8856)

**Columns:** 33 total

```typescript
{
  id: string                              // UUID
  tenant_id: string | null                // FK to tenants
  name: string                            // NOT NULL
  module_key: string                      // NOT NULL (inferred)
  service_kind: string                    // NOT NULL (inferred)
  full_price: number                      // NOT NULL
  total_sessions: number                  // NOT NULL (default inferred)
  default_duration_minutes: number        // NOT NULL
  price: number | null
  duration: string | null
  description: string | null
  details: string[] | null
  offer: string | null
  ktv_commission: number | null
  session_multiplier: number | null
  status: string | null
  is_hq_template: boolean | null
  template_id: string | null              // Possible FK to packages(id)
  before_after_required: boolean          // NOT NULL (default inferred)
  requires_resource: boolean              // NOT NULL (default inferred)
  default_resource_type: string | null
  care_note_template: string | null
  service_category: string | null
  estimated_duration: number | null
  required_workers: number | null
  price_floor: number | null
  price_cap: number | null
  allowed_franchise_override: boolean | null
  metadata: Json | null
  product_usage: Json | null              // CRITICAL for inventory forecasting
  created_at: string | null               // TIMESTAMPTZ
  updated_at: string | null               // TIMESTAMPTZ
}
```

### Application Usage Evidence

**Files using packages:** 15+

**Critical usages:**
1. `src/services/customer-actions.ts:181` - Pricing calculation
   ```typescript
   const pkg = booking.packages as { name?: string; price?: number; total_sessions?: number };
   ```

2. `src/app/api/inventory/forecast/route.ts:162` - Inventory forecasting
   ```typescript
   const pkg = booking.packages as { product_usage?: Record<string, number> };
   ```

3. `src/modules/bookings/actions/ktv-suggestion-actions.ts:126` - Service resolution
   ```typescript
   const pkgData = booking.packages as { module_key?: string; default_duration_minutes?: number };
   ```

**Usage pattern:** FK relationship from `bookings.package_id → packages.id`

### Migration References

- First reference: `20260511000000_initial_schema.sql:61` (bookings.package_id)
- Total references: 120+ migrations
- ALTER TABLE: `20260515040000_create_packages_table.sql` (says "table exists")
- Column additions: Multiple migrations add columns (session_multiplier, product_usage, etc.)

### Missing Schema Information

⚠️ **Need to determine:**
- Primary key constraint definition
- Foreign key to `tenants(id)` - ON DELETE behavior?
- Foreign key to `packages(id)` (template_id) - self-reference?
- Unique constraints (if any)
- Indexes beyond PK
- RLS policies (tenant isolation?)
- Check constraints on `status`, `module_key`, `service_kind`
- Default values (uuid generation, NOW(), booleans)
- Triggers (updated_at auto-update?)

### Source/Timestamp

⚠️ **Unknown:** When was `supabase-generated.ts` last generated?

---

## TABLE 2: `sessions`

### Generated Types Evidence

**Status:** ❌ NOT FOUND in generated types

### Critical Discovery

**The table `sessions` does NOT exist. References are to:**
1. **`session_logs`** - The ACTUAL table (created in `20260511000000_initial_schema.sql:75`)
2. **Broken MVs/functions** - Incorrectly reference `public.sessions` instead of `session_logs`

**Evidence:**
```sql
-- ACTUAL table that exists
CREATE TABLE IF NOT EXISTS session_logs (...)

-- But MVs incorrectly reference:
FROM public.sessions s  -- ❌ WRONG - should be session_logs
```

**Broken migrations referencing `sessions`:**
- `20260622273000_create_mv_customer_item_interactions.sql` - MV creation FAILS
- `20260622274000_create_demand_history_rpcs.sql` - Function references sessions
- `20260622275000_create_recommendation_rpcs.sql` - Function references sessions

### Classification

⚠️ **This is NOT a missing table - this is BROKEN MIGRATIONS**

**Action Required:** Fix migrations to reference `session_logs` instead of `sessions`

**NOT a CREATE TABLE issue - it's a typo/naming issue in MVs**

---

## TABLE 3: `inventory_items`

### Generated Types Evidence (Line 7449)

**Status:** ⚠️ CRITICAL - Previously thought to be dead code

### Application Usage Evidence

**New finding:** USED in inventory forecasting

```typescript
// src/app/api/inventory/forecast/route.ts:162
const pkg = booking.packages as { product_usage?: Record<string, number> };
// product_usage maps to inventory_items
```

### Migration References

- 31 references total
- Many DISABLED with comments "table never created"
- But generated types prove it EXISTS

### Critical Question

⚠️ **Must answer:**
```
Is inventory_items the PRIMARY inventory storage for Bella/Babycare?
      ↓
Or is it a reference/catalog table?
      ↓
Where does actual product stock/inventory live?
```

### Missing Schema Information

⚠️ **Need to extract:**
- Full schema from generated types
- Relationship to inventory_logs
- Relationship to product_usage in packages
- Babycare-specific usage

---

## TABLE 4: `inventory_logs`

### Generated Types Evidence (Line 7509)

**Status:** ⚠️ CRITICAL - Audit trail for inventory

### Application Usage Evidence

**Migration references:** 44 migrations (heavily used in accounting)

**Known usages:**
- Accounting backfills
- Business event tracking
- MV for inventory status

### Critical Relationship

```
inventory_items (catalog/items)
      ↓
inventory_logs (movements/audit)
      ↓
accounting system integration
```

### Missing Schema Information

⚠️ **Need to extract:**
- Full schema from generated types
- FK to inventory_items
- Accounting integration columns
- Triggers/audit mechanisms

---

## DEAD CODE VERIFICATION

### TABLE 5: `employees`

**Generated types:** ❌ NOT FOUND  
**Migration references:** 13

**Known context:**
- Deleted in `20260515010000_the_great_purge.sql`
- Replaced by `people_directory` (Foundation Org Schema)
- Migration `20260709140001_booking_engine_schema_v2.sql` has comment: "Removed employees table reference (not available)"

**Verification needed:**
```bash
# Check if any active code still references employees table
grep -r "from employees" src/ --include="*.ts" --include="*.tsx"
grep -r "employees\." src/ | grep -v "auto_" | grep -v "comment"
```

**Hypothesis:** Dead code - safely removable

---

### TABLE 6: `profiles`

**Generated types:** ❌ NOT FOUND  
**Migration references:** 4 (all in RLS policies)

**Context:** Referenced in `20260701000004_create_policy_rls.sql`

**Verification needed:**
```bash
# Check if profiles is an alias for auth.users
grep -r "profiles" src/ --include="*.ts"
# Check Supabase auth integration
```

**Hypothesis:** May be `auth.users` or legacy auth table

---

### TABLE 7: `services`

**Generated types:** ❌ NOT FOUND  
**Migration references:** 12

**⚠️ CONFLICTING EVIDENCE:**
- Audit found: `CREATE TABLE sandbox.services` in migration `20260617010000_api_gateway_sandbox_environment.sql`
- But NOT in `public` schema

**Verification needed:**
```bash
# Distinguish between public.services and sandbox.services
grep -r "services" supabase/migrations/ | grep -i "create table"
grep -r "public\.services" src/
```

**Hypothesis:** Exists in sandbox only, not in public schema

---

### TABLE 8: `projects`

**Generated types:** ❌ NOT FOUND  
**Migration references:** 17 (mostly in Real Estate seed data)

**Context:** Referenced in `supabase/seed_data/partner_portal_demo_data.sql`

**Verification needed:**
```bash
# Check if projects is Real Estate specific
grep -r "from projects" src/ --include="*.ts"
grep -r "real.estate.*project" src/
```

**Hypothesis:** Real Estate demo data, may not be in base schema

---

## NEXT ACTIONS (IN ORDER)

### ❌ DO NOT YET:
- Create any migrations
- Modify existing migrations
- Remove any references
- Make assumptions about missing schema elements

### ✅ MUST DO NEXT:

1. **Extract full schema for 4 existing tables:**
   ```bash
   # Read full type definitions
   # Line 8856: packages
   # Line 15675: sessions
   # Line 7449: inventory_items
   # Line 7509: inventory_logs
   ```

2. **Search for constraint/FK definitions in migrations:**
   ```bash
   # Find FK definitions
   grep -r "REFERENCES packages" supabase/migrations/
   grep -r "REFERENCES inventory_items" supabase/migrations/
   
   # Find RLS policies
   grep -r "CREATE POLICY.*packages" supabase/migrations/
   
   # Find indexes
   grep -r "CREATE INDEX.*packages" supabase/migrations/
   ```

3. **Verify Babycare inventory usage:**
   ```bash
   # Find Babycare-specific inventory operations
   grep -r "babycare" src/ | grep -i "inventory"
   grep -r "inventory" src/ | grep -i "product\|item"
   ```

4. **Check generated types timestamp:**
   ```bash
   # When was schema last generated?
   git log -1 --format="%ai" -- src/types/supabase-generated.ts
   head -20 src/types/supabase-generated.ts  # Check for timestamp comment
   ```

5. **Verify dead code tables in application:**
   ```bash
   # Each of: employees, profiles, services, projects
   grep -r "from $TABLE" src/ --include="*.ts"
   ```

---

**Status:** ⏸️ EVIDENCE COLLECTION IN PROGRESS  
**Next:** Complete schema extraction → Review → Then decide remediation  
**Do NOT proceed to Phase 1 (CREATE migrations) until matrix complete**
