# STEP 2: Migration Dependency Graph Audit

**Date:** 2026-09-05  
**Scope:** Full migration chain analysis for `20260510000000_create_spa_core_tables.sql`  
**Status:** 🔴 **CRITICAL CYCLE DETECTED**

---

## Executive Summary

**BLOCKER:** Migration `20260510000000_create_spa_core_tables.sql` has **bidirectional dependency cycle** that prevents safe repositioning in migration history.

**Root Cause:** Tables (`packages`, `inventory_items`, `inventory_logs`) were originally created OUTSIDE migration system (seed data/manual SQL), then later "restoration migration" created with timestamp that references not-yet-created dependencies.

**Impact:** Cannot move 20260510 to later position without breaking 12+ downstream migrations. Cannot execute 20260510 at current position due to missing FK targets and trigger functions.

---

## 1. Dependency Graph Analysis

### 1.1 Objects Created by 20260510

```sql
CREATE TABLE packages (...)
CREATE TABLE inventory_items (...)
CREATE TABLE inventory_logs (...)

-- With triggers:
CREATE TRIGGER audit_packages AFTER ... EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ... EXECUTE FUNCTION update_updated_at_column();
-- (same for inventory_items, inventory_logs)
```

### 1.2 Objects Required by 20260510

| Dependency | Created By | Timestamp | Type |
|------------|-----------|-----------|------|
| `tenants(id)` | `20260511000000_initial_schema.sql` | 2026-05-11 | FK target |
| `users(id)` | `20260511000000_initial_schema.sql` | 2026-05-11 | FK target |
| `session_logs(id)` | `20260511000000_initial_schema.sql` | 2026-05-11 | FK target |
| `update_updated_at_column()` | `20260511000000_initial_schema.sql` | 2026-05-11 | Function |
| `log_audit_event()` | `20260516000001_audit_logs.sql` | 2026-05-16 | Function |

**Result:** 20260510 references objects created 1-6 days LATER in chronological order.

### 1.3 Downstream Dependencies on 20260510

**12+ migrations assume `packages`, `inventory_items`, `inventory_logs` already exist:**

| Migration | Dependency Type | Evidence |
|-----------|----------------|----------|
| `20260512000000_fix_permissions.sql` | DISABLE RLS inventory_items | Commented out: "table never created" |
| `20260515040000_create_packages_table.sql` | ALTER TABLE packages | Comment: "Bảng packages tồn tại từ seed data" |
| `20260522040000_brand_service_master.sql` | ALTER TABLE packages | Adds `template_id` FK |
| `20260608110000_create_beauty_spa_phase2_foundation.sql` | UPDATE packages | module_key normalization |
| `20260622163000_create_booking_service_items.sql` | FK to packages(id) | Foreign key constraint |
| `20260622181000_create_mv_inventory_status.sql` | FROM inventory_items, inventory_logs | Materialized view |
| `20260622182000_create_mv_session_analytics.sql` | LEFT JOIN packages | Analytics view |
| `20260622274000_create_demand_history_rpcs.sql` | CROSS JOIN packages | RPC function |
| `20260709140000_booking_engine_schema.sql` | FK to packages(id) | Foreign key constraint |
| `20260709140001_booking_engine_schema_v2.sql` | FK to packages(id) | Foreign key constraint |
| `20260709140002_booking_engine_schema_v3_final.sql` | FK to packages(id) | Foreign key constraint |
| `20260711134600_fix_backfill_earned_revenue_and_inventory_cost.sql` | LEFT JOIN inventory_items | Accounting backfill |
| `20260712000000_create_waitlist_tables.sql` | FK to packages(id) | Foreign key constraint |
| `20260715223000_fix_inventory_purchase_backfill_payment_method.sql` | LEFT JOIN inventory_items | Accounting backfill |
| `20260716000000_add_product_usage_to_packages.sql` | ALTER TABLE packages | Adds `product_usage` JSONB |

---

## 2. Cycle Detection

### 2.1 The Dependency Cycle

```
20260510 (May 10)
    ↓ NEEDS (forward references)
20260511 (May 11) - tenants, users, session_logs, update_updated_at_column()
    ↓
20260516 (May 16) - log_audit_event()
    ↓ BUT
20260512-20260716 (May 12 - Jul 16)
    ↓ NEED (backward references)
20260510 objects (packages, inventory_items, inventory_logs)
```

### 2.2 Why Option A Fails

**Option A:** Rename `20260510` → `20260517`

