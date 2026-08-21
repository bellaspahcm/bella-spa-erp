# R3 DEPLOYMENT EXECUTION GUIDE

**Date:** 2026-08-20  
**Phase:** R3 Remediation — DEPLOYMENT + VERIFICATION  
**Priority:** CRITICAL — Must complete before R4  
**Principle:** Evidence > Assumption

---

## 🎯 OBJECTIVE

Transform R3 from **"implementation complete"** to **"production-verified"**

**NOT:** Write more code or design R4  
**IS:** Deploy R3, run tests, collect evidence, prove enforcement works

---

## 📋 DEPLOYMENT SEQUENCE (7 STEPS)

### STEP 1: Apply R3 Migration

**Command:**
```bash
npx supabase db push
```

**Expected Output:**
```
Applying migration: 20260820110000_database_role_separation.sql
✓ Created role: bella_developer
✓ Created role: bella_migration_executor
✓ Granted privileges
✓ Created table: migration_governance.role_usage_audit
Migration applied successfully
```

**Verification:**
```sql
-- Check roles exist
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole 
FROM pg_roles 
WHERE rolname LIKE 'bella_%';

-- Expected result:
-- bella_developer      | f | f | f
-- bella_migration_executor | f | t | f
```

**If fails:** Check migration SQL syntax, database connection, permissions

---

### STEP 2: Set Role Passwords

**Security Requirements:**
- Minimum 32 characters
- Cryptographically random
- Store in 1Password / AWS Secrets Manager
- NEVER commit to git

**Commands:**
```sql
-- Generate secure passwords first (use password manager)
-- Example using openssl:
-- openssl rand -base64 32

-- Set bella_developer password
ALTER ROLE bella_developer WITH PASSWORD '<generated-secure-password-1>';

-- Set bella_migration_executor password
ALTER ROLE bella_migration_executor WITH PASSWORD '<generated-secure-password-2>';
```

**Execute via:**
```bash
psql $DATABASE_URL -c "ALTER ROLE bella_developer WITH PASSWORD '...'"
psql $DATABASE_URL -c "ALTER ROLE bella_migration_executor WITH PASSWORD '...'"
```

**Verification:**
```bash
# Test bella_developer login
psql "postgresql://bella_developer:<password>@<host>:<port>/<db>" -c "SELECT current_user;"
# Expected: bella_developer

# Test bella_migration_executor login
psql "postgresql://bella_migration_executor:<password>@<host>:<port>/<db>" -c "SELECT current_user;"
# Expected: bella_migration_executor
```

**If fails:** Check password syntax, role creation, connection string format

---

### STEP 3: Update Developer `.env` (bella_developer credentials)

**File:** `.env` (developer local environment)

**BEFORE:**
```bash
DATABASE_URL=postgresql://postgres:<password>@<host>:<port>/postgres
```

**AFTER:**
```bash
# Developer credentials (READ-ONLY)
DATABASE_URL=postgresql://bella_developer:<bella-dev-password>@<host>:<port>/postgres
```

**Verification:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT current_user, current_database();"

# Test read capability
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"
# Expected: SUCCESS (returns count)

# Test mutation blocked
psql $DATABASE_URL -c "INSERT INTO tenants (name) VALUES ('test');"
# Expected: ERROR: permission denied for table tenants
```

**If fails:** Check connection string, password, role privileges

---

### STEP 4: Configure BDGF Executor Credentials

**File:** `.env` (BDGF executor environment - CI/CD or admin machine ONLY)

**ADD NEW:**
```bash
# Executor credentials (AUTHORIZED MUTATION)
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<executor-password>@<host>:<port>/postgres

# Keep existing for read-only checks (R2 approval verification)
DATABASE_URL=postgresql://bella_developer:<dev-password>@<host>:<port>/postgres
```

**Update BDGF scripts to use `DATABASE_EXECUTOR_URL` for mutation operations**

**Verification:**
```bash
# Test executor connection
psql $DATABASE_EXECUTOR_URL -c "SELECT current_user;"
# Expected: bella_migration_executor

# Test mutation capability
psql $DATABASE_EXECUTOR_URL -c "
  BEGIN;
  CREATE TABLE test_r3_executor (id int);
  DROP TABLE test_r3_executor;
  COMMIT;
