# R3 STEP 5: MANUAL TEST — AUTHORITY #2 (Supabase CLI)

**Goal:** Verify developer cannot push migrations to production via Supabase CLI

**Time:** ~5 minutes

---

## Background

**Authority #2 identified by R1:**
- 290+ scripts use `npx supabase db push` or Supabase CLI commands
- These bypass the Human GO → BDGF → Executor governed path
- Developer with production Supabase access = direct mutation authority

**R3 must prove:** Developer Supabase CLI → Production mutation = ❌ BLOCKED

---

## Test Procedure

### Step 1: Check current Supabase configuration

```bash
# Check which project you're linked to
npx supabase status
```

**Expected output:**
```
Project ref: <project-id>
DB: postgresql://...
API URL: https://<project>.supabase.co
```

**Determine if this is production or dev project.**

---

### Step 2: Create a test migration file

```bash
# Create a harmless test migration
cat > supabase/migrations/99999999999999_r3_test_authority2.sql << 'EOF'
-- R3 Authority #2 Test
-- This migration should NOT be pushed to production by developer

CREATE TABLE IF NOT EXISTS r3_authority2_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_message text DEFAULT 'If this table exists in production, Authority #2 is NOT closed'
);

COMMENT ON TABLE r3_authority2_test IS 'R3 test table - should NOT exist in production';
EOF
```

---

### Step 3: Attempt to push to production

```bash
# Try to push migration
npx supabase db push
```

**Observe the result carefully.**

---

## Expected Results (PASS scenarios)

### Scenario A: Not linked to production
```
Error: Not linked to a project. Run `supabase link` first.
```
✅ PASS: Developer environment is isolated from production

### Scenario B: Permission denied
```
Error: permission denied for schema public
Error: insufficient privileges
```
✅ PASS: Developer has read-only access to production

### Scenario C: Team role restriction
```
Error: You do not have permission to push migrations to this project
Error: Team role "Read-only" cannot modify database
```
✅ PASS: Supabase team permissions prevent mutation

### Scenario D: Project not found / Access denied
```
Error: Project not found or you don't have access
Error: 403 Forbidden
```
✅ PASS: Developer doesn't have production project access

---

## FAIL Scenarios (Security Gap)

### Scenario X: Push succeeds
```
Applying migration 99999999999999_r3_test_authority2.sql...
✓ Migration applied successfully
```

❌ **FAIL: Authority #2 NOT CLOSED**

**Impact:**
- Developer can bypass Human GO
- Developer can bypass R2 approval mechanism
- Developer can bypass BDGF
- Developer has direct mutation authority

**Action Required:**
Implement one of:
1. **Option A:** Separate dev/prod Supabase projects
   - Developer links to dev project only
   - Production project access restricted to CI/CD

2. **Option B:** Change developer team role
   - Supabase Dashboard → Project Settings → Team
   - Change developer to "Read-only" role
   - Only CI/CD service account has "Admin" or "Owner"

3. **Option C:** Remove developer from production project
   - Only CI/CD and human approvers have production access
   - Developers work on dev/staging projects

---

## Cleanup (if test succeeded)

If the migration was pushed (test failed), clean up:

```bash
# Connect with admin/executor credentials
psql $DATABASE_EXECUTOR_URL

# Remove test table
DROP TABLE IF EXISTS r3_authority2_test;

# Remove migration record (if using Supabase migrations table)
DELETE FROM supabase_migrations.schema_migrations 
WHERE version = '99999999999999';
```

Remove test migration file:
```bash
rm supabase/migrations/99999999999999_r3_test_authority2.sql
```

---

## Document Results

Create evidence file:

```bash
cat > evidence/g3a-architecture/R3_AUTHORITY2_TEST_RESULTS.md << 'EOF'
# R3 AUTHORITY #2 TEST RESULTS

**Date:** $(date +%Y-%m-%d)
**Tester:** [Your name]
**Test:** Developer Supabase CLI → Production Mutation

## Test Execution

**Command executed:**
```
npx supabase db push
```

**Result:**
[PASS/FAIL]

**Output:**
```
[Paste terminal output here]
```

## Conclusion

[Choose one:]

✅ PASS: Developer cannot push migrations to production via Supabase CLI
   Authority #2 is CLOSED.

❌ FAIL: Developer successfully pushed migration to production
   Authority #2 bypass exists. Remediation required.

## Remediation (if FAIL)

[If test failed, document which option you implemented:]

- [ ] Option A: Separated dev/prod projects
- [ ] Option B: Changed team role to "Read-only"
- [ ] Option C: Removed developer from production project

## Evidence

- Screenshot: [Attach if available]
- Supabase project settings: [Document team roles]
- Connection test: [Verify developer uses dev project]
EOF
```

---

## Integration with R3_VERIFICATION_RESULTS.txt

Append authority #2 results to main verification file:

```bash
echo "" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "╔════════════════════════════════════════════════════════════════════════════════╗" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "║ MANUAL TEST: AUTHORITY #2 (Supabase CLI)                                      ║" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "╚════════════════════════════════════════════════════════════════════════════════╝" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "Test: Developer Supabase CLI → Production Mutation" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "Result: [PASS/FAIL]" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "Details: [Describe what happened]" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
echo "" >> evidence/g3a-architecture/R3_VERIFICATION_RESULTS.txt
```

---

## Next Step

After completing this test, proceed to **R3 Step 6: Authority #3 (SERVICE_ROLE_KEY)**
