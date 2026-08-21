# E0 CHECK CLASSIFICATION ANALYSIS

**Date:** 2026-08-20  
**Purpose:** Classify 33 E0 checks to determine required BDGF capabilities  
**Source:** `evidence/g3a-baseline/result-A-e0.txt` + `scripts/run-e0-artifact-integrity-gate.mjs`  

---

## CLASSIFICATION METHODOLOGY

**For each check, determine:**

1. **Can existing P0 primitives handle this?**
   - YES → Use existing ✅
   - NO → Classify need ↓

2. **Is this a generic governance capability?**
   - YES → Add to Check Registry (generic) ✅
   - NO → Domain-specific or one-off ↓

3. **Is this Amendment 12-specific?**
   - YES → Keep in config, use `custom` check type ⬜
   - NO → Reject (shouldn't reach here) ❌

---

## GROUP A: ARTIFACT INTEGRITY (15 checks)

### A1-A6: Migration File Existence (6 checks)

**Checks:**
1. `20260819040000_runtime_migration_e1_gate_schema_safe.sql` exists
2. `20260819050000_runtime_migration_05a_classification_reservation.sql` exists
3. `20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql` exists
4. `20260819050002_runtime_migration_05b_canonical_tenant_creation.sql` exists
5. `20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql` exists
6. `20260819050004_runtime_migration_e3_post_05c_verification.sql` exists

**Legacy implementation:**
```javascript
if (fs.existsSync(file)) {
  const hash = fileHash(file);
  pass(`Migration file exists: ${path.basename(file)} (${hash})`);
}
```

**Classification:** ✅ **Use existing primitive**

**P0 primitive:** `file-existence`

**Reason:** File existence check is already in Check Registry

**Config approach:**
```json
{
  "id": "check-migration-e1-exists",
  "type": "file-existence",
  "config": {
    "path": "supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql"
  }
}
```

**Domain knowledge in config:** Migration filenames (allowed)  
**Kernel knowledge:** None (checks any file)

---

### A7-A9: Verification Script Existence (3 checks)

**Checks:**
7. `verify-amendment-12-v3-package-integrity.mjs` exists
8. `run-e1-verification.mjs` exists
9. `run-e0-artifact-integrity-gate.mjs` exists

**Classification:** ✅ **Use existing primitive**

**P0 primitive:** `file-existence`

**Same as A1-A6** (file existence)

---

### A10: Documentation Existence (1 check)

**Check:**
10. `BELLA_RUNTIME_MIGRATION_05_PACKAGE_REVIEW.md` exists

**Classification:** ✅ **Use existing primitive**

**P0 primitive:** `file-existence`

**Same as A1-A6**

---

### A11-A15: File Content Structure (5 checks)

**Checks:**
11. 05-A contains `canonical_tenant_map` table definition
12. 05-A contains `migration_05a_preflight_p4_collision_gate` function
13. 05-B contains `prevent_canonical_id_change` trigger
14. 05-B contains `DELETE FROM runtime_tenant_registry` logic
15. E2 contains `migration_05_e2_orphan_safety_gate` function

**Legacy implementation:**
```javascript
const content = fs.readFileSync(file, 'utf-8');
if (content.includes('CREATE TABLE migration_evidence.canonical_tenant_map')) {
  pass('05-A structure: canonical_tenant_map table definition present');
}
```

**Classification:** ✅ **Use existing primitive**

**P0 primitive:** `file-contains-text` (exists as `regex-match`)

**Config approach:**
```json
{
  "id": "check-05a-canonical-map-table",
  "type": "regex-match",
  "config": {
    "path": "supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql",
    "pattern": "CREATE TABLE migration_evidence\\.canonical_tenant_map"
  }
}
```

**Domain knowledge in config:** Table names, function names (allowed)  
**Kernel knowledge:** None (checks any text pattern)

---

**GROUP A SUMMARY:**

- **Total checks:** 15
- **Use existing primitives:** 15
- **New primitives needed:** 0

**Primitives used:**
- `file-existence` (10 checks)
- `regex-match` (5 checks)

---

## GROUP B: DEPENDENCY INTEGRITY (6 checks)

### B1: Table Existence Check

**Check:**
16. `runtime_tenant_registry` table exists

**Legacy implementation:**
```javascript
const result = await client.query(`
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'runtime_tenant_registry'
  ) AS exists
`);
```

**Classification:** ⬜ **NEW GENERIC PRIMITIVE NEEDED**

**Proposed primitive:** `database-table-exists`

**Generic capability:** Check if any table exists in any schema  
**Reusable:** Yes (all OS need table existence verification)  
**Domain knowledge:** None (parameterized)

