# R3 VERIFICATION FILES INDEX

**Purpose:** Index of all R3 verification files and tools  
**Status:** Ready for execution  
**Created:** 2026-08-20

---

## 📋 MASTER GUIDE

**START HERE:**

- **`evidence/g3a-architecture/R3_VERIFICATION_CHECKLIST.md`**
  - Comprehensive 7-step verification checklist
  - 20-30 minute execution time
  - Detailed instructions for each step

- **`scripts/bdgf/R3_VERIFICATION_EXECUTION_GUIDE.md`**
  - Complete execution guide (30-40 minutes)
  - Quick start instructions
  - Troubleshooting section
  - Success criteria checklist

---

## 🔴 STEP 1: SET PASSWORDS (Manual)

**Files:**

1. **`scripts/bdgf/r3-step1-set-passwords.sql`**
   - SQL script to set passwords for both roles
   - Edit with your generated passwords
   - Execute with admin credentials

2. **`scripts/bdgf/r3-step1-test-connection.mjs`**
   - Interactive connection test script
   - Tests both bella_developer and bella_migration_executor
   - Confirms passwords work

**Usage:**
```bash
# 1. Generate passwords in password manager
# 2. Edit SQL file with passwords
code scripts/bdgf/r3-step1-set-passwords.sql

# 3. Apply passwords
psql $DATABASE_URL -f scripts/bdgf/r3-step1-set-passwords.sql

# 4. Test connections
node scripts/bdgf/r3-step1-test-connection.mjs
```

---

## 🔴 STEP 2-3: UPDATE CREDENTIALS (Manual)

**Files:**

1. **`scripts/bdgf/r3-step2-update-env-helper.md`**
   - Helper guide for updating .env
   - Shows current DATABASE_URL structure
   - Examples of URL encoding for special characters
   - Verification commands

**Usage:**
```bash
# 1. Backup .env
cp .env .env.backup.r3

# 2. Read helper guide
cat scripts/bdgf/r3-step2-update-env-helper.md

# 3. Edit .env
code .env
# - Change DATABASE_URL to bella_developer
# - Add DATABASE_EXECUTOR_URL with bella_migration_executor

# 4. Verify
node -e "import pkg from 'pg'; import dotenv from 'dotenv'; dotenv.config(); const c = new pkg.Client({connectionString: process.env.DATABASE_URL}); await c.connect(); const r = await c.query('SELECT current_user'); console.log('Role:', r.rows[0].current_user); await c.end();"
```

---

## 🟢 STEP 4: AUTOMATED TESTS (Automated)

**Files:**

1. **`scripts/bdgf/test-credential-enforcement.mjs`** ⭐ MAIN TEST
   - Comprehensive automated test suite
   - Tests Authority #1 (DATABASE_URL)
   - Tests Governed Path (BDGF + Executor)
   - Generates evidence file

2. **`scripts/bdgf/r3-step4-security-fix-test.mjs`**
   - Specific test for executor self-authorization prevention
   - Verifies executor cannot INSERT/UPDATE/DELETE approvals
   - Critical security validation

**Usage:**
```bash
# Run main test suite
node scripts/bdgf/test-credential-enforcement.mjs > evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt 2>&1

# Print results
cat evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt

# Run security fix test
node scripts/bdgf/r3-step4-security-fix-test.mjs
```

**Expected:** 11/11 tests PASS + 4/4 security tests PASS

---

## 🔴 STEP 5: MANUAL TEST — AUTHORITY #2 (Manual)

**Files:**

1. **`scripts/bdgf/r3-step5-authority2-manual-test.md`**
   - Detailed guide for Supabase CLI test
   - Test procedure (create migration, attempt push)
   - Expected results (PASS = blocked)
   - Remediation options if FAIL
   - Evidence template

**Test:** Developer cannot push migrations to production via Supabase CLI

**Usage:**
```bash
# Read guide
cat scripts/bdgf/r3-step5-authority2-manual-test.md

# Execute test (follow guide)
# Document results in:
# evidence/g3a-architecture/R3_AUTHORITY2_TEST_RESULTS.md
```

---

## 🔴 STEP 6: MANUAL TEST — AUTHORITY #3 (Manual)

**Files:**

