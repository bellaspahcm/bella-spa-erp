# P3.1 Runtime Verification Checklist

**Product:** Bella Preschool  
**Phase:** P3.1 Student & Guardian Management UI  
**Status:** 🟡 IN PROGRESS  
**Date:** 2026-09-07

---

## Prerequisites

- [x] Dev server started (`npm run dev` → http://localhost:3000)
- [x] Supabase linked (`npx supabase db push --linked --include-all`)
- [x] Primary guardian DB constraint verified
- [x] Schema drift fixed (relationship types aligned)
- [ ] Real auth enabled (Tenant A/B test users)
- [ ] Test data setup

---

## Verification Workflow

### Phase 1: Authentication & Navigation

- [ ] **AUTH-01:** Login as Tenant A user
- [ ] **AUTH-02:** Navigate to `/preschool` → layout renders
- [ ] **AUTH-03:** PreschoolNav shows "Students" link
- [ ] **AUTH-04:** Navigate to `/preschool/students` → list page loads

---

### Phase 2: Student CRUD

#### Create Student
- [ ] **STU-01:** Click "Add Student" → form renders
- [ ] **STU-02:** Fill form:
  - First Name: "Alice"
  - Last Name: "Nguyen"
  - Date of Birth: 2021-05-15
  - Gender: Female
  - Enrollment Status: Active
- [ ] **STU-03:** Submit → success toast
- [ ] **STU-04:** Redirect to `/preschool/students/[id]` → profile page renders
- [ ] **STU-05:** Reload page → data persists (DB read-back)

#### Read Student
- [ ] **STU-06:** Navigate to `/preschool/students` → Alice appears in list
- [ ] **STU-07:** Click Alice → profile page shows correct data
- [ ] **STU-08:** All fields match submitted values

#### Update Student
- [ ] **STU-09:** Click "Edit" → edit page renders with pre-filled form
- [ ] **STU-10:** Change Last Name to "Tran"
- [ ] **STU-11:** Submit → success toast
- [ ] **STU-12:** Redirect to profile → Last Name = "Tran"
- [ ] **STU-13:** Reload page → change persists

#### Search/Filter (if implemented)
- [ ] **STU-14:** Return to `/preschool/students`
- [ ] **STU-15:** Search "Tran" → Alice appears
- [ ] **STU-16:** Search "xyz" → no results

---

### Phase 3: Guardian Management

#### Link Existing Customer as Guardian
- [ ] **GUA-01:** On Alice's profile, click "Add Guardian"
- [ ] **GUA-02:** Dialog opens with customer search
- [ ] **GUA-03:** Search existing customer (e.g., email/name)
- [ ] **GUA-04:** Select customer from results
- [ ] **GUA-05:** Set relationship: "Parent"
- [ ] **GUA-06:** Set "Primary Contact": true
- [ ] **GUA-07:** Set "Pickup Authorized": true
- [ ] **GUA-08:** Set "Emergency Contact": true
- [ ] **GUA-09:** Submit → success toast
- [ ] **GUA-10:** Guardian appears in "Guardians" section with correct metadata

#### Primary Guardian Invariant
- [ ] **GUA-11:** Add second guardian (different customer)
- [ ] **GUA-12:** Set relationship: "Grandparent"
- [ ] **GUA-13:** Attempt to set "Primary Contact": true
- [ ] **GUA-14:** Submit → **should fail with DB constraint violation**
- [ ] **GUA-15:** Unset "Primary Contact" → Submit succeeds
- [ ] **GUA-16:** Only ONE guardian shows "Primary Contact" badge

#### Edit Guardian Relationship
- [ ] **GUA-17:** Click "Edit" on second guardian
- [ ] **GUA-18:** Change relationship to "Guardian"
- [ ] **GUA-19:** Toggle "Pickup Authorized" to false
- [ ] **GUA-20:** Submit → success toast
- [ ] **GUA-21:** Reload page → changes persist
- [ ] **GUA-22:** Second guardian shows updated metadata

#### Unlink Guardian (Preserve Customer)
- [ ] **GUA-23:** Click "Remove" on second guardian
- [ ] **GUA-24:** Confirm dialog appears
- [ ] **GUA-25:** Confirm → guardian removed from list
- [ ] **GUA-26:** Reload page → guardian still removed
- [ ] **GUA-27:** Navigate to Customers module
- [ ] **GUA-28:** Search removed guardian by email/name
- [ ] **GUA-29:** **Customer still exists** (not deleted, only unlinked)

---

### Phase 4: Tenant Isolation (RLS Enforcement)

- [ ] **TEN-01:** Note Alice's student ID
- [ ] **TEN-02:** Note primary guardian relationship ID
- [ ] **TEN-03:** Logout from Tenant A
- [ ] **TEN-04:** Login as Tenant B user
- [ ] **TEN-05:** Navigate to `/preschool/students`
- [ ] **TEN-06:** Alice does NOT appear in Tenant B's list
- [ ] **TEN-07:** Attempt to navigate to `/preschool/students/[alice-id]` directly
- [ ] **TEN-08:** **Should fail:** 403 Forbidden OR redirect to 404/unauthorized
- [ ] **TEN-09:** Verify via SQL query:
  ```sql
  SELECT * FROM preschool_students WHERE id = '[alice-id]';
  -- Should return 0 rows when executed with Tenant B JWT
  ```
- [ ] **TEN-10:** Verify guardian relationship isolation:
  ```sql
  SELECT * FROM preschool_student_guardians WHERE student_id = '[alice-id]';
  -- Should return 0 rows when executed with Tenant B JWT
  ```

---

### Phase 5: Edge Cases & Error Handling

#### Required Field Validation
- [ ] **ERR-01:** Create student with empty First Name → validation error
- [ ] **ERR-02:** Create student with invalid Date of Birth (future date) → error
- [ ] **ERR-03:** Form shows inline validation messages

#### Guardian Search - No Results
- [ ] **ERR-04:** Search for non-existent customer email → "No results" message
- [ ] **ERR-05:** Dialog allows retry without closing

#### Concurrent Primary Guardian (DB Constraint Test)
- [ ] **ERR-06:** Open two browser tabs with same student profile
- [ ] **ERR-07:** Tab 1: Edit Guardian A → set Primary = true → Submit
- [ ] **ERR-08:** Tab 2: Edit Guardian B → set Primary = true → Submit
- [ ] **ERR-09:** **Second submit should fail with DB constraint error**
- [ ] **ERR-10:** Reload → only Guardian A is primary

---

## Evidence Collection

### Screenshots
- [ ] Student list page (with data)
- [ ] Student profile page
- [ ] Guardian section with primary badge
- [ ] Add Guardian dialog
- [ ] Edit Guardian dialog
- [ ] Tenant B unauthorized access (404/403)

### SQL Verification
- [ ] Export final `preschool_students` table state (Tenant A)
- [ ] Export final `preschool_student_guardians` table state (Tenant A)
- [ ] Verify primary guardian constraint:
  ```sql
  SELECT student_id, COUNT(*) 
  FROM preschool_student_guardians 
  WHERE is_primary_contact = true 
  GROUP BY student_id 
  HAVING COUNT(*) > 1;
  -- Should return 0 rows
  ```

### Performance Metrics
- [ ] Student list page load time: _____ ms
- [ ] Profile page load time: _____ ms
- [ ] Create student operation: _____ ms
- [ ] Link guardian operation: _____ ms

---

## Pass Criteria

✅ **ALL items checked** = P3.1 Behavioral Verification PASS

Minimum requirements:
- Student CRUD works (create → persist → read → update → persist)
- Guardian link/unlink works
- Primary guardian invariant enforced by DB
- Customer preserved after guardian unlink
- Tenant A cannot access Tenant B data (RLS enforced)
- No unhandled errors in UI
- All navigation flows work

---

## Failure Handling

If ANY item fails:
1. **Document failure** (screenshot + error message + SQL state)
2. **Classify severity:**
   - 🔴 CRITICAL: Data loss, security breach, RLS failure
   - 🟡 MODERATE: UI error, validation missing, performance issue
   - 🟢 MINOR: Cosmetic, non-blocking
3. **Fix critical failures immediately**
4. **Re-verify failed items**
5. **Do NOT proceed to P3.2 until all critical failures resolved**

---

## Sign-off

- [ ] **All verification items completed**
- [ ] **Evidence collected (screenshots + SQL)**
- [ ] **No critical failures remaining**
- [ ] **Tenant isolation verified**
- [ ] **Primary guardian invariant verified**

**Verified by:** _____________  
**Date:** _____________  
**Status:** ⏳ PENDING

---

**Next:** After PASS → Update CONSTRUCTION_EVIDENCE.md → Mark P3.1 as ✅ VERIFIED (subject to Platform build blocker) → Proceed to P3.2
