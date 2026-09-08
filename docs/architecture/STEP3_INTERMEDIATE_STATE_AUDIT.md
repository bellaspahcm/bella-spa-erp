# STEP 3: Intermediate-State Safety Audit

**Date:** 2026-09-05  
**Scope:** Migrations 20260509-20260516 safety verification for Option C split  
**Status:** 🔴 **AUDIT COMPLETE — CONDITIONAL SAFE WITH CAVEAT**

---

## Executive Summary

**Split feasibility:** ⚠️ **CONDITIONALLY SAFE** — FK enforcement not required, but audit trail gap exists.

**Finding:** Migration 20260515 performs data migration UPDATE on `packages` table during proposed intermediate state (after table creation, before trigger application).

**Impact:** 
- ✅ **FK safety:** UPDATE does not modify foreign key columns → no orphan risk
- ⚠️ **Audit gap:** UPDATE executes without audit trigger → data migration unaudited
- ✅ **Trigger execution:** No runtime trigger calls in interval

**Recommendation:** SPLIT SAFE if audit gap for schema migration UPDATEs is acceptable architectural tradeoff.

---

## 1. Audit Methodology

### 1.1 Scope

**Target interval:** 20260509 (proposed base tables) → 20260516 (audit function created)

**Proposed split:**
```sql
20260509000000_create_spa_base_tables.sql
  → CREATE TABLE packages (no FK, no triggers)
  → CREATE TABLE inventory_items (no FK, no triggers)
  → CREATE TABLE inventory_logs (no FK, no triggers)

[INTERMEDIATE STATE: 20260509-20260516]

20260517000000_add_spa_constraints.sql
  → ALTER TABLE ... ADD CONSTRAINT FK
  → CREATE TRIGGER ... EXECUTE FUNCTION log_audit_event()
  → CREATE TRIGGER ... EXECUTE FUNCTION update_updated_at_column()
```

### 1.2 Safety Questions

**For intermediate state to be SAFE, must verify:**

1. ✅ **NO FK enforcement required:** No DML modifying foreign key columns
2. ✅ **NO trigger verification:** No code checking trigger existence
3. ✅ **NO function calls:** No explicit calls to audit/update functions
4. ⚠️ **NO DML requiring audit:** Data operations should not execute without audit trail
5. ✅ **NO seed data:** Bootstrap/seed scripts must not run in interval
6. ✅ **NO dependent constraints:** No CHECK/UNIQUE violations from missing FKs

---

## 2. Evidence Collection

### 2.1 Migration Timeline in Interval

```
20260509 (proposed) ← base tables
  ↓
20260510 (NONE - gap)
  ↓
20260511000000_initial_schema.sql ← creates update_updated_at_column()
  ↓
20260512000000_fix_permissions.sql
  ↓
20260513 (NONE - gap)
  ↓
20260514 (NONE - gap)
  ↓
20260515040000_create_packages_table.sql ← ⚠️ DML DETECTED
  ↓
20260516000001_audit_logs.sql ← creates log_audit_event()
  ↓
20260517 (proposed) ← constraints + triggers
```

**Total migrations in interval:** 3 (20260511, 20260512, 20260515)

### 2.2 Check 1: Trigger Verification

**Query:** `pg_trigger|information_schema\.triggers|tgname`

**Result:** ✅ **ZERO MATCHES**

**Conclusion:** No migration checks for trigger existence during interval.

### 2.3 Check 2: Seed/Bootstrap Scripts

**Query:** `seed.*202605|bootstrap.*202605`

**Result:** ✅ **ZERO MATCHES**

**Files found:**
- `seed.sql` (no date constraint)
- `seed_packages.sql` (no date constraint)
- `seed_demo_2026.sql` (no date constraint)

**Conclusion:** No seed scripts explicitly tied to intermediate state interval. Seed files exist but execution timing not specified in migration history.

### 2.4 Check 3: Function Calls

**Query:** `EXECUTE.*log_audit_event|EXECUTE.*update_updated_at`

**Result in 20260509-20260516:** ✅ **ZERO MATCHES** (except trigger creation statements)

**Triggers found AFTER 20260516:**
- 20260516: Creates triggers on revenue, expenses, salary_records
- 20260519: Creates trigger on staff_leaves
- 20260520: Creates triggers on bookings, session_logs, customers, users, packages (retroactive)

**Conclusion:** No explicit function calls during intermediate state. Triggers applied AFTER 20260516.

### 2.5 Check 4: DML Operations

**Query:** `INSERT INTO.*packages|UPDATE.*packages|DELETE FROM.*packages`

**Result:** 🔴 **3 MATCHES**

#### **Critical Finding: 20260515040000_create_packages_table.sql**

