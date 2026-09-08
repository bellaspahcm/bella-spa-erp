# Migration Chain Defect: profiles Table Missing

**Date Discovered:** 2026-09-05  
**Discovered During:** Fresh DB reset test for 20260510 remediation  
**Classification:** 🔴 **INDEPENDENT PRE-EXISTING DEFECT** (not caused by current remediation)

---

## Summary

**Issue:** Migration 20260515 references `public.profiles` table that was never created in canonical migration history.

**Impact:** Blocks fresh database initialization at migration 20260515.

**Relationship to 20260510 remediation:** INDEPENDENT (unrelated to packages/inventory split)

**Recommended action:** Separate investigation and remediation (outside current scope)

---

## Error Details

### Failure Point

**Migration:** `20260515000000_standardization_phase_1.sql`

**Operation:** CREATE POLICY on `public.chat_messages` table

**Statement:**
```sql
CREATE POLICY "Users can view chat messages for their tenant"
    ON public.chat_messages FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
```

**Error:**
```
ERROR: relation "public.profiles" does not exist (SQLSTATE 42P01)
At statement: 2
```

### Execution Context

**Fresh DB reset log:**
```
✅ Applying migration 20260509000000_create_spa_base_tables.sql...
✅ Applying migration 20260511000000_initial_schema.sql...
✅ Applying migration 20260512000000_fix_permissions.sql...
✅ Applying migration 20260514000000_add_gender_baby.sql...
✅ Applying migration 20260514000001_audit_logs.sql...
🔴 Applying migration 20260515000000_standardization_phase_1.sql...
   ERROR: relation "public.profiles" does not exist
```

---

## Root Cause Analysis

### profiles Table Search

**Query:** Search entire migration history for `CREATE TABLE profiles`

**Command:**
```bash
grep -r "CREATE TABLE.*profiles" supabase/migrations/
```

**Result:** ZERO matches for `public.profiles`

**Similar tables found:**
- `people_profiles` (created in `20260801030000_foundation_org_people_schema.sql`)
- `patient_profiles` (created in `20260806050000_healthcare_platform_extended_schema.sql`)
- `hr_employee_profiles` (created in `20260802000000_create_hr_capability_schema.sql`)
- `auto_customer_profiles` (created in `20260803220000_create_auto_customer_extension.sql`)

**Conclusion:** Generic `public.profiles` table was never created in canonical migration history, but 20260515 assumes it exists.

### Hypothesis: Manual Creation

**Likely scenario:**
1. `profiles` table created manually in early development (outside migration system)
2. Migration 20260515 written assuming table exists
3. Fresh database initialization fails because table was never captured in migrations
4. Similar to packages/inventory_items issue (created outside migration system)

**Evidence:** Multiple tables reference patterns suggesting manual schema creation followed by migration capture attempts.

---

## Impact Assessment

### On Fresh Database Initialization

**Status:** BLOCKED

**Impact:** Cannot execute full migration chain from zero

**Blocking migrations:** All migrations after 20260515 (200+ migrations)

**Workaround:** Manual creation of profiles table before running migrations (NOT recommended for production)

### On Production

**Status:** LIKELY WORKING

**Rationale:** Production probably has manually-created profiles table

**Risk:** Production schema != migration-generated schema (drift)

### On Development

**Status:** BLOCKED

**Impact:** New developers cannot initialize fresh local database

**Workaround:** Copy production schema or manually create missing tables

---

## Relationship to Current Remediation

### 20260510 Dependency Cycle Remediation

**Original issue:** 20260510 creates packages/inventory tables with forward references

**Remediation:** Split into 20260509 (base) + 20260517 (constraints)

**Status:** Partially validated (20260509 proven to work)

### Independence Verification

**Does 20260510 reference profiles?** ❌ NO

**Does 20260509 reference profiles?** ❌ NO

**Does 20260517 reference profiles?** ❌ NO

**Does profiles relate to packages/inventory?** ❌ NO

**Conclusion:** profiles defect is COMPLETELY INDEPENDENT of packages/inventory remediation

### Discovery Context

**Why discovered now?**
- Fresh DB reset performed to validate 20260510 split remediation
- Reset executes ALL migrations from zero
- Previously hidden defect (profiles) surfaced during comprehensive test

**Classification:** Collateral discovery (found while testing different issue)

---

## Recommended Investigation Steps

### Step 1: Verify Production Schema

**Query production for profiles table:**
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

**Expected outcomes:**
- **Table exists:** Production has manual creation → need restoration migration
- **Table missing:** 20260515 is incorrect reference → need migration fix

### Step 2: Search for profiles References

**Find all migrations referencing profiles:**
```bash
grep -r "profiles" supabase/migrations/ | grep -v ".bak"
```

**Analyze:**
- How many migrations reference profiles?
- Are references essential or removable?
- Is profiles a critical table or vestigial reference?

### Step 3: Determine Table Purpose

**Questions:**
- What data does profiles contain?
- Is it authentication-related (Supabase auth.users extension)?
- Is it tenant-specific user profiles?
- Is it superseded by later tables (people_profiles, hr_employee_profiles)?

### Step 4: Design Resolution

**Option A: Restoration Migration**
- Extract profiles schema from production
- Create `202605XX000000_create_profiles_table.sql`
- Position BEFORE 20260515
- Test fresh DB reset