**Analysis:**
- ✅ Solves forward reference problem (tenants/users/functions created first)
- ❌ **BREAKS 12+ downstream migrations that assume tables exist**
- ❌ Creates semantic inversion (ALTER TABLE before CREATE TABLE)

**Example failure:**
```sql
-- 20260515040000_create_packages_table.sql (now runs BEFORE 20260517)
ALTER TABLE packages ADD COLUMN price BIGINT;
-- ERROR: relation "packages" does not exist
```

### 2.3 Why Option B Fails

**Option B:** Remove FK constraints and triggers from 20260510

**Analysis:**
- ✅ Migration executes without errors
- ❌ **Weakens data integrity** (orphaned inventory, no audit trail)
- ❌ Violates canonical architecture (Healthcare/Finance Kernels require audit)
- ❌ Converts migration integrity problem → production data integrity problem

**Rejected per user directive:**
> "Không remove FK/triggers chỉ để làm migration xanh. Điều đó sẽ biến migration integrity problem thành weakened data integrity."

### 2.4 Why Option D Fails

**Option D:** Inline `update_updated_at_column()` and `log_audit_event()` in 20260510

**Analysis:**
- ✅ Solves function dependency
- ❌ **Creates duplication** (functions defined in 20260511 AND 20260510)
- ❌ Ownership ambiguity (which definition is canonical?)
- ❌ Platform infrastructure should not be duplicated per capability

**Rejected per user directive:**
> "Không inline function nếu chúng vốn là shared platform infrastructure. Duplication sẽ tạo ownership ambiguity."

---

## 3. Historical Reconstruction

### 3.1 Evidence: Tables Created Outside Migration History

**Key evidence from 20260515 comment:**
```sql
-- Lý do: Bảng packages tồn tại nhưng thiếu cột và thiếu quyền truy cập
-- (Reason: packages table exists but missing columns and permissions)

-- 1. Thêm các cột còn thiếu vào bảng packages (đã tồn tại từ seed data)
-- (Add missing columns to packages table - already exists from seed data)
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price BIGINT;
```

**Evidence from 20260512 comment:**
```sql
-- ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY; -- REMOVED: table never created
```

### 3.2 Likely Historical Timeline

**Timeline 1: ACTUAL HISTORY (What Happened)**
```
???? (Unknown date)
  → Tables created manually OR via seed data
  → packages, inventory_items, inventory_logs exist in production

2026-05-11: 20260511000000_initial_schema.sql
  → Core platform tables: tenants, users, session_logs, bookings
  → Platform functions: update_updated_at_column()

2026-05-12: 20260512000000_fix_permissions.sql
  → Attempts DISABLE RLS on inventory_items (assumes exists)

2026-05-15: 20260515040000_create_packages_table.sql
  → ALTER TABLE packages (confirms "tồn tại từ seed data")

2026-05-16: 20260516000001_audit_logs.sql
  → Creates log_audit_event()

2026-05-22+: Multiple migrations assume tables exist
  → ALTER TABLE packages
  → FK to packages(id)
  → JOIN inventory_items
```

**Timeline 2: MIGRATION RESTORATION ATTEMPT (Current Problem)**
```
2026-05-10: 20260510000000_create_spa_core_tables.sql ← ADDED LATER
  → Attempts to "restore" CREATE TABLE statements
  → References tenants/users/functions not yet created
  → Creates cycle with downstream migrations
```

### 3.3 Classification

**20260510 is NOT:**
- ❌ Original table creation (tables existed before migration timestamp)
- ❌ Standard migration (violates dependency order)
- ❌ Safely repositionable (breaks 12+ downstream migrations)

**20260510 IS:**
- ✅ **Restoration migration** documenting tables originally created outside migration system
- ✅ **Incorrectly timestamped** (references future objects, conflicts with past migrations)
- ✅ **Canonical contract capture** (correct structure, but wrong position)

---

## 4. Verification: FK Targets and Functions

### 4.1 Are tenants/users/session_logs Correct FK Targets?

**Verification from 20260511000000_initial_schema.sql:**

```sql
-- Line 7: Creates tenants table (referenced by inventory_items FK)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ...
);

-- Line 17: Creates users table (referenced by packages.updated_by FK)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ...
);

-- Line 69: Creates session_logs table (referenced by inventory_logs FK)
CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) NOT NULL,
    ...
);
```

**✅ CONFIRMED:** These are `public.tenants`, `public.users`, `public.session_logs` — NOT auth schema references.