1. **`scripts/bdgf/r3-step6-authority3-manual-test.md`**
   - Detailed guide for SERVICE_ROLE_KEY test
   - Test procedure (check exec_sql, attempt mutation)
   - Expected results (PASS = blocked)
   - Remediation options if FAIL
   - Alternative test (REST API)
   - Evidence template

**Test:** Developer cannot execute mutations via SERVICE_ROLE_KEY

**Usage:**
```bash
# Read guide
cat scripts/bdgf/r3-step6-authority3-manual-test.md

# Execute test (follow guide)
# Document results in:
# evidence/g3a-architecture/R3_AUTHORITY3_TEST_RESULTS.md
```

---

## 🟢 STEP 7: FINALIZE & LOCK (Semi-automated)

**Files:**

1. **`scripts/bdgf/r3-step7-finalize.md`**
   - Finalization procedure
   - Update R3_FINAL_STATUS.md
   - Create evidence archive
   - Lock baseline
   - Create completion summary

**Usage:**
```bash
# Read finalization guide
cat scripts/bdgf/r3-step7-finalize.md

# Execute finalization steps (includes evidence archive creation)
```

**Generates:**
- `evidence/g3a-architecture/r3-evidence/` (archive)
- `evidence/g3a-architecture/R3_COMPLETION_SUMMARY.md`
- `evidence/g3a-architecture/R3_BASELINE_LOCKED.md`

---

## 📊 SUPPORTING TOOLS

### Infrastructure Inspection

1. **`scripts/bdgf/inspect-database-roles.mjs`**
   - Lists all database roles and privileges
   - Checks bella_developer and bella_migration_executor
   - Shows granted privileges

2. **`scripts/bdgf/check-executor-privileges.mjs`**
   - Focused check on executor privileges
   - Verifies CREATEDB removed
   - Verifies approvals table permissions (SELECT only)

**Usage:**
```bash
node scripts/bdgf/inspect-database-roles.mjs
node scripts/bdgf/check-executor-privileges.mjs
```

### Migration Status

1. **`scripts/bdgf/check-migration-status.mjs`**
   - Shows applied migrations
   - Checks for R2 and R3 migrations
   - Verifies migration_governance schema

**Usage:**
```bash
node scripts/bdgf/check-migration-status.mjs
```

---

## 📁 EVIDENCE FILES (Generated)

After completing verification, you will have:

### Automated Test Evidence

- **`evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt`**
  - Output from test-credential-enforcement.mjs
  - Authority #1 results (11 tests)
  - Governed Path results
  - Manual test instructions

### Manual Test Evidence

- **`evidence/g3a-architecture/R3_AUTHORITY2_TEST_RESULTS.md`**
  - Supabase CLI test results
  - Command executed
  - Output observed
  - Conclusion (PASS/FAIL)

- **`evidence/g3a-architecture/R3_AUTHORITY3_TEST_RESULTS.md`**
  - SERVICE_ROLE_KEY test results
  - API call executed
  - Response received
  - Conclusion (PASS/FAIL)

### Status Documents

- **`evidence/g3a-architecture/R3_FINAL_STATUS.md`** (UPDATED)
  - Status: 🟢 COMPLETE
  - Verification: ✅ PRODUCTION-VERIFIED
  - Verification evidence section added

- **`evidence/g3a-architecture/R3_COMPLETION_SUMMARY.md`** (NEW)
  - What R3 achieved
  - Technical implementation
  - Test results summary
  - Impact assessment
  - Lessons learned

- **`evidence/g3a-architecture/R3_BASELINE_LOCKED.md`** (NEW)
  - Locks R3 architecture
  - Prevents further changes
  - Documents locked components

### Evidence Archive

- **`evidence/g3a-architecture/r3-evidence/`**
  - All R3_*.md files
  - All R3_*.txt files
  - scripts/ subdirectory (verification scripts)
  - MANIFEST.md (evidence index)

---

## 🔧 MIGRATIONS (Already Applied)

R3 depends on these migrations being applied:

1. **`supabase/migrations/20260820100000_migration_governance_approvals.sql`** (R2)
   - Creates migration_governance schema
   - Creates approvals table
   - Creates approval functions

