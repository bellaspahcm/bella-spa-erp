# E6 BUG LOG — WAREHOUSE MANAGEMENT BUG TRACKING & REWORK

**Experiment:** E6 (Warehouse Management Repeatability)  
**Status:** 🔄 IN PROGRESS  
**Bugs Found:** 0  
**Rework Effort:** 0.0000 days

---

## 🎯 BUG CLASSIFICATION PROTOCOL

### Categories

**1. Bella Implementation Bug** ✅ Counts in C₆ rework
```
Definition: Bug in Warehouse Management implementation code
Root cause: Bella code error (not infrastructure)
Fix: Requires code change in src/platform/logistics/warehouse/
Rework: YES - counts in C₆
```

**2. Test Harness Bug** ❌ Does NOT count in C₆ rework
```
Definition: Bug in test script, not implementation
Root cause: Test code has error, implementation correct
Fix: Requires change in scripts/e6/ only
Rework: NO - not implementation bug
Effort: Record separately as "test infrastructure effort"
```

**3. Environment/Infrastructure Issue** ❌ Does NOT count in C₆ rework
```
Definition: External system problem
Root cause: External to Bella implementation
Fix: Infrastructure/environment change needed
Rework: NO - external blocker
Effort: Exclude from C₆
```

**4. Schema/Contract Mismatch** ✅ Counts in C₆ rework
```
Definition: Implementation vs platform contract mismatch
Root cause: Domain boundary friction
Fix: Migration + code change required
Rework: YES - implementation bug at contract boundary
Note: Expected friction, not protocol failure
```

**5. False Positive** ❌ Does NOT count in C₆ rework
```
Definition: Test failed but no actual bug
Root cause: Test flakiness (race condition, timing)
Fix: Fix test harness, not implementation
Rework: NO
```

---

## 🐛 BUG INVENTORY

**Total Bugs:** 6

**By Category:**
- Bella Implementation: 1 (B4 - discrepancy column)
- Schema/Contract: 2 (B1 - tenant FK, B2 - RLS pattern)
- Test Harness: 2 (B3, B5 - tenant fixtures)
- Environment/Tooling: 1 (B6 - migration automation, TBD)
- False Positive: 0

**By Phase:**
- Schema Foundation: 2 (B1, B2)
- R1 Receive Inventory: 1 (B4)
- R4 Unique Constraint: 1 (B6 - pending classification)
- Test Infrastructure: 2 (B3, B5)
- R2-R3, R5-R15: 0

**Rework Distribution:**
```
Schema/Contract bugs: 0.0065d (B1: 0.0054d + B2: 0.0011d)
R1 Implementation bugs: 0.0021d (B4: ~3 min)
R4 bugs: TBD (B6 pending classification)
Total rework (counts in C₆): 0.0086d (~12.4 minutes) + B6 TBD
```

**Rework Distribution:**
```
Schema/Contract bugs: 0.0065d (B1: 0.0054d + B2: 0.0011d)
R1 Implementation bugs: 0.0021d (B4: ~3 min)
Total rework (counts in C₆): 0.0086d (~12.4 minutes)
```

---

## 📋 BUG REPORTS

### Bug #1 - Schema Foundation: Missing Canonical Tenant Table

**Discovery:** 2026-08-21 23:40:16  
**Classification:** Schema/Contract Mismatch (pending investigation)  
**Counts in C₆:** TBD (depends on root cause)  
**Status:** 🔄 INVESTIGATING

**Error:**
```
ERROR: relation "public_tenants" does not exist
LINE 26: FOREIGN KEY (tenant_id) REFERENCES public_tenants(id)
```

**Context:**
- Phase: Schema migration
- File: `migrations/logistics/20260821_warehouse_schema.sql`
- FK constraints reference `public_tenants` table
- Table does not exist in target database

**Root Cause Analysis:**
Warehouse schema assumes canonical tenant infrastructure exists with specific contract:
- Table name: `public_tenants`
- Column: `id` (UUID)
- Purpose: Tenant authority for FK referential integrity

**This reveals platform boundary friction:**
1. Warehouse vertical makes infrastructure assumption
2. Assumption not documented in platform contract
3. E3 (Freight Audit) likely had same assumption - how was it resolved?

**Significance for E6:**
This is **exactly the type of friction E6 is designed to measure**:
- Does second vertical encounter infrastructure gaps?
- Are platform boundaries clear?
- What's the cost of cross-vertical dependency resolution?

