# R3 Credential Rotation Instructions

**Purpose:** Rotate exposed PostgreSQL credentials from R3 testing

**Status:** 🔴 REQUIRED BEFORE BASELINE LOCK

---

## 🔐 CREDENTIALS TO ROTATE

1. `bella_developer` - Password exposed in testing
2. `bella_migration_executor` - Password exposed in testing

---

## 📋 ROTATION PROCEDURE

### Step 1: Generate New Passwords

```bash
node scripts/bdgf/r3-generate-password.mjs
```

**Output:** Two secure 32-character passwords  
**Action:** Copy both passwords immediately (they won't be shown again)

---

### Step 2: Update SQL Script

Open `scripts/bdgf/r3-rotate-credentials.sql`

Replace placeholders:
```sql
ALTER USER bella_developer WITH PASSWORD '<NEW_PASSWORD_1>';
ALTER USER bella_migration_executor WITH PASSWORD '<NEW_PASSWORD_2>';
```

With actual generated passwords from Step 1.

---

### Step 3: Execute in Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Paste the updated SQL from `r3-rotate-credentials.sql`
3. Execute the script
4. Verify output shows both roles updated

---

### Step 4: Update Local .env

Update `.env` file with new passwords:

```env
DATABASE_URL=postgresql://bella_developer:<NEW_PASSWORD_1>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres

DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<NEW_PASSWORD_2>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
```

⚠️  **DO NOT COMMIT .env TO GIT**

---

### Step 5: Clean Up Exposed Credentials

Check and clean these locations:

```bash
# Check for old passwords in evidence files
grep -r "[REDACTED � ROTATED 2026-08-20]" evidence/
grep -r "[REDACTED � ROTATED 2026-08-20]" evidence/

# Clean any findings - replace with [REDACTED] or remove files

# Check git history
git log -p | grep -i "[REDACTED � ROTATED 2026-08-20]"

# If found in git history, consider git-filter-repo or notify team
```

---

### Step 6: Verify Rotation

Run Authority #1 verification test:

```bash
node scripts/bdgf/r3-simple-test.mjs
```

**Expected:** All tests PASS with new credentials

---

### Step 7: Negative Test (Complete Authority #2 Verification)

```bash
# Test 1: CLI link should still be denied
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv
# Expected: "Access token not provided"

# Test 2: CLI push should be denied
npx supabase db push --linked --project-ref lvnvkpyxtuilhrabtlwv
# Expected: Auth error, NOT [Y/n] prompt

# Test 3: Direct mutation via DATABASE_URL should be denied
node scripts/bdgf/r3-simple-test.mjs
# Expected: INSERT/UPDATE/DELETE all denied (tests 2-4 PASS)
```

---

## ✅ SUCCESS CRITERIA

All of the following must be TRUE:

- [ ] New passwords generated
- [ ] SQL script executed successfully in Supabase Dashboard
- [ ] Local .env updated with new passwords
- [ ] Old passwords removed from evidence files
- [ ] Old passwords NOT found in git history (or remediated)
- [ ] `r3-simple-test.mjs` passes (8/8 tests)
- [ ] CLI link test denied (no authentication)
- [ ] CLI push test denied (no mutation path)

---

## 🔴 ONLY AFTER ALL CHECKS PASS

Create `R3_BASELINE_LOCKED.md` and mark:

```
Authority #1 — DATABASE_URL       ✅ CLOSED (rotated + verified)
Authority #2 — Supabase CLI       ✅ CLOSED (logout + no mutation path)
Authority #3 — SERVICE_ROLE_KEY   ✅ CLOSED (removed + backed up)

R3 = 🟢 3/3 CLOSED
```

---

## 📝 IMPORTANT NOTES

**Why SQL in Dashboard, not script?**
- bella_developer and bella_migration_executor lack ALTER USER privilege
- Requires superuser or service role access
- Supabase SQL Editor runs as service role by default

**Why not automate?**
- Prevents accidental credential logging
- Forces manual verification at each step
- Reduces risk of credentials in git/logs

**Next Step After Lock:**
- Open R4 (Migration Execution Gate Framework)
- R3 baseline becomes immutable reference

---

**Principle:** "Evidence > Assumption"  
**Action:** Verify every step, don't assume rotation worked
