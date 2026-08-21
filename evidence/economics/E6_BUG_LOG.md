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

**Total Bugs:** 2

**By Category:**
- Bella Implementation: 0
- Schema/Contract: 2 (B1: tenant FK, B2: RLS pattern)
- Test Harness: 0
- Environment: 0
- False Positive: 0

**By Requirement:**
- Schema Foundation: 2 (B1, B2)
- R1: 0
- R2-R15: 0 (pending)

**Rework Distribution:**
```
Schema/Contract bugs: 0.0065d (B1: 0.0054d + B2: 0.0011d)
Total rework (counts in C₆): 0.0065d
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
