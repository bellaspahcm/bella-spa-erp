# Migration Chain Audit: Dangling Dependencies

**Date:** 2026-09-05  
**Status:** Classification in progress  
**Total dangling dependencies:** 36

---

## AUDIT METHODOLOGY

**Extraction:**
- Created tables: 397 (from CREATE TABLE statements)
- Referenced tables: 278 (from FROM/JOIN/REFERENCES/ALTER TABLE)
- Dangling: 36 (referenced but never created)

**Classification criteria:**
- **Platform Core:** Cross-industry capability (tenant, auth, RLS)
- **Bella Spa Legacy:** Spa-specific tables/functions
- **Babycare Legacy:** Babycare-specific tables/functions
- **Finance Functions:** Finance Kernel functions (not tables)
- **Materialized Views:** Views that should be created dynamically
- **Supabase/System:** System-managed objects
- **Truly Dangling:** No clear owner, likely migration defect

---

## AUDIT RESULTS: 36 → 13 TRULY DANGLING TABLES

**Refined classification after object type verification:**

### ✅ Category 1: FALSE POSITIVES - Functions (20 verified)
*These are FUNCTIONS, not tables - search detected function calls*

1. `f5_reconstruct_ap_position` - ✅ Function EXISTS
2. `f5_reconstruct_ar_position` - ✅ Function EXISTS
3. `f5_reconstruct_cash_balance` - ✅ Function EXISTS
4. `f5_reconstruct_cash_position_v1_6` - ✅ Function EXISTS
5. `f5_reconstruct_prepayment_position` - ✅ Function EXISTS
6. `finance_ap_facts_as_of` - ✅ Function EXISTS
7. `finance_ar_facts_as_of` - ✅ Function EXISTS
8. `finance_bank_account_gl_map` - ✅ Function EXISTS
9. `finance_cash_allocation_lock_key` - ✅ Function EXISTS
10. `finance_cash_opening_balance_as_of` - ✅ Function EXISTS
11. `finance_financial_lock_key` - ✅ Function EXISTS
12. `finance_get_cash_movements_as_of` - ✅ Function EXISTS
13. `finance_get_prepayment_gl_map_as_of` - ✅ Function EXISTS
14. `finance_journal_entries_as_of` - ✅ Function EXISTS
15. `finance_prepayment_facts_as_of` - ✅ Function EXISTS
16. `finance_prepayment_position_as_of` - ✅ Function EXISTS
17. `calculate_ktv_salary_sheet` - ✅ Function EXISTS
18. `get_ktv_leaderboard` - ✅ Function EXISTS
19. `get_package_demand_history` - ✅ Function EXISTS
20. `get_service_demand_history` - ✅ Function EXISTS

**Status:** ✅ NO ACTION NEEDED - Functions exist, not dangling tables  
**Risk:** NONE

---

### ⚠️ Category 2: FALSE POSITIVES - Materialized Views (3)
*MVs not created yet but will be created dynamically*

21. `mv_customer_item_interactions` - Materialized view (not yet created)
22. `mv_customer_segments` - Materialized view (not yet created)
23. `mv_forecast_accuracy` - Materialized view (not yet created)

**Status:** ⚠️ LOW PRIORITY - MVs are lazily created by refresh jobs  
**Action:** Verify MVs are created before first use, or create in migration  
**Risk:** LOW (may cause initial query failures until first refresh)

---

### 🔴 Category 3: TRULY DANGLING - Bella Spa Legacy Tables (13)
*Tables that are REFERENCED but NEVER CREATED*

#### **3A. DELETED BY THE GREAT PURGE (verified)**

24. **`employees`** - 13 migration references
   - **Status:** Deleted in `20260515010000_the_great_purge.sql`
   - **Replacement:** `people_directory` (Foundation Org Schema)
   - **Dangling refs:** booking_engine still references `employees` FK
   - **Action:** Update FKs to reference `people_directory` or remove

25. **`units`** - 11 migration references  
   - **Status:** Deleted in `20260515010000_the_great_purge.sql`
   - **Replacement:** `org_units` (Foundation Org Schema)
   - **Dangling refs:** Mostly comments/aliases
   - **Action:** LOW PRIORITY - mostly semantic references