**Investigation Path:**
1. ✅ Error recorded with timestamp
2. ⏳ Search for canonical tenant table in existing schema
3. ⏳ Check E3 Freight Audit schema - how did it handle tenant FK?
4. ⏳ Decision: Fix FK reference / Create tenant table / Remove FK
5. ⏳ Measure resolution time
6. ⏳ Classify as platform bug vs environment gap

**Options:**
- **A:** Database has tenant table with different name → update FK
- **B:** No tenant infrastructure exists → create minimal foundation
- **C:** Remove FK, rely on RLS only (⚠️ loses referential integrity)

**Decision Criteria:**
- What does E3 Freight Audit do?
- Is `public_tenants` documented in platform contracts?
- RLS ≠ FK (authorization ≠ referential integrity)

**Timestamp Log:**
- Discovery: 2026-08-21 23:40:16
- Investigation start: 2026-08-21 23:40:16
- E3 comparison: 2026-08-21 23:45:00
- Root cause found: 2026-08-21 23:45:30
- Resolution: IN PROGRESS

**Root Cause:**
✅ **IDENTIFIED:** Table name mismatch
- Warehouse schema: `public_tenants` (underscore)
- Canonical table: `public.tenants` (no underscore, explicit schema)
- Source: `supabase/migrations/20260511000000_initial_schema.sql`

**E3 Comparison:**
E3 Freight Audit schema did NOT use FK constraints to tenant table.
Only defined: `tenant_id UUID NOT NULL` without FK.

**This means E6 is MORE rigorous than E3** (good for referential integrity, but exposed naming mismatch).

**Classification:**
- ✅ **Bella Implementation Bug** (counts in C₆)
- Error in schema definition (table name)
- NOT test harness or environment issue

**Resolution:**
Update all FK references:
```sql
-- BEFORE:
FOREIGN KEY (tenant_id) REFERENCES public_tenants(id)

-- AFTER:
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
```

**Rework Time:** TBD (measuring now)

---

## 📝 BUG REPORT TEMPLATE

```markdown
## Bug #{n} - R{i}: {Requirement Name}

**Discovery:** {YYYY-MM-DD HH:MM:SS}  
**Classification:** [Bella Implementation | Test Harness | Environment | Schema/Contract | False Positive]  
**Counts in C₆:** [YES | NO]  
**Status:** [🔄 REPRODUCING | 🔧 FIXING | ✅ FIXED | ❌ BLOCKED]

### Symptoms
{Description of test failure or unexpected behavior}

### Root Cause
{Analysis of underlying issue}

### Reproduction Steps
1. {Step 1}
2. {Step 2}
3. {Expected vs Actual}

### Fix
**Fix Start:** {YYYY-MM-DD HH:MM:SS}  
**Fix Commit:** {commit hash}  
**Fix End:** {YYYY-MM-DD HH:MM:SS}  
**Rework Effort:** {hours}h = {days}d

**Changes:**
- {File 1}: {description}
- {File 2}: {description}

### Retest
**Retest:** {YYYY-MM-DD HH:MM:SS}  
**Result:** [✅ PASS | ❌ FAIL]  
**Notes:** {Any notes on retest}

### Analysis
{Why this bug occurred, lessons learned, pattern comparison to E3}
```

---

## 🔍 E3 COMPARISON REFERENCE

**E3 (Freight Audit) Bug Pattern:**
```
Total bugs: 2/15 (13.3%)
Location: R2, R3 (both domain contract boundary)
Classification: Schema/Contract mismatch
Rework: 0.1356d total
Pattern: Front-loaded at discovery phase (R2-R3)
Clean after: 11/11 (100%) R4-R15
```

**E6 Expected Pattern:**
- Similar domain (logistics), different contracts
- Schema/Contract bugs likely at R2-R3
- Validates Contract Layer need if pattern repeats

---

## 📊 REWORK METRICS (RUNNING)

```
Total Bugs: 0
Rework Bugs (Bella + Schema/Contract): 0
Total Rework Effort: 0.0000 days

Rework as % of Implementation: TBD
Rework as % of C₆: TBD

E3 Comparison:
- E3 rework: 0.1356d (2.3% of C₆)
- E6 rework: TBD
- Delta: TBD
```

---

## 🎯 REWORK PROTOCOL

**When bug discovered:**

1. ✅ **Reproduce** in clean environment
2. ✅ **Classify** using 5 categories above
3. ✅ **Document** in this log (use template)
4. ✅ **Timestamp** discovery → fix → retest
5. ✅ **Fix** (if Bella/Schema bug)
6. ✅ **Retest** and record result
7. ✅ **Aggregate** rework effort

