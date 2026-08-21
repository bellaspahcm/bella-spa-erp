# R3 Credential Rotation — Execution Guide

**Date:** 2026-08-20  
**Status:** 🔴 AWAITING MANUAL EXECUTION

---

## 🎯 OBJECTIVE

Rotate exposed PostgreSQL credentials and complete R3 verification before baseline lock.

**Current State:**
- Authority #1: ✅ CLOSED (but credentials exposed)
- Authority #2: ⚠️ CLI logged out (needs final mutation test)
- Authority #3: ✅ CLOSED (SERVICE_ROLE_KEY removed)

**Target State:**
- Authority #1: ✅ CLOSED (rotated + re-verified)
- Authority #2: ✅ CLOSED (no mutation path confirmed)
- Authority #3: ✅ CLOSED (already verified)

---

## 📋 EXECUTION SEQUENCE (MANUAL)

### Step 1: Generate New Passwords

```bash
node scripts/bdgf/r3-generate-password.mjs
```

**Output:** Two 32-character passwords  
**Action:** Copy both immediately, do NOT save to file

---

### Step 2: Rotate in Supabase Dashboard

1. Open: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new
2. Paste this SQL (replace `<PASSWORD>` with generated values):

```sql
-- Rotate bella_developer
ALTER USER bella_developer WITH PASSWORD '<NEW_PASSWORD_1>';

-- Rotate bella_migration_executor  
ALTER USER bella_migration_executor WITH PASSWORD '<NEW_PASSWORD_2>';

-- Verify
SELECT rolname, rolcanlogin, rolsuper 
FROM pg_roles
WHERE rolname IN ('bella_developer', 'bella_migration_executor');
```

3. Execute
4. Verify output shows both roles

---

### Step 3: Update Local .env

Edit `.env`:

```env
DATABASE_URL=postgresql://bella_developer:<NEW_PASSWORD_1>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres

DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<NEW_PASSWORD_2>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
```

Save (do NOT commit to git).

---

### Step 4: Verify Authority #1 with New Credentials

```bash
node scripts/bdgf/r3-simple-test.mjs
```

**Expected:** 8/8 tests PASS

---

### Step 5: Complete Authority #2 Verification

```bash
# Test 1: CLI should have no auth
npx supabase projects list

# Test 2: Link should be denied
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv

# Test 3: Push should be denied (CRITICAL)
npx supabase db push --linked --project-ref lvnvkpyxtuilhrabtlwv
```

**Expected ALL:** "Access token not provided" or auth error  
**CRITICAL:** NO [Y/n] prompt for mutations

---

### Step 6: Redact Old Credentials (PowerShell)

```powershell
# Redact old passwords from all files
$files = Get-ChildItem -Path evidence/,scripts/ -Recurse -File
$files | ForEach-Object {
  (Get-Content $_.FullName) `
    -replace '[REDACTED � ROTATED 2026-08-20]', '[REDACTED_OLD_PASSWORD_DEV]' `
    -replace '[REDACTED � ROTATED 2026-08-20]', '[REDACTED_OLD_PASSWORD_EXEC]' |
  Set-Content $_.FullName
}

# Verify redaction
grep -r "[REDACTED � ROTATED 2026-08-20]" evidence/ scripts/
# Should return no results
```

---

### Step 7: Check Git History

```bash
# Check if old credentials in git
git log --all -p | grep "[REDACTED � ROTATED 2026-08-20]"

# If found in HEAD commit only:
git add -A
git commit --amend --no-edit

# If found in older commits:
# Accept as historical (now rotated and invalid)
```

---

### Step 8: Document Rotation Complete

Update `scripts/bdgf/r3-cleanup-exposed-credentials.md`:

```markdown
**Status:** ✅ COMPLETE
**Date:** 2026-08-20 [TIME]
**Method:** Supabase Dashboard SQL Editor
**Verification:** r3-simple-test.mjs (8/8 PASS)
**Cleanup:** Redacted from evidence/scripts
**Git:** Checked / Amended
```

---

### Step 9: Create Baseline Lock Document

