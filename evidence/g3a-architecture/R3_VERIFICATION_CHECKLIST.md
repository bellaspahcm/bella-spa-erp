# R3 PRODUCTION VERIFICATION CHECKLIST

**Date:** 2026-08-20  
**Purpose:** Complete R3 verification and achieve PRODUCTION-VERIFIED status  
**Estimated Time:** 20-30 minutes  

---

## 🎯 OBJECTIVE

Prove that 3 canonical mutation authorities identified by R1 are CLOSED:
1. Authority #1: DATABASE_URL → ❌ BLOCKED
2. Authority #2: Supabase CLI → ❌ BLOCKED  
3. Authority #3: SERVICE_ROLE_KEY → ❌ BLOCKED

And governed path works:
4. Human GO + BDGF + Executor → ✅ ALLOWED

---

## 🔴 STEP 1: SET PASSWORDS (5 minutes)

### 1.1 Generate Secure Passwords

Use password manager (1Password, LastPass, etc.) to generate:
- `bella_developer` password: 32+ characters, random
- `bella_migration_executor` password: 32+ characters, random

**DO NOT:**
- ❌ Use simple/guessable passwords
- ❌ Reuse passwords
- ❌ Store passwords in plaintext files
- ❌ Commit passwords to git

**DO:**
- ✅ Use password manager
- ✅ Store in secure vault
- ✅ Document password location (not the password itself)

### 1.2 Apply Passwords to Roles

Connect to database with admin credentials and execute:

```sql
-- Set bella_developer password
ALTER ROLE bella_developer WITH PASSWORD '<generated-password-1>';

-- Set bella_migration_executor password
ALTER ROLE bella_migration_executor WITH PASSWORD '<generated-password-2>';
```

**Verify passwords set:**
```bash
# Test bella_developer connection
psql "postgresql://bella_developer:<password>@<host>:<port>/<database>" -c "SELECT current_user;"
# Expected: bella_developer

# Test bella_migration_executor connection
psql "postgresql://bella_migration_executor:<password>@<host>:<port>/<database>" -c "SELECT current_user;"
# Expected: bella_migration_executor
```

**Checkpoint:** ✅ Both roles can authenticate with new passwords

---

## 🔴 STEP 2: UPDATE DEVELOPER CREDENTIALS (5 minutes)

### 2.1 Backup Current `.env`

```bash
cp .env .env.backup.r3
```

### 2.2 Update DATABASE_URL

Edit `.env`:

```bash
# BEFORE (postgres role - FULL MUTATION)
DATABASE_URL=postgresql://postgres:<old-password>@<host>:<port>/<database>

# AFTER (bella_developer role - READ-ONLY)
DATABASE_URL=postgresql://bella_developer:<new-password-from-step-1>@<host>:<port>/<database>
```

**Connection string format:**
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Get HOST, PORT, DATABASE from your current `DATABASE_URL`.

### 2.3 Verify Developer Connection

```bash
# Test connection
node scripts/bdgf/check-migration-status.mjs
```

**Expected:**
```
✅ Connected to database
Current role: bella_developer
```

**If fails:**
- Check password is correct
- Check connection string format
- Check role exists: `SELECT rolname FROM pg_roles WHERE rolname = 'bella_developer';`

**Checkpoint:** ✅ Developer can connect as bella_developer (READ-ONLY)

---

## 🔴 STEP 3: CONFIGURE EXECUTOR CREDENTIALS (5 minutes)

### 3.1 Add DATABASE_EXECUTOR_URL to `.env`

```bash
# Add this line (executor credentials - AUTHORIZED MUTATION)
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<executor-password>@<host>:<port>/<database>

# Keep existing (now using bella_developer for read-only checks)
DATABASE_URL=postgresql://bella_developer:<dev-password>@<host>:<port>/<database>
```

### 3.2 Verify Executor Connection

```bash
# Test executor connection (Linux/Mac)
psql "$DATABASE_EXECUTOR_URL" -c "SELECT current_user;"

# Or test with Node.js
node -e "
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const client = new pg.Client({ connectionString: process.env.DATABASE_EXECUTOR_URL });
await client.connect();
const result = await client.query('SELECT current_user');
console.log('Connected as:', result.rows[0].current_user);
await client.end();
"
```

**Expected:** Connected as: bella_migration_executor

**Checkpoint:** ✅ Executor credentials configured and working

---

## 🔴 STEP 4: RUN AUTOMATED VERIFICATION TESTS (5 minutes)

### 4.1 Execute Test Suite

```bash
node scripts/bdgf/test-credential-enforcement.mjs
```

### 4.2 Save Test Output

```bash
node scripts/bdgf/test-credential-enforcement.mjs > evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt 2>&1
```

### 4.3 Expected Results

**Authority #1 Tests (Developer credentials):**
```
TEST 1A: Developer INSERT → ❌ BLOCKED (permission denied)
TEST 1B: Developer UPDATE → ❌ BLOCKED (permission denied)
TEST 1C: Developer DELETE → ❌ BLOCKED (permission denied)
TEST 1D: Developer DDL → ❌ BLOCKED (permission denied)
TEST 1E: Developer SELECT → ✅ ALLOWED (read capability verified)
```