**Honest measurement:**
- ❌ Do NOT hide bugs as "test infrastructure"
- ❌ Do NOT exclude schema/contract bugs from rework
- ❌ Do NOT skip timestamp or effort tracking
- ✅ Count all Bella + Schema/Contract bugs in C₆
- ✅ Document even if embarrassing or unexpected
- ✅ Compare pattern to E3 transparently

---

## 📝 NOTES

**E6 Bug Tracking Philosophy:**

> "Bugs are expected data points, not failures. Schema/contract bugs especially validate the need for Contract Layer investment."

**Key Insights to Track:**
1. Do E6 bugs cluster at R2-R3 like E3?
2. Are bugs schema/contract related (domain boundary)?
3. Is rework front-loaded or distributed?
4. Does bug pattern validate E5 Contract Layer recommendation?

---

**Last Updated:** 2026-08-21 23:06:39  
**Status:** Ready for bug tracking during verification


**RESOLUTION - 2026-08-21 23:46:10:**

✅ **VERIFIED & FIXED**

**Verification (2026-08-21 23:48:00):**
- ✅ `public.tenants` table exists in database
- ✅ Column `id` exists with type `uuid NOT NULL`
- ✅ FK constraint will work: `REFERENCES public.tenants(id)`

**Rework Time:**
- Discovery → Investigation: 5.23 minutes
- Investigation → Fix: 0.67 minutes  
- Fix → Verification: 1.83 minutes
- **Total: ~7.73 minutes (0.0054 days)**

**Fix Applied:**
Changed all 6 FK references from `public_tenants` → `public.tenants`:
1. logistics_warehouse_skus ✅
2. logistics_warehouse_bins ✅
3. logistics_warehouse_receipts ✅
4. logistics_warehouse_receipt_line_items ✅
5. logistics_warehouse_inventory_on_hand ✅
6. logistics_warehouse_movements ✅

**Counts in C₆:** ✅ YES (0.0054 days)

**Status:** ✅ VERIFIED → Ready for migration

---


### Bug #2 - Schema Foundation: Missing User Table Reference in RLS

**Discovery:** 2026-08-21 23:51:22  
**Classification:** Schema/Contract Mismatch  
**Counts in C₆:** TBD  
**Status:** 🔄 INVESTIGATING

**Error:**
```
ERROR: relation "public_users" does not exist
```

**Context:**
- Phase: RLS policy creation
- RLS policies use: `(SELECT tenant_id FROM public_users WHERE id = auth.uid())`
- Table `public_users` not found

**Pattern:** Same as B1 - table name assumption mismatch

**Investigation:**
1. Check if users table exists with different name
2. Check E3 Freight Audit - how does it handle RLS + tenant lookup?
3. Determine correct user/tenant relationship pattern

**Timestamp:**
- Discovery: 2026-08-21 23:51:22
- Investigation start: 2026-08-21 23:51:22

---


**ROOT CAUSE FOUND - 2026-08-21 23:52:00:**

E3 uses **session variable pattern** for RLS:
```sql
-- E3 (Freight Audit):
USING (tenant_id = current_setting('app.tenant_id')::uuid)
```

E6 assumed **user table lookup pattern**:
```sql
-- E6 (Warehouse) - WRONG:
USING (tenant_id = (SELECT tenant_id FROM public_users WHERE id = auth.uid()))
```

**Verification:**
- ✅ E3 Freight Audit schema confirmed: `current_setting('app.tenant_id')` is canonical
- ✅ Session variable pattern is platform standard
- ✅ User table lookup pattern was incorrect assumption

**Classification:** ✅ Bella Implementation Bug (counts in C₆)
- Wrong RLS pattern assumption
- Should follow E3 precedent
- Platform contract not documented/discovered during design

**Significance for E6:**
This is **EXACTLY the friction E6 is designed to measure**:
- Second vertical makes different platform assumption than first
- Contract boundary not clear
- Discovery happens at implementation, not design
- Pattern: B1 (tenant FK) + B2 (RLS) both at platform boundary

**Fix Applied - 2026-08-21 23:52:55:**
Updated all 6 RLS policies:
1. logistics_warehouse_skus ✅
2. logistics_warehouse_bins ✅
3. logistics_warehouse_receipts ✅
4. logistics_warehouse_receipt_line_items ✅
5. logistics_warehouse_inventory_on_hand ✅
6. logistics_warehouse_movements ✅

