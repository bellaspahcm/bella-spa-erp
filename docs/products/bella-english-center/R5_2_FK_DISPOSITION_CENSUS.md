# R5.2 FOREIGN KEY DISPOSITION CENSUS

**Date:** 2026-09-12  
**Method:** Query actual migration files for `REFERENCES persons(id)`  
**Total FK Tables Found:** 4

---

## 📋 FK CENSUS RESULTS

### Search Method

```bash
grep -r "REFERENCES\s+(public\.)?persons\(id\)" supabase/migrations/**/*.sql
```

### Tables with FK → `persons(id)`

**Total:** 4 tables

1. **students** (`person_id`)
2. **p41_medication_authorizations** (`authorized_by_guardian_id`, `revoked_by`)
3. **p41_medication_logs** (`actor_id`)
4. **p41_safety_incident_logs** (`actor_id`)

---

## 🔍 DETAILED DISPOSITION

### Table #1: `students`

**FK Column:** `person_id UUID NOT NULL`

**Constraint:**
```sql
CONSTRAINT students_person_fk FOREIGN KEY (person_id) 
  REFERENCES public.persons(id) ON DELETE CASCADE
```

**Migration:** `20260810224417_create_students_table.sql`

**Current Status:** MIGRATED TO PARTY ✅

**Evidence:**
- R2: Party FK added (`party_id UUID NOT NULL`)
- R3: 631 students migrated, `person_id` backfilled
- R4: Production code migrated to use `party_id`

**Disposition:** ✅ **MIGRATE_TO_PARTY COMPLETE**

**Legacy Compatibility:** `person_id` retained as backfill reference (non-canonical).

---

### Table #2: `p41_medication_authorizations`

**FK Columns:**
- `authorized_by_guardian_id UUID NOT NULL` → `persons(id)`
- `revoked_by UUID` → `persons(id)`

**Constraint:**
```sql
authorized_by_guardian_id UUID NOT NULL REFERENCES public.persons(id),
revoked_by UUID REFERENCES public.persons(id)
```

**Migration:** `20260909000051_p41_safety_critical.sql`

**Domain:** Preschool (P41 Safety-Critical)

**Disposition:** 🟡 **OUT OF SCOPE** (Education vertical only)

**Rationale:**
- This is Bella Preschool Product (`p41_` prefix)
- E0.1A-R remediation scope: Bella English Center (Education OS)
- Different product vertical = separate migration track

**Action:** NONE (not in Education scope)

---

### Table #3: `p41_medication_logs`

**FK Column:** `actor_id UUID NOT NULL` → `persons(id)`

**Constraint:**
```sql
actor_id UUID NOT NULL REFERENCES public.persons(id)
```

**Migration:** `20260909000051_p41_safety_critical.sql`

**Domain:** Preschool (P41 Safety-Critical)

**Disposition:** 🟡 **OUT OF SCOPE** (Education vertical only)

**Rationale:** Same as Table #2 (Preschool product, not Education)

**Action:** NONE (not in Education scope)

---

### Table #4: `p41_safety_incident_logs`

**FK Column:** `actor_id UUID NOT NULL` → `persons(id)`

**Constraint:**
```sql
actor_id UUID NOT NULL REFERENCES public.persons(id)
```

**Migration:** `20260909000051_p41_safety_critical.sql`

**Domain:** Preschool (P41 Safety-Critical)

**Disposition:** 🟡 **OUT OF SCOPE** (Education vertical only)

**Rationale:** Same as Table #2 (Preschool product, not Education)

**Action:** NONE (not in Education scope)

---

## 📊 DISPOSITION SUMMARY

```text
Total FK tables found:          4

EDUCATION VERTICAL:
  students                      ✅ MIGRATED (R2-R4 complete)

PRESCHOOL VERTICAL (OUT OF SCOPE):
  p41_medication_authorizations 🟡 Preschool Product
  p41_medication_logs           🟡 Preschool Product
  p41_safety_incident_logs      🟡 Preschool Product

EDUCATION REMAINING:            0 ✅
```

---

## ✅ R5.2 EXIT CRITERIA

```text
FK census method:               ✅ Query actual schema (migrations)
Assumed FK list:                ❌ AVOIDED (queried ground truth)
Total FK tables found:          4
Education FK tables:            1 (students)
Education remaining:            0 ✅
Preschool FK tables:            3 (out of scope)
Unknown FK tables:              0 ✅

Denominator exact:              ✅ YES
Census complete:                ✅ YES
```

---

## 🎯 FINDING: EDUCATION SCOPE COMPLETE

**Critical Discovery:** Only `students` table has FK to `persons(id)` within Education vertical.

**Status:** Already migrated to Party (R2-R4 complete).

**Remaining `persons` FKs:** 3 tables, all Preschool Product (P41 prefix), out of Education scope.

---

## 🚦 IMPLICATIONS FOR R5.3

**Original R5.3 Plan:** Compatibility bridge deprecation
- `RegisterStudentInput.personId`
- `students.person_id`
- Person-based Education helpers

**Updated Assessment:**

Since Education has only 1 FK table (`students`) and it's already migrated:

**R5.3 Should Focus:**
1. Deprecate `RegisterStudentInput.personId` (compatibility parameter)
2. Document `students.person_id` as legacy backfill (non-canonical)
3. Verify zero Education production code creates new Person records (R5.1 already proved this)

**R5.3 Complexity:** LOW (single table, already migrated)

---

## 📁 EVIDENCE FILES

### Migrations Analyzed
- `supabase/migrations/20260810224417_create_students_table.sql`
- `supabase/migrations/20260810224418_migrate_students_to_platform_schema.sql`
- `supabase/migrations/20260909000051_p41_safety_critical.sql`

### Search Commands Used
```bash
# Find all FK to persons(id)
grep -r "REFERENCES\s+(public\.)?persons\(id\)" supabase/migrations/**/*.sql

# Find all person_id columns
grep -r "person_id\s+(UUID|uuid)" supabase/migrations/**/*.sql
```

---

## 🔐 R5.2 STATUS

**Status:** ✅ COMPLETE

**Denominator:** 4 FK tables total
- 1 Education (students) — ✅ MIGRATED
- 3 Preschool (p41_*) — 🟡 OUT OF SCOPE

**Education Remaining:** 0

**Proceed:** R5.3 Compatibility Bridge Deprecation

---

**R5.2 Complete. FK census from actual schema: Education has zero remaining Person FK migrations.**
