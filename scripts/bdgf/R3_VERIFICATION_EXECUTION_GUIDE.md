# R3 PRODUCTION VERIFICATION — EXECUTION GUIDE

**Purpose:** Complete guide to execute R3 verification from start to finish  
**Estimated Time:** 30-40 minutes  
**Status:** Ready to execute

---

## 📋 OVERVIEW

**Goal:** Prove that 3 canonical mutation authorities are CLOSED

**Verification Structure:**
```
Step 1-3: Credential Distribution (15 min) — MANUAL
Step 4:   Automated Tests (5 min) — AUTOMATED
Step 5:   Manual Test Authority #2 (5 min) — MANUAL
Step 6:   Manual Test Authority #3 (5 min) — MANUAL
Step 7:   Finalize and Lock (5 min) — SEMI-AUTOMATED
```

---

## 🚀 QUICK START

### Prerequisites Check

```bash
# 1. Verify migrations applied
psql $DATABASE_URL -c "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bella_developer');"
# Expected: t (true)

psql $DATABASE_URL -c "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bella_migration_executor');"
# Expected: t (true)

# 2. Verify scripts exist
ls scripts/bdgf/r3-*.* scripts/bdgf/test-credential-enforcement.mjs

# 3. Backup .env
cp .env .env.backup.r3

echo "✅ Prerequisites ready. Proceed to Step 1."
```

---

## 🔴 STEP 1: SET PASSWORDS (MANUAL — 5 minutes)

### Instructions

1. **Generate 2 secure passwords (32+ chars)**
   - Use password manager (1Password, LastPass, Bitwarden)
   - One for `bella_developer`
   - One for `bella_migration_executor`
   - Store in secure vault

2. **Apply passwords to database**
   
   ```bash
   # Edit the SQL file first
   code scripts/bdgf/r3-step1-set-passwords.sql
   
   # Replace <PASSWORD_1> and <PASSWORD_2> with your generated passwords
   # Then execute (requires admin/postgres credentials)
   psql $DATABASE_URL -f scripts/bdgf/r3-step1-set-passwords.sql
   ```

3. **Test connections**
   
   ```bash
   node scripts/bdgf/r3-step1-test-connection.mjs
   ```
   
   **Expected:** Both bella_developer and bella_migration_executor connect successfully

### Success Criteria

```
✅ Passwords generated and stored securely
✅ Passwords applied to database roles
✅ Both roles can authenticate
```

**If any test fails:** Fix password/connection issues before proceeding.

**Documentation:** `scripts/bdgf/r3-step1-set-passwords.sql`

---

## 🔴 STEP 2-3: UPDATE CREDENTIALS (MANUAL — 10 minutes)

### Instructions

1. **Review current configuration**
   
   ```bash
   # Read the helper guide
   cat scripts/bdgf/r3-step2-update-env-helper.md
   ```

2. **Update DATABASE_URL (Step 2)**
   
   ```bash
   # Edit .env file
   code .env
   
   # Change DATABASE_URL from postgres to bella_developer
   # Before: postgresql://postgres:<password>@host:port/database
   # After:  postgresql://bella_developer:<PASSWORD_FROM_STEP_1>@host:port/database
   
   # Remember to URL-encode special characters in password!
   ```

3. **Add DATABASE_EXECUTOR_URL (Step 3)**
   
   ```bash
   # Still in .env file, add new line:
   DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<PASSWORD_FROM_STEP_1>@host:port/database
   
   # Save and close
   ```

4. **Verify connections**
   
   ```bash
   # Test developer connection
   node -e "import pkg from 'pg'; import dotenv from 'dotenv'; dotenv.config(); const c = new pkg.Client({connectionString: process.env.DATABASE_URL}); await c.connect(); const r = await c.query('SELECT current_user'); console.log('Developer role:', r.rows[0].current_user); await c.end();"
   
   # Expected: Developer role: bella_developer
   
   # Test executor connection
   node -e "import pkg from 'pg'; import dotenv from 'dotenv'; dotenv.config(); const c = new pkg.Client({connectionString: process.env.DATABASE_EXECUTOR_URL}); await c.connect(); const r = await c.query('SELECT current_user'); console.log('Executor role:', r.rows[0].current_user); await c.end();"
   
   # Expected: Executor role: bella_migration_executor
   ```

