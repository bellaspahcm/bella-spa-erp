# Migration Defect Investigation — inventory_items Dangling Dependency

**Date:** 2026-09-05  
**Status:** DEFECT IDENTIFIED  
**Impact:** Blocks Supabase initialization, Phase 3.5 validation blocked

---

## FINDING

**`inventory_items` table:**
- ❌ Never created in any migration
- ❌ Not used in application code
- ✅ Referenced in 9 subsequent migrations
- ✅ First reference: `20260512000000_fix_permissions.sql` (Bella Spa)

**Classification:** DANGLING DEPENDENCY

**Root cause:** Table was planned/expected but CREATE TABLE migration never executed or was removed

---

## EVIDENCE

### 1. No CREATE TABLE Statement

```bash
grep -r "CREATE TABLE.*inventory_items" supabase/migrations/
# Result: No matches
```

### 2. No Application Usage

```bash
# Search entire codebase (excluding migrations/docs)
file_search: inventory_items
# Result: No files found
```

### 3. References in Migrations

**9 migrations reference non-existent table:**

1. `20260512000000_fix_permissions.sql` - Bella Spa permission fix
2. `20260520000003_audit_all_tables.sql` - Audit trigger
3. `20260523010000_harden_all_database_rls.sql` - RLS policies
4. `20260622181000_create_mv_inventory_status.sql` - Materialized view
5. `20260711134600_fix_backfill_earned_revenue_and_inventory_cost.sql` - Join
6. `20260715223000_fix_inventory_purchase_backfill_payment_method.sql` - Join
7. `20260806050000_healthcare_platform_extended_schema.sql` - FK reference
8. `20260808000004_create_perioperative_platform.sql` - FK references
9. `20260819040000_fix_legacy_spa_rls_policies.sql` - RLS policy

### 4. Migration Context

**20260512000000_fix_permissions.sql** references Bella Spa tables:
- customers
- bookings
- session_logs
- revenue
- expenses
- salary_records
- kpi_records
- **inventory_items** ← dangling
- membership_records

**All other tables exist EXCEPT inventory_items**

---

## ROOT CAUSE

**Hypothesis:** 

`inventory_items` was part of Bella Spa planned schema but:
1. CREATE TABLE migration was never written, OR
2. CREATE TABLE migration was removed/rolled back, OR  
3. Table creation was done manually in dev but never migrated

**Subsequent migrations incorrectly assumed table exists.**

---

## IMPACT

**Supabase initialization fails:**

```
ERROR: relation "inventory_items" does not exist (SQLSTATE 42P01)
At statement: 14
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY
```

**Blocks:**
- ✅ Local Supabase startup
- ✅ Database reset
- ✅ Factory Phase 3.5 validation (Manufacturing)
- ✅ Any fresh database initialization

---

## REMEDIATION OPTIONS

### Option A: Remove All References (Recommended)

**Rationale:**
- Table never existed
- Not used in application
- References are dead code

**Action:** Comment out or remove all 9 references to `inventory_items`

**Risk:** LOW (table doesn't exist, no data loss)

### Option B: Create Missing Table

**Rationale:** Preserve migration intent

**Action:** Create `inventory_items` table schema based on reference context

**Risk:** MEDIUM (creates unused table, unclear schema requirements)

**NOT RECOMMENDED:** No evidence of what schema should be

### Option C: Create Conditional Migration

**Rationale:** Allow initialization to proceed

**Action:** Wrap references in `IF EXISTS` checks

**Risk:** LOW but leaves dead code

---

## RECOMMENDED FIX

**Remove dangling references from 9 migrations.**

**Principle:** Don't create tables just to make migrations pass

**Files to fix:**
1. `20260512000000_fix_permissions.sql` - Comment out inventory_items line
2. `20260520000003_audit_all_tables.sql` - Comment out trigger
3. `20260523010000_harden_all_database_rls.sql` - Comment out policies
4. `20260622181000_create_mv_inventory_status.sql` - Remove FROM clause
5. `20260711134600_fix_backfill...sql` - Remove JOIN
6. `20260715223000_fix_inventory...sql` - Remove JOIN
7. `20260806050000_healthcare...sql` - Remove FK
8. `20260808000004_create_perioperative...sql` - Remove FKs
9. `20260819040000_fix_legacy...sql` - Comment out policy

---

## PHASE 3.5 STATUS

**Phase 3.5 NOT implicated.**

**Status:** BLOCKED by pre-existing migration defect

**Blocker:** Migration chain contains dangling dependency to non-existent table

**Manufacturing:** Not related to Manufacturing OS

**Contract Establishment:** Cannot proceed until bootstrap succeeds

---

## NEXT STEPS

1. ✅ Apply remediation (remove references)
2. ⏳ Test Supabase initialization
3. ⏳ Verify no other dangling dependencies
4. ⏳ Resume Phase 3.5 Manufacturing validation

---

**Investigation Date:** 2026-09-05  
**Finding:** Dangling dependency to non-existent table  
**Recommendation:** Remove all references (Option A)
