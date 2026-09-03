# E5: Remote/Local Migration Name Reconciliation Gate

**Date:** 2026-08-24  
**Status:** 🔴 BLOCKED — db push --dry-run failed  
**Blocker:** Remote migration versions not found in local migrations directory

---

## **Context**

**Step 2 Gate:** `npx supabase db push --dry-run` failed with:

```
Remote migration versions not found in local migrations directory.
Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:
supabase migration repair --status reverted 20260820151000_r4_3_gate_tokens ...
```

**Issue:** Despite Step 1 recording 16 migration histories, CLI still detects remote-only migrations.

---

## **CLI Complaint List (16 versions)**

```
20260820151000_r4_3_gate_tokens
20260820152000_r4_4_monitoring_audit
20260820150000_r4_approval_contract
20260820000000
20260820010000
20260820100000
20260820110000
20260820120000
20260820130000
20260820140000
20260821122000_create_accessorial_rates_table
20260821121000_create_carrier_rates_table
20260821123000_create_discrepancies_table
20260821120000_create_freight_audit_tables
20260821000000
20260821115404
```

---

## **E5.2: Local Files Enumeration** ✅ COMPLETE

**Query:** All local migrations matching `20260820*` or `20260821*`

**Result:** 16 files found

```
20260820151000_r4_3_gate_tokens.sql
20260820152000_r4_4_monitoring_audit.sql
20260820150000_r4_approval_contract.sql
20260820000000_f5_fx_integrity.sql
20260820010000_f5_prepayment_reconciliation.sql
20260820100000_migration_governance_approvals.sql
20260820110000_database_role_separation.sql
20260820120000_fix_executor_privileges.sql
20260820130000_grant_executor_rls_bypass.sql
20260820140000_enable_rls_block_service_key.sql
20260821122000_create_accessorial_rates_table.sql
20260821121000_create_carrier_rates_table.sql
20260821123000_create_discrepancies_table.sql
20260821120000_create_freight_audit_tables.sql
20260821000000_fix_healthcare_rls_tenant_isolation.sql
20260821115404_logistics_schema.sql
```

**Analysis:**
- ✅ ALL 16 versions from CLI error have corresponding local files
- ✅ No missing local files
- ✅ Naming convention consistent: `{version}_{description}.sql` OR `{version}.sql`

---

## **Hypothesis: CLI Version/Name Matching Issue**

**Two naming conventions observed:**

### **Convention A: Abbreviated Version (underscore suffix)**
```
Version: 20260820151000_r4_3_gate_tokens
File:    20260820151000_r4_3_gate_tokens.sql
```

### **Convention B: Full Timestamp**
```
Version: 20260820110000
File:    20260820110000_database_role_separation.sql
```

**CLI Expectation:**
- For Convention A: filename must be `{version}.sql` (exact match)
- For Convention B: filename must be `{version}_{name}.sql`

**Problem:**
- Step 1 recorded `name` column in `schema_migrations`
- But CLI may not be able to reconcile if:
  - `name` doesn't match filename suffix
  - OR version format doesn't match CLI's expectation

---

## **E5.1: Remote History Query** ⏳ REQUIRED

**Need to execute on Dashboard:**

File: `scripts/forensic_e5_name_reconciliation.sql`

Or run directly:

```sql
-- E5.1: Remote versions + names for 20260820*
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%'
ORDER BY version;

-- E5.2: Remote versions + names for 20260821*
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260821%'
ORDER BY version;

-- E5.3: Check ALL versions CLI complained about
SELECT
  version,
  name,
  applied_at
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260820151000_r4_3_gate_tokens',
  '20260820152000_r4_4_monitoring_audit',
  '20260820150000_r4_approval_contract',
  '20260820000000',
  '20260820010000',
  '20260820100000',
  '20260820110000',
  '20260820120000',
  '20260820130000',
  '20260820140000',
  '20260821122000_create_accessorial_rates_table',
  '20260821121000_create_carrier_rates_table',
  '20260821123000_create_discrepancies_table',
  '20260821120000_create_freight_audit_tables',
  '20260821000000',
  '20260821115404'
)
ORDER BY version;
```

---

## **E5 Decision Tree (After Remote Query)**

### **CASE A: Remote name matches local filename suffix**

**Example:**
```
Remote: version=20260820110000, name=database_role_separation
Local:  20260820110000_database_role_separation.sql
```

**Conclusion:** Naming is correct, issue is elsewhere (possibly CLI bug or cache)

**Action:** Investigate CLI reconciliation logic

---

### **CASE B: Remote name does NOT match local filename suffix**

**Example:**
```
Remote: version=20260820110000, name=database_role_separation_v2
Local:  20260820110000_database_role_separation.sql
```

**Conclusion:** Step 1 recorded wrong name OR local file has wrong name

**Action:**
- Option 1: Rename local file to match remote name
- Option 2: UPDATE remote `schema_migrations.name`

---

### **CASE C: Remote version uses abbreviated format**

**Example:**
```
Remote: version=20260820151000_r4_3_gate_tokens, name=r4_3_gate_tokens
Local:  20260820151000_r4_3_gate_tokens.sql
```

**Conclusion:** CLI may not support abbreviated version format in local filename

**Action:** Investigate Supabase CLI version compatibility

---

### **CASE D: Remote history orphaned (no DDL)**

**Example:**
```
Remote: version=20260820_something
DDL:    NOT FOUND in pg_catalog
Local:  File exists but content is placeholder
```

**Conclusion:** Migration was recorded but DDL never applied or was rolled back

**Action:** Mark as reverted via `migration repair --status reverted`

---

## **E5 Gate Requirements**

E5 PASS only when:

```
∀ remote migration (version, name):
  ∃ local file: {version}_{name}.sql OR {version}.sql
  AND
  name matches filename convention
  AND
  no version duplicates
  AND
  CLI can reconcile migration graph
```

---

## **Next Steps**

1. **Human Architect:** Execute E5.1 query on Dashboard (3 queries)
2. **Report:** Remote version + name pairs for all 16 migrations
3. **Kiro:** Compare remote names with local filenames
4. **Kiro:** Generate E5 mapping matrix
5. **Kiro:** Identify CASE A/B/C/D for each migration
6. **Human Architect:** Approve resolution strategy
7. **Kiro:** Execute corrections (rename files OR update remote names)
8. **Verify:** `db push --dry-run` shows ONLY RPC
9. **Deploy:** RPC migration
10. **🛑 STOP**

---

## **Status Update**

| Gate | Status | Evidence |
|------|--------|----------|
| E1-E4 | ✅ COMPLETE | Remote identity + DDL provenance |
| Option B | ✅ APPROVED | F2 renamed, duplicates deleted |
| E5.2 Local Files | ✅ COMPLETE | 16/16 files exist |
| **E5.1 Remote Names** | ⏳ **PENDING** | Need Dashboard query |
| **E5 Reconciliation** | 🔴 **BLOCKED** | Awaiting E5.1 results |
| db push | 🔴 BLOCKED | Cannot proceed until E5 PASS |
| RPC Deployment | ⏸️ DEFERRED | Blocked by E5 |
| F2 Deployment | ⏸️ DEFERRED | Phase 4.5 (separate) |

---

**Principles:**
- ❌ NO `migration repair` without full E5 analysis
- ❌ NO `db pull` without understanding provenance
- ❌ NO blind fixes to make CLI quiet
- ✅ Evidence-based classification FIRST
- ✅ Architect approval BEFORE mutations

---

**File:** `scripts/forensic_e5_name_reconciliation.sql` (ready to execute)