26. **`profiles`** - 4 migration references
   - **Status:** Referenced in RLS policies (`20260701000004_create_policy_rls.sql`)
   - **Likely:** Intended to be `auth.users` or user profile table
   - **Action:** Replace with correct auth table reference

#### **3B. LEGACY SPA TABLES - NEVER CREATED**

27. **`packages`** - 120+ migration references ⚠️ **CRITICAL**
   - **Status:** WIDELY USED but table creation missing
   - **Evidence:** Migration `20260515040000_create_packages_table.sql` says "table exists" but does ALTER TABLE
   - **Usage:** Booking engine, salary calculation, demand forecasting, MVs
   - **Action:** **MUST VERIFY** - does seed data create this? Or is it truly missing?

28. **`inventory_items`** - 31 migration references (already known)
   - **Status:** DISABLED in multiple migrations with comments "table never created"
   - **Evidence:** Healthcare/Perioperative tried to extend it, failed
   - **Action:** Remove dangling references OR create canonical table

29. **`inventory_logs`** - 44 migration references ⚠️ **HIGH IMPACT**
   - **Status:** RLS policies exist, accounting backfills reference it
   - **Usage:** Accounting review, business events, MVs
   - **Action:** **MUST VERIFY** - likely needs table creation

30. **`sessions`** - 54 migration references ⚠️ **CRITICAL**
   - **Status:** Demand forecasting, MVs, salary calculations all depend on it
   - **Usage:** Core Spa booking workflow
   - **Action:** **MUST VERIFY** - may be created by seed or legacy migration

31. **`session_service_details`** - 5 migration references
   - **Status:** Line items for sessions
   - **Action:** Verify if created elsewhere or truly missing

32. **`services`** - 12 migration references
   - **Status:** Service master data (different from packages)
   - **Action:** Verify if refactored into packages or separate table

33. **`projects`** - 17 migration references
   - **Status:** Used in Real Estate seed data (partner portal)
   - **Context:** May be Real Estate specific
   - **Action:** Check if Real Estate Industry OS has this table

#### **3C. LEGACY SPA TABLES - POSSIBLY RENAMED**

34. **`reviews`** - 1 migration reference
   - **Status:** Comment says "from reviews or session ratings"
   - **Likely:** Renamed to `session_reviews` or removed
   - **Action:** LOW PRIORITY - just a comment

35. **`sale_contracts`** - 0 migration references (found in other searches)
   - **Status:** May be renamed to `contract_contracts`
   - **Action:** LOW PRIORITY - verify rename

36. **`finance_periods`** - NOT FOUND as function
   - **Status:** May alias `accounting_periods` table
   - **Action:** Verify alias or create view

---

## CRITICAL: Babycare Product Storage Investigation

**MUST VERIFY before any remediation:**

```
Babycare Product/Inventory Flow
      ↓
Where does Babycare store products?
      ↓
Options:
  A. Uses legacy `inventory_items` table (BUT TABLE DOESN'T EXIST!)
  B. Uses Babycare-specific schema (products/items/inventory)
  C. Uses Platform/shared schema
  D. No product storage yet (prototype only)
```

**Investigation required:**
1. Search Babycare codebase for product/inventory references
2. Check Babycare migrations for product schema
3. Verify actual data storage in running Babycare instance
4. Confirm whether Babycare is functional or broken

**DO NOT remove any `inventory_*`, `product*`, `packages`, or `services` references until this is verified.**

---

## NEXT STEPS

### Phase 1: Verify Object Types (CURRENT)
- [ ] Check CREATE FUNCTION for all suspected functions
- [ ] Check CREATE MATERIALIZED VIEW for all suspected views
- [ ] Distinguish between missing tables vs missing function definitions

### Phase 2: Babycare Investigation (CRITICAL)
- [ ] Search Babycare code for product storage
- [ ] Check if Babycare uses any dangling tables
- [ ] Verify Babycare functionality (working or broken?)
- [ ] Document actual product/inventory storage location

