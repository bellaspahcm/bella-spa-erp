# P3.1 DB Constraint Verification — REQUIRED GATE

**Status:** 🟡 PENDING EXECUTION  
**Date Created:** September 7, 2026  
**Blocker:** P3.1 cannot proceed to runtime verification until this gate passes

---

## Context

P3.1 Student & Guardian Management implementation complete with one critical blocker:

**Business invariant:** Each student can have at most ONE primary guardian

**Current state:**
- ✅ Implementation complete (11 files, ~1,760 LOC)
- ✅ Build/type verification PASS
- ✅ Migration created: `20260907000001_add_primary_guardian_constraint.sql`
- ⏳ Migration NOT YET APPLIED
- ⏳ Constraint NOT YET VERIFIED

**Why this gates P3.1:**

Without DB-level enforcement, the primary guardian invariant relies on application logic:
```typescript
// Update others to false
await supabase.update({ is_primary_contact: false }).eq('student_id', studentId);

// Then insert new primary
await supabase.insert({ is_primary_contact: true, ... });
```

**Race condition risk:** Two concurrent requests can both become primary if they execute between the same window.

**Factory Test #4 learning:**
> Invariant enforcement must be verified at DB level BEFORE behavioral testing. Not after production deployment.

---

## Required Actions

### 1. Apply Migration

```bash
# Start Supabase
docker-compose up -d
# or
supabase start

# Apply migration
supabase migration up
# or manually:
psql -U postgres -d postgres -f supabase/migrations/20260907000001_add_primary_guardian_constraint.sql
```

### 2. Run Verification Script

```bash
npx tsx scripts/verify-primary-guardian-constraint.ts
```

**Expected output:**
```
🔍 Verifying Primary Guardian Constraint...

1️⃣ Creating test tenant...
✅ Tenant created: {id}

2️⃣ Creating test student...
✅ Student created: {id}

3️⃣ Creating test customers...
✅ Created 2 customers

4️⃣ Adding first primary guardian...
✅ First primary guardian added: {id}

5️⃣ Attempting to add second primary guardian (should fail)...
✅ CONSTRAINT ENFORCED: Duplicate primary guardian rejected
   Error: duplicate key value violates unique constraint "preschool_student_guardians_one_primary_per_student"

6️⃣ Verifying only one primary guardian exists...
✅ VERIFIED: Exactly ONE primary guardian exists

7️⃣ Unsetting first primary, adding second...
✅ Second primary guardian added successfully after unsetting first

8️⃣ Final verification...
✅ FINAL VERIFICATION PASSED: Still only ONE primary guardian

9️⃣ Cleaning up test data...
✅ Cleanup complete

═══════════════════════════════════════
✅ PRIMARY GUARDIAN CONSTRAINT VERIFIED
═══════════════════════════════════════

✅ Constraint prevents duplicate primary guardians
✅ Invariant enforced at DB level
✅ Application can safely rely on ONE primary per student
```

### 3. Document Evidence

Capture verification output and update `CONSTRUCTION_EVIDENCE.md`:

```markdown
## DB Invariant Verification

**Date:** {timestamp}
**Migration:** 20260907000001_add_primary_guardian_constraint.sql
**Status:** ✅ VERIFIED

**Test results:**
- ✅ Duplicate primary guardian rejected by DB
- ✅ Only ONE primary exists after all operations
- ✅ Constraint allows sequential primary updates (unset → set new)

**Evidence:** {link to screenshot or log file}
```

---

## Acceptance Criteria

### ✅ PASS Conditions

- [ ] Migration applied without errors
- [ ] Verification script completes successfully
- [ ] Test #5 (duplicate primary) FAILS with constraint error
- [ ] Only ONE primary guardian exists after all operations
- [ ] Sequential update (unset → set new) succeeds
- [ ] Final verification confirms invariant

### ❌ FAIL Conditions

- [ ] Migration fails
- [ ] Duplicate primary NOT rejected
- [ ] Multiple primary guardians exist
- [ ] Constraint blocks legitimate operations