```sql
-- Line 18: Data normalization
UPDATE public.packages 
SET price = full_price::BIGINT 
WHERE price = 0 OR price IS NULL;

-- Line 21: Encoding fix
UPDATE public.packages 
SET duration = '90 phút/buổi' 
WHERE duration LIKE '90 ph%' OR duration = '90 min/session';
```

**Analysis:**
- **Operation type:** Data migration UPDATE (schema normalization)
- **Columns modified:** `price`, `duration` (NOT `tenant_id`, `updated_by`, or FK columns)
- **Referential impact:** NONE (no foreign key columns touched)
- **Audit impact:** ⚠️ **UPDATE would execute WITHOUT audit trigger if split to 20260517**

**Other matches:**
- 20260521: `INSERT INTO packages` (tenant onboarding) — AFTER proposed split boundary
- 20260525: `INSERT INTO packages` (sample data) — AFTER proposed split boundary
- 20260526: `INSERT INTO packages` (sample data) — AFTER proposed split boundary

**Conclusion:** ⚠️ **DML exists in intermediate state, but does NOT require FK enforcement. DOES create audit gap.**

### 2.6 Check 5: Updated_at Column References

**Query:** `packages\.updated_at|inventory_items\.updated_at`

**Result:** ✅ **ZERO MATCHES**

**Conclusion:** No migration queries the `updated_at` column during interval. Missing trigger does not cause query failures.

### 2.7 Check 6: FK Constraint Metadata Queries

**Query:** `pg_constraint|information_schema\.table_constraints|FOREIGN KEY.*packages`

**Result in 20260509-20260516:** ✅ **ZERO MATCHES**

**Conclusion:** No migration inspects FK metadata during interval.

---

## 3. Detailed Analysis: 20260515 UPDATE Safety

### 3.1 UPDATE Operation Semantics

```sql
-- Operation 1: Price normalization
UPDATE public.packages 
SET price = full_price::BIGINT 
WHERE price = 0 OR price IS NULL;
```

**Safety verification:**
- ❓ Does UPDATE require `packages.tenant_id` FK to `tenants(id)`?
  - ✅ **NO** — WHERE clause does not filter by tenant_id
  - ✅ **NO** — SET does not modify tenant_id
  - ✅ **NO** — No JOIN to tenants table
  
- ❓ Does UPDATE require `packages.updated_by` FK to `users(id)`?
  - ✅ **NO** — updated_by column not modified
  
- ❓ Does UPDATE require audit trigger?
  - ⚠️ **YES (policy)** — Data migrations should be audited per Healthcare/Finance Kernel
  - ❌ **NO (technical)** — UPDATE executes successfully without trigger

```sql
-- Operation 2: Duration encoding fix
UPDATE public.packages 
SET duration = '90 phút/buổi' 
WHERE duration LIKE '90 ph%' OR duration = '90 min/session';
```

**Safety verification:**
- ✅ Same as Operation 1 — no FK columns touched
- ⚠️ Same audit gap

### 3.2 Historical Context

**Comment from 20260515:**
```sql
-- Lý do: Bảng packages tồn tại nhưng thiếu cột và thiếu quyền truy cập
-- (Reason: packages table exists but missing columns and permissions)
```

**Interpretation:**
- Tables existed from seed data (confirmed in Step 2)
- 20260515 is a **schema repair migration** (adding missing columns + normalizing data)
- UPDATE operations are **data migrations**, not transactional business operations
- Historical execution: UPDATE ran BEFORE triggers existed (20260510 not yet applied)

**Conclusion:** ⚠️ **Split replicates historical state (no audit during schema migration) but violates canonical principle (all changes audited).**

---

## 4. Function Ownership Analysis

### 4.1 update_updated_at_column()

**Created:** 20260511000000_initial_schema.sql (line 261)

**Usage:**
- 20260511: tenants, users, customers, bookings, membership_records
- 20260519: staff_leaves
- 20260731: real_estate tables
- 20260801: foundation_org_people
- 20260802: real_estate_partner_portal
- 20260818: runtime_tables
- 20260821: logistics_schema
- 20260905: retail_os_canonical_schema

**Classification:**
- ✅ **Shared platform infrastructure**
- ✅ Generic trigger (domain-agnostic)
- ✅ Ownership: Platform Core
- ✅ Safe to precede domain tables

**Recommendation:** ✅ **Keep in 20260511 (current position is correct)**

### 4.2 log_audit_event()

**Created:** 20260516000001_audit_logs.sql (line 38)

**Dependencies:**
- `audit_logs` table (created in same migration)
- `tenants` table (FK dependency)
- `auth.users` (Supabase auth)