2. **`supabase/migrations/20260820110000_database_role_separation_v2.sql`** (R3)
   - Creates bella_developer role (READ-ONLY)
   - Creates bella_migration_executor role (AUTHORIZED MUTATION)
   - Grants appropriate privileges

3. **`supabase/migrations/20260820120000_fix_executor_privileges.sql`** (R3 Security Fix)
   - Removes CREATEDB from executor
   - Revokes INSERT/UPDATE/DELETE on approvals from executor
   - Grants SELECT only on approvals to executor

**Verify migrations applied:**
```bash
node scripts/bdgf/check-migration-status.mjs
```

---

## 📖 DOCUMENTATION (Reference)

### Status & Planning

- **`evidence/g3a-architecture/R3_DEPLOYMENT_STATUS.md`**
  - Infrastructure deployment record
  - Roles created
  - Privileges granted
  - Known issues

- **`evidence/g3a-architecture/R3_SECURITY_FIX_APPLIED.md`**
  - Security hardening documentation
  - CREATEDB removal
  - Approvals table protection

- **`evidence/g3a-architecture/R3_NEXT_ACTIONS.md`**
  - Guidance after R3 deployment
  - Points to verification checklist

### Audit Context

- **`evidence/g3a-architecture/AUDIT_07_BYPASS_DETECTION.md`**
  - Original bypass detection (R1)
  - 450+ references → 3 authorities identified

- **`evidence/g3a-architecture/AUDIT_07_REMEDIATION_PLAN.md`**
  - Overall remediation plan (R1-R6)
  - R3 status tracking

- **`evidence/g3a-architecture/BYPASS_VECTOR_INVENTORY.md`** (R1)
  - Complete inventory of bypass vectors
  - Classification by authority

- **`evidence/g3a-architecture/R2_MACHINE_VERIFIABLE_HUMAN_GO.md`**
  - R2 documentation (prerequisite for R3)
  - Approval mechanism details

---

## 🎯 EXECUTION SEQUENCE

**Recommended order:**

```
1. Read: R3_VERIFICATION_CHECKLIST.md OR R3_VERIFICATION_EXECUTION_GUIDE.md
2. Execute: Step 1 (set passwords)
3. Execute: Step 2-3 (update credentials)
4. Execute: Step 4 (automated tests)
5. Execute: Step 5 (manual test authority #2)
6. Execute: Step 6 (manual test authority #3)
7. Execute: Step 7 (finalize and lock)
8. Review: All evidence files created
9. Confirm: R3 status = 🟢 COMPLETE
10. Proceed: R4 planning
```

---

## ✅ SUCCESS CRITERIA

R3 verification is COMPLETE when:

```
✅ All tools executed successfully
✅ 11/11 automated tests PASS
✅ 4/4 security fix tests PASS
✅ 2/2 manual tests PASS
✅ All evidence files created
✅ R3_FINAL_STATUS.md updated (COMPLETE)
✅ Evidence archived (r3-evidence/)
✅ Baseline locked
✅ Ready for R4
```

---

## 📞 TROUBLESHOOTING

If you encounter issues:

1. **Check prerequisites:** Verify migrations applied
2. **Run inspection tools:** inspect-database-roles.mjs, check-executor-privileges.mjs
3. **Review evidence:** R3_DEPLOYMENT_STATUS.md, R3_SECURITY_FIX_APPLIED.md
4. **Check guides:** Each step has troubleshooting section
5. **Verify .env:** Ensure DATABASE_URL and DATABASE_EXECUTOR_URL correct

**Common issues covered in execution guide:**
- Developer still has mutation capability
- Executor cannot connect
- Automated tests fail
- Security fix test fails

---

## 🚀 READY TO START

**Quick start:**

```bash
# 1. Read master guide
cat evidence/g3a-architecture/R3_VERIFICATION_CHECKLIST.md

# 2. Or use execution guide
cat scripts/bdgf/R3_VERIFICATION_EXECUTION_GUIDE.md

# 3. Begin Step 1
# Follow instructions step by step
```

**Estimated time:** 30-40 minutes total

**Blocking:** None (all tools ready)

---

**Last Updated:** 2026-08-20  
**Status:** ✅ ALL FILES READY FOR EXECUTION  
**Next:** Execute R3 verification steps 1-7
