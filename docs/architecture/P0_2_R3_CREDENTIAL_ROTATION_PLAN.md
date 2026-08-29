# P0.2-R3: Credential Rotation Plan

**Date:** 2026-08-25  
**Status:** 🔴 AWAITING EXECUTION  
**Trigger:** T5 credential exposure incident

---

## Incident Summary

**During P0.2-T5 Operational Verification:**
- `.env` file read for evidence collection
- Plaintext credentials exposed:
  - `DATABASE_URL` (bella_developer password)
  - `DATABASE_EXECUTOR_URL` (bella_migration_executor password)

**Classification:** CREDENTIAL EXPOSURE  
**Severity:** HIGH (plaintext passwords exposed in audit conversation)  
**Scope:** Local development environment  
**Production Impact:** Currently assessed LOW because Vercel runtime does not use these PostgreSQL credentials (uses SUPABASE_SERVICE_ROLE_KEY instead); however, credentials are treated as compromised and rotation is mandatory regardless of assessed impact.

---

## Rotation Surface

### Credentials to Rotate

```
1. bella_developer
   Role: READ-ONLY developer access
   Current credential: DATABASE_URL in .env (EXPOSED)
   Consumers: 26+ BDGF scripts, manual psql, test suites
   
2. bella_migration_executor
   Role: AUTHORIZED MUTATION (BDGF migrations)
   Current credential: DATABASE_EXECUTOR_URL in .env (EXPOSED)
   Consumers: 26+ BDGF executor scripts, deployment tools
```

### Storage Locations

```
✅ Local .env — PRIMARY (must update)
❌ GitHub Secrets — NOT CONFIGURED
❌ Vercel Environment Variables — NOT USED (Vercel uses SUPABASE_SERVICE_ROLE_KEY)
❌ CI/CD — NOT CONFIGURED
❌ Password Manager — NOT EVIDENCED
```

### Impact Analysis

```
Developer Workflow:
  - Local .env must be updated
  - BDGF scripts will fail until .env updated
  - R3 verification blocked until rotation complete
  
Production Runtime:
  ✅ Currently assessed NO IMPACT (Vercel uses Supabase API, not direct PostgreSQL)
  🔴 Credentials treated as compromised regardless of production usage
  
CI/CD:
  ✅ NO IMPACT (not configured)
  
Migration Deployment:
  🟡 BLOCKED until DATABASE_EXECUTOR_URL updated
```

---

## Rotation Procedure

### Prerequisites

- [ ] Supabase Dashboard access
- [ ] Password generator (cryptographically secure)
- [ ] Password manager for secure storage (recommended)
- [ ] `.env` file backup (optional, but do NOT commit)

### Step 1: Generate New Passwords

**Method: Cryptographically Secure Random**

```bash
# Generate bella_developer password (32 characters)
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

# Generate bella_migration_executor password (32 characters)
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

**Requirements:**
- Minimum 32 characters
- Base64url encoding (URL-safe)
- Cryptographically random
- Do NOT reuse old passwords
- Do NOT commit to git

**Action:**
- [ ] Generate `NEW_DEVELOPER_PASSWORD`
- [ ] Generate `NEW_EXECUTOR_PASSWORD`
- [ ] Store in password manager (if available)

### Step 2: Rotate in Supabase (PostgreSQL)

**Access:** Supabase Dashboard → SQL Editor  
**URL:** https://supabase.com/dashboard/project/lvnvkpyxtuilhabtlwv/sql/new

**SQL:**
```sql
-- Rotate bella_developer password
ALTER ROLE bella_developer WITH PASSWORD '<NEW_DEVELOPER_PASSWORD>';

-- Rotate bella_migration_executor password
ALTER ROLE bella_migration_executor WITH PASSWORD '<NEW_EXECUTOR_PASSWORD>';