After ALL steps above complete, create `evidence/g3a-architecture/R3_BASELINE_LOCKED.md`:

```markdown
# R3 BASELINE LOCKED

**Date:** 2026-08-20  
**Status:** 🟢 PRODUCTION VERIFICATION COMPLETE

## Authority Closure Summary

Authority #1 — DATABASE_URL        ✅ CLOSED (rotated + verified)
Authority #2 — Supabase CLI        ✅ CLOSED (logout + mutation path denied)
Authority #3 — SERVICE_ROLE_KEY    ✅ CLOSED (removed + backed up)

**R3 = 🟢 3/3 AUTHORITIES CLOSED**

## Evidence Trail

- Authority #1: `scripts/bdgf/r3-simple-test.mjs` (8/8 PASS with rotated credentials)
- Authority #2: `evidence/g3a-architecture/R3_AUTHORITY2_FINAL_TEST.md`
- Authority #3: `evidence/g3a-architecture/R3_AUTHORITY3_TEST_RESULTS.txt`

## Credential Security

- Old credentials: ROTATED and REDACTED from evidence
- New credentials: Stored in .env (NOT in git)
- SERVICE_ROLE_KEY: Removed (backed up to mcp-server/.env.backup.r3)

## What R3 Achieved

R3 closes **WHO** can mutate Production outside BDGF.

Infrastructure enforcement:
- PostgreSQL role permissions (bella_developer READ-ONLY)
- CLI profile logout (no authentication)
- Service key removal (no bypass)

## What R3 Does NOT Cover

R4 will govern:
- **WHEN** a migration may execute
- **UNDER WHAT CONDITIONS** approval is required
- Approval gate automation
- Execution audit trail

## R3 Principle Validated

**"Evidence > Assumption"**

Every authority verified through:
1. Infrastructure remediation
2. Negative test execution  
3. Documented evidence

## Next Step

✅ R3 BASELINE LOCKED  
→ Open R4: Migration Execution Gate Framework
```

---

## ✅ COMPLETION CHECKLIST

Mark each as you complete:

- [ ] Step 1: Passwords generated
- [ ] Step 2: SQL executed in Supabase Dashboard
- [ ] Step 3: .env updated
- [ ] Step 4: r3-simple-test.mjs PASSED (8/8)
- [ ] Step 5a: `npx supabase projects list` → Auth error
- [ ] Step 5b: `npx supabase link` → Auth error
- [ ] Step 5c: `npx supabase db push` → Auth error (NO [Y/n])
- [ ] Step 6: Old passwords redacted
- [ ] Step 7: Git history checked
- [ ] Step 8: Cleanup status updated
- [ ] Step 9: R3_BASELINE_LOCKED.md created

---

## 🔴 CRITICAL VALIDATION

**Before marking R3 complete:**

Authority #2 is NOT closed by "Access token not provided" alone.

Must verify:
1. ✅ No authentication → VERIFIED (Step 5a)
2. ✅ Cannot link production → VERIFIED (Step 5b)
3. ✅ Cannot push to production → MUST VERIFY (Step 5c)
4. ✅ NO mutation path via CLI → MUST VERIFY (Step 5c, no [Y/n] prompt)

**Principle:** Evidence > Assumption

CLI logout proves credential removed.  
Push test proves no alternate mutation path exists.

---

## 📞 NOTIFY WHEN COMPLETE

After all 9 steps complete, report:

```
✅ R3 Rotation Complete

Authority Status:
- Authority #1: ✅ CLOSED (8/8 tests PASS)
- Authority #2: ✅ CLOSED (no mutation path)
- Authority #3: ✅ CLOSED (key removed)

Evidence:
- r3-simple-test.mjs: 8/8 PASS
- CLI link test: Auth denied
- CLI push test: Auth denied (no [Y/n] prompt)

Credentials:
- Old passwords: Rotated + Redacted
- New passwords: In .env (not in git)

Next: R4 Migration Execution Gate Framework
```

---

**Status:** 🔴 AWAITING YOUR EXECUTION

**Estimated Time:** 15-20 minutes

**After Complete:** R3 → 🟢 LOCKED, R4 → OPEN