**Primitive interface:**
```javascript
{
  type: 'database-table-exists',
  config: {
    schema: 'public',
    tableName: 'runtime_tenant_registry',
    expectExists: true
  }
}
```

**Domain in config:** `runtime_tenant_registry` (Amendment 12 table name)  
**Kernel knowledge:** How to check ANY table exists

---

### B2: Column Data Type Check

**Check:**
17. `runtime_tenant_registry.tenant_id` type = TEXT

**Legacy implementation:**
```javascript
const result = await client.query(`
  SELECT data_type FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'runtime_tenant_registry'
    AND column_name = 'tenant_id'
`);
if (result.rows[0].data_type === 'text') { /* pass */ }
```

**Classification:** ⬜ **NEW GENERIC PRIMITIVE NEEDED**

**Proposed primitive:** `database-column-type`

**Generic capability:** Verify any column's data type  
**Reusable:** Yes (type verification is common governance need)  
**Domain knowledge:** None (parameterized)

**Primitive interface:**
```javascript
{
  type: 'database-column-type',
  config: {
    schema: 'public',
    tableName: 'runtime_tenant_registry',
    columnName: 'tenant_id',
    expectedTypes: ['text', 'character varying'] // Allow aliases
  }
}
```

**Domain in config:** Table/column names, expected type (Amendment 12)  
**Kernel knowledge:** How to check ANY column type

---

### B3: Table Existence (public.tenants)

**Check:**
18. `public.tenants` table exists

**Classification:** ✅ **Use new primitive (B1)**

**Primitive:** `database-table-exists` (defined in B1)

**Same as B1, different table**

---

### B4: Column Type (public.tenants.id)

**Check:**
19. `public.tenants.id` type = UUID

**Classification:** ✅ **Use new primitive (B2)**

**Primitive:** `database-column-type` (defined in B2)

**Same as B2, different column**

---

### B5: Schema NOT Exists

**Check:**
20. `migration_evidence` schema does NOT exist

**Legacy implementation:**
```javascript
const result = await client.query(`
  SELECT EXISTS(
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = 'migration_evidence'
  ) AS exists
`);
if (!result.rows[0].exists) { /* pass */ }
```

**Classification:** ⬜ **NEW GENERIC PRIMITIVE NEEDED**

**Proposed primitive:** `database-schema-exists`

**Generic capability:** Check if any schema exists  
**Reusable:** Yes (schema state verification is common)  
**Domain knowledge:** None (parameterized)

**Primitive interface:**
```javascript
{
  type: 'database-schema-exists',
  config: {
    schemaName: 'migration_evidence',
    expectExists: false // Inverted check
  }
}
```

**Domain in config:** `migration_evidence` schema name (Amendment 12)  
**Kernel knowledge:** How to check ANY schema exists

---

### B6: Table NOT Exists (canonical_tenant_map)

**Check:**
21. `canonical_tenant_map` does NOT exist

**Classification:** ✅ **Use new primitive (B1)**

**Primitive:** `database-table-exists` (defined in B1)

**Config:**
```json
{
  "type": "database-table-exists",
  "config": {
    "schema": "migration_evidence",
    "tableName": "canonical_tenant_map",
    "expectExists": false
  }
}
```

**Same primitive, inverted expectation**

---

**GROUP B SUMMARY:**

- **Total checks:** 6
- **New primitives needed:** 3
  - `database-table-exists` (checks 16, 18, 21)
  - `database-column-type` (checks 17, 19)
  - `database-schema-exists` (check 20)
- **Reusable:** Yes (all 3 are generic database capabilities)

---

## GROUP C: EXECUTION PRECONDITIONS (4 checks)

### C1: Query Result Check (Fixture Count)

**Check:**
22. 5 TEXT fixtures present in `runtime_tenant_registry`

**Legacy implementation:**
```javascript
const result = await client.query(`
  SELECT COUNT(*) as count FROM runtime_tenant_registry
  WHERE tenant_id IN (
    'test-e2e-tenant-a', 'test-e2e-tenant-b', 'test-e2e-tenant-attacker',
    'test-quarantine-tenant-a', 'test-quarantine-tenant-b'
  )
`);
if (parseInt(result.rows[0].count) === 5) { /* pass */ }
```

**Classification:** ⬜ **NEW GENERIC PRIMITIVE NEEDED**

**Proposed primitive:** `database-query`

**Generic capability:** Execute any parameterized query and verify result  
**Reusable:** Yes (query-based validation is universal)  
**Domain knowledge:** None (query and expected value in config)