"
# Expected: SUCCESS

# Test R2 integration (approval check)
psql $DATABASE_URL -c "
  SELECT * FROM migration_governance.approvals LIMIT 1;
"
# Expected: SUCCESS (executor can read approval table)
```

**If fails:** Check executor credential distribution, role privileges, R2 integration

---

### STEP 5: Restrict Supabase CLI (Authority #2)

**Option A: Separate Projects (Recommended)**
```bash
# Developer machine: link to dev project only
npx supabase link --project-ref <dev-project-ref>

# CI/CD: link to prod project
npx supabase link --project-ref <prod-project-ref>
```

**Option B: Team Role Restrictions**
- Set developer team role to "Read-only" on production project
- Only CI/CD service account has "Admin" role

**Verification:**
```bash
# Developer attempts production push
npx supabase db push

# Expected: One of:
# - "Not linked to production project"
# - "Permission denied"
# - "Read-only access to this project"
```

**If fails:** Check project link configuration, team roles, Supabase dashboard settings

---

### STEP 6: Gate SERVICE_ROLE_KEY (Authority #3)

**Option A: Remove exec_sql Usage (Recommended)**
- Audit all uses of `/rest/v1/rpc/exec_sql` or similar
- Replace with stored procedures or proper API endpoints
- Deprecate direct SQL execution via API

**Option B: Rotate Key (Immediate)**
```bash
# Create new limited SERVICE_ROLE_KEY for developers
# Keep full SERVICE_ROLE_KEY only in CI/CD

# Update developer .env
SERVICE_ROLE_KEY=<new-limited-key>

# Keep full key in CI/CD only
SERVICE_ROLE_KEY_FULL=<original-full-key>
```

**Option C: Add RLS Policy**
```sql
-- Example: Only allow exec_sql from trusted IPs or with additional auth
CREATE POLICY exec_sql_restriction ON ... 
  USING (auth.jwt()->>'role' = 'service_admin');
```

**Verification:**
```bash
# Developer attempts exec_sql mutation
curl -X POST https://<project>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "INSERT INTO tenants (name) VALUES (\"bypass-test\");"}'

# Expected: One of:
# - 403 Forbidden
# - Function not found
# - RLS policy denial
```

**If fails:** Review exec_sql usage, implement Option A or B, test again

---

### STEP 7: Run Verification Tests (THE CRITICAL STEP)

**Command:**
```bash
node scripts/bdgf/test-credential-enforcement.mjs
```

**Expected Output:**

```
╔════════════════════════════════════════════════════════════════════════════════╗
║ BDGF — R3 CREDENTIAL ENFORCEMENT VERIFICATION                                  ║
╚════════════════════════════════════════════════════════════════════════════════╝

Running all automated tests...

===============================================================================
TEST: Authority #1 — Developer DATABASE_URL → Mutation
===============================================================================

TEST 1A: DML — INSERT into tenants
✅ PASSED: INSERT blocked by role permissions
   Error: permission denied for table tenants

TEST 1B: DML — UPDATE tenants
✅ PASSED: UPDATE blocked by role permissions
   Error: permission denied for table tenants

TEST 1C: DML — DELETE from tenants
✅ PASSED: DELETE blocked by role permissions
   Error: permission denied for table tenants

TEST 1D: DDL — CREATE TABLE
✅ PASSED: CREATE TABLE blocked by role permissions
   Error: permission denied for schema public

TEST 1E: SELECT from tenants (should succeed - verify read capability)
✅ PASSED: SELECT succeeded (found 1029 tenants)
   Developer has read capability as expected

===============================================================================
TEST: Controlled Path — Human GO → BDGF → Executor → Mutation
===============================================================================

TEST 4A: Verify executor CAN perform INSERT
✅ PASSED: Executor can INSERT (audit record <uuid> created)
   Test record cleaned up

TEST 4B: Verify executor CAN perform CREATE TABLE
✅ PASSED: Executor can CREATE TABLE (and DROP)

TEST 4C: Verify executor can access R2 approval mechanism
✅ PASSED: Executor can access migration_governance.approvals
   R2 + R3 integration verified