### Success Criteria

```
✅ .env backup created (.env.backup.r3)
✅ DATABASE_URL updated to bella_developer
✅ DATABASE_EXECUTOR_URL configured
✅ Both connections work
```

**If connection fails:** Check password URL-encoding and connection string format.

**Documentation:** `scripts/bdgf/r3-step2-update-env-helper.md`

---

## 🟢 STEP 4: AUTOMATED TESTS (AUTOMATED — 5 minutes)

### Instructions

1. **Run main verification suite**
   
   ```bash
   node scripts/bdgf/test-credential-enforcement.mjs > evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt 2>&1
   
   # Also print to terminal
   cat evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
   ```

2. **Run security fix test**
   
   ```bash
   node scripts/bdgf/r3-step4-security-fix-test.mjs
   ```

### Expected Results

**Main verification (11 tests):**
- ✅ Authority #1 — INSERT: BLOCKED
- ✅ Authority #1 — UPDATE: BLOCKED
- ✅ Authority #1 — DELETE: BLOCKED
- ✅ Authority #1 — DDL: BLOCKED
- ✅ Authority #1 — SELECT: ALLOWED
- ✅ Governed Path — INSERT: ALLOWED
- ✅ Governed Path — DDL: ALLOWED
- ✅ Governed Path — R2 Integration: WORKING

**Security fix (4 tests):**
- ✅ Executor INSERT approvals: BLOCKED
- ✅ Executor UPDATE approvals: BLOCKED
- ✅ Executor DELETE approvals: BLOCKED
- ✅ Executor SELECT approvals: ALLOWED

### Success Criteria

```
✅ All 11 main tests PASS
✅ All 4 security fix tests PASS
✅ R3_VERIFICATION_RESULTS.txt created
✅ No FAIL results
```

**If any test fails:** Review failure message, fix credential distribution, re-run.

**Documentation:** `scripts/bdgf/test-credential-enforcement.mjs`

---

## 🔴 STEP 5: MANUAL TEST — AUTHORITY #2 (MANUAL — 5 minutes)

### Instructions

1. **Read manual test guide**
   
   ```bash
   cat scripts/bdgf/r3-step5-authority2-manual-test.md
   ```

2. **Execute Supabase CLI test**
   
   Follow instructions in the guide to:
   - Check current Supabase project link
   - Create test migration
   - Attempt to push to production
   - Observe result (should FAIL/BLOCK)

3. **Document results**
   
   Create `evidence/g3a-architecture/R3_AUTHORITY2_TEST_RESULTS.md` with outcome

### Expected Result

```
✅ Supabase CLI push to production BLOCKED
   (One of: not linked, permission denied, read-only role, access denied)
```

**If push succeeds (FAIL):** Implement one of the remediation options in the guide.

**Documentation:** `scripts/bdgf/r3-step5-authority2-manual-test.md`

---

## 🔴 STEP 6: MANUAL TEST — AUTHORITY #3 (MANUAL — 5 minutes)

### Instructions

1. **Read manual test guide**
   
   ```bash
   cat scripts/bdgf/r3-step6-authority3-manual-test.md
   ```

2. **Execute SERVICE_ROLE_KEY test**
   
   Follow instructions in the guide to:
   - Get Supabase project URL and SERVICE_ROLE_KEY
   - Test if exec_sql function exists
   - Attempt mutation via exec_sql
   - Observe result (should FAIL/BLOCK)

3. **Document results**
   
   Create `evidence/g3a-architecture/R3_AUTHORITY3_TEST_RESULTS.md` with outcome

### Expected Result