**Primitive interface:**
```javascript
{
  type: 'database-query',
  config: {
    query: 'SELECT COUNT(*) as count FROM runtime_tenant_registry WHERE tenant_id IN ($1, $2, $3, $4, $5)',
    params: ['test-e2e-tenant-a', 'test-e2e-tenant-b', 'test-e2e-tenant-attacker', 'test-quarantine-tenant-a', 'test-quarantine-tenant-b'],
    expectedResult: {
      count: 5
    }
  }
}
```

**Domain in config:** Table name, fixture IDs, expected count (Amendment 12)  
**Kernel knowledge:** How to execute ANY query and compare results

---

### C2: Foreign Key Constraint Check

**Check:**
23. No FK constraint on `runtime_tenant_registry.tenant_id`

**Legacy implementation:**
```javascript
const result = await client.query(`
  SELECT COUNT(*) as count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'runtime_tenant_registry'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name = 'tenant_id'
`);
if (parseInt(result.rows[0].count) === 0) { /* pass */ }
```

**Classification:** ✅ **Use new primitive (C1)**

**Primitive:** `database-query` (defined in C1)

**Reason:** This is a query-based check (can use generic query primitive)

**Alternative:** Could create `database-constraint-check` primitive for cleaner interface

**Decision:** Use `database-query` (FK check is Amendment 12-specific precondition, not common enough for dedicated primitive)

---

### C3: Database Version Check

**Check:**
24. PostgreSQL >= 12 (partial UNIQUE index support)

**Legacy implementation:**
```javascript
const result = await client.query('SHOW server_version');
const version = result.rows[0].server_version;
const majorVersion = parseInt(version.split('.')[0]);
if (majorVersion >= 12) { /* pass */ }
```

**Classification:** ⬜ **NEW GENERIC PRIMITIVE NEEDED**

**Proposed primitive:** `database-version`

**Generic capability:** Check database version  
**Reusable:** Yes (version requirements are common in migrations)  
**Domain knowledge:** None (version constraint in config)

**Primitive interface:**
```javascript
{
  type: 'database-version',
  config: {
    minVersion: '12.0',
    expectedDatabase: 'postgresql' // Optional validation
  }
}
```

**Domain in config:** Required version (12) for Amendment 12  
**Kernel knowledge:** How to check ANY database version

---

### C4: User Privileges Check

**Check:**
25. Database user has CREATE privileges

**Legacy implementation:**
```javascript
const result = await client.query(`
  SELECT 
    has_schema_privilege(CURRENT_USER, 'public', 'CREATE') as can_create_in_public,
    has_database_privilege(CURRENT_DATABASE(), 'CREATE') as can_create_schema
`);
if (result.can_create_in_public && result.can_create_schema) { /* pass */ }
```

**Classification:** ⬜ **NEW GENERIC PRIMITIVE NEEDED**

**Proposed primitive:** `database-privilege`

**Generic capability:** Verify user has required privileges  
**Reusable:** Yes (privilege verification is common governance need)  
**Domain knowledge:** None (privilege list in config)

**Primitive interface:**
```javascript
{
  type: 'database-privilege',
  config: {
    privileges: [
      { type: 'schema', name: 'public', privilege: 'CREATE' },
      { type: 'database', privilege: 'CREATE' }
    ]
  }
}
```

**Domain in config:** Required privileges for Amendment 12  
**Kernel knowledge:** How to check ANY privileges

---

**GROUP C SUMMARY:**

- **Total checks:** 4
- **New primitives needed:** 3
  - `database-query` (checks 22, 23)
  - `database-version` (check 24)
  - `database-privilege` (check 25)
- **Reusable:** Yes (all 3 are generic capabilities)

---

## GROUP D: GATE INTEGRITY (8 checks)

### D1-D8: Pattern Matching in Files

**Checks:**
26. E1 gate defined as SQL function (`CREATE OR REPLACE FUNCTION migration_05_e1_gate()`)
27. E1 returns structured results (`RETURNS TABLE`)
28. E2 gate defined as SQL function
29. E3 gate defined as SQL function
30. 05-B calls E2 BEFORE deletion (ordering check)
31. 05-B blocks deletion if E2 fails (`IF v_e2_result.status = 'FAIL' THEN RAISE EXCEPTION`)
32. E2 uses EXCEPTION for hard stops
33. Advisory lock prevents concurrent execution (`pg_try_advisory_xact_lock`)

**Legacy implementation:**
```javascript
const content = fs.readFileSync(file, 'utf-8');
if (content.includes('CREATE OR REPLACE FUNCTION migration_05_e1_gate()')) {
  pass('Gate integrity: E1 gate defined as SQL function');
}
```

