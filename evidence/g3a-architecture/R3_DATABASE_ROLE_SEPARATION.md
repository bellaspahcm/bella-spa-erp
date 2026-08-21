# R3 — DATABASE ROLE SEPARATION

**Phase:** R3 Remediation (Database Role Separation)  
**Date:** 2026-08-20  
**Status:** IMPLEMENTATION COMPLETE — PENDING DEPLOYMENT & VERIFICATION

---

## 🎯 OBJECTIVE

Close 3 canonical mutation authorities identified by R1 through **infrastructure-level credential/role separation**.

**Problem Statement (from R1):**
```
450+ file references → 290 scripts → 31 production threats → 3 canonical mutation authorities

Authority #1: DATABASE_URL → Developer has direct PostgreSQL mutation capability
Authority #2: Supabase CLI → Developer has production deployment capability  
Authority #3: SERVICE_ROLE_KEY → Developer has API-level exec_sql capability
```

**Solution (R3):**
- Establish two database roles with different privilege boundaries
- Distribute credentials so developer has READ-ONLY access
- Reserve mutation capability for controlled executor (with R2 Human GO approval)

---

## 🔐 IMPLEMENTATION SUMMARY

### Files Created

1. **`scripts/bdgf/inspect-database-roles.mjs`**
   - Purpose: Inspect current credential → role → privilege chain BEFORE changes
   - Output: Current role capabilities and mutation tests
   - Status: ✅ COMPLETE

2. **`supabase/migrations/20260820110000_database_role_separation.sql`**
   - Purpose: Create bella_developer and bella_migration_executor roles
   - Privileges: bella_developer = SELECT only, bella_migration_executor = FULL DML+DDL
   - Status: ✅ READY TO DEPLOY

3. **`docs/governance/R3_CREDENTIAL_DISTRIBUTION_PLAN.md`**
   - Purpose: Document credential mapping and deployment sequence
   - Contains: 6-step deployment plan, rollback procedures, security considerations
   - Status: ✅ COMPLETE

4. **`scripts/bdgf/test-credential-enforcement.mjs`**
   - Purpose: Verify all 3 authorities are closed + governed path works
   - Tests: 4 automated tests + 2 manual test instructions
   - Status: ✅ READY TO EXECUTE

### Database Roles Created (Pending Deployment)

#### `bella_developer` (NON-MUTATING ROLE)
```sql
CREATE ROLE bella_developer WITH
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE;

-- Privileges:
-- ✅ SELECT on all tables (all schemas)
-- ✅ SELECT on all sequences
-- ✅ EXECUTE on safe read-only functions (e.g., verify_approval)
-- ❌ NO INSERT, UPDATE, DELETE
-- ❌ NO DDL (CREATE, ALTER, DROP)
-- ❌ NO EXECUTE on mutation functions (e.g., consume_approval)
```

**Purpose:** Daily developer work (queries, debugging, analysis)  
**Credential:** `DATABASE_URL` (in developer `.env`)  
**Mutation Capability:** ❌ NONE

#### `bella_migration_executor` (AUTHORIZED MUTATION ROLE)
```sql
CREATE ROLE bella_migration_executor WITH
  LOGIN
  NOSUPERUSER
  CREATEDB    -- For CREATE SCHEMA in migrations
  NOCREATEROLE;

-- Privileges:
-- ✅ ALL PRIVILEGES on all tables (all schemas)
-- ✅ ALL PRIVILEGES on all sequences
-- ✅ EXECUTE on all functions
-- ✅ CREATE in all schemas
-- ✅ Full DML (INSERT, UPDATE, DELETE)
-- ✅ Full DDL (CREATE, ALTER, DROP)
```

**Purpose:** Execute approved migrations via BDGF  
**Credential:** `DATABASE_EXECUTOR_URL` (BDGF executor only, not in developer `.env`)  
**Mutation Capability:** ✅ FULL (requires R2 Human GO approval)

### Audit Mechanism