**Rework Time:**
- Discovery: 23:51:22
- Investigation: 23:51:22 → 23:52:00 (0.63 minutes)
- Fix: 23:52:00 → 23:52:55 (0.92 minutes)
- **Total: ~1.55 minutes (0.0011 days)**

**Counts in C₆:** ✅ YES (0.0011 days)

**Status:** ✅ FIXED → Ready for migration retry

---


### Bug #3 - R1 Test: FK Constraint - Test Tenant Must Exist

**Discovery:** 2026-08-22 05:13:09  
**Classification:** Test Harness / Environment Setup  
**Counts in C₆:** ❌ NO (test infrastructure, not implementation bug)  
**Status:** 🔄 INVESTIGATING

**Error:**
```
insert or update on table "logistics_warehouse_skus" violates foreign key constraint 
"logistics_warehouse_skus_tenant_fk"
```

**Context:**
- Phase: R1 Test execution (setup phase)
- Test script: `scripts/e6/test-r1-receive-inventory.mjs`
- Test creates fresh UUID for tenant: `const TEST_TENANT_ID = uuidv4();`
- FK constraint requires tenant exists in `public.tenants` first

**Root Cause:**
Test assumes arbitrary tenant UUID can be used (E3 pattern), but FK constraint to `public.tenants` (added in B1 fix) requires tenant record to exist first.

**Classification Decision:**
- ❌ **NOT a Bella implementation bug**
- ✅ **Test harness infrastructure issue**
- Test needs to create tenant fixture before creating SKUs

**Impact:**
- Blocks R1 verification
- Does NOT count as implementation rework
- Test infrastructure effort tracked separately

**Fix Options:**
1. Create tenant fixture in test setup
2. Use existing tenant from database
3. Temporarily disable FK for test (❌ bad practice)

**Decision: Option 1** - Create proper test tenant fixture

**Timestamp:**
- Discovery: 2026-08-22 05:13:09
- Investigation: 2026-08-22 05:13:09
- Fix: IN PROGRESS

---


### Bug #4 - R1: Schema - Discrepancy Column Constraint Issue

**Discovery:** 2026-08-22 05:15:51  
**Classification:** Schema/Implementation Mismatch  
**Counts in C₆:** ✅ YES (implementation bug)  
**Status:** 🔄 INVESTIGATING

**Error:**
```
cannot insert a non-DEFAULT value into column "discrepancy"
```

**Context:**
- Phase: R1 Verification - AC1.1 (Basic Receipt Creation)
- Table: `logistics_warehouse_receipt_line_items`
- Test attempts to insert: `discrepancy: 0` and `discrepancy: 5`

**Root Cause:**
Schema likely has `discrepancy` as GENERATED column or has constraint preventing direct insert.
Implementation assumes discrepancy can be inserted directly.

**Impact:**
- Blocks R1 line item creation
- Core R1 functionality broken

**Investigation needed:**
1. Check schema definition for `discrepancy` column
2. Determine if should be GENERATED ALWAYS or manually calculated
3. Fix schema or service implementation

**Timestamp:**
- Discovery: 2026-08-22 05:15:51
- Investigation: IN PROGRESS

---

### Bug #5 - R1 Test: RLS Test FK Constraint (Second Tenant)

**Discovery:** 2026-08-22 05:15:51  
**Classification:** Test Harness (similar to B3)  
**Counts in C₆:** ❌ NO (test infrastructure)  
**Status:** 🔄 INVESTIGATING

**Error:**
```
insert or update on table "logistics_warehouse_receipts" violates foreign key constraint 
"logistics_warehouse_receipts_tenant_fk"
```

**Context:**
- Phase: RLS Tenant Isolation test
- Test creates second tenant UUID without fixture: `const OTHER_TENANT_ID = uuidv4();`

**Root Cause:**
Same as B3 - FK constraint requires tenant exists in `public.tenants` first.

**Classification:**
- ❌ NOT implementation bug
- ✅ Test harness needs second tenant fixture

**Fix:**
Add second tenant fixture creation in RLS test.

**Timestamp:**
- Discovery: 2026-08-22 05:15:51

---


**RESOLUTION - B4: 2026-08-22 05:16:00**

✅ **FIXED**

**Root Cause:**
Schema defines `discrepancy` as GENERATED ALWAYS column:
```sql
discrepancy DECIMAL(12,2) GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED
```