**Option B: Remove References**
- Audit all profiles references
- Replace with correct table (users, people_profiles, etc.)
- Update 20260515 and other affected migrations

**Option C: Historical Acceptance**
- Archive migrations referencing profiles
- Document as historical drift
- Recommend production schema export for fresh DB setup

---

## Scope Boundary

### Current Remediation Scope

**Objective:** Fix 20260510 dependency cycle

**Scope:** packages, inventory_items, inventory_logs tables ONLY

**Status:** Partially validated (20260509 proven)

### profiles Issue Scope

**Objective:** TBD (separate investigation)

**Scope:** profiles table + all referencing migrations

**Status:** DISCOVERED, not yet remediated

**Decision:** OUT OF SCOPE for current 20260510 remediation

**Rationale:**
- Independent issue (no relation to packages/inventory)
- Broader impact (affects multiple migrations)
- Requires separate root cause investigation
- Expanding scope risks mission creep

---

## Recommendations

### For Current Remediation (20260510)

**Action:** STOP at scope boundary

**Status:** PARTIALLY RUNTIME-VALIDATED
- ✅ Split Part 1 (20260509) proven to work
- ⏸️ Split Part 2 (20260517) blocked (not reached due to profiles failure)
- ⏸️ Full chain validation incomplete

**Document:** profiles defect separately (this file)

**Proceed:** Report qualified status to user for Manufacturing Phase 3.5 decision

### For profiles Defect

**Action:** Create separate remediation work item

**Priority:** TBD (depends on impact assessment)

**Owner:** TBD

**Prerequisites:**
1. Verify production profiles schema
2. Audit all profiles references
3. Determine table purpose and necessity
4. Design restoration or removal strategy

**Timeline:** Independent of 20260510 remediation

---

## Impact on Manufacturing Phase 3.5

### Question

**Can Manufacturing Phase 3.5 proceed without full fresh DB validation?**

### Analysis

**Risk factors:**
- ✅ 20260509 (split Part 1) proven to work
- 🟡 20260517 (split Part 2) not runtime-proven (blocked before reaching)
- 🔴 Full migration chain untested (blocked at 20260515)

**Mitigation:**
- Static verification of 20260517 complete (dependencies checked)
- Syntax validated (no obvious errors)
- FK targets confirmed to exist (tenants, users, session_logs from 20260511)

**Confidence level:**
- HIGH for 20260509 working (runtime proven)
- MEDIUM for 20260517 working (static verified, not runtime proven)
- LOW for full chain producing production-equivalent schema

### Decision Options

**Option A: Proceed with qualified status**
- Accept partial validation (20260509 proven)
- Acknowledge 20260517 not runtime-tested
- Document risk in Manufacturing Phase 3.5 planning

**Option B: Block until profiles resolved**
- Fix profiles issue first
- Complete full fresh DB validation
- Proceed with full confidence

**Option C: Test 20260517 in isolation**
- Run 20260517 SQL against production-like state
- Verify syntax/execution (supplementary evidence)
- Does NOT replace full chain proof

---

## Historical Pattern Recognition

### Similar Issues Discovered

1. **packages table** (20260510 issue - CURRENT REMEDIATION)
   - Created outside migration system
   - Later migrations assume existence
   - Restoration migration attempted (20260510) but had forward references

2. **inventory_items table** (20260510 issue - CURRENT REMEDIATION)
   - Created outside migration system
   - Comment in 20260512: "inventory_items table never created"
   - Restoration migration attempted (20260510) but had forward references

3. **profiles table** (THIS ISSUE)
   - Created outside migration system (hypothesis)
   - Migration 20260515 assumes existence
   - NO restoration migration attempted

### Pattern

**Root cause:** Early development created tables manually, migration history captured incrementally

**Result:** Migration history incomplete, fresh DB initialization fails

**Manifestation:** Different tables discovered at different times during testing

**Implication:** May be MORE undiscovered issues of same pattern

---

## Recommendations for Broader Investigation

### Consider Comprehensive Migration Audit

**Scope:** All migrations, all table references

**Objective:** Identify ALL missing table creation migrations

**Method:**
1. Parse all migrations for table references (SELECT/INSERT/UPDATE/FK)
2. Cross-reference with CREATE TABLE statements
3. Flag references to never-created tables
4. Prioritize by impact and frequency

**Risk:** May uncover significant additional issues

**Benefit:** Prevents future discoveries during critical operations

**Timeline:** Out of scope for current remediation (recommend separate work item)

---

## Status

**Classification:** 🔴 INDEPENDENT PRE-EXISTING DEFECT

**Relationship to 20260510 remediation:** UNRELATED

**Scope decision:** OUT OF SCOPE (separate investigation required)

**Impact:** Blocks full fresh DB validation (20260510 remediation partially validated only)

**Recommended action:** Create separate work item for profiles investigation and remediation

**Production impact:** UNKNOWN (likely working if table exists via manual creation)

**Development impact:** HIGH (blocks new developer onboarding via fresh DB setup)

---

**Discovery context:** Collateral finding during 20260510 remediation testing  
**Discovery date:** 2026-09-05  
**Status:** DOCUMENTED, awaiting separate investigation