```
✅ exec_sql mutation BLOCKED
   (One of: function not found, permission denied, API key restricted, RLS denial)
```

**If mutation succeeds (FAIL):** Implement one of the remediation options in the guide.

**Documentation:** `scripts/bdgf/r3-step6-authority3-manual-test.md`

---

## 🟢 STEP 7: FINALIZE & LOCK (SEMI-AUTOMATED — 5 minutes)

### Instructions

1. **Review all results**
   
   ```bash
   # Check automated tests
   cat evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
   
   # Check manual test results
   ls evidence/g3a-architecture/R3_AUTHORITY*.md
   ```

2. **If all tests PASSED, run finalization**
   
   ```bash
   # Read finalization guide
   cat scripts/bdgf/r3-step7-finalize.md
   
   # Execute finalization steps (creates evidence archive, updates status docs)
   ```

3. **Update R3_FINAL_STATUS.md**
   
   ```bash
   code evidence/g3a-architecture/R3_FINAL_STATUS.md
   
   # Change status to:
   # **Verification:** ✅ PRODUCTION-VERIFIED
   # **Status:** 🟢 R3 COMPLETE
   
   # Add verification date and your name
   ```

4. **Create evidence archive**
   
   ```bash
   mkdir -p evidence/g3a-architecture/r3-evidence
   cp evidence/g3a-architecture/R3_*.* evidence/g3a-architecture/r3-evidence/
   mkdir -p evidence/g3a-architecture/r3-evidence/scripts
   cp scripts/bdgf/r3-*.* evidence/g3a-architecture/r3-evidence/scripts/
   cp scripts/bdgf/test-credential-enforcement.mjs evidence/g3a-architecture/r3-evidence/scripts/
   ```

5. **Lock baseline**
   
   ```bash
   # Create lock file (follow Step 7.5 in finalize guide)
   # This prevents further R3 architecture changes
   ```

### Success Criteria

```
✅ All tests passed (13/13)
✅ R3_FINAL_STATUS.md updated (COMPLETE)
✅ Evidence archived (r3-evidence/)
✅ Completion summary created
✅ Baseline locked
✅ Ready for R4
```

**Documentation:** `scripts/bdgf/r3-step7-finalize.md`

---

## 📊 VERIFICATION SUMMARY

### Test Coverage

| Test | Type | Result |
|------|------|--------|
| Authority #1 — INSERT | Automated | ✅ BLOCKED |
| Authority #1 — UPDATE | Automated | ✅ BLOCKED |
| Authority #1 — DELETE | Automated | ✅ BLOCKED |
| Authority #1 — DDL | Automated | ✅ BLOCKED |
| Authority #1 — SELECT | Automated | ✅ ALLOWED |
| Security Fix — Executor INSERT approvals | Automated | ✅ BLOCKED |
| Security Fix — Executor UPDATE approvals | Automated | ✅ BLOCKED |
| Security Fix — Executor DELETE approvals | Automated | ✅ BLOCKED |
| Security Fix — Executor SELECT approvals | Automated | ✅ ALLOWED |
| Governed Path — INSERT | Automated | ✅ ALLOWED |
| Governed Path — DDL | Automated | ✅ ALLOWED |
| Authority #2 — Supabase CLI | Manual | ⏳ PENDING |
| Authority #3 — SERVICE_ROLE_KEY | Manual | ⏳ PENDING |

**Total: 11/11 automated, 0/2 manual (PENDING)**

### Evidence Files

After completion, you should have:
- `R3_VERIFICATION_RESULTS.txt` — Automated test output
- `R3_AUTHORITY2_TEST_RESULTS.md` — Supabase CLI test
- `R3_AUTHORITY3_TEST_RESULTS.md` — SERVICE_ROLE_KEY test
- `R3_COMPLETION_SUMMARY.md` — Overall summary
- `R3_BASELINE_LOCKED.md` — Lock file
- `r3-evidence/` — Complete archive

---

## ⚠️ TROUBLESHOOTING

### Issue: Developer still has mutation capability

