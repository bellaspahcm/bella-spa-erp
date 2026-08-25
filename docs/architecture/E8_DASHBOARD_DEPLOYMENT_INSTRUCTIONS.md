# E8: Dashboard Deployment Instructions

**Date:** 2026-08-24  
**Status:** 🟡 READY TO EXECUTE  
**Method:** Supabase Dashboard SQL Editor

---

## Prerequisites

✅ **E7 PASS:** Provenance verified, 20260824000000 FREE  
✅ **E8.4A PASS:** Database state CLEAN (no partial deployment)  
✅ **Verification script ready:** `scripts/e8_verify_deployment.ts`

---

## Deployment Steps

### Step 1: Open Dashboard SQL Editor

1. Navigate to: **Supabase Dashboard → SQL Editor**
2. Ensure you're connected to the correct project

### Step 2: Copy Migration SQL

**File:** `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`

**Action:**
- Open the file in your editor
- Copy **entire file content**
- Verify file size: ~6441 bytes

### Step 3: Execute via Dashboard

**Paste** migration SQL into Dashboard SQL Editor

**Click "Run"**

**Expected result:**
- ✅ "Success" message
- ✅ No SQL errors
- ⚠️  **UNKNOWN if migration auto-recorded** (will verify next)

---

## ⚠️ Important Notes

**Dashboard SQL Editor behavior:**
- ✅ Executes SQL statements
- ❓ **May or may not auto-record in schema_migrations**
- ❓ Depends on Dashboard version/feature

**Do NOT assume:**
- Migration automatically recorded
- E8 automatically PASS after execution

**Always verify with independent script.**

---

## Step 4: Verify Deployment

**IMMEDIATELY after Dashboard execution:**

```bash
npx tsx scripts/e8_verify_deployment.ts
```

**This script checks:**
- E8.4: Migration recorded in schema_migrations?
- E8.5: RPC `finance_test_cleanup` exists and callable?
- E8.6: No unexpected side effects?

---

## Possible Outcomes

### Outcome A: All Gates PASS ✅

```
✅ E8.4 PASS — Migration recorded
✅ E8.5 PASS — RPC exists + callable
✅ E8.6 PASS — No side effects

E8 DEPLOYMENT: VERIFIED + PASS
```

**Action:** Proceed to E9 (Phase 4.4 cleanup)

---

### Outcome B: E8.4 FAIL (Migration Not Recorded) ❌

```
❌ E8.4 FAIL — Migration NOT in schema_migrations
✅ E8.5 PASS — RPC exists + callable
✅ E8.6 PASS — No side effects
```

**Meaning:**
- SQL executed successfully
- RPC created
- But migration history NOT auto-recorded

**DO NOT:**
- ❌ Manually INSERT into schema_migrations

**Action required:**
- Identify official Supabase migration deployment mechanism
- Options:
  1. Use CLI `db push` (if CLI reconciliation resolved)
  2. Find Dashboard "Run Migration" feature (NOT just SQL Editor)
  3. Wait for guidance on manual recording (governance review required)

---

### Outcome C: E8.5 FAIL (RPC Not Created) ❌

```
❌ E8.4 FAIL — Migration NOT recorded
❌ E8.5 FAIL — RPC NOT found
✅ E8.6 PASS — No side effects
```

**Meaning:**
- SQL execution failed or rolled back
- Database still CLEAN

**Action:**
- Investigate Dashboard execution error
- Retry deployment

---

### Outcome D: E8.6 FAIL (Side Effects) ❌

```
? E8.4 — (check result)
? E8.5 — (check result)
❌ E8.6 FAIL — Duplicates or corruption detected
```

**Meaning:**
- Unexpected database changes
- Possible corruption

**Action:**
- STOP immediately
- DO NOT proceed to E9
- Investigate side effects
- Escalate to Human Architect

---

## Governance Checkpoints

**Before Dashboard execution:**
- [ ] E7 PASS verified
- [ ] E8.4A CLEAN state verified
- [ ] Migration file ready
- [ ] Verification script ready

**After Dashboard execution:**
- [ ] Run verification script immediately
- [ ] Capture all output
- [ ] Review E8.4, E8.5, E8.6 results
- [ ] Only declare E8 PASS if all gates pass

**DO NOT:**
- [ ] ❌ Manually INSERT schema_migrations
- [ ] ❌ Declare E8 PASS without verification evidence
- [ ] ❌ Proceed to E9 if any gate fails

---

## Recovery If Verification Fails

**If E8.4 fails (migration not recorded):**

**Option 1:** Rollback and use correct mechanism
```sql
-- Rollback RPC
DROP FUNCTION IF EXISTS public.finance_test_cleanup(boolean);

-- Then retry via correct deployment mechanism
```

**Option 2:** Manual recording (requires governance approval)
- NOT approved yet
- Requires Human Architect decision
- Must document why auto-recording failed

---

## Success Criteria

**E8 PASS requires ALL of:**

✅ Dashboard execution successful (no SQL errors)  
✅ E8.4 PASS: Migration recorded in schema_migrations  
✅ E8.5 PASS: RPC exists and callable  
✅ E8.6 PASS: No unexpected side effects  

**Only when all 4 conditions met → E8 PASS → proceed to E9**

---

## Timeline

- **Dashboard execution:** ~10 seconds
- **Verification script:** ~5 seconds
- **Review results:** ~2 minutes
- **Total:** ~3 minutes

---

## Files

**Deployment source:**
- `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`

**Verification script:**
- `scripts/e8_verify_deployment.ts`

**Evidence document:**
- `docs/architecture/E8_DEPLOYMENT_EVIDENCE.md` (create after PASS)

---

## Ready to Execute

**Current status:** APPROVED, awaiting Human execution

**Human must:**
1. Execute migration via Dashboard SQL Editor
2. Run verification script immediately
3. Share verification output
4. Only declare E8 PASS with evidence

**Kiro cannot:**
- Execute Dashboard SQL (web UI)
- Declare E8 PASS without verification evidence
- Proceed to E9 without approval

---

**Awaiting Dashboard execution + verification results.**