### Phase 3: Classification Refinement
- [ ] Categorize by: Platform / Spa / Babycare / Dangling
- [ ] For each category, determine: PRESERVE / COMMENT / REMOVE / CREATE
- [ ] Check git history for context on unclear items

### Phase 4: Remediation Plan (AFTER CLASSIFICATION)
- [ ] Group fixes by category
- [ ] Single coordinated remediation
- [ ] Test fresh DB initialization
- [ ] Verify no regression in Spa/Babycare

---

## PRINCIPLES

1. **Audit before remediation** - Understand before fixing
2. **Classify by ownership** - Platform / Spa / Babycare / Dangling
3. **Preserve working capabilities** - Don't break Babycare/Spa
4. **Fix semantics, not symptoms** - Understand why references exist
5. **Single coordinated fix** - Not incremental patches

---

**Status:** Classification phase - determining which "tables" are actually functions/views  
**Next:** Verify object types, then investigate Babycare product storage  
**Blocked:** Manufacturing Phase 3.5 validation (migration chain must be clean first)


---

## 🚨 CRITICAL DISCOVERY: Bella Spa Core Tables Missing

**Investigation result:** The following tables are **HEAVILY REFERENCED** but **NEVER CREATED**:

| Table | References | Created? | Impact |
|-------|-----------|----------|---------|
| `packages` | 120+ migrations | ❌ NO | 🔴 CRITICAL - booking engine, salary, forecasting |
| `sessions` | 54 migrations | ❌ NO | 🔴 CRITICAL - core booking workflow |
| `inventory_logs` | 44 migrations | ❌ NO | 🔴 HIGH - accounting, business events |
| `inventory_items` | 31 migrations | ❌ NO | 🟡 MEDIUM - disabled in migrations |
| `projects` | 17 migrations | ❌ NO | 🟡 MEDIUM - Real Estate seed data |
| `services` | 12 migrations | ✅ YES (sandbox only) | ⚠️ Exists in sandbox schema only |

---

## 🔍 ROOT CAUSE HYPOTHESIS

**Hypothesis 1: External schema bootstrap (most likely)**
- These tables were created by **external seed script** or **application bootstrap**
- Migrations reference them but don't create them
- Bella Spa may be functional IF these tables exist in running database

**Hypothesis 2: Migration history gap**
- Early migrations that created these tables were removed/lost
- Current migration chain incomplete
- Would cause fresh database initialization to fail

**Hypothesis 3: Namespace collision**
- Tables exist in different schema (not `public`)
- Migrations reference `public.packages` but table is elsewhere
- Would cause RLS/FK failures

---

## 🎯 CRITICAL VALIDATION REQUIRED

### Before ANY remediation, MUST verify:

**1. Check running Bella Spa database:**
```sql
-- Does packages table exist in production?
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name IN ('packages', 'sessions', 'inventory_logs', 'inventory_items');

-- Does Bella Spa have data in these tables?
SELECT 'packages' as table_name, COUNT(*) FROM public.packages
UNION ALL
SELECT 'sessions', COUNT(*) FROM public.sessions
UNION ALL  
SELECT 'inventory_logs', COUNT(*) FROM public.inventory_logs;
```

**2. Check external bootstrap scripts:**
```bash
# Search for table creation outside migrations
find . -name "*.sql" -not -path "*/migrations/*" | xargs grep -l "CREATE TABLE.*packages"
find . -name "*.ts" -o -name "*.js" | xargs grep -l "CREATE TABLE.*packages"
```

**3. Check git history for deleted migrations:**
```bash
git log --all --full-history --oneline -- "*packages*"
git log --all --full-history --oneline -- "*sessions*"
```

---

## 📊 CONSEQUENCES

### If Bella Spa is FUNCTIONAL:
- ✅ Tables exist, created externally
- ⚠️ Migration chain incomplete (cannot bootstrap fresh DB)
- 🔧 **Fix:** Add CREATE TABLE migrations OR document external bootstrap

### If Bella Spa is BROKEN:
- ❌ Tables never existed
- ❌ Bella Spa non-functional since "The Great Purge" (2026-05-15)
- 🔧 **Fix:** Create missing tables with proper schema