**Governed Path Tests (Executor credentials):**
```
TEST 4A: Executor INSERT → ✅ ALLOWED
TEST 4B: Executor DDL → ✅ ALLOWED
TEST 4C: Executor R2 Integration → ✅ ALLOWED (can access approval table)
```

### 4.4 Verify Security Fix

Test that executor CANNOT modify approvals:

```bash
# Create test script
cat > test-executor-approval-block.mjs << 'EOF'
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_EXECUTOR_URL });
await client.connect();

try {
  await client.query("INSERT INTO migration_governance.approvals (migration_id, migration_files, environment, requested_by) VALUES ('test-bypass', ARRAY['test.sql'], 'production', 'hacker')");
  console.log('❌ FAIL: Executor can INSERT approvals (security vulnerability!)');
} catch (error) {
  if (error.message.includes('permission denied')) {
    console.log('✅ PASS: Executor cannot INSERT approvals (security fix verified)');
  } else {
    console.log('⚠️  Unexpected error:', error.message);
  }
}

await client.end();
EOF

node test-executor-approval-block.mjs
```

**Expected:** ✅ PASS: Executor cannot INSERT approvals

**Checkpoint:** ✅ All automated tests pass

---

## 🔴 STEP 5: MANUAL TESTS — AUTHORITY #2 (Supabase CLI) (5 minutes)

### Test: Developer Supabase CLI → Production Mutation

**Goal:** Verify developer cannot push migrations to production via Supabase CLI

**Test Procedure:**

1. Check current Supabase project link:
```bash
npx supabase status
```

2. Attempt to push migration to production:
```bash
npx supabase db push
```

**Expected Results (ONE OF):**
- "Not linked to production project" (project separation)
- "Permission denied" (team role restriction)
- "Read-only access to this project" (role restriction)
- Push blocked by any means

**If push SUCCEEDS (migration applied to production):**
- ❌ FAIL: Authority #2 NOT closed
- Action Required: Implement one of:
  - Option A: Separate dev/prod Supabase projects
  - Option B: Set developer team role to "Read-only"
  - Option C: Remove developer from production project

**Checkpoint:** ⏳ Authority #2 verification result: [PASS/FAIL]

---

## 🔴 STEP 6: MANUAL TESTS — AUTHORITY #3 (SERVICE_ROLE_KEY) (5 minutes)

### Test: Developer SERVICE_ROLE_KEY → exec_sql Mutation

**Goal:** Verify developer cannot execute mutations via REST API exec_sql

**Prerequisites:**
- Get your Supabase project URL
- Get your SERVICE_ROLE_KEY (or service key that developer has access to)

**Test Procedure:**

```bash
# Replace <PROJECT_URL> and <SERVICE_ROLE_KEY>
curl -X POST https://<PROJECT_URL>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO migration_governance.role_usage_audit (role_name, operation_type, succeeded) VALUES (\"bypass-test\", \"INSERT\", true);"
  }'
```

**Expected Results (ONE OF):**
- `403 Forbidden` (API key restricted)
- `404 Not Found` (exec_sql function removed/disabled)
- `RLS policy denial` (RLS blocks exec_sql)
- Any error preventing mutation

**If exec_sql SUCCEEDS (data inserted):**
- ❌ FAIL: Authority #3 NOT closed
- Action Required: Implement one of:
  - Option A: Remove exec_sql function entirely
  - Option B: Rotate SERVICE_ROLE_KEY (developer gets limited key)
  - Option C: Add RLS policy to block exec_sql
  - Option D: Gate exec_sql with approval check

**Checkpoint:** ⏳ Authority #3 verification result: [PASS/FAIL]

---

## 🟢 STEP 7: DOCUMENT RESULTS & LOCK R3 (5 minutes)

### 7.1 Review Test Results

Check all tests passed:

```
✅ Authority #1 (DATABASE_URL): Developer mutations BLOCKED
✅ Authority #1 (DATABASE_URL): Developer SELECT ALLOWED
✅ Authority #1 (DATABASE_URL): Executor mutations ALLOWED
✅ Security Fix: Executor cannot modify approvals
✅ Authority #2 (Supabase CLI): Production push BLOCKED
✅ Authority #3 (SERVICE_ROLE_KEY): exec_sql BLOCKED
✅ Governed Path: BDGF + Approval → Executor → WORKS
```

### 7.2 Update R3_FINAL_STATUS.md

If ALL tests pass, update status:

```markdown
## 🎯 R3 STATUS

**Infrastructure:** ✅ DEPLOYED + SECURITY HARDENED
**Verification:** ✅ PRODUCTION-VERIFIED
**Status:** 🟢 R3 COMPLETE

### Verification Evidence:
- Automated tests: `evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt`
- Authority #1: ✅ Developer READ-ONLY enforced
- Authority #2: ✅ Supabase CLI production access blocked
- Authority #3: ✅ SERVICE_ROLE_KEY exec_sql blocked
- Governed path: ✅ BDGF + Approval → Executor works
- Security fix: ✅ Executor cannot self-authorize

**Date Verified:** 2026-08-XX
**Verified By:** [Your name]
```