**Table:** `migration_governance.role_usage_audit`
- Tracks all role usage and attempted mutations
- Monitors for unauthorized mutation attempts
- Provides forensic evidence for security reviews

**Fields:**
- `role_name`: Which role attempted the operation
- `operation_type`: SELECT, INSERT, UPDATE, DELETE, DDL, etc.
- `succeeded`: Whether the operation was allowed
- `error_message`: Permission denied details if blocked
- `attempted_at`: Timestamp
- `session_user`, `client_addr`: Session context

---

## 📋 DEPLOYMENT STATUS

### Current State (PRE-R3)

**Inspection Results (from `inspect-database-roles.mjs`):**
```
Current Role: postgres (not superuser but CAN CREATE ROLE/DB)
Privileges: FULL DML + DDL
  - DELETE ✅
  - INSERT ✅
  - UPDATE ✅
  - TRUNCATE ✅
  - DDL (CREATE SCHEMA) ✅

Environment: ⚠️ PRODUCTION (1029 non-test tenants)
Existing bella_* roles: NONE
```

**Problem Confirmed:** Developer currently has FULL mutation capability via `DATABASE_URL`.

### Deployment Steps (PENDING)

| Step | Action | Status |
|------|--------|--------|
| 1 | Apply migration (`npx supabase db push`) | ⏳ PENDING |
| 2 | Set passwords for bella_developer & bella_migration_executor | ⏳ PENDING |
| 3 | Update developer `.env` → bella_developer credentials | ⏳ PENDING |
| 4 | Update BDGF executor `.env` → bella_migration_executor credentials | ⏳ PENDING |
| 5 | Restrict Supabase CLI access (Authority #2) | ⏳ PENDING |
| 6 | Gate SERVICE_ROLE_KEY exec_sql (Authority #3) | ⏳ PENDING |
| 7 | Run verification tests | ⏳ PENDING |

---

## ✅ R3 SUCCESS CRITERIA

R3 is considered **COMPLETE** only when ALL 4 verification tests pass:

### Test 1: Authority #1 — DATABASE_URL → ❌ BLOCKED

**Test:** Developer credentials attempt mutation
```bash
psql $DATABASE_URL -c "INSERT INTO tenants (name) VALUES ('bypass-test');"
```

**Expected Result:**
```
ERROR: permission denied for table tenants
```

**Automated Test:** `node scripts/bdgf/test-credential-enforcement.mjs`  
**Status:** ⏳ PENDING DEPLOYMENT

### Test 2: Authority #2 — Supabase CLI → ❌ BLOCKED

**Test:** Developer attempts production deployment via CLI
```bash
npx supabase db push
```

**Expected Result:**
- `Permission denied` OR
- `Not linked to production project` OR  
- `Read-only access to production`

**Test Type:** MANUAL  
**Status:** ⏳ PENDING DEPLOYMENT

### Test 3: Authority #3 — SERVICE_ROLE_KEY → ❌ BLOCKED

**Test:** Developer attempts exec_sql via REST API
```bash
curl -X POST https://<project>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -d '{"query": "INSERT INTO tenants ..."}'
```

**Expected Result:**
- `403 Forbidden` OR
- `Function not found` OR
- `RLS policy denial`

**Test Type:** MANUAL  
**Status:** ⏳ PENDING DEPLOYMENT

### Test 4: Controlled Path — Human GO → BDGF → Executor → ✅ ALLOWED

**Test:** BDGF executor with valid Human GO approval attempts mutation
```bash
# Step 1: Record Human GO approval (R2)
node scripts/bdgf/record-human-go-approval.mjs <migration-id> production

# Step 2: Execute migration with executor credentials
node scripts/bdgf/execute-migration.mjs <migration-id> production
```

**Expected Result:**
```
✅ Approval verified
✅ Migration executed successfully
✅ Approval consumed (one-time use)
```

**Automated Test:** `node scripts/bdgf/test-credential-enforcement.mjs`  
**Status:** ⏳ PENDING DEPLOYMENT

---

## 🔒 SECURITY ARCHITECTURE

### Credential Separation

```
┌────────────────────────────────────────────────────────────────┐
│ BEFORE R3 (BYPASS EXISTS)                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Developer                                                     │
│    ├─ DATABASE_URL ───────────► postgres role                │
│    │                               ├─ DML: ✅ FULL           │
│    │                               └─ DDL: ✅ FULL           │
│    ├─ Supabase CLI ───────────► Production access            │
│    │                               └─ Deploy: ✅ ALLOWED     │
│    └─ SERVICE_ROLE_KEY ───────► exec_sql endpoint            │
│                                    └─ Mutation: ✅ ALLOWED    │
│                                                                │
│  ❌ PROBLEM: Developer bypasses R2 Human GO enforcement       │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ AFTER R3 (BYPASSES CLOSED)                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Developer (Day-to-Day Work)                                   │
│    ├─ DATABASE_URL ───────────► bella_developer role         │
│    │                               ├─ SELECT: ✅ ALLOWED     │
│    │                               ├─ DML: ❌ BLOCKED        │
│    │                               └─ DDL: ❌ BLOCKED        │
│    ├─ Supabase CLI ───────────► Dev project only             │
│    │                               └─ Production: ❌ BLOCKED  │
│    └─ SERVICE_ROLE_KEY ───────► exec_sql gated               │
│                                    └─ Mutation: ❌ BLOCKED    │
│                                                                │
│  BDGF Executor (Approved Mutations Only)                       │
│    ├─ Human GO Approval ───────► R2 verify_approval()        │
│    └─ DATABASE_EXECUTOR_URL ───► bella_migration_executor    │
│                                    ├─ DML: ✅ ALLOWED         │
│                                    ├─ DDL: ✅ ALLOWED         │
│                                    └─ Requires: R2 approval    │
│                                                                │
│  ✅ SOLUTION: Mutation requires R2 approval + R3 credentials  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Break-Glass Procedure

**Emergency Access (if BDGF fails):**
1. `postgres` role credentials stored in secure vault (CTO-only access)
2. Usage triggers incident report
3. Must be followed by retroactive Human GO approval
4. Document in `migration_governance.approvals` with `type = 'EMERGENCY'`

**This ensures:**
- Production never completely locked
- Emergency access is audited and tracked
- Break-glass usage requires post-incident governance review

---

## 📊 VERIFICATION EVIDENCE (PENDING DEPLOYMENT)

### Pre-Deployment Inspection

**Executed:** `node scripts/bdgf/inspect-database-roles.mjs`

**Key Findings:**
- Current role: `postgres` (not superuser)
- Mutation capability: ✅ FULL (can CREATE SCHEMA, INSERT, UPDATE, DELETE)
- Production database: ⚠️ 1029 non-test tenants
- bella_* roles: Not yet created

**Evidence Location:** Console output from inspection script

### Post-Deployment Verification (TODO)

**Execute:** `node scripts/bdgf/test-credential-enforcement.mjs`

**Expected Results:**
```
✅ Authority #1 — INSERT: BLOCKED (permission denied)
✅ Authority #1 — UPDATE: BLOCKED (permission denied)
✅ Authority #1 — DELETE: BLOCKED (permission denied)
✅ Authority #1 — DDL: BLOCKED (permission denied)
✅ Authority #1 — SELECT: ALLOWED (read capability verified)

✅ Governed Path — INSERT: ALLOWED (executor has privilege)
✅ Governed Path — DDL: ALLOWED (executor can CREATE TABLE)
✅ Governed Path — R2 Integration: CAN ACCESS approval table

Manual Test Results (TODO):
⏳ Authority #2 — Supabase CLI: [PENDING]
⏳ Authority #3 — SERVICE_ROLE_KEY: [PENDING]
```

**Evidence Location:** To be saved in `evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt`

---

## 🚀 NEXT ACTIONS

### Immediate (R3 Deployment)

1. **Apply R3 Migration**
   ```bash
   npx supabase db push
   ```
   - Creates bella_developer and bella_migration_executor roles
   - Grants appropriate privileges
   - Creates role_usage_audit table

2. **Set Role Passwords**
   ```sql
   ALTER ROLE bella_developer WITH PASSWORD '<secure-random-32char>';
   ALTER ROLE bella_migration_executor WITH PASSWORD '<secure-random-32char>';
   ```
   - Use cryptographically random passwords
   - Store in 1Password / AWS Secrets Manager
   - NEVER commit to git

3. **Distribute Credentials**
   - Update developer `.env`: `DATABASE_URL=postgresql://bella_developer:...`
   - Update BDGF executor: `DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:...`
   - Restrict Supabase CLI to dev project
   - Gate or rotate SERVICE_ROLE_KEY

4. **Run Verification Tests**
   ```bash
   node scripts/bdgf/test-credential-enforcement.mjs
   ```
   - Must show all 3 authorities blocked
   - Must show governed path works
   - Save results as evidence

5. **Execute Manual Tests**
   - Test Supabase CLI production access (Authority #2)
   - Test SERVICE_ROLE_KEY exec_sql (Authority #3)
   - Document results

### After R3 Complete

6. **R4: Migration Execution Gate**
   - Wrap migration executor with approval check + advisory lock + E1 verification

7. **R5: Close Legacy Bypasses**
   - Archive or redirect 31 production threat files identified in R1
   - Update references to use BDGF only

8. **R6: Re-Audit**
   - Re-run Audit 7 bypass detection
   - Verify all 70+ vectors now closed
   - Confirm no new bypasses introduced

9. **Audit 7 Re-Audit → PASS**
   - If R3–R6 successful: Audit 7 changes from FAIL to PASS
   - Then proceed to Full Differential 95/95 verification
   - Then G3a Final Decision

---

## 📝 ARCHITECTURAL SIGNIFICANCE

### What R2 + R3 Together Achieve

**R2 Alone:**
- Transforms Human GO from policy to machine-verifiable authorization
- BDGF executor checks `migration_governance.approvals` before mutation
- **Limitation:** Developer can bypass BDGF entirely (still has mutation credentials)

**R3 Alone:**
- Would block mutation but wouldn't enforce governance
- Could lock developers out unnecessarily

**R2 + R3 Together:**
```
Human GO (policy)
      ↓
R2: Machine-Verifiable Approval (database constraint)
      ↓
R3: Credential/Role Separation (infrastructure enforcement)
      ↓
RESULT: Developer CANNOT mutate (no privilege)
        Executor CAN mutate (requires approval)
```

**This is the enforcement architecture Bella needs:**
- Not just "don't do this" (policy)
- Not just "we check this" (application logic)
- But "you cannot do this" (infrastructure constraint)

---

## 🎯 R3 DEFINITION OF DONE

**R3 COMPLETE** means:

✅ Migration applied (roles created)  
✅ Passwords set for both roles  
✅ Developer credentials distributed (bella_developer)  
✅ Executor credentials distributed (bella_migration_executor)  
✅ Supabase CLI access restricted  
✅ SERVICE_ROLE_KEY usage gated  
✅ Test 1 PASS: Authority #1 (DATABASE_URL) → ❌ BLOCKED  
✅ Test 2 PASS: Authority #2 (Supabase CLI) → ❌ BLOCKED  
✅ Test 3 PASS: Authority #3 (SERVICE_ROLE_KEY) → ❌ BLOCKED  
✅ Test 4 PASS: Governed Path → ✅ ALLOWED  
✅ Evidence saved: Verification test results  

**Current Status:** Implementation COMPLETE, Deployment PENDING

---

**Related Documents:**
- `evidence/g3a-architecture/BYPASS_VECTOR_INVENTORY.md` (R1 findings)
- `evidence/g3a-architecture/R2_MACHINE_VERIFIABLE_HUMAN_GO.md` (R2 implementation)
- `docs/governance/R3_CREDENTIAL_DISTRIBUTION_PLAN.md` (R3 deployment guide)
- `evidence/g3a-architecture/AUDIT_07_REMEDIATION_PLAN.md` (Master remediation plan)
