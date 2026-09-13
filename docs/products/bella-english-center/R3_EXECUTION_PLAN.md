---
remediation_id: E0.1A-R
phase: R3_EDUCATION_CUTOVER
status: authorized_pending_execution
created: 2026-09-12
requires: service_role_or_migration_deployment
---

# R3 EDUCATION CUTOVER — EXECUTION PLAN

> **Status:** 🟢 AUTHORIZED (Database migration pending proper deployment)  
> **Requires:** Service role permissions or migration deployment

---

## ⚠️ EXECUTION BLOCKER

**Current Issue:** ALTER TABLE requires elevated permissions

```text
Error: must be owner of table students
Cause: DATABASE_EXECUTOR_URL lacks ALTER TABLE permission
Solution: Execute via Supabase migration or service role
```

---

## 📋 R3 STAGED CUTOVER SEQUENCE

### R3.1 — ADD students.party_id (NULLABLE)

```sql
ALTER TABLE students ADD COLUMN party_id UUID;
```

**Status:** ⏸️ PENDING EXECUTION  
**Risk:** LOW (additive only, nullable)  
**Rollback:** DROP COLUMN party_id

---

### R3.2 — BACKFILL party_id

```sql
UPDATE students s
SET party_id = m.party_id
FROM identity_migration_mapping m
WHERE s.person_id = m.person_id
  AND s.party_id IS NULL;  -- Idempotent
```

**Expected:** 631 students updated  
**Status:** ⏸️ PENDING R3.1  
**Risk:** LOW (idempotent, uses sealed mapping)

---

### R3.3 — VERIFY Mappings

```sql
SELECT 
  COUNT(*) as total_students,
  COUNT(party_id) as with_party_id,
  COUNT(*) FILTER (WHERE party_id IS NULL) as missing_party_id
FROM students;
```

**Expected:**
- total_students: 631
- with_party_id: 631
- missing_party_id: 0

**Status:** ⏸️ PENDING R3.2

---

### R3.4 — ADD FK Constraint

```sql
ALTER TABLE students
ADD CONSTRAINT students_party_id_fkey
FOREIGN KEY (party_id) REFERENCES party_parties(id);
```

**Status:** ⏸️ PENDING R3.3 PASS  
**Risk:** MEDIUM (referential integrity)  
**Rollback:** DROP CONSTRAINT students_party_id_fkey

---

### R3.5 — StudentService Code Changes

**File:** `src/platform/education/student/student.service.ts`

**BEFORE:**
```typescript
// Validates Person
const person = await personRepo.findById(request.personId, request.tenantId);
if (!person) {
  throw new Error('Person does not exist');
}

await supabase.from('students').insert({
  person_id: request.personId,
  // ...
});
```

**AFTER:**
```typescript
// Validates Party
const party = await partyRepo.findById(request.partyId, request.tenantId);
if (!party || party.partyType !== 'person') {
  throw new Error('Party does not exist or is not a person');
}

await supabase.from('students').insert({
  person_id: request.partyId, // Compatibility (optional)
  party_id: request.partyId,  // New authoritative
  // ...
});
```

**Status:** ⏸️ PENDING R3.4 PASS  
**Risk:** MEDIUM (breaking change if not coordinated)

---

### R3.6 — Contract Implementation Fix

**File:** `src/platform/education/contracts/student.contract.impl.ts`

**BEFORE:**
```typescript
const student = await StudentService.createStudent({
  tenantId: input.tenantId,
  personId: input.partyId, // ⚠️ Semantic mismatch
  // ...
});
```

**AFTER:**
```typescript
const student = await StudentService.createStudent({
  tenantId: input.tenantId,
  partyId: input.partyId, // ✅ Semantic correct
  // ...
});
```

**Status:** ⏸️ PENDING R3.5  
**Risk:** LOW (semantic fix, no DB change)

---

### R3.7 — Integration Tests