╔════════════════════════════════════════════════════════════════════════════════╗
║ R3 VERIFICATION RESULTS SUMMARY                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

✅ PASSED: 8 tests
   - Authority #1 — INSERT: Developer INSERT blocked
   - Authority #1 — UPDATE: Developer UPDATE blocked
   - Authority #1 — DELETE: Developer DELETE blocked
   - Authority #1 — DDL: Developer DDL blocked
   - Authority #1 — SELECT: Developer can SELECT (read-only capability verified)
   - Governed Path — INSERT: Executor INSERT succeeded
   - Governed Path — DDL: Executor DDL succeeded
   - Governed Path — R2 Integration: Executor can access approval table

❌ FAILED: 0 tests

╔════════════════════════════════════════════════════════════════════════════════╗
║ R3 SUCCESS CRITERIA                                                            ║
╚════════════════════════════════════════════════════════════════════════════════╝

✅ AUTOMATED TESTS: PASSED

R3 will be considered COMPLETE when:
  1. ✅ All automated tests pass (current status)
  2. ⏳ Manual Test — Authority #2 (Supabase CLI) verified
  3. ⏳ Manual Test — Authority #3 (SERVICE_ROLE_KEY) verified

Next Steps:
  - Execute manual tests above
  - Document results in evidence/g3a-architecture/R3_VERIFICATION_EVIDENCE.md
  - If all tests pass: R3 COMPLETE ✅
  - If any test fails: Review credential distribution and re-test
