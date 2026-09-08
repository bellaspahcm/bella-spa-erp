# Phase 1: Schema Restoration Status

**Date:** 2026-09-05  
**Status:** ⏸️ CREATED, NOT VERIFIED

**Critical:** `IF NOT EXISTS` does NOT guarantee schema compatibility.
Production safety requires explicit verification, not just absence of errors.

---

## ✅ COMPLETED

### Migration Created
- **File:** `supabase/migrations/20260510000000_create_spa_core_tables.sql`
- **Size:** ~530 lines
- **Position:** BEFORE `20260511000000_initial_schema.sql` (which references packages)

### Tables Restored

**1. packages (33 columns)**
- ✅ All columns from generated types
- ✅ 2 Foreign keys (tenant + self-reference)
- ✅ 4 Check constraints (module_key, service_kind, duration, resource_type)
- ✅ 4 Indexes (tenant/module, template, HQ flag, product_usage GIN)
- ✅ 2 RLS policies (read + admin manage)
- ✅ Comments on table + critical columns

**2. inventory_items (12 columns)**
- ✅ All columns from generated types
- ✅ 1 Foreign key (tenant)
- ✅ 3 Check constraints (stock_level >=0, min_stock >=0, price >=0)
- ✅ 4 Indexes (tenant, SKU, category, unique SKU per tenant)
- ✅ 1 RLS policy (tenant isolation)
- ✅ Comments on table + critical columns

**3. inventory_logs (13 columns)**
- ✅ All columns from generated types
- ✅ 4 Foreign keys (tenant, item, session_log, user)
- ✅ Note: accounting_template FK commented (table created later)
- ✅ 5 Indexes (tenant, item, session, business_event, created_at)
- ✅ 1 RLS policy (tenant isolation)
- ✅ Comments on table + critical columns

### Schema Features Preserved
- ✅ Dependency ordering (packages → inventory_items → inventory_logs)
- ✅ ON DELETE behaviors (CASCADE for tenant, SET NULL for optional FKs, RESTRICT for item)
- ✅ Default values (gen_random_uuid, NOW(), numeric defaults)
- ✅ Service role bypass in RLS policies
- ✅ HQ template cross-tenant sharing (packages)
- ✅ Product usage JSONB for inventory forecasting
- ✅ Accounting integration (inventory_logs)

---

## ⏸️ PENDING (Definition of Done)

### Runtime Validation Required

**Cannot proceed until:**
1. ⏸️ Fresh database initialization test
2. ⏸️ Migration chain GREEN verification
3. ⏸️ Verify no conflicts with subsequent migrations
4. ⏸️ Bella Spa regression test (inventory operations)
5. ⏸️ Babycare regression test (if applicable)
6. ⏸️ Manufacturing Phase 3.5 validation

### Blocker: Docker/Supabase

**Current issue:** Supabase containers not staying up for testing

**Workarounds:**
1. Manual Docker restart + retry
2. Test on remote Supabase instance
3. Static verification only (not sufficient for Production)

---

## 📊 MIGRATION CONTENT SUMMARY

### Dependency Chain
```
tenants (pre-existing)
  ↓
packages (created by this migration)
  ↓ (self-reference for templates)
packages.template_id → packages.id
  ↓
inventory_items (created by this migration)
  ↓
inventory_logs (created by this migration)
  ↓ (references session_logs)
session_logs (created by 20260511)
```

### Key Design Decisions

**1. packages.template_id self-reference**
- Allows HQ → Branch template distribution
- ON DELETE SET NULL (orphan children become independent)

**2. inventory_items.sku uniqueness**
- UNIQUE per tenant (allows same SKU across tenants)
- NULL SKUs allowed (optional identifier)

**3. inventory_logs FKs**
- item_id: RESTRICT (cannot delete item with history)
- session_log_id: SET NULL (preserve log even if session deleted)
- created_by: SET NULL (preserve log even if user deleted)

**4. RLS service_role bypass**
- All policies check for service_role first
- Allows migrations and backend operations to bypass RLS