**Run:** 
```bash
npm run test -- src/platform/education/student/
npm run test -- src/platform/education/enrollment/
```

**Expected:** All tests PASS with Party validation

**Status:** ⏸️ PENDING R3.6

---

### R3.8 — Make party_id Authoritative

**Option A:** NOT NULL constraint (immediate)
```sql
ALTER TABLE students ALTER COLUMN party_id SET NOT NULL;
```

**Option B:** Defer to R6 (after full verification)

**Recommendation:** DEFER to R6 (safer)

**Status:** ⏸️ DEFERRED to R6

---

## ✅ R3 PASS CRITERIA

```text
students with person_id (legacy):     631
students with party_id (new):         631
missing party_id:                     0
invalid Party FK:                     0
orphan party refs:                    0
tenant mismatch:                      0
party_type != 'person':               0

Contract semantic mismatch:           0
StudentService Person validation:     REMOVED
StudentService Party validation:      ADDED

Integration tests:                    ALL PASS
New student creation:                 uses Party (NOT Person)
```

---

## 🔴 EXECUTION REQUIREMENTS

### Prerequisites

1. ✅ R2 sealed (848 parties)
2. ✅ R2V passed (structural + semantic)
3. ⏸️ Service role database access OR
4. ⏸️ Supabase migration deployment

### Deployment Coordination

```text
1. Deploy DB migration (R3.1–R3.4)
2. Verify DB migration success
3. Deploy application code (R3.5–R3.6)
4. Run integration tests (R3.7)
5. Monitor for errors
6. Proceed to R4 if R3 PASS
```

### Rollback Plan

```sql
-- If R3 fails before R4:
BEGIN;
  -- Remove FK
  ALTER TABLE students DROP CONSTRAINT IF EXISTS students_party_id_fkey;
  
  -- Remove column
  ALTER TABLE students DROP COLUMN IF EXISTS party_id;
  
  -- Revert application code (git revert + redeploy)
COMMIT;
```

---

## 📊 CURRENT STATUS

```text
R0 PREFLIGHT                      ✅ COMPLETE
R1 IDENTITY MAPPING               ✅ SEALED
R2 PARTY BACKFILL                 ✅ COMPLETE
R2V VERIFICATION                  ✅ PASS
R2 EVIDENCE                       🔒 SEALED

R3 EDUCATION CUTOVER              🟢 AUTHORIZED
  R3.1 ADD party_id               ⏸️ PENDING DEPLOYMENT
  R3.2 BACKFILL                   ⏸️ PENDING R3.1
  R3.3 VERIFY                     ⏸️ PENDING R3.2
  R3.4 ADD FK                     ⏸️ PENDING R3.3
  R3.5 StudentService             ⏸️ PENDING R3.4
  R3.6 Contract Fix               ⏸️ PENDING R3.5
  R3.7 Tests                      ⏸️ PENDING R3.6
  R3.8 Authoritative              ⏸️ DEFERRED R6

R4 CALLER MIGRATION               🚫 BLOCKED (wait R3 PASS)
```

---

## 📋 NEXT STEPS

1. **Deploy R3 Database Migration**
   - Via Supabase Dashboard → SQL Editor (service role)
   - Or create Supabase migration file
   - Or execute with elevated permissions

2. **Verify Database Changes**
   - Run verification queries
   - Confirm 631/631 students have party_id
   - Confirm FK integrity

3. **Deploy Application Code**
   - StudentService changes
   - Contract implementation fix
   - Coordinated deployment

4. **Run Tests**
   - Integration tests
   - Negative tests (new student → Party)
   - Education regression

5. **Proceed to R4**
   - Only after R3 PASS
   - Update 8 test fixtures
   - Update 40+ E2E/integration tests

---

**R3 STATUS:** 🟢 AUTHORIZED, ⏸️ PENDING PROPER DEPLOYMENT

**BLOCKER:** Database permissions (requires service role or migration)

**RECOMMENDATION:** Deploy via Supabase migration or service role access
