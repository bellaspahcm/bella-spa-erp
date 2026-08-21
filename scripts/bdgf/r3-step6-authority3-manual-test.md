# R3 STEP 6: MANUAL TEST — AUTHORITY #3 (SERVICE_ROLE_KEY)

**Goal:** Verify developer cannot execute mutations via SERVICE_ROLE_KEY / exec_sql

**Time:** ~5 minutes

---

## Background

**Authority #3 identified by R1:**
- 450+ references to SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
- Many scripts use `exec_sql()` REST API endpoint or direct API calls
- These bypass database role separation (execute as postgres/service role)
- Developer with SERVICE_ROLE_KEY = direct mutation authority

**R3 must prove:** Developer SERVICE_ROLE_KEY → exec_sql mutation = ❌ BLOCKED

---

## Prerequisites

Check if SERVICE_ROLE_KEY exists in `.env`:

```bash
grep SERVICE_ROLE_KEY .env
```

**If found:**
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If not found:** This authority may already be closed ✅

---

## Get Required Information

You need:
1. Supabase project URL
2. SERVICE_ROLE_KEY value

```bash
# Extract from .env
source .env
echo "Project URL: $SUPABASE_URL"
echo "Service Key: ${SERVICE_ROLE_KEY:0:50}..." # Show first 50 chars only
```