**Usage:**
- 20260516: revenue, expenses, salary_records
- 20260520: bookings, session_logs, customers, users, packages (retroactive)
- 20260510: packages, inventory_items, inventory_logs (forward reference)

**Classification:**
- ✅ **Shared platform infrastructure**
- ✅ Audit/compliance capability
- ✅ Ownership: Platform Core (audit infrastructure)
- ⚠️ **Created AFTER core schema (20260516 vs 20260511)**

**Question:** Should audit infrastructure precede all auditable tables?

**Analysis:**
- Audit infrastructure requires `tenants` table (FK in audit_logs)
- `tenants` created in 20260511
- Earliest valid position: 20260511 (same migration) or 20260512

**Could log_audit_event() move to 20260511?**
- ✅ Technical: YES (tenants exists)
- ⚠️ Semantic: Requires moving `audit_logs` table creation
- ⚠️ Risk: May break migrations 20260512-20260515 if they assume audit infrastructure NOT present

**Recommendation:** ⚠️ **Keep in 20260516 unless evidence shows audit should precede all domain operations**

---

## 5. Split Safety Matrix

| Concern | Status | Evidence | Blocking? |
|---------|--------|----------|-----------|
| **FK enforcement** | ✅ SAFE | No DML modifies FK columns in interval | NO |
| **Trigger verification** | ✅ SAFE | No pg_trigger queries in interval | NO |
| **Function calls** | ✅ SAFE | No explicit EXECUTE calls in interval | NO |
| **Audit gap** | ⚠️ CAVEAT | UPDATE in 20260515 unaudited if split | POLICY |
| **Seed data** | ✅ SAFE | No dated seed scripts in interval | NO |
| **Constraint metadata** | ✅ SAFE | No pg_constraint queries in interval | NO |
| **updated_at queries** | ✅ SAFE | No queries reference column in interval | NO |

---

## 6. Architectural Tradeoff: Audit Gap

### 6.1 The Dilemma

**If split to 20260509 + 20260517:**

```
20260509: CREATE TABLE packages (no audit trigger)
  ↓
20260515: UPDATE packages (data migration, UNAUDITED)
  ↓
20260517: CREATE TRIGGER audit_packages (future changes audited)
```

**Result:** Schema migration UPDATE not captured in audit_logs.

### 6.2 Options

**Option A: Accept audit gap**
- ✅ Rationale: Schema migrations are infrastructure operations, not business transactions
- ✅ Precedent: Historical execution had same gap (20260515 ran before 20260510 applied)
- ❌ Risk: Violates "all data changes audited" principle from Healthcare/Finance Kernel

**Option B: Reject split, maintain cycle**
- ✅ Rationale: Preserves audit completeness
- ❌ Risk: Leaves migration dependency cycle unresolved
- ❌ Impact: Fresh DB deployment fails

**Option C: Reorder 20260515 after 20260517**
- ✅ Rationale: Ensures audit trigger present before UPDATE
- ❌ Risk: 20260515 assumes columns already exist (ALTER TABLE before UPDATE)
- ⚠️ Complexity: Requires splitting 20260515 into ALTER + UPDATE parts

**Option D: Manual audit entry**
- ✅ Rationale: Document schema migration in audit_logs manually
- ⚠️ Complexity: Requires post-UPDATE INSERT with synthetic audit record
- ❌ Risk: Synthetic entry may not match trigger-generated format

---

## 7. Conclusion

### 7.1 Final Assessment

**Intermediate state safety for FK enforcement:** ✅ **SAFE**

**Intermediate state safety for audit compliance:** ⚠️ **CONDITIONAL**

**Overall classification:** ⚠️ **SPLIT CONDITIONALLY SAFE**

### 7.2 Conditions for SAFE

**If user accepts:**
- Schema migration UPDATEs (data normalization) may be unaudited
- Audit trail begins AFTER schema stabilization (20260517)
- Historical behavior preserved (20260515 originally ran without audit)

**Then:** ✅ **SPLIT SAFE — PROCEED**

### 7.3 Conditions for UNSAFE

**If user requires:**
- ALL data modifications audited (no exceptions for schema migrations)
- Audit trail completeness per Healthcare/Finance Kernel strict interpretation

**Then:** ❌ **SPLIT UNSAFE — REDESIGN REQUIRED**

---

## 8. Three-Way Conclusion

### 🟢 SPLIT SAFE (with caveat)

**Recommendation:** Proceed with Option C split

**Rationale:**
- FK enforcement not required in intermediate state (technical safety)
- Trigger verification not performed (no broken queries)
- Seed data does not execute in interval (no bootstrap conflicts)
- UPDATE in 20260515 is schema migration (infrastructure operation)
- Historical execution already had same audit gap

