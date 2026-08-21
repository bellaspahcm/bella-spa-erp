# R3 NEXT SESSION — Quick Start Guide

**Status:** 🔴 R3 BLOCKED — Authority #2 remediation required  
**Goal:** Close Authority #2 (Supabase CLI) → Verify 3/3 authorities → Lock R3 baseline  
**Time Estimate:** 15-20 minutes  
**Do NOT:** Start R4 until R3 complete

---

## 🎯 MISSION

Prove developer CANNOT mutate Production via Supabase CLI, even when intentionally trying.

---

## ✅ 4-STEP CHECKLIST

### [ ] STEP 1: Remove Developer from Production Team (2 min) ⚠️ MANUAL

**Action:**
1. Open: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Settings → Team / Access
3. Find developer user
4. **REMOVE** from team

**Verification:**
- Developer no longer listed in production team

---

### [ ] STEP 2: Unlink and Link Dev (1 min) ✅ AUTOMATED

```bash
# Unlink from production
npx supabase unlink

# Link to dev
npx supabase link --project-ref bmnbqbcdbuklhopfbopv

# Verify
npx supabase projects list
# bella-spa-erp-e2e should show ● (linked)
```

---

### [ ] STEP 3: ⭐ NEGATIVE TEST (3 min) ✅ CRITICAL

**This is the DECISIVE test for Authority #2.**

```bash
# Test 3A: Attempt production re-link
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv

# MUST return:
# "Error: Not a member of this project"

# Test 3B: Attempt production push
echo "SELECT 1;" > supabase/migrations/99999999999999_r3_negative_test.sql
npx supabase db push --linked --project-ref lvnvkpyxtuilhrabtlwv

# MUST return:
# "Error: Not a member" OR "Permission denied"

# Cleanup
rm supabase/migrations/99999999999999_r3_negative_test.sql
```

**Save output:**
```bash
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv 2>&1 | \
  Out-File -FilePath evidence/g3a-architecture/R3_AUTHORITY2_NEGATIVE_TEST.txt
```

**PASS Criteria:**
- ✅ "Error: Not a member" message
- ✅ NO [Y/n] confirmation prompt
- ✅ Infrastructure-enforced denial

**FAIL Criteria:**
- ❌ Link succeeds
- ❌ [Y/n] prompt appears
- → Remediation incomplete, investigate

---

### [ ] STEP 4: Document and Lock (10 min) ✅ AUTOMATED

**4A: Rotate Passwords**
```sql
-- Connect to Supabase PostgreSQL
ALTER USER bella_developer WITH PASSWORD '<new_secure_password>';
ALTER USER bella_migration_executor WITH PASSWORD '<new_secure_password>';
```

**4B: Update .env**
```bash
# Update with new passwords
# DO NOT write passwords in evidence files
```

**4C: Re-test R3**
```bash
node scripts/bdgf/r3-simple-test.mjs
# Should still PASS with new credentials
```

**4D: Create Baseline Lock**
- File: `evidence/g3a-architecture/R3_BASELINE_LOCKED.md`
- Content: Declare R3 complete (3/3 authorities), list frozen invariants

**4E: Update Status**
- `evidence/g3a-architecture/R3_FINAL_STATUS.md` → 🟢 COMPLETE (3/3)
- `evidence/g3a-architecture/AUDIT_07_REMEDIATION_PLAN.md` → R3: 🟢 COMPLETE

---

## 🔴 CRITICAL: WHAT CONSTITUTES "PASS"

**Authority #2 is CLOSED when:**
- ✅ Developer removed from production team (Supabase access control)
- ✅ Production re-link attempt → "Error: Not a member"
- ✅ NO [Y/n] confirmation prompt
- ✅ Infrastructure-enforced (not discipline-based)
- ✅ Equivalent to Authority #1 enforcement level

**NOT sufficient:**
- ❌ "Developer currently linked to dev" (can re-link)
- ❌ "[Y/n] prompt" (discipline, not infrastructure)
- ❌ "Developer hasn't pushed yet" (capability exists)

---

## 🎯 AFTER R3 LOCKED → R4

**Only after all 4 steps complete:**
1. Begin R4 design
2. R4 = Migration Execution Gate Framework prototype
3. R4 answers: "WHEN can a mutation happen?" (R3 answered: "WHO can mutate?")

---

## 📋 QUICK REFERENCE

**Current Status:**
- Authority #1: ✅ CLOSED
- Authority #2: 🔴 OPEN ← BLOCKER
- Authority #3: ✅ CLOSED

**Exposed Passwords (ROTATE):**
- bella_developer: `[REDACTED � ROTATED 2026-08-20]`
- bella_migration_executor: `[REDACTED � ROTATED 2026-08-20]`

**Key Files:**
- Action plan: `evidence/g3a-architecture/R3_AUTHORITY2_ACTION_REQUIRED.md`
- Test results: `evidence/g3a-architecture/R3_AUTHORITY2_TEST_RESULTS.txt`
- Checkpoint: `evidence/g3a-architecture/R3_SESSION_CHECKPOINT.md`

---

**Principle:** "Evidence > Assumption" — Negative test is decisive proof.

