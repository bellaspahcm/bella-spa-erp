---
remediation_id: E0.1A-R
phase: R0_PREFLIGHT
title: Identity Migration Preflight
owner: platform-core-team
created: 2026-09-12
status: in_progress
purpose: census_and_strategy_before_migration
blocker_for: E0.1A-R_MIGRATION
---

# E0.1A-R0 — IDENTITY MIGRATION PREFLIGHT

> **Purpose:** Census existing identity data, detect conflicts, freeze migration strategy BEFORE touching database.

---

## 🎯 PREFLIGHT MISSION

**DO NOT migrate blindly.**

**Before touching database:**
1. Census all Person records
2. Census all Party records
3. Detect UUID collisions
4. Detect same-human duplicates
5. Trace every Person FK
6. Trace every Party consumer
7. Audit registerStudent callers
8. **Freeze migration strategy per record**

**Output:** Migration execution plan with deterministic outcomes.

---

## 📊 R0.1 — CENSUS PERSONS

### Query

```sql
-- Count persons records
SELECT COUNT(*) AS total_persons FROM persons;

-- Sample persons structure
SELECT 
  id,
  tenant_id,
  first_name,
  last_name,
  full_name,
  date_of_birth,
  email,
  phone,
  created_at,
  updated_at
FROM persons
LIMIT 10;

-- Persons by tenant
SELECT 
  tenant_id,
  COUNT(*) AS person_count
FROM persons
GROUP BY tenant_id
ORDER BY person_count DESC;

-- Persons with missing critical fields
SELECT COUNT(*) AS missing_name
FROM persons
WHERE full_name IS NULL AND (first_name IS NULL OR last_name IS NULL);

SELECT COUNT(*) AS missing_dob
FROM persons
WHERE date_of_birth IS NULL;
```

### Expected Output

```text
Total Persons:                    [X]
Tenants with Persons:             [Y]
Largest Tenant Person Count:      [Z]
Persons Missing Name:             [N]
Persons Missing DOB:              [M]
```

**Decision Point:** If missing critical fields > 5%, require data cleanup before migration.

---

## 📊 R0.2 — CENSUS PARTY_PARTIES

### Query

```sql
-- Count party_parties records
SELECT COUNT(*) AS total_parties FROM party_parties;

-- Sample party structure
SELECT 
  id,
  tenant_id,
  type,
  display_name,
  created_at,
  updated_at
FROM party_parties
LIMIT 10;

-- Parties by type
SELECT 
  type,
  COUNT(*) AS party_count
FROM party_parties
GROUP BY type
ORDER BY party_count DESC;

-- Parties by tenant
SELECT 
  tenant_id,
  COUNT(*) AS party_count
FROM party_parties
GROUP BY tenant_id
ORDER BY party_count DESC;
```

### Expected Output

```text
Total Parties:                    [X]
Party Types:                      [individual, organization, ...]
Tenants with Parties:             [Y]
Individual Parties:               [N]
Organization Parties:             [M]
```

---

## 📊 R0.3 — DETECT UUID COLLISIONS

### Query

```sql
-- Check for same UUID in both tables
SELECT 
  p.id,
  p.tenant_id AS person_tenant,
  pp.tenant_id AS party_tenant,
  p.full_name AS person_name,
  pp.display_name AS party_name
FROM persons p
INNER JOIN party_parties pp ON p.id = pp.id;
```

### Expected Output

```text
UUID Collisions:                  [X rows]

IF X > 0:
  ❌ CONFLICT: Same UUID in persons + party_parties
  ACTION REQUIRED: Resolve collision before migration
  
  Options:
    1. Generate new UUIDs for persons (risky, breaks FKs)
    2. Generate new UUIDs for parties (safer if parties are new)
    3. Deterministic resolution: persons UUID wins, remap parties

IF X = 0:
  ✅ SAFE: No UUID collisions detected
  ACTION: Proceed with migration
```

**Decision:** If collisions found, BLOCK migration until resolved.

---

## 📊 R0.4 — DETECT SAME-HUMAN DUPLICATES

### Query