Service implementation attempted to insert discrepancy value directly, violating GENERATED constraint.

**Fix Applied:**
Removed `discrepancy` from insert statement in `receipt.service.ts`.
Database now auto-calculates discrepancy on insert.

**Rework Time:**
- Discovery: 05:15:51
- Investigation: 05:15:51 → 05:16:00 (0.15 min)
- Fix: 05:16:00 (code change)
- Verification: 05:17:07 (retest PASS)
- **Total: ~3 minutes (0.0021 days)**

**Counts in C₆:** ✅ YES (0.0021 days)

**Classification:** Bella Implementation Bug (schema-service contract mismatch)

**Status:** ✅ VERIFIED - R1 tests PASS

---

**RESOLUTION - B3 & B5: Test Infrastructure (NO REWORK COUNT)**

✅ **FIXED (Test Harness Only)**

**B3 & B5 Root Cause:**
Test script creates fresh tenant UUIDs without creating tenant fixtures first.
FK constraints (added in B1 fix) require tenants exist in `public.tenants`.

**Fix Applied:**
- B3: Added tenant fixture creation in setup
- B5: Added second tenant fixture in RLS test

**Classification:** ❌ Test Harness (NOT implementation bug)

**Counts in C₆:** ❌ NO (test infrastructure, not Bella code)

**Status:** ✅ FIXED

---

### Bug #6 - R4: Migration Automation - Unique Index Not Applied

**Discovery:** 2026-08-22 05:41:50  
**Classification:** TBD (pending investigation)  
**Counts in C₆:** TBD  
**Status:** 🔄 INVESTIGATING

**Error:**
```
❌ Migration failed: supabase.rpc(...).catch is not a function
⚠️  Manual application required
```

**Test Failure:**
```
❌ AC4.2: Duplicate receipt rejected: Duplicate was NOT rejected (BUG)
```

**Context:**
- Phase: R4 Unique Constraint Validation
- Requirement: AC4.1 - Create unique index on receipts
- Migration script: `scripts/e6/apply-r4-migration.mjs`
- Index SQL: `migrations/logistics/20260822_add_receipt_unique_constraint.sql`

**Symptoms:**
1. Migration automation script failed (RPC method issue)
2. Unique index `idx_receipts_unique` NOT created in database
3. R4 test AC4.2 failed - duplicate receipt was accepted (should have been rejected)
4. Test results: 4/5 PASS (only AC4.2 failed)

**Root Cause Analysis (In Progress):**

**Possibility A: Migration Tooling Friction**
- Automation script relies on Supabase RPC method
- RPC method `.catch()` not available or wrong syntax
- SQL itself is correct, but automation delivery failed
- Classification: Tooling/Environment (❌ NOT Bella bug)

**Possibility B: Schema Definition Error**
- Unique index SQL has error
- Would cause silent failure or wrong constraint
- Classification: Schema/Contract bug (✅ Bella bug)

**Possibility C: Database State Issue**
- Conflicting data prevents index creation
- Database permissions issue
- Classification: Environment (❌ NOT Bella bug)

**Investigation Steps:**
1. ✅ Verify SQL syntax of unique index (appears correct)
2. ⏳ Manual application via Supabase SQL Editor
3. ⏳ Verify index created after manual application
4. ⏳ Retest R4 after manual fix
5. ⏳ Classify based on whether manual application succeeds

**SQL to Apply Manually:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_unique
ON logistics_warehouse_receipts (tenant_id, po_number, vendor_id, received_date)
WHERE deleted_at IS NULL;
```

**Timestamp Log:**
- Discovery: 2026-08-22 05:41:50
- Test failure confirmed: 2026-08-22 05:41:50
- Investigation start: 2026-08-22 05:41:50
- Manual application: PENDING USER ACTION

**Impact:**
- ⏸️ BLOCKS R4 verification
- Cannot proceed to R5 until R4 PASS
- T₆ continues running

**Protocol:**
1. User applies SQL manually via Supabase SQL Editor
2. User confirms index created successfully
3. Rerun test: `node scripts/e6/test-r4-unique-constraint.mjs`
4. If PASS → classify as tooling friction (no C₆ rework)
5. If FAIL → deeper investigation needed

**Expected Classification:**
Migration automation tooling issue (not implementation bug).
SQL appears correct, delivery mechanism failed.

**Counts in C₆:** TBD (likely NO if tooling issue)

**Status:** ⏸️ PAUSED - Awaiting manual SQL execution

---