### 7.3 Create Evidence Archive

```bash
# Collect all R3 evidence
mkdir -p evidence/g3a-architecture/r3-evidence
cp evidence/g3a-architecture/R3_*.md evidence/g3a-architecture/r3-evidence/
cp evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt evidence/g3a-architecture/r3-evidence/
```

### 7.4 Update AUDIT_07_REMEDIATION_PLAN.md

```markdown
| Phase | Status | Evidence |
|-------|--------|----------|
| R1: Threat Surface Mapping | ✅ COMPLETE | BYPASS_VECTOR_INVENTORY.md |
| R2: Machine-Verifiable Human GO | ✅ COMPLETE | R2_MACHINE_VERIFIABLE_HUMAN_GO.md |
| R3: Database Role Separation | ✅ COMPLETE (PRODUCTION-VERIFIED) | R3_FINAL_STATUS.md |
| R4: Migration Execution Gate | ⏳ READY TO START | - |
```

**Checkpoint:** ✅ R3 locked and documented

---

## 🔒 R3 COMPLETION CRITERIA

**R3 is COMPLETE when:**

### Infrastructure ✅
- ✅ bella_developer role created (READ-ONLY)
- ✅ bella_migration_executor role created (AUTHORIZED MUTATION)
- ✅ CREATEDB removed from executor
- ✅ Executor cannot modify approvals
- ✅ Passwords set for both roles
- ✅ Credentials distributed

### Verification ✅
- ✅ All automated tests pass
- ✅ Authority #1 verified: Developer mutations BLOCKED
- ✅ Authority #2 verified: Supabase CLI BLOCKED
- ✅ Authority #3 verified: SERVICE_ROLE_KEY BLOCKED
- ✅ Governed path verified: WORKS
- ✅ Security fix verified: Executor cannot self-authorize

### Evidence ✅
- ✅ Verification results documented
- ✅ Failed mutation examples collected
- ✅ Successful governed mutation example
- ✅ All 3 authorities proven closed

**ONLY THEN:** R3 status = 🟢 COMPLETE (PRODUCTION-VERIFIED)

---

## 🚀 AFTER R3 COMPLETE

**DO NOT start R4 immediately.**

**Next Session:**
1. Review R3 evidence
2. Confirm all 3 authorities closed
3. Lock R1-R2-R3 as baseline (no more architecture changes)
4. THEN begin R4 design

**R4 will add:**
- Migration execution gate (single authorized path)
- Preflight checks (E1, approval, environment)
- Execution wrapper (evidence collection)
- Idempotency protection

**But R4 builds on R3. R3 must be solid first.**

---

## ⚠️ COMMON ISSUES & TROUBLESHOOTING

### Issue: Developer still has mutation capability

**Symptom:** Test 1A-1D show INSERT/UPDATE/DELETE succeed

**Diagnosis:**
```bash
# Check current role
psql $DATABASE_URL -c "SELECT current_user;"
```

**If shows `postgres`:** DATABASE_URL not updated to bella_developer

**Fix:** Update `.env` with bella_developer credentials

---

### Issue: Executor cannot connect

**Symptom:** DATABASE_EXECUTOR_URL connection fails

**Diagnosis:**
- Password incorrect
- Role doesn't exist
- Connection string malformed

**Fix:**
```sql
-- Verify role exists
SELECT rolname FROM pg_roles WHERE rolname = 'bella_migration_executor';

-- Reset password
ALTER ROLE bella_migration_executor WITH PASSWORD '<new-password>';
```

---

### Issue: Supabase CLI still works (Authority #2 not closed)

**Symptom:** `npx supabase db push` succeeds

**Fix Options:**
1. Unlink production: `npx supabase unlink`
2. Link to dev project only: `npx supabase link --project-ref <dev-ref>`
3. Change team role to "Read-only" in Supabase dashboard

---

### Issue: exec_sql still works (Authority #3 not closed)

**Symptom:** curl request succeeds, data inserted

**Fix Options:**
1. Remove exec_sql function: `DROP FUNCTION IF EXISTS exec_sql;`
2. Rotate SERVICE_ROLE_KEY (give developer limited key)
3. Add RLS policy blocking exec_sql
4. Disable REST API exec_sql in Supabase settings

---

## 📝 CHECKLIST SUMMARY

```
□ Step 1: Passwords set (bella_developer, bella_migration_executor)
□ Step 2: Developer .env updated (DATABASE_URL → bella_developer)
□ Step 3: Executor credentials configured (DATABASE_EXECUTOR_URL)
□ Step 4: Automated tests run and PASS
□ Step 5: Authority #2 manual test PASS
□ Step 6: Authority #3 manual test PASS
□ Step 7: Results documented and R3 locked

IF ALL CHECKED: R3 = PRODUCTION-VERIFIED ✅
```

---

**Estimated Total Time:** 20-30 minutes  
**Blockers:** None (all tools and infrastructure ready)  
**Next After R3:** Review evidence → Lock baseline → Design R4