-- Verification (does NOT show passwords)
SELECT 
  rolname, 
  rolcanlogin, 
  rolsuper, 
  rolcreatedb,
  rolcreaterole
FROM pg_roles
WHERE rolname IN ('bella_developer', 'bella_migration_executor')
ORDER BY rolname;
```

**Expected Output:**
```
rolname                    | rolcanlogin | rolsuper | rolcreatedb | rolcreaterole
---------------------------|-------------|----------|-------------|---------------
bella_developer            | t           | f        | f           | f
bella_migration_executor   | t           | f        | f           | f
```

**Action:**
- [ ] Execute `ALTER ROLE` commands
- [ ] Verify 2 rows returned
- [ ] Confirm `rolcanlogin = t` for both roles
- [ ] Close SQL Editor (do NOT save query with passwords)

### Step 3: Update Local .env

**File:** `.env` (root of repository)

**Current (COMPROMISED):**
```bash
DATABASE_URL=postgresql://bella_developer:[OLD_PASSWORD]@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:[OLD_PASSWORD]@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
```

**New (ROTATED):**
```bash
DATABASE_URL=postgresql://bella_developer:<NEW_DEVELOPER_PASSWORD>@db.lvnvkpyxtuilhabtlwv.supabase.co:5432/postgres
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<NEW_EXECUTOR_PASSWORD>@db.lvnvkpyxtuilhabtlwv.supabase.co:5432/postgres
```

**Action:**
- [ ] Replace `[OLD_PASSWORD]` with new passwords
- [ ] Verify connection string format (postgresql://user:pass@host:port/db)
- [ ] Save `.env`
- [ ] Verify `.gitignore` still contains `.env`
- [ ] Do NOT commit `.env` to git

### Step 4: Verify Rotation

**Test connection with new credentials:**

```bash
# Test bella_developer (READ-ONLY)
psql $DATABASE_URL -c "SELECT current_user, current_database();"

# Expected output:
#  current_user    | current_database
# -----------------|------------------
#  bella_developer | postgres
```

**If connection fails:**
- Check password copy/paste (no extra spaces)
- Verify Supabase `ALTER ROLE` was executed
- Check connection string format

**Action:**
- [ ] Test `DATABASE_URL` connection
- [ ] Verify `current_user = bella_developer`
- [ ] If fails: diagnose before proceeding

### Step 5: Run R3 Verification

**Execute R3 verification test suite:**

```bash
node scripts/bdgf/r3-simple-test.mjs
```

**Expected Output (8/8 PASS):**
```
╔════════════════════════════════════════════════════════════╗
║ R3 SIMPLE PERMISSION TEST                                  ║
╚════════════════════════════════════════════════════════════╝

🧪 TEST 1: Developer (READ-ONLY) Check
Role: bella_developer
✅ SELECT works
✅ INSERT blocked (permission denied)
✅ UPDATE blocked (permission denied)
✅ DELETE blocked (permission denied)

🧪 TEST 2: Executor (AUTHORIZED MUTATION) Check
Role: bella_migration_executor
✅ INSERT works (rolled back)
✅ CREATE TABLE works (rolled back)
✅ Can SELECT from approvals
✅ Cannot INSERT approvals (security fix works)

╔════════════════════════════════════════════════════════════╗
║ TEST COMPLETE                                              ║
╚════════════════════════════════════════════════════════════╝
```

**If any test fails:**
- Diagnose grant configuration
- Compare with R3_DEPLOYMENT_STATUS.md expectations
- Do NOT proceed until 8/8 PASS

**Action:**
- [ ] Run `r3-simple-test.mjs`
- [ ] Verify 8/8 tests PASS
- [ ] If fails: investigate before marking R3 complete

### Step 6: Document Rotation

**Create completion record:**

```bash
# Update R3_FINAL_STATUS.md
echo "## Credential Rotation

