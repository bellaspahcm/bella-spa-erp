# R3 AUTHORITY #2 REMEDIATION — Step-by-Step Guide

**Date:** 2026-08-20  
**Objective:** Close Authority #2 (Supabase CLI) via infrastructure enforcement  
**Strategy:** Option C + A Combined (Project separation + Team removal)

---

## 🎯 REMEDIATION STRATEGY

**NOT sufficient:**
- ❌ Unlink CLI only (developer still has team access)
- ❌ Rely on confirmation prompt [Y/n] (discipline, not infrastructure)

**REQUIRED:**
- ✅ Remove developer from production project team (Supabase access control)
- ✅ Unlink CLI from production
- ✅ Link CLI to dev project only
- ✅ Verify mutation attempts are DENIED (not just prompted)

---

## 📐 ARCHITECTURE TARGET

```
BELLA PRODUCTION
      │
      ├─── Human GO Authority
      │         │
      │    BDGF Approval (R2)
      │         │
      └─── CI/CD Service Account
                │
           bella_migration_executor (R3)
                │
           Production DB


Developer (Local)
      │
      ├─── bella-spa-erp-e2e (Dev Project)
      │         │
      │    Full access (develop + test)
      │
      └───X─── bellaspahcm's Project (Production)
               ↑
          ❌ INFRASTRUCTURE DENIAL
             (Not a team member)
```

---

## 🔧 STEP-BY-STEP REMEDIATION

### STEP 1: Remove Developer from Production Project Team

**Action:** Supabase Dashboard (Manual)

1. Navigate to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Settings → Team
3. Find developer user account
4. Click "Remove" or change role to "Read-only" (if available)
5. Confirm removal

**Expected Result:**
- Developer no longer listed in project team
- Developer cannot access production project settings
- Developer CLI commands to production → "Error: Not a member"

**Verification Command:**
```bash
npx supabase projects list
# Production project should still appear but WITHOUT team access indicator
```

---

### STEP 2: Unlink CLI from Production

**Action:** Local CLI (Automated)

```bash
# Check current link
npx supabase projects list

# Unlink from production
npx supabase unlink

# Verify unlinked
npx supabase projects list
# No project should have ● (linked) indicator
```

**Expected Result:**
- CLI no longer linked to any project
- `supabase/config.toml` updated (project_id removed or changed)

---

### STEP 3: Link CLI to Dev Project

**Action:** Local CLI (Automated)

```bash
# Link to dev project
npx supabase link --project-ref bmnbqbcdbuklhopfbopv

# Verify link
npx supabase projects list
# bella-spa-erp-e2e should show ● (linked)
```

**Expected Result:**
- CLI linked to dev project (bmnbqbcdbuklhopfbopv)
- Developer can work on dev environment
- Production not linked

---

### STEP 4: CRITICAL — Negative Test Production Access

**Action:** Automated test (MUST verify infrastructure denial)

**Test 4A: Attempt to link to production**
```bash
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv
# Expected: Error: You are not a member of this project
# OR: Error: Insufficient permissions
```

**Test 4B: Attempt direct push to production (if somehow linked)**
```bash
# Create harmless test migration
echo "SELECT 1 AS r3_test;" > supabase/migrations/99999999999999_r3_test.sql

# Attempt push (should fail)
npx supabase db push --linked --project-ref lvnvkpyxtuilhrabtlwv
# Expected: Error: Not a member OR Permission denied
# NOT EXPECTED: "Do you want to push? [Y/n]" prompt
```

**Test 4C: Verify dev project access still works**
```bash
npx supabase db push --linked --project-ref bmnbqbcdbuklhopfbopv
# Expected: Success OR appropriate prompt for dev environment
```

**Success Criteria:**
- ✅ Production link fails with "Not a member" or "Permission denied"
- ✅ NO confirmation prompt [Y/n] for production
- ✅ Error is infrastructure-enforced (Supabase team access control)
- ✅ Dev project access still functional

**FAILURE Criteria (requires additional remediation):**
- ❌ Production push shows [Y/n] prompt (developer still has access)
- ❌ Link command succeeds for production
- ❌ No infrastructure denial message

---

### STEP 5: Document Evidence and Lock R3

**Action:** Create evidence files

**5A: Save test output**
```bash
# Run tests and save output
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv 2>&1 | \
  Out-File -FilePath evidence/g3a-architecture/R3_AUTHORITY2_NEGATIVE_TEST.txt

npx supabase projects list | \
  Out-File -Append -FilePath evidence/g3a-architecture/R3_AUTHORITY2_NEGATIVE_TEST.txt
```