```

**Save Output:**
```bash
node scripts/bdgf/test-credential-enforcement.mjs > evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt 2>&1
```

**If ANY test fails:**
1. Review failure reason (permission still granted? role not switched?)
2. Check credential distribution (DATABASE_URL still using postgres role?)
3. Re-run relevant deployment step
4. Re-test until ALL tests pass

**Do NOT proceed to R4 until all tests pass.**

---

### MANUAL TESTS (Complete After Automated)

**Manual Test 1: Authority #2 — Supabase CLI**

```bash
# Developer attempts production deployment
npx supabase db push
```

**Expected:** Permission denied OR "Not linked to production project"

**If PASSES (mutation allowed):** ❌ Authority #2 NOT closed, review Step 5

---

**Manual Test 2: Authority #3 — SERVICE_ROLE_KEY**

```bash
# Developer attempts exec_sql mutation
curl -X POST https://<project>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "INSERT INTO migration_governance.role_usage_audit (role_name, operation_type, succeeded) VALUES (\"bypass-test\", \"INSERT\", true);"}'
```

**Expected:** 403 Forbidden OR Function not found OR RLS policy denial

**If PASSES (mutation allowed):** ❌ Authority #3 NOT closed, review Step 6

---

## ✅ R3 COMPLETION CRITERIA (STRICT)

**R3 is COMPLETE only when ALL conditions met:**

### Deployment Complete
- ✅ Migration applied (roles exist in database)
- ✅ Passwords set for both roles
- ✅ Developer credentials distributed (bella_developer)
- ✅ Executor credentials distributed (bella_migration_executor)
- ✅ Supabase CLI restricted (Authority #2)
- ✅ SERVICE_ROLE_KEY gated (Authority #3)

### Verification PASS (with Evidence)
- ✅ **Test 1A:** Developer INSERT → ❌ BLOCKED (permission denied)
- ✅ **Test 1B:** Developer UPDATE → ❌ BLOCKED (permission denied)
- ✅ **Test 1C:** Developer DELETE → ❌ BLOCKED (permission denied)
- ✅ **Test 1D:** Developer DDL → ❌ BLOCKED (permission denied)
- ✅ **Test 1E:** Developer SELECT → ✅ ALLOWED (read-only verified)
- ✅ **Test 2:** Developer Supabase CLI → production → ❌ BLOCKED
- ✅ **Test 3:** Developer SERVICE_ROLE_KEY → exec_sql → ❌ BLOCKED
- ✅ **Test 4A:** Executor INSERT → ✅ ALLOWED
- ✅ **Test 4B:** Executor DDL → ✅ ALLOWED
- ✅ **Test 4C:** Executor + R2 approval access → ✅ ALLOWED

### Evidence Documented
- ✅ Verification test output saved: `R3_VERIFICATION_RESULTS.txt`
- ✅ Failed mutation examples collected
- ✅ Successful governed mutation example collected
- ✅ Role usage audit queries documented

**Until ALL conditions met: R3 status = IMPLEMENTATION COMPLETE, NOT PRODUCTION-VERIFIED**

---

## 🚨 FAILURE SCENARIOS & REMEDIATION

### Scenario 1: Developer can still INSERT/UPDATE/DELETE

**Symptom:**
```
TEST 1A: DML — INSERT into tenants
❌ FAILED: INSERT succeeded (should have been blocked)
```

**Diagnosis:**
- DATABASE_URL still using `postgres` role (not `bella_developer`)
- Migration not applied
- Privileges not revoked

**Fix:**
1. Verify current role: `psql $DATABASE_URL -c "SELECT current_user;"`
2. If `postgres`: Update `.env` to use `bella_developer` credentials
3. Re-test

---

### Scenario 2: Executor cannot mutate

**Symptom:**
```
TEST 4A: Verify executor CAN perform INSERT
❌ FAILED: Executor INSERT blocked: permission denied
```

**Diagnosis:**
- DATABASE_EXECUTOR_URL not configured
- Using wrong credentials
- Migration not applied (bella_migration_executor doesn't exist)

**Fix:**
1. Verify executor role exists: `psql $DATABASE_URL -c "SELECT * FROM pg_roles WHERE rolname = 'bella_migration_executor';"`
2. If missing: Re-apply migration (Step 1)
3. If exists: Check DATABASE_EXECUTOR_URL connection string
4. Re-test

---

### Scenario 3: Supabase CLI still allows production push

**Symptom:** Developer can push to production via Supabase CLI

**Diagnosis:**
- Still linked to production project
- Team role not restricted
- No project separation

**Fix:**
1. Check current link: `npx supabase status`
2. Unlink production: `npx supabase unlink`
3. Link to dev project only: `npx supabase link --project-ref <dev-ref>`
4. Or set team role to read-only in Supabase dashboard
5. Re-test manual test

---

### Scenario 4: SERVICE_ROLE_KEY still allows exec_sql

**Symptom:** Developer can execute SQL via API

**Diagnosis:**
- exec_sql endpoint still exists and accessible
- SERVICE_ROLE_KEY not rotated
- No RLS policy

**Fix:**
1. Option A: Remove exec_sql function entirely
2. Option B: Rotate SERVICE_ROLE_KEY (developer gets limited key)
3. Option C: Add RLS policy to exec_sql
4. Re-test manual test

---

## 📊 EVIDENCE COLLECTION

**After ALL tests pass, collect evidence:**

### 1. Role Configuration Evidence
```sql
-- Document role privileges
SELECT 
  r.rolname,
  r.rolsuper,
  r.rolcreatedb,
  r.rolcreaterole,
  array_agg(DISTINCT tp.privilege_type) as table_privileges
FROM pg_roles r
LEFT JOIN information_schema.table_privileges tp ON tp.grantee = r.rolname
WHERE r.rolname LIKE 'bella_%'
GROUP BY r.rolname, r.rolsuper, r.rolcreatedb, r.rolcreaterole;
```

Save output to: `evidence/g3a-architecture/R3_ROLE_CONFIGURATION.txt`

---

### 2. Failed Mutation Examples
```bash
# Collect permission denied errors
psql $DATABASE_URL -c "INSERT INTO tenants (name) VALUES ('test');" 2>&1 | tee evidence/g3a-architecture/R3_DEVELOPER_INSERT_BLOCKED.txt

psql $DATABASE_URL -c "UPDATE tenants SET name = 'test' WHERE id = (SELECT id FROM tenants LIMIT 1);" 2>&1 | tee evidence/g3a-architecture/R3_DEVELOPER_UPDATE_BLOCKED.txt

psql $DATABASE_URL -c "DELETE FROM tenants WHERE id = (SELECT id FROM tenants LIMIT 1);" 2>&1 | tee evidence/g3a-architecture/R3_DEVELOPER_DELETE_BLOCKED.txt