```sql
-- Detect probable same-human records (fuzzy match)
WITH person_normalized AS (
  SELECT 
    id,
    tenant_id,
    LOWER(TRIM(full_name)) AS name_normalized,
    date_of_birth,
    LOWER(TRIM(email)) AS email_normalized
  FROM persons
),
party_normalized AS (
  SELECT 
    id,
    tenant_id,
    LOWER(TRIM(display_name)) AS name_normalized,
    -- Assuming party has contact info in separate table
    NULL AS email_normalized  -- TODO: join party_contacts if exists
  FROM party_parties
  WHERE type = 'individual'
)
SELECT 
  pn.id AS person_id,
  pn.name_normalized AS person_name,
  pp.id AS party_id,
  pp.name_normalized AS party_name,
  pn.tenant_id
FROM person_normalized pn
INNER JOIN party_normalized pp 
  ON pn.tenant_id = pp.tenant_id
  AND pn.name_normalized = pp.name_normalized
  AND (pn.email_normalized = pp.email_normalized OR pn.email_normalized IS NULL);
```

### Expected Output

```text
Probable Same-Human Matches:      [X rows]

IF X > 0:
  ⚠️ AMBIGUOUS: Same person may exist in both tables
  ACTION REQUIRED: Manual review + merge strategy
  
  Strategy Options:
    1. REUSE Party (link Person → existing Party)
    2. CREATE Party (Person has no Party equivalent)
    3. REVIEW (unclear, manual decision)

IF X = 0:
  ✅ SAFE: No duplicates detected
  ACTION: Create new Party for each Person
```

**Decision:** If ambiguous matches > 10, require manual review.

---

## 📊 R0.5 — TRACE EVERY PERSONS FK

### Query

```sql
-- Find all tables with person_id FK
SELECT 
  tc.table_name,
  kcu.column_name,
  COUNT(*) AS fk_count
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name LIKE '%person_id%'
GROUP BY tc.table_name, kcu.column_name
ORDER BY fk_count DESC;

-- Verify students.person_id
SELECT COUNT(*) AS students_with_person_id
FROM students
WHERE person_id IS NOT NULL;

-- Check for other person_id references
-- (Add queries for each table found above)
```

### Expected Output

```text
Tables with person_id FK:         [students, guardians?, teachers?, ...]
Students with person_id:          [X]
Other tables:                     [list]

CRITICAL: students.person_id must be migrated to party_id
REVIEW: Any other tables requiring migration
```

---

## 📊 R0.6 — TRACE EVERY PARTY CONSUMER

### Query

```sql
-- Find all tables with party_id FK
SELECT 
  tc.table_name,
  kcu.column_name,
  COUNT(*) AS fk_count
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name LIKE '%party_id%'
GROUP BY tc.table_name, kcu.column_name
ORDER BY fk_count DESC;

-- Verify no students.party_id exists yet
SELECT COUNT(*) AS students_with_party_id
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'party_id';
```

### Expected Output

```text
Tables with party_id FK:          [hc_patients, teacher_assignments?, ...]
Students.party_id exists:         NO (expected, not migrated yet)

Healthcare using Party:           ✅ YES
Real Estate using Party:          ✅ YES (verify)
Education using Person:           ⚠️ LEGACY (migration target)
```

---

## 📊 R0.7 — AUDIT REGISTERSTUDENT CALLERS

### Search

```bash
# Find all calls to registerStudent
grep -r "registerStudent" src/

# Find contract imports
grep -r "IEducationStudentContract" src/

# Find Person creation
grep -r "INSERT INTO persons" src/
grep -r "persons.create" src/
```

### Expected Output

```text
registerStudent Callers:
  - src/products/bella-preschool/student/student-registration.service.ts
  - src/platform/education/student/__tests__/student.integration.test.ts
  - [other callers...]

Contract Usage:
  - Preschool: ✅ Uses contract
  - Tests: ✅ Uses contract
  - Direct SQL: ❌ NONE (expected)

Person Writers:
  - StudentService (via registerStudent)
  - [legacy code?]
```

**Decision:** All callers must update from `personId` → `partyId` parameter.

---

## 📊 R0.8 — FREEZE MIGRATION STRATEGY

### Strategy Decision Tree

```text
FOR EACH Person record:

1. Check UUID collision
   ├─ Collision EXISTS
   │    └─ BLOCK: Resolve collision first
   │
   └─ No collision
        ↓
2. Check same-human match in Party
   ├─ Deterministic match (name + email + tenant)
   │    └─ STRATEGY: LINK (reuse existing Party)
   │
   ├─ No match
   │    └─ STRATEGY: CREATE (new Party from Person)
   │
   └─ Ambiguous match
        └─ STRATEGY: REVIEW (manual decision)
```

### Migration Strategies

**STRATEGY A: LINK (Reuse Existing Party)**
```sql
-- Person → existing Party
UPDATE students
SET party_id = [existing_party_id]
WHERE person_id = [person_id];

-- Mark Person as migrated (don't delete yet)
UPDATE persons
SET migrated_to_party_id = [party_id],
    migrated_at = NOW()
WHERE id = [person_id];
```

