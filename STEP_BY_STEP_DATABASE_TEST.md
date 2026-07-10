# Step-by-Step: Database Migration Verification

**Date:** 2026-07-10  
**Goal:** Verify Rule Management database migration is 100% correct  
**Time:** ~5 minutes

---

## 📋 STEP 1: Apply Migration (If Not Applied Yet)

### Check if migration is already applied:
```bash
# List recent migrations
ls -la supabase/migrations/ | grep "20260710"
```

You should see:
```
20260710160000_rule_management_tables.sql
```

### Apply migration (if needed):

**Option A: Using Supabase CLI** (Recommended)
```bash
# Push migration to your Supabase project
supabase db push

# Or if you have specific project ref
supabase db push --project-ref YOUR_PROJECT_REF
```

**Option B: Manual (Copy to SQL Editor)**
1. Open file: `supabase/migrations/20260710160000_rule_management_tables.sql`
2. Copy ALL content (Ctrl+A, Ctrl+C)
3. Open Supabase Dashboard → SQL Editor
4. Paste and click "Run"
5. Wait for success message

---

## 📋 STEP 2: Run Verification Script

### Open Verification Script:
1. Open file: `supabase/VERIFY_RULE_MANAGEMENT_MIGRATION.sql`
2. Copy ALL content (Ctrl+A, Ctrl+C)

### Run in Supabase SQL Editor:
1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"
5. Paste the verification script
6. Click "Run" (or press F5)

### Watch the Output:
The script will run 15 tests and show results in real-time.

---

## ✅ EXPECTED OUTPUT (SUCCESS)

You should see this in the "Results" panel:

```
╔════════════════════════════════════════════════════════════╗
║  Rule Management Migration Verification                   ║
╚════════════════════════════════════════════════════════════╝

🧪 Test 1: Verify tables exist
  ✅ PASS: All 4 tables exist (rules, rule_versions, rule_approvals, rule_test_results)

🧪 Test 2: Verify rules table structure
  ✅ PASS: rules table has all required columns

🧪 Test 3: Verify JSONB columns
  ✅ PASS: conditions and actions are JSONB type

🧪 Test 4: Verify indexes exist
  ✅ PASS: All required indexes exist (15+)

🧪 Test 5: Verify RLS is enabled
  ✅ PASS: RLS enabled on all 4 tables

🧪 Test 6: Verify RLS policies exist
  ✅ PASS: RLS policies exist (8+ policies)

🧪 Test 7: Verify trigger functions exist
  ✅ PASS: Trigger functions exist

🧪 Test 8: Verify triggers are attached
  ✅ PASS: All triggers attached (3)

🧪 Test 9: Verify RPC functions exist
  ✅ PASS: All 4 RPC functions exist

🧪 Test 10: Verify grants for authenticated users
  ✅ PASS: authenticated role has correct grants

🧪 Test 11: Test auto-versioning trigger
  ✅ PASS: Auto-versioning trigger works (version snapshot created)

🧪 Test 12: Test get_rule_with_history RPC
  ✅ PASS: get_rule_with_history RPC executes successfully

🧪 Test 13: Test get_pending_rule_approvals RPC
  ✅ PASS: get_pending_rule_approvals RPC executes successfully

🧪 Test 14: Test get_rule_test_stats RPC
  ✅ PASS: get_rule_test_stats RPC executes successfully

🧪 Test 15: Test rollback_rule_to_version RPC
  ✅ PASS: rollback_rule_to_version RPC executes successfully

🧹 Cleaning up test data...
✅ Test data cleaned up

╔════════════════════════════════════════════════════════════╗
║  TEST SUMMARY                                              ║
╠════════════════════════════════════════════════════════════╣
║  Total Tests:  15                                          ║
║  Passed:       15                                          ║
║  Failed:        0                                          ║
║  Success Rate: 100.0%                                      ║
╚════════════════════════════════════════════════════════════╝

🎉 ALL TESTS PASSED! Migration is successful.
```

---

## ❌ IF TESTS FAIL

### Common Issue 1: Tables Don't Exist
**Symptom:** Test 1 fails with "Not all tables exist"

**Fix:**
```sql
-- Run migration first
\i supabase/migrations/20260710160000_rule_management_tables.sql
```

---

### Common Issue 2: RPC Functions Missing
**Symptom:** Test 9 fails with "Missing RPC functions"

**Fix:**
```sql
-- Check if functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%rule%';

-- If missing, re-run migration
\i supabase/migrations/20260710160000_rule_management_tables.sql
```

---

### Common Issue 3: Triggers Not Attached
**Symptom:** Test 8 fails with "Missing triggers"

**Fix:**
```sql
-- Check existing triggers
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%rule%';

-- Re-create triggers if needed (see migration file)
```

---

## 📸 SCREENSHOT THIS RESULT

**Please take a screenshot of the final output showing:**
- ✅ All 15 tests PASS
- ✅ Success Rate: 100.0%
- ✅ "ALL TESTS PASSED! Migration is successful."

---

## 📋 STEP 3: Confirm Results

**After running the verification:**

**If ALL 15 tests PASS:**
✅ Database migration is 100% correct
✅ Zero technical debt
✅ Ready to proceed to API tests

**If ANY test FAILS:**
❌ Do NOT continue
❌ Share the error output
❌ We'll fix the issue before continuing

---

## 🎯 NEXT STEPS

After verification passes:
1. ✅ Database migration verified (15/15 tests pass)
2. 🔜 Run API integration tests
3. 🔜 Run automated test suite
4. 🔜 Build UI components

---

**Ready?** 

👉 **Copy the verification script from `supabase/VERIFY_RULE_MANAGEMENT_MIGRATION.sql`**  
👉 **Paste into Supabase SQL Editor**  
👉 **Click "Run"**  
👉 **Report the result (PASS or FAIL)**

Let's do this! 🚀