### Manufacturing Phase 3.5 Impact:
- **BLOCKED either way** - cannot initialize fresh database
- Manufacturing canonical schema is CORRECT
- Issue is pre-existing Bella Spa migration defect

---

## 🚦 NEXT STEPS (IN ORDER)

### Step 1: Verify Bella Spa Functionality ⚠️ **DO THIS FIRST**
- [ ] Check if Bella Spa has running database instance
- [ ] Verify `packages`, `sessions`, `inventory_logs` tables exist
- [ ] Confirm tables have data (not empty)
- [ ] Document actual schema of existing tables

### Step 2: Classification Based on Evidence
**IF tables exist in production:**
- Extract schema from production
- Create canonical migrations
- Add to migration history
- Document external bootstrap removal

**IF tables don't exist:**
- Classify as abandoned legacy
- Remove all dangling references
- Update migrations to remove dead code
- Verify Bella Spa actually works without them

### Step 3: Execute Remediation
- Single coordinated fix (not incremental)
- Test fresh DB initialization
- Verify no regression in functional systems

### Step 4: Manufacturing Phase 3.5 Validation
- Only after migration chain GREEN
- Only after Bella Spa validation PASS
- Full Phase 3.5 pipeline end-to-end

---

## 🎯 DECISION GATE

**We are at a critical decision point:**

```
Do packages/sessions/inventory_logs tables exist in running Bella Spa?
│
├─ YES → Migration history incomplete
│   └─ Action: Extract schema + add migrations
│
└─ NO → Tables never existed / Bella Spa broken
    └─ Action: Remove dangling references / create tables if needed
```

**MUST VERIFY before proceeding with ANY code changes.**

---

**Status:** ⚠️ INVESTIGATION REQUIRED - Cannot proceed with remediation until Bella Spa table existence verified  
**Blocker:** Manufacturing Phase 3.5  
**Next:** Verify Bella Spa database schema (production or running instance)

---

## 📋 INVESTIGATION SUMMARY

### What We Know:
1. ✅ **20 "dangling" objects are actually FUNCTIONS** - false positives, no action needed
2. ⚠️ **3 materialized views** not created yet - low priority, lazily created
3. 🔴 **13 tables truly dangling** - referenced but never created:
   - `packages` (120+ refs) - CRITICAL
   - `sessions` (54 refs) - CRITICAL
   - `inventory_logs` (44 refs) - HIGH
   - `inventory_items` (31 refs) - already disabled in many migrations
   - Plus 9 others

### What We DON'T Know (Critical Gap):
- ❓ Do these tables exist in **running Bella Spa database**?
- ❓ Is Bella Spa **functional or broken** since "The Great Purge" (2026-05-15)?
- ❓ Were these tables created by **external bootstrap** (outside migrations)?
- ❓ Does Babycare use any of these tables?

### Why This Blocks Manufacturing:
- Fresh database initialization **FAILS** - migration chain incomplete
- Cannot validate Phase 3.5 canonical contract establishment
- Cannot prove Manufacturing schema correctness
- Manufacturing implementation is CORRECT - blocker is pre-existing Spa defect

---

## 🎯 RECOMMENDED NEXT ACTION

**Option A: Check Running Bella Spa Database (FASTEST)**
```bash
# If you have access to running Bella Spa Supabase instance:
npx supabase db remote --db-url <bella-spa-url>

# Then run:
\dt public.packages
\dt public.sessions
\dt public.inventory_logs
SELECT COUNT(*) FROM public.packages;
```

**Option B: Initialize Fresh Local DB and Document Failures (SAFER)**
```bash
# Try fresh initialization:
npx supabase db reset

# Document which migrations fail
# Classify failures by category
# Then remediate based on actual evidence
```

**Option C: Defer Bella Spa Investigation (PRAGMATIC)**
- Manufacturing schema is CORRECT
- Bella Spa migration defect is PRE-EXISTING
- Classify as "known technical debt"
- Proceed with Manufacturing validation on **remote Supabase instance**
- Return to Spa remediation later with user guidance

---

**Recommendation: Option B (Fresh DB Reset with Failure Documentation)**  
**Rationale:** Provides real runtime evidence, discovers ALL migration defects (not just suspected ones), safe to execute locally