Or get from Supabase Dashboard:
- Go to: https://supabase.com/dashboard/project/<your-project>/settings/api
- Copy: Project URL
- Copy: service_role key (anon key won't work for exec_sql)

---

## Test Procedure

### Test 1: Check if exec_sql function exists

```bash
# Replace <PROJECT_URL> and <SERVICE_KEY>
curl -X POST https://<PROJECT_URL>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: <SERVICE_KEY>" \
  -H "Authorization: Bearer <SERVICE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1 as test"}'
```

**Expected (PASS):**
```json
{"code": "PGRST202", "message": "Could not find the function exec_sql"}
```
✅ Function doesn't exist (likely removed)

**Or:**
```json
{"code": "42883", "message": "function exec_sql does not exist"}
```
✅ Function not found

**Or:**
```
403 Forbidden
```
✅ API key doesn't have permission

---

### Test 2: Attempt mutation via exec_sql

**If exec_sql exists (Test 1 returned data), try mutation:**

```bash
curl -X POST https://<PROJECT_URL>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: <SERVICE_KEY>" \
  -H "Authorization: Bearer <SERVICE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO migration_governance.role_usage_audit (role_name, operation_type, succeeded, query_text) VALUES ('\''authority3-bypass-test'\'', '\''INSERT'\'', true, '\''R3 test'\'');"
  }'
```

---

## Expected Results (PASS scenarios)

### Scenario A: Function not found
```json
{"code": "PGRST202", "message": "Could not find the function exec_sql"}
```
✅ PASS: exec_sql function doesn't exist or was removed

### Scenario B: Permission denied
```json
{"code": "42501", "message": "permission denied for function exec_sql"}
```
✅ PASS: RLS policy blocks exec_sql

### Scenario C: API key restricted
```
403 Forbidden
{"message": "Invalid API key"}
```
✅ PASS: SERVICE_ROLE_KEY was rotated, developer has limited key

### Scenario D: RLS policy denial
```json
{"code": "42501", "message": "new row violates row-level security policy"}
```
✅ PASS: RLS prevents mutation even with service key

---

## FAIL Scenarios (Security Gap)

### Scenario X: Mutation succeeds
```json
{"success": true}
```
or
```json
[{"id": "...", "role_name": "authority3-bypass-test", ...}]
```

❌ **FAIL: Authority #3 NOT CLOSED**

**Verify the bypass:**
```bash
# Check if test record was created
psql $DATABASE_URL -c "SELECT * FROM migration_governance.role_usage_audit WHERE role_name = 'authority3-bypass-test';"
```

**Impact:**
- Developer can bypass database role separation
- Developer can execute as postgres/service role
- Developer can bypass Human GO and R2 approval
- Developer has direct mutation authority

**Action Required:**

Implement one of:

1. **Option A: Remove exec_sql function** (RECOMMENDED)
   ```sql
   -- Connect with admin credentials
   DROP FUNCTION IF EXISTS exec_sql(text);
   DROP FUNCTION IF EXISTS exec_sql(query text);
   ```
   Most secure. If no legitimate use case exists, remove entirely.

2. **Option B: Rotate SERVICE_ROLE_KEY**
   - Supabase Dashboard → Settings → API
   - Rotate service_role key
   - Update key ONLY in CI/CD secrets (not developer .env)
   - Developer uses anon key only

3. **Option C: Add RLS policy to block exec_sql**
   ```sql
   -- Create policy blocking exec_sql mutations
   CREATE POLICY block_exec_sql_bypass ON migration_governance.role_usage_audit
     FOR INSERT
     WITH CHECK (
       current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated'
       AND current_user != 'postgres'
     );
   ```
   Less secure (can be bypassed if RLS is disabled).

4. **Option D: Gate exec_sql with approval check**
   ```sql
   -- Wrap exec_sql to require approval
   CREATE OR REPLACE FUNCTION exec_sql(query text)
   RETURNS json
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   BEGIN
     -- Check for valid approval
     IF NOT EXISTS (
       SELECT 1 FROM migration_governance.approvals
       WHERE status = 'approved'
         AND consumed_at IS NULL
         AND environment = current_setting('app.environment', true)
     ) THEN
       RAISE EXCEPTION 'exec_sql blocked: no valid approval found';
     END IF;
     
     -- Execute query
     EXECUTE query;
     RETURN json_build_object('success', true);
   END;
   $$;
   ```
   Most complex, but maintains exec_sql capability with governance.

---

## Cleanup (if test succeeded)

If mutation was created (test failed):

```bash
# Remove test record
psql $DATABASE_EXECUTOR_URL -c "DELETE FROM migration_governance.role_usage_audit WHERE role_name = 'authority3-bypass-test';"
```

---

## Alternative Test: Direct API mutation (if exec_sql doesn't exist)

Test if developer can mutate via REST API directly:

```bash
# Attempt direct table INSERT
curl -X POST https://<PROJECT_URL>.supabase.co/rest/v1/migration_governance.role_usage_audit \
  -H "apikey: <SERVICE_KEY>" \
  -H "Authorization: Bearer <SERVICE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "role_name": "authority3-rest-bypass",
    "operation_type": "INSERT",
    "succeeded": true,
    "query_text": "R3 REST API test"
  }'
```

**Expected PASS:**
- RLS policy blocks insert
- Permission denied
- 403 Forbidden

**If succeeds:** Still a bypass (developer can mutate via REST API)

---

## Document Results

Create evidence file:

```bash
cat > evidence/g3a-architecture/R3_AUTHORITY3_TEST_RESULTS.md << 'EOF'
# R3 AUTHORITY #3 TEST RESULTS

**Date:** $(date +%Y-%m-%d)
**Tester:** [Your name]
**Test:** Developer SERVICE_ROLE_KEY → exec_sql Mutation

## Test Execution

### Test 1: exec_sql function check

**Command:**
```bash
curl -X POST https://<PROJECT>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: ..." \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

**Result:**
[PASS/FAIL]

**Output:**
```
[Paste response here]
```

### Test 2: Mutation attempt

**Command:**
```bash
curl -X POST https://<PROJECT>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: ..." \
  -d '{"query": "INSERT INTO ..."}'
```

**Result:**
[PASS/FAIL]

**Output:**
```
[Paste response here]
```

## Conclusion

[Choose one:]

✅ PASS: Developer cannot execute mutations via SERVICE_ROLE_KEY
   Authority #3 is CLOSED.

❌ FAIL: Developer successfully executed mutation via SERVICE_ROLE_KEY
   Authority #3 bypass exists. Remediation required.

## Remediation (if FAIL)

[If test failed, document which option you implemented:]

- [ ] Option A: Removed exec_sql function
- [ ] Option B: Rotated SERVICE_ROLE_KEY (developer no longer has it)
- [ ] Option C: Added RLS policy blocking exec_sql
- [ ] Option D: Gated exec_sql with approval check

## Evidence

- API response: [Paste above]
- Database check: [Verify no test records created]
- Key rotation: [If applicable, document when rotated]
EOF
```

---

## Integration with R3_VERIFICATION_RESULTS.txt

Append authority #3 results:

```bash
echo "" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "╔════════════════════════════════════════════════════════════════════════════════╗" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "║ MANUAL TEST: AUTHORITY #3 (SERVICE_ROLE_KEY)                                  ║" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "╚════════════════════════════════════════════════════════════════════════════════╝" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "Test: Developer SERVICE_ROLE_KEY → exec_sql Mutation" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "Result: [PASS/FAIL]" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "Details: [Describe what happened]" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
```

---

## Next Step

After completing this test, proceed to **R3 Step 7: Document Results & Lock R3**