Date: $(date)
Event: P0.2-T5 credential exposure remediation
Rotated: bella_developer, bella_migration_executor
Verification: 8/8 PASS (r3-simple-test.mjs)
Status: ✅ R3 COMPLETE (PRODUCTION-VERIFIED)
" >> evidence/g3a-architecture/R3_FINAL_STATUS.md
```

**Action:**
- [ ] Create `R3_FINAL_STATUS.md` if 8/8 PASS
- [ ] Mark R3 as ✅ COMPLETE (PRODUCTION-VERIFIED)
- [ ] Update P0.2 documentation
- [ ] Close E2 as OBSOLETE

### Step 7: Secure Old Credentials

**Old credentials are IMMEDIATELY REVOKED:**
- `ALTER ROLE ... WITH PASSWORD` invalidates old passwords instantly
- Old credentials can no longer authenticate
- No additional revocation needed
- Do NOT test old credentials (increases exposure surface)

**Action:**
- [ ] Destroy any `.env.backup` files containing old passwords
- [ ] Remove passwords from clipboard/history
- [ ] Confirm rotation documented in password manager (if used)

---

## Post-Rotation Checklist

**Verification:**
- [ ] New `DATABASE_URL` connects successfully
- [ ] New `DATABASE_EXECUTOR_URL` connects successfully
- [ ] R3 verification test: 8/8 PASS
- [ ] Old `.env.backup` destroyed (if created)

**Documentation:**
- [ ] `R3_FINAL_STATUS.md` created
- [ ] P0.2 status updated
- [ ] Credential exposure incident closed

**Security:**
- [ ] `.env` not committed to git
- [ ] `.gitignore` contains `.env`
- [ ] Old passwords destroyed
- [ ] New passwords stored securely

---

## Execution Timeline

```
🔴 Before Rotation:
   - T5 credential exposure
   - R3 verification HOLD
   - E2 marked OBSOLETE
   - P0.2 evidence phase complete

⏳ During Rotation:
   - Generate passwords
   - ALTER ROLE in Supabase
   - Update .env
   - Test connection

✅ After Rotation:
   - Run r3-simple-test.mjs
   - If 8/8 PASS: Mark R3 COMPLETE
   - Close P0.2 with security incident resolved
   - Lock bella_developer + bella_migration_executor architecture
```

---

## Risk Assessment

**Low Risk:**
- Rotation scope: Local development only
- No production runtime impact (Vercel uses API keys)
- No CI/CD impact (not configured)
- Rollback: Use Supabase Dashboard to reset passwords

**Execution Safety:**
- `.env` is gitignored (verified)
- R3 verification uses ROLLBACK (no persistent changes)
- Old credentials immediately invalidated
- New credentials tested before declaring complete

---

## Next Steps After Rotation

1. **If 8/8 PASS:**
   - Mark R3 as ✅ COMPLETE (PRODUCTION-VERIFIED)
   - Close P0.2 with E2 OBSOLETE
   - Lock R3 baseline
   - Document bella_developer/bella_migration_executor as approved architecture

2. **If any test FAIL:**
   - Investigate grant configuration
   - Compare with `20260820110000_database_role_separation.sql`
   - Do NOT close P0.2 until verified

3. **E3 Decision (Separate from P0.2):**
   - Decide if GitHub Actions should be operational deployment path
   - If YES: Provision `PRODUCTION_SUPABASE_DB_URL` in GitHub Environment
   - If NO: Document BDGF as sole production migration mechanism

---

## Execution Lock

**❌ DO NOT:**
- Commit `.env` to git
- Share passwords in chat/documentation/logs
- Use old credentials after rotation
- Provision GitHub secrets without separate architecture decision

**✅ ALLOWED:**
- Execute rotation as documented
- Run r3-simple-test.mjs after rotation
- Update local .env
- Document rotation completion

---

**Ready for execution: YES (manual, following procedure above)**  
**Automation: NO (credential rotation requires human approval)**  
**Approval required: YES (user must initiate)**