**Symptom:** Authority #1 tests show INSERT/UPDATE/DELETE succeed

**Diagnosis:**
```bash
psql $DATABASE_URL -c "SELECT current_user;"
```

**If shows `postgres`:** DATABASE_URL not updated

**Fix:** Complete Step 2 (update .env)

---

### Issue: Executor cannot connect

**Symptom:** DATABASE_EXECUTOR_URL connection fails

**Diagnosis:**
- Wrong password
- Password not URL-encoded
- Role doesn't exist

**Fix:**
```bash
# Verify role exists
psql $DATABASE_URL -c "SELECT rolname FROM pg_roles WHERE rolname = 'bella_migration_executor';"

# Reset password (if needed)
psql $DATABASE_URL -c "ALTER ROLE bella_migration_executor WITH PASSWORD '<new-password>';"
```

---

### Issue: Automated tests fail with "approvals table not found"

**Symptom:** R2 integration test fails

**Diagnosis:** R2 migration not applied

**Fix:**
```bash
# Apply R2 migration first
psql $DATABASE_URL -f supabase/migrations/20260820100000_migration_governance_approvals.sql
```

---

### Issue: Security fix test fails (executor CAN modify approvals)

**Symptom:** Executor INSERT/UPDATE approvals succeeds

**Diagnosis:** Migration `20260820120000_fix_executor_privileges.sql` not applied

**Fix:**
```bash
# Apply security fix migration
psql $DATABASE_URL -f supabase/migrations/20260820120000_fix_executor_privileges.sql

# Verify privileges
node scripts/bdgf/check-executor-privileges.mjs
```

---

## 🎯 SUCCESS CRITERIA

R3 is COMPLETE when ALL of these are true:

```
✅ Infrastructure
   - bella_developer role exists (READ-ONLY)
   - bella_migration_executor role exists (AUTHORIZED MUTATION)
   - Executor cannot modify approvals (security fix)
   - Passwords set and distributed securely

✅ Verification
   - 11/11 automated tests PASS
   - 2/2 manual tests PASS (authorities #2, #3)
   - All 3 authorities proven closed
   - Governed path proven working

✅ Evidence
   - R3_VERIFICATION_RESULTS.txt exists
   - R3_AUTHORITY2_TEST_RESULTS.md exists
   - R3_AUTHORITY3_TEST_RESULTS.md exists
   - Evidence archived in r3-evidence/

✅ Documentation
   - R3_FINAL_STATUS.md updated (COMPLETE)
   - R3_COMPLETION_SUMMARY.md created
   - R3_BASELINE_LOCKED.md created
   - AUDIT_07_REMEDIATION_PLAN.md updated

✅ Baseline
   - R3 locked (no more architecture changes)
   - Ready to proceed to R4
```

**ONLY when ALL checked: R3 = ✅ COMPLETE (PRODUCTION-VERIFIED)**

---

## ➡️ NEXT PHASE: R4

After R3 complete:

1. **Review R3 evidence** (all tests passed)
2. **Lock R1-R2-R3 baseline** (no more changes)
3. **Design R4** (Migration Execution Gate)

**R4 Goal:** Wrap executor with approval + preflight + evidence

**R4 builds on:**
- R3 database roles
- R2 approval mechanism
- R1 threat surface mapping

**DO NOT start R4 until R3 is PRODUCTION-VERIFIED.**

---

## 📞 SUPPORT

If you encounter issues not covered in troubleshooting:

1. Check migration status: `node scripts/bdgf/check-migration-status.mjs`
2. Verify role privileges: `node scripts/bdgf/check-executor-privileges.mjs`
3. Review evidence files for clues
4. Check R3 deployment status: `cat evidence/g3a-architecture/R3_DEPLOYMENT_STATUS.md`

---

**Estimated Total Time:** 30-40 minutes  
**Blocking:** None (all tools ready)  
**Next:** R4 — Migration Execution Gate

**🚀 Ready to execute R3 verification!**