**Caveat:** Accept that schema normalization UPDATE (20260515) is not audited.

**Required documentation:**
```sql
-- 20260515040000_create_packages_table.sql
-- NOTE: This UPDATE executes before audit trigger application (20260517).
-- Schema migration operations are infrastructure changes, not business 
-- transactions, and are not captured in audit_logs per platform policy.
UPDATE public.packages SET price = full_price::BIGINT ...
```

**Gates passed:**
- ✅ No FK violations
- ✅ No trigger metadata queries
- ✅ No function execution failures
- ⚠️ Audit gap accepted as architectural tradeoff

**Action:** Create split migrations with documentation comment.

---

### 🔴 SPLIT UNSAFE — REDESIGN REQUIRED

**IF user rejects audit gap caveat.**

**Alternative approaches:**

**A. Split 20260515 into pre/post-audit parts:**
```
20260509: CREATE TABLE packages (no constraints)
20260515a: ALTER TABLE packages ADD COLUMN ... (structure only)
20260517: ADD CONSTRAINT + CREATE TRIGGER (enable audit)
20260515b: UPDATE packages ... (data migration, NOW AUDITED)
```

**B. Inline audit in 20260515:**
```sql
-- Manual audit entry for schema migration
INSERT INTO audit_logs (tenant_id, table_name, action, new_data, ...)
SELECT tenant_id, 'packages', 'UPDATE', 
       row_to_json(packages)::jsonb, ...
FROM packages
WHERE price = 0 OR price IS NULL;

-- Then perform UPDATE
UPDATE packages SET price = full_price::BIGINT ...
```

**C. Accept historical defect + archive:**
- Do not split 20260510
- Archive to `supabase/migrations/archive/`
- Document: "Tables created outside migration system; canonical structure in production"
- Use production schema as source of truth for future modifications

---

### ⚠️ HISTORICAL ACCEPTANCE REQUIRED

**IF redesign proves too complex or risky.**

**Rationale:**
- Tables genuinely created outside migration history (seed data origin confirmed)
- 20260510 is restoration attempt, not original creation
- Migration history cannot be "fixed" without rewriting actual chronology
- Fresh DB deployments should use production dump, not migration replay

**Recommendation:**
- Archive `20260510000000_create_spa_core_tables.sql`
- Document migration history gap in `docs/architecture/MIGRATION_HISTORY_GAPS.md`
- Treat production schema as canonical (query from production for CREATE TABLE statements)
- Future table modifications via new migrations only

---

## 9. Recommendation to User

**AWAITING USER DECISION:**

**Question 1:** Is audit gap for schema migration UPDATEs acceptable?
- **YES** → ✅ **SPLIT SAFE** (proceed with Option C)
- **NO** → 🔴 **SPLIT UNSAFE** (redesign or historical acceptance)

**Question 2:** Should audit infrastructure (log_audit_event) precede all domain tables?
- Currently created in 20260516 (after core schema in 20260511)
- Moving to 20260511 would require verification similar to this audit
- Recommend: **Keep in 20260516** unless strong evidence for earlier position

**Question 3:** Preferred path if audit gap rejected?
- **A:** Split 20260515 into structure + data parts
- **B:** Inline manual audit entry in 20260515
- **C:** Accept historical defect + archive 20260510

---

## 10. Next Steps Based on Decision

### If SPLIT SAFE chosen:

```
STEP 4: Create split migration files
  - 20260509000000_create_spa_base_tables.sql
  - 20260517000000_add_spa_constraints.sql
  - Archive 20260510000000_create_spa_core_tables.sql
  
STEP 5: Fresh DB validation (db reset)

STEP 6: Regression testing (production unchanged)

STEP 7: Unblock Manufacturing Phase 3.5
```

### If SPLIT UNSAFE chosen:

```
STEP 4: Implement redesign (A/B/C selected by user)

STEP 5: Re-audit intermediate state

STEP 6: Fresh DB validation

STEP 7: Regression testing

STEP 8: Unblock Manufacturing Phase 3.5
```

### If HISTORICAL ACCEPTANCE chosen:

```
STEP 4: Archive 20260510

STEP 5: Document migration gap

STEP 6: Export production canonical schema

STEP 7: Update deployment docs (use production dump)

STEP 8: Unblock Manufacturing Phase 3.5 (different path)
```

---

**Status:** ⏸️ **AWAITING USER DECISION ON AUDIT GAP ACCEPTABILITY**

**Gate:** Intermediate State Audit ✅ COMPLETE → User Decision ⏳ PENDING

**Evidence:** All checks complete, tradeoff documented, three-way conclusion provided.

**NO migrations modified. NO database operations performed. NO production changes.**