**✅ FK targets are semantically correct** for multi-tenant inventory tracking.

### 4.2 Are Functions Shared Platform Infrastructure?

**update_updated_at_column():**
- Created in `20260511000000_initial_schema.sql` (line 261)
- Reused in 7+ later migrations (20260731, 20260801, 20260802, 20260818, 20260821, 20260905)
- **Classification:** ✅ **Shared platform infrastructure**

**log_audit_event():**
- Created in `20260516000001_audit_logs.sql` (line 38)
- Updated in `20260520000003_audit_all_tables.sql` (tenant handling)
- Updated in `20260520000008_fix_audit_trigger_exception.sql` (graceful failure)
- **Classification:** ✅ **Shared platform infrastructure** (evolves across migrations)

**Conclusion:** Functions SHOULD NOT be inlined/duplicated. They are canonical platform capabilities.

---

## 5. Option C Feasibility: Split Migration

### 5.1 Approach

Split `20260510` into **TWO migrations:**

**Migration 1:** `20260509000000_create_spa_base_tables.sql`
- Creates ONLY table structures (no FKs, no triggers)
- Zero external dependencies
- Position: BEFORE 20260511

**Migration 2:** `20260517000000_add_spa_constraints.sql`
- Adds FK constraints
- Adds trigger references
- Position: AFTER 20260516 (after functions created)

### 5.2 Analysis

**Pros:**
- ✅ Preserves downstream migrations (tables exist when needed)
- ✅ Resolves forward reference problem (constraints added after dependencies)
- ✅ Documents creation chronology accurately

**Cons:**
- ❌ Still violates ACTUAL history (tables created manually before 20260509)
- ❌ Intermediate state (20260509-20260516) has tables without integrity constraints
- ⚠️ Requires verifying NO migration between 20260509-20260516 assumes FK/triggers exist

### 5.3 Remaining Questions

**Q1:** Do any migrations between 20260509-20260516 assume `packages` table has specific constraints?

**Q2:** Did seed data include FK constraints, or were constraints added later?

**Q3:** Is there evidence of when triggers were originally applied?

---

## 6. Earliest Valid Position Analysis

### 6.1 If Preserving Current Structure (FKs + Triggers)

**Earliest valid position:** `20260517000000` (May 17, 2026)

**Requirements met:**
- ✅ After `20260511` (tenants, users, session_logs, update_updated_at_column exist)
- ✅ After `20260516` (log_audit_event exists)

**Violations created:**
- ❌ 12+ migrations break (ALTER TABLE before CREATE TABLE)
- ❌ Semantic timeline inversion

**Verdict:** ❌ **NOT FEASIBLE**

### 6.2 If Splitting Migration (Option C)

**Base tables:** `20260509000000` (May 9, 2026)  
**Constraints:** `20260517000000` (May 17, 2026)

**Requirements met:**
- ✅ Base tables available for downstream migrations
- ✅ Constraints added after dependencies exist
- ⚠️ Need to verify no intermediate violations

**Verdict:** ⚠️ **FEASIBLE but requires intermediate state verification**

### 6.3 If Removing Constraints (Option B)

**Position:** `20260509000000` (May 9, 2026)

**Requirements met:**
- ✅ Zero external dependencies
- ✅ Downstream migrations work

**Violations created:**
- ❌ Weakened data integrity (no FK enforcement)
- ❌ No audit trail (no triggers)
- ❌ Violates Healthcare/Finance Kernel requirements

**Verdict:** ❌ **NOT ACCEPTABLE per user directive**

---

## 7. Dependency DAG (Visual)

```
UPWARD DEPENDENCIES (20260510 NEEDS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    20260510
                       ↑
                       ├─── tenants (20260511)
                       ├─── users (20260511)
                       ├─── session_logs (20260511)
                       ├─── update_updated_at_column() (20260511)
                       └─── log_audit_event() (20260516)

DOWNWARD DEPENDENCIES (OTHERS NEED 20260510):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    20260510
                       ↓
     ┌────────────────┼────────────────┐
     ↓                ↓                ↓
20260512        20260515        20260522
(RLS)        (ALTER packages)  (ALTER packages)
     ↓                ↓                ↓
20260608        20260622        20260709+
(UPDATE)        (MV + FK)       (FK to packages)
     ↓                ↓                ↓
20260711        20260712        20260715
(JOIN)          (FK)            (JOIN)
                ↓
            20260716
        (ALTER packages)

CYCLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20260510 ──needs──> 20260511 ──needs──> 20260516
    ↑                                        |
    └────────────────┬───────────────────────┘
                     ↓
          20260512-20260716 need 20260510

RESULT: Cannot move 20260510 after 20260516 without breaking 20260512-20260716
```