psql $DATABASE_URL -c "CREATE TABLE test_bypass (id int);" 2>&1 | tee evidence/g3a-architecture/R3_DEVELOPER_DDL_BLOCKED.txt
```

---

### 3. Successful Governed Mutation Example
```bash
# Record a governed mutation with R2 approval
node scripts/bdgf/record-human-go-approval.mjs --migration-id="R3-VERIFICATION-TEST" --environment="production" --executor="$USER"

# Execute mutation with executor credentials
psql $DATABASE_EXECUTOR_URL -c "
  INSERT INTO migration_governance.role_usage_audit 
    (role_name, operation_type, succeeded, query_text)
  VALUES 
    ('bella_migration_executor', 'INSERT', true, 'R3 verification - governed mutation test')
  RETURNING id, attempted_at;
" | tee evidence/g3a-architecture/R3_EXECUTOR_MUTATION_ALLOWED.txt
```

---

### 4. Role Usage Audit Query
```sql
-- Query role usage audit
SELECT 
  role_name,
  operation_type,
  succeeded,
  COUNT(*) as attempts,
  MAX(attempted_at) as last_attempt
FROM migration_governance.role_usage_audit
WHERE attempted_at > NOW() - INTERVAL '1 hour'
GROUP BY role_name, operation_type, succeeded
ORDER BY role_name, operation_type;
```

Save output to: `evidence/g3a-architecture/R3_ROLE_USAGE_AUDIT.txt`

---

## 🎯 POST-VERIFICATION ACTIONS

**After ALL tests pass and evidence collected:**

1. **Update Status Documents**
   ```bash
   # Update R3_DATABASE_ROLE_SEPARATION.md
   # Change status from "IMPLEMENTATION COMPLETE" to "PRODUCTION-VERIFIED"
   
   # Update AUDIT_07_REMEDIATION_PLAN.md
   # R3: 🟡 → ✅ COMPLETE (PRODUCTION-VERIFIED)
   ```

2. **Create R3 Verification Evidence Document**
   ```bash
   # Create evidence/g3a-architecture/R3_VERIFICATION_EVIDENCE.md
   # Include:
   # - Test results summary
   # - Failed mutation examples
   # - Successful governed mutation example
   # - Role configuration
   # - Role usage audit
   ```

3. **Update Session Status**
   ```bash
   # Mark R3 as COMPLETE in session tracking
   # Update G3A_NEXT_SESSION_BRIEF.md
   ```

4. **Checkpoint Decision**
   - Option A: Close session here (natural checkpoint after R3 verification)
   - Option B: Continue to R4 in same session (if time permits)

**Recommended:** Close session after R3 verification. This is a major milestone.

---

## 💡 KEY PRINCIPLE

> "Đây là lúc Bella cần bằng chứng thực thi, không phải thêm tài liệu."

**Evidence > Assumption**

**R3 PASS means:**
- Not "roles designed correctly"
- But "roles deployed AND developer provably cannot mutate AND executor provably can mutate with approval"

**Only after production verification can we claim:**
> "Bella đã bắt đầu chuyển từ 'kiến trúc được thiết kế để an toàn' sang 'kiến trúc có thể chứng minh bằng máy rằng nó an toàn'."

---

## 📝 NEXT SESSION (AFTER R3 VERIFICATION COMPLETE)

**R4: Migration Execution Gate**
- Wrap executor with approval + preflight + postflight + evidence
- Single authorized execution path
- Idempotency checks
- Rollback procedures

**R5: Close Legacy Bypasses**
- Archive 31 production threat scripts
- Classify: delete / archive / dev-only / emergency-with-evidence
- Update references to use BDGF executor only

**R6: Re-Audit**
- Re-run Audit 7 bypass detection
- Verify all 70+ vectors closed
- Confirm: Audit 7 FAIL → PASS
- Document evidence

**Then:** Full Differential 95/95 → G3a Final Decision

---

**Document Purpose:** Execute R3 deployment and prove enforcement with production evidence

**Critical Success Factor:** ALL verification tests must pass. No exceptions. No "mostly works."

**Definition of Done:** Developer CANNOT mutate (proven), Executor CAN mutate with approval (proven), Evidence documented.