**Classification:** ✅ **Use existing primitive**

**P0 primitive:** `regex-match`

**Config approach:**
```json
{
  "id": "check-e1-gate-function",
  "type": "regex-match",
  "config": {
    "path": "supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql",
    "pattern": "CREATE OR REPLACE FUNCTION migration_05_e1_gate\\(\\)"
  }
}
```

**Domain knowledge in config:** Function names, Amendment 12 gate patterns (allowed)  
**Kernel knowledge:** None (checks any pattern)

**Note on D30 (ordering check):**
```javascript
const e2CallBeforeDelete = 
  content.indexOf('migration_05_e2_orphan_safety_gate()') < 
  content.indexOf('DELETE FROM runtime_tenant_registry');
```

**This is custom logic, but can be approximated with two separate checks:**
1. E2 call exists (regex-match)
2. DELETE exists (regex-match)
3. Manual verification or use `custom` check type for ordering

**Decision:** Use `custom` check type for D30 (ordering logic is Amendment 12-specific)

---

**GROUP D SUMMARY:**

- **Total checks:** 8
- **Use existing primitives:** 7 (`regex-match`)
- **Use custom check:** 1 (D30 ordering logic)
- **New primitives needed:** 0

---

## FINAL CLASSIFICATION SUMMARY

### Primitives Needed

**Existing primitives (reuse):**
- `file-existence` (10 checks)
- `regex-match` (12 checks)

**New generic primitives (add to Check Registry):**
1. ✅ `database-table-exists` (3 uses: B1, B3, B6)
2. ✅ `database-column-type` (2 uses: B2, B4)
3. ✅ `database-schema-exists` (1 use: B5)
4. ✅ `database-query` (2 uses: C1, C2)
5. ✅ `database-version` (1 use: C3)
6. ✅ `database-privilege` (1 use: C4)

**Custom checks (Amendment 12-specific logic):**
- D30: Ordering verification (1 use)

**Total new primitives:** 6 (all generic and reusable)

---

### Check Breakdown

| Group | Total | Existing | New Generic | Custom |
|-------|-------|----------|-------------|--------|
| A     | 15    | 15       | 0           | 0      |
| B     | 6     | 0        | 6           | 0      |
| C     | 4     | 0        | 4           | 0      |
| D     | 8     | 7        | 0           | 1      |
| **Total** | **33** | **22** | **10** | **1** |

---

### Boundary Validation

**✅ All 6 new primitives are generic:**

1. `database-table-exists` → Works for ANY table
2. `database-column-type` → Works for ANY column
3. `database-schema-exists` → Works for ANY schema
4. `database-query` → Executes ANY query
5. `database-version` → Checks ANY database version
6. `database-privilege` → Checks ANY privileges

**✅ Domain knowledge stays in config:**
- Table names: `runtime_tenant_registry`, `canonical_tenant_map`
- Column names: `tenant_id`
- Schema names: `migration_evidence`
- Function names: `migration_05_e1_gate`, `migration_05_e2_orphan_safety_gate`
- Expected values: 5 fixtures, PostgreSQL 12, CREATE privileges

**✅ Kernel knows HOW, not WHAT:**
- HOW to check table existence ✅
- NOT the Amendment 12 database schema ✅

---

## DECISION: ADD 6 GENERIC DATABASE PRIMITIVES

**Justification:**

1. **All are reusable governance capabilities**
   - Healthcare OS: Check `hc_patients` table exists
   - Finance OS: Verify `ledger.entries` column type
   - Education OS: Check PostgreSQL version
   - Real Estate OS: Verify user privileges

2. **No domain leakage**
   - Primitives are parameterized
   - No hardcoded table/column names
   - No Amendment 12 logic

3. **Enables declarative database governance**
   - Config can specify database checks
   - No custom code needed for common cases
   - Reusable across all OS

4. **Tests self-extension capability**
   - Proves BDGF can add infrastructure capabilities
   - Validates boundary discipline under expansion
   - Critical architectural validation

---

## NEXT STEPS

1. ✅ Classification complete (this document)
2. ⬜ Enhance Check Registry with 6 database primitives
3. ⬜ Test each primitive independently (non-Amendment-12 data)
4. ⬜ Create E0 config (33 check definitions)
5. ⬜ Create E0 runner (thin adapter)
6. ⬜ Execute E0 (target: 33/33 PASS)
7. ⬜ Differential verification (A ≡ B)
8. ⬜ Boundary audit (0 Amendment 12 knowledge in kernel)
9. ⬜ Freeze Layer 2.2

---

**Classification complete. Ready to enhance Check Registry.**