**5B: Create R3 baseline lock document**
- File: `evidence/g3a-architecture/R3_BASELINE_LOCKED.md`
- Contents: 3/3 authorities closed, evidence summary, lock timestamp

**5C: Update remediation plan**
- Mark R3 as 🟢 FULLY COMPLETE (3/3 authorities)
- Update progress table with Authority #2 closure date

---

## ✅ VERIFICATION CHECKLIST

### Authority #1 (DATABASE_URL)
- [x] bella_developer has READ-ONLY privileges
- [x] Developer INSERT/UPDATE/DELETE → Permission denied
- [x] Evidence: `scripts/bdgf/r3-simple-test.mjs` (8/8 PASS)

### Authority #2 (Supabase CLI)
- [ ] Developer removed from production project team (PENDING)
- [ ] CLI unlinked from production (PENDING)
- [ ] CLI linked to dev project (PENDING)
- [ ] Production push attempt → "Not a member" error (PENDING)
- [ ] Evidence: Negative test output saved (PENDING)

### Authority #3 (SERVICE_ROLE_KEY)
- [x] SERVICE_ROLE_KEY removed from `mcp-server/.env`
- [x] Developer lacks credential to bypass RLS
- [x] Evidence: `scripts/bdgf/r3-test-authority3.mjs` (key not found)

---

## 🚨 CRITICAL DISTINCTION

**What does NOT close Authority #2:**
- ❌ Unlink CLI only (developer can re-link if still team member)
- ❌ Confirmation prompt [Y/n] (discipline, not infrastructure)
- ❌ Process documentation ("Don't push to prod")

**What DOES close Authority #2:**
- ✅ Remove developer from production project team (Supabase access control)
- ✅ CLI commands fail with "Not a member" or "Permission denied"
- ✅ Infrastructure-enforced denial (not user choice)

**Principle:**
> "Infrastructure denial (NO) > User confirmation (Are you sure?)"

---

## 📊 SUCCESS CRITERIA

### Before Remediation
```
Developer → Supabase CLI → Production
                              ↓
                    "Do you want to push? [Y/n]"
                              ↓
                    Developer decides (discipline)
```

### After Remediation (Target)
```
Developer → Supabase CLI → Production
                              ↓
                    ❌ "Error: Not a member"
                              ↓
                    Infrastructure denial (enforced)
```

---

## 🔄 POST-REMEDIATION STATUS

**Current (Before Remediation):**
```
Authority #1: ✅ CLOSED (explicit denial)
Authority #2: 🔴 OPEN (discipline-based, not infrastructure)
Authority #3: ✅ CLOSED (key removed)
Overall: 🟡 2/3 CLOSED
```

**Target (After Remediation):**
```
Authority #1: ✅ CLOSED (PostgreSQL permission denied)
Authority #2: ✅ CLOSED (Supabase team access control)
Authority #3: ✅ CLOSED (credential removed)
Overall: ✅ 3/3 CLOSED
```

---

## ⏭️ AFTER R3 LOCKED

**Then and only then:**
1. Rotate exposed passwords (bella_developer, bella_migration_executor)
2. Remove plaintext passwords from evidence documents
3. Update `.env` with new credentials
4. Create `R3_BASELINE_LOCKED.md`
5. Begin R4 design (Migration Execution Gate Framework)

---

## 💡 WHY THIS APPROACH

### Combined Strategy (C + A)

**Option C alone (Unlink CLI):**
- ❌ Developer can run `npx supabase link --project-ref lvnvkpyxtuilhrabtlwv` again
- ❌ If still team member, link succeeds
- ❌ Authority #2 not truly closed

**Option A alone (Remove from team):**
- ✅ Developer cannot access production
- ✅ Infrastructure-enforced
- ✅ But doesn't establish dev workflow

**Option C + A combined:**
- ✅ Developer removed from production team (access control)
- ✅ Developer CLI linked to dev project (proper workflow)
- ✅ Infrastructure-enforced denial (not discipline)
- ✅ Clear dev/prod separation
- ✅ Matches Authority #1 enforcement level

---

## 🎯 ALIGNMENT WITH R3 GOAL

**R3 Design Goal:**
> "Remove developer direct mutation capability via infrastructure enforcement"

**Authority #2 Compliance:**
- ✅ Infrastructure enforcement: Supabase team access control
- ✅ Direct mutation removed: Developer cannot push to production
- ✅ Matches Authority #1 level: Permission denied (not prompt)

---

**Next:** Execute Steps 1-5 in sequence, verify negative test, lock R3 baseline.

**Status:** 🔴 PENDING EXECUTION — Manual Supabase Dashboard action required (Step 1)