---

## If Verification PASSES

**Update CONSTRUCTION_EVIDENCE.md:**
```markdown
**DB invariant enforcement:** ✅ VERIFIED
**P3.1 Status:** 🟢 READY FOR RUNTIME VERIFICATION
```

**Next steps:**
1. Setup test data: `npx tsx scripts/preschool-p3-1-setup-test-data.ts`
2. Manual verification: Follow `P3_1_RUNTIME_VERIFICATION_CHECKLIST.md`
3. Automated tests
4. Evidence collection
5. P3.1 closure

---

## If Verification FAILS

**Classify failure:**

### Migration Error
- Review migration SQL syntax
- Check DB connectivity
- Verify column names match schema

### Constraint Not Working
- Investigate: Why duplicate primary allowed?
- Check WHERE clause syntax
- Verify Postgres version supports partial unique indexes

### Blocking Legitimate Operations
- Review constraint logic
- May need to adjust implementation
- Document trade-offs

**Do NOT proceed to runtime verification until constraint verified.**

---

## Manual Verification (Alternative)

If script cannot run due to environment issues, manual verification:

```sql
-- 1. Apply migration
\i supabase/migrations/20260907000001_add_primary_guardian_constraint.sql

-- 2. Create test data
INSERT INTO preschool_students (tenant_id, student_code, first_name, last_name, date_of_birth)
VALUES ('{tenant-id}', 'TEST001', 'Test', 'Student', '2020-01-01')
RETURNING id;
-- Save student_id

-- 3. Create test customers
INSERT INTO customers (tenant_id, name_mother, phone)
VALUES 
  ('{tenant-id}', 'Guardian One', '+1-555-0001'),
  ('{tenant-id}', 'Guardian Two', '+1-555-0002')
RETURNING id;
-- Save customer_id_1, customer_id_2

-- 4. Add first primary guardian (should succeed)
INSERT INTO preschool_student_guardians (
  tenant_id, student_id, guardian_customer_id, 
  relationship_type, is_primary_contact
)
VALUES ('{tenant-id}', '{student-id}', '{customer-id-1}', 'mother', true);
-- Expected: SUCCESS

-- 5. Try to add second primary (should FAIL)
INSERT INTO preschool_student_guardians (
  tenant_id, student_id, guardian_customer_id, 
  relationship_type, is_primary_contact
)
VALUES ('{tenant-id}', '{student-id}', '{customer-id-2}', 'father', true);
-- Expected: ERROR - duplicate key violates constraint

-- 6. Verify only one primary
SELECT COUNT(*) FROM preschool_student_guardians
WHERE student_id = '{student-id}' AND is_primary_contact = true;
-- Expected: 1

-- 7. Update first to non-primary
UPDATE preschool_student_guardians
SET is_primary_contact = false
WHERE student_id = '{student-id}' AND guardian_customer_id = '{customer-id-1}';

-- 8. Now add second as primary (should succeed)
INSERT INTO preschool_student_guardians (
  tenant_id, student_id, guardian_customer_id, 
  relationship_type, is_primary_contact
)
VALUES ('{tenant-id}', '{student-id}', '{customer-id-2}', 'father', true);
-- Expected: SUCCESS

-- 9. Final verification
SELECT COUNT(*) FROM preschool_student_guardians
WHERE student_id = '{student-id}' AND is_primary_contact = true;
-- Expected: 1 (only second guardian now)
```

---

## Sign-Off

**Verified by:** `_______________`  
**Date:** `_______________`  
**Result:** ☐ PASS / ☐ FAIL

**Evidence:**
- [ ] Migration applied successfully
- [ ] Verification script output captured
- [ ] SQL query results (manual verification)
- [ ] Screenshot/log file stored

**Next action:**
- [ ] Unblock P3.1 runtime verification (if PASS)
- [ ] Fix constraint (if FAIL)

---

**This gate MUST pass before P3.1 can proceed to runtime verification.**