**STRATEGY B: CREATE (New Party from Person)**
```sql
-- Create Party from Person
INSERT INTO party_parties (id, tenant_id, type, display_name, created_at, updated_at)
SELECT 
  id,  -- SAME UUID as Person
  tenant_id,
  'individual',
  full_name,
  created_at,
  updated_at
FROM persons
WHERE id = [person_id];

-- Update students to use new Party
UPDATE students
SET party_id = [person_id]  -- Same UUID
WHERE person_id = [person_id];
```

**STRATEGY C: REVIEW (Manual Decision)**
```text
Export ambiguous cases to CSV:
  person_id, person_name, probable_party_id, party_name, tenant_id, confidence_score

Human reviews:
  ├─ Confirm match → LINK
  ├─ Not a match → CREATE
  └─ Merge required → MERGE (advanced case)
```

---

## ✅ PREFLIGHT COMPLETION CRITERIA

### R0 Complete When:

```text
✅ R0.1 Person census complete
✅ R0.2 Party census complete
✅ R0.3 UUID collisions detected (0 or resolved)
✅ R0.4 Same-human duplicates detected (strategy frozen)
✅ R0.5 Person FKs traced (students, guardians, teachers)
✅ R0.6 Party consumers traced (healthcare, real-estate)
✅ R0.7 registerStudent callers audited
✅ R0.8 Migration strategy frozen per record

Output Artifacts:
  ✅ R0_CENSUS_REPORT.md (data counts)
  ✅ R0_COLLISION_REPORT.md (if any)
  ✅ R0_DUPLICATE_REPORT.csv (ambiguous cases)
  ✅ R0_MIGRATION_STRATEGY.md (decision tree + record-level plan)
  ✅ R0_EXECUTION_PLAN.sql (automated migration script)
```

---

## 🚫 PREFLIGHT BLOCKERS

### DO NOT PROCEED TO MIGRATION IF:

```text
❌ UUID collisions > 0 (unresolved)
❌ Ambiguous duplicates > 10 (require review)
❌ Missing critical fields > 5% (require cleanup)
❌ Person FK trace incomplete
❌ registerStudent callers not audited
❌ Migration strategy NOT frozen
```

---

## 🚀 AFTER PREFLIGHT

### Revised Migration Rollout Sequence:

```text
R0 PREFLIGHT (census + strategy freeze)
     ↓
R1 IDENTITY MAPPING (create mapping evidence table)
     ↓
R2 DATA MIGRATION (party backfill + identifiers)
     ↓
R3 KERNEL + CONTRACT CUTOVER (simultaneous)
   ├── students.person_id → party_id (DB schema)
   ├── StudentService implementation
   ├── IEducationStudentContract signature
   └── [NO intermediate broken state]
     ↓
R4 CALLER CUTOVER (Preschool + tests + fixtures)
     ↓
R5 FREEZE LEGACY PERSON WRITES (no new INSERT to persons)
     ↓
R6 VERIFICATION
   ├── FK integrity
   ├── Identity consistency
   ├── Education regression GREEN
   └── Preschool critical E2E GREEN
     ↓
R7 EVIDENCE SEAL (E0.1A-R CLOSED)
```

**CRITICAL:** R3 must be atomic. Cannot have DB using party_id while contract still passes personId.

### If Preflight FAILS:

```text
BLOCKERS IDENTIFIED
     ↓
RESOLVE BLOCKERS (collision, cleanup, review)
     ↓
RE-RUN PREFLIGHT
     ↓
PASS → PROCEED
```

---

## 📝 PREFLIGHT STATUS

```text
E0.1A-R0 IDENTITY MIGRATION PREFLIGHT

R0.1 Census Persons               ⏸️ NOT STARTED
R0.2 Census Parties               ⏸️ NOT STARTED
R0.3 Detect Collisions            ⏸️ NOT STARTED
R0.4 Detect Duplicates            ⏸️ NOT STARTED
R0.5 Trace Person FKs             ⏸️ NOT STARTED
R0.6 Trace Party Consumers        ⏸️ NOT STARTED
R0.7 Audit Callers                ⏸️ NOT STARTED
R0.8 Freeze Strategy              ⏸️ NOT STARTED

Status:                           🔴 IN PROGRESS
Blockers:                         TBD (after census)
Next Action:                      Execute R0.1 → R0.8
```

---

**CREATED:** 2026-09-12
**PHASE:** R0 Preflight (before migration)
**NEXT:** R1 Migration Execution (after preflight PASS)