**5. Accounting template FK deferred**
- FK to accounting_event_templates commented
- Will be added by accounting migration
- Prevents circular dependency

---

## 🔍 STATIC VERIFICATION

### Syntax Check
- ✅ File created successfully
- ✅ ~530 lines of SQL
- ✅ All 3 tables present
- ✅ Correct dependency order

### Ordering Check
- ✅ Migration timestamp: 20260510000000
- ✅ Before first usage: 20260511000000_initial_schema.sql
- ✅ packages referenced in bookings (line 61 of 20260511)

### Schema Completeness
- ✅ 33 columns for packages (matches generated types)
- ✅ 12 columns for inventory_items (matches generated types)
- ✅ 13 columns for inventory_logs (matches generated types)
- ✅ All FKs defined
- ✅ All indexes created
- ✅ All RLS policies applied

---

## ⚠️ KNOWN LIMITATIONS

### Not Included in Phase 1
- ❌ Triggers for updated_at auto-update (not in generated types)
- ❌ Additional module_key values beyond babycare/beauty_spa/industrial_cleaning
- ❌ Status enum values for packages (open-ended in types)
- ❌ inventory_logs FK to accounting_event_templates (deferred)

### Requires Subsequent Investigation
- ⏸️ sessions table (broken MVs - separate investigation needed)
- ⏸️ employees references (dead code cleanup)
- ⏸️ profiles references (auth confusion)
- ⏸️ services references (schema confusion)
- ⏸️ projects references (demo data)

---

## 🎯 SUCCESS CRITERIA

**Phase 1 is complete when:**

```bash
# 1. Fresh DB initialization succeeds
npx supabase db reset
# Expected: ✅ ALL migrations pass (including new 20260510)

# 2. Verify tables exist with correct schema
psql -c "\d packages"
psql -c "\d inventory_items"  
psql -c "\d inventory_logs"
# Expected: ✅ Schema matches migration

# 3. Verify RLS policies active
psql -c "SELECT * FROM pg_policies WHERE tablename IN ('packages', 'inventory_items', 'inventory_logs');"
# Expected: ✅ 4 policies total (2 + 1 + 1)

# 4. Verify indexes created
psql -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('packages', 'inventory_items', 'inventory_logs');"
# Expected: ✅ 13 indexes total (4 + 4 + 5)

# 5. Bella Spa smoke test
# Test inventory operations (create item, log movement)
# Expected: ✅ No regression

# 6. Manufacturing Phase 3.5
npx tsx scripts/governance/factory-build.ts manufacturing
# Expected: ✅ UNBLOCKED (if no other migration issues)
```

---

## 📝 NEXT STEPS

**Immediate:**
1. Resolve Docker/Supabase container issue
2. Run fresh DB reset test
3. Verify migration chain GREEN
4. Document any errors encountered

**If migration succeeds:**
1. Run Bella Spa regression tests
2. Test inventory operations
3. Verify Manufacturing Phase 3.5 unblocked
4. Update Manufacturing blocker status

**If migration fails:**
1. Capture exact error message
2. Identify failing migration
3. Check for schema conflicts
4. Revise migration if needed
5. Do NOT bypass with --skip flags

---

## 🚫 WHAT WAS NOT DONE (BY DESIGN)

### Explicitly excluded from Phase 1:
- ❌ Did NOT create `sessions` table (broken MVs need investigation)
- ❌ Did NOT fix broken materialized views
- ❌ Did NOT remove employees/profiles/services/projects references
- ❌ Did NOT modify Manufacturing schema
- ❌ Did NOT create placeholder/stub tables
- ❌ Did NOT comment out migrations to bypass errors
- ❌ Did NOT add --skip-contract or other workarounds

**Rationale:** Phase 1 scope is RESTORE proven operational tables only.
Other objects require separate investigation and classification.

---

**Status:** ✅ MIGRATION CREATED / ⏸️ RUNTIME VALIDATION PENDING  
**Blocker:** Docker/Supabase startup issues preventing test execution  
**Next:** Manual Docker restart → Fresh DB test → Regression validation