---

## 8. Recommendations

### 8.1 Minimal Structural Remediation

**Recommended Approach: OPTION C (Split Migration) with Verification**

**Phase 1: Prepare Split**
1. Create `20260509000000_create_spa_base_tables.sql`
   - CREATE TABLE packages (no FKs, no triggers)
   - CREATE TABLE inventory_items (no FKs, no triggers)
   - CREATE TABLE inventory_logs (no FKs, no triggers)

2. Create `20260517000000_add_spa_table_constraints.sql`
   - ALTER TABLE packages ADD CONSTRAINT ... FK to tenants/users
   - ALTER TABLE inventory_items ADD CONSTRAINT ... FK to packages/tenants/users
   - ALTER TABLE inventory_logs ADD CONSTRAINT ... FK to inventory_items/session_logs/tenants/users
   - CREATE TRIGGER ... EXECUTE FUNCTION log_audit_event()
   - CREATE TRIGGER ... EXECUTE FUNCTION update_updated_at_column()

3. Archive `20260510000000_create_spa_core_tables.sql`

**Phase 2: Verify Intermediate State**
- Check migrations 20260509-20260516 for assumptions about:
  - FK constraints existence
  - Trigger behavior
  - Data integrity requirements

**Phase 3: Test Execution**
- Fresh DB reset with split migrations
- Verify all downstream migrations execute successfully
- Verify final schema matches production canonical structure

### 8.2 Alternative: Infrastructure-First Migration

**If verification reveals intermediate state violations:**

Create earlier infrastructure migration:

**`20260508000000_create_platform_infrastructure.sql`**
- CREATE OR REPLACE FUNCTION update_updated_at_column()
- CREATE OR REPLACE FUNCTION log_audit_event()

**Then:**
- `20260509000000_create_spa_core_tables.sql` (full structure with FKs + triggers)
- Requires verifying `tenants`/`users`/`session_logs` are NOT referenced before 20260511

### 8.3 Last Resort: Historical Accept + Future Fix

**If splitting proves too risky:**

**Accept historical migration defect:**
- Archive `20260510000000_create_spa_core_tables.sql` to `archive/` folder
- Document: "Tables originally created outside migration system; canonical structure documented in production schema"
- Use production schema as source of truth
- Future table modifications via new migrations only

**Rationale:**
- No customers affected (production already correct)
- Fresh DB deployments use seed data + production dump
- Migration history becomes "documentation" not "executable contract"

---

## 9. Assumptions and Unresolved Items

### 9.1 Assumptions

1. **Seed data origin:** Tables were created via seed data or manual SQL before 2026-05-10
2. **Production canonical:** Current production structure is architecturally correct
3. **No data migration needed:** `module_key` drift handled by application translation layer
4. **FK targets correct:** `tenants`, `users`, `session_logs` are intended canonical relationships

### 9.2 Unresolved Items

1. **Exact creation date:** When were `packages`, `inventory_items`, `inventory_logs` originally created?
2. **Original constraints:** Did tables originally have FK constraints, or were they added incrementally?
3. **Trigger application:** When were audit/update triggers first applied to these tables?
4. **Seed data contents:** What initial data was seeded into these tables?
5. **Intermediate state safety:** Do migrations 20260509-20260516 require FK/trigger existence?

---

## 10. Next Steps

**BLOCKED on user decision:**

1. ✅ **Approve Option C (Split Migration)**
   - Proceed with intermediate state verification
   - Create split migration files
   - Test on fresh DB

2. ⚠️ **Request Alternative Approach**
   - If Option C intermediate state unsafe
   - Consider infrastructure-first variant
   - Or accept historical defect + archive

3. ❌ **Do NOT proceed with:**
   - Option A (rename to 20260517 - breaks downstream)
   - Option B (remove constraints - weakens integrity)
   - Option D (inline functions - creates duplication)

**NO migration execution, NO db reset, NO production changes until user approval.**

---

**Status:** 🔴 **AWAITING USER DECISION ON REMEDIATION APPROACH**  
**Gate:** Dependency Graph Audit ✅ COMPLETE → Remediation Strategy ⏳ PENDING
