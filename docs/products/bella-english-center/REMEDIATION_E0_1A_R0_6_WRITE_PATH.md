---
remediation_id: E0.1A-R
phase: R0.6_WRITE_PATH_CENSUS
status: in_progress
created: 2026-09-12
blast_radius: platform_wide
---

# E0.1A-R0.6 — WRITE-PATH CENSUS

> **Purpose:** Identify ALL code paths that write to `persons` table before migration cutover.
> 
> **Critical:** Must find every INSERT/UPDATE/DELETE to persons, including indirect wrappers.

---

## 📋 R0.6 SCOPE

```text
R0.6.1  Direct database writes (SQL, RPC)
R0.6.2  Repository/Service methods
R0.6.3  API routes/handlers
R0.6.4  Test helpers/fixtures
R0.6.5  Migration/seed scripts
R0.6.6  Classify and assign cutover actions
```

---

## 🎯 SEARCH TARGETS

### Database Layer

```text
- INSERT INTO persons
- UPDATE persons SET
- DELETE FROM persons
- .from("persons").insert()
- .from("persons").update()
- supabase.from("persons")
- CREATE OR REPLACE FUNCTION ... persons
- RPC procedures touching persons
```

### Application Layer

```text
- PersonRepository.create()
- PersonRepository.update()
- PersonRepository.save()
- PersonService.create()
- PersonService.update()
- createPerson()
- updatePerson()
- savePerson()
- deletePerson()
```

### Test/Fixture Layer

```text
- tests/**/*person*.ts
- fixtures/*person*
- seed scripts
- factory methods
- test helpers
```

---

## 📊 CLASSIFICATION SCHEMA

Each write path must be classified:

| Attribute | Values |
|-----------|--------|
| **PATH** | File path + function/method |
| **OWNER** | Module/Team (Education, HR, RE, Platform) |
| **OPERATION** | CREATE \| UPDATE \| DELETE \| UPSERT |
| **ENVIRONMENT** | PRODUCTION \| TEST \| MIGRATION \| SEED |
| **LAYER** | DIRECT_DB \| REPOSITORY \| SERVICE \| API \| HELPER |
| **STATUS** | ACTIVE \| LEGACY \| DEAD_CODE |
| **CUTOVER_ACTION** | FREEZE \| MIGRATE_TO_PARTY \| DEPRECATE \| NO_ACTION |

---

## 🔍 R0.6.1 — DIRECT DATABASE WRITES

### Search Queries

```bash
# SQL files
grep -r "INSERT INTO persons" supabase/ database/ migrations/
grep -r "UPDATE persons" supabase/ database/ migrations/

# TypeScript database calls
grep -r "\.from\(['\"]persons['\"]" src/
grep -r "INSERT INTO persons" src/
grep -r "UPDATE persons" src/
```

### Expected Findings

```text
PATH: supabase/seed.sql
OPERATION: INSERT
ENVIRONMENT: SEED
LAYER: DIRECT_DB
STATUS: ACTIVE
CUTOVER_ACTION: MIGRATE_TO_PARTY

PATH: supabase/migrations/*_create_persons_table.sql
OPERATION: CREATE TABLE
ENVIRONMENT: MIGRATION
LAYER: DIRECT_DB
STATUS: ACTIVE
CUTOVER_ACTION: NO_ACTION (already executed)
```

---

## 🔍 R0.6.2 — REPOSITORY/SERVICE METHODS

### Search Queries

```bash
# Repository methods
grep -r "class.*PersonRepository" src/
grep -r "interface.*PersonRepository" src/

# Service methods
grep -r "class.*PersonService" src/
grep -r "createPerson\|updatePerson\|savePerson" src/
```

### Expected Pattern

```typescript
// Example: PersonRepository
class PersonRepository {
  async create(data: CreatePersonDTO): Promise<Person> {
    // INSERT INTO persons
  }
  
  async update(id: UUID, data: UpdatePersonDTO): Promise<Person> {
    // UPDATE persons
  }
  
  async delete(id: UUID): Promise<void> {
    // DELETE FROM persons
  }
}
```

---

## 🔍 R0.6.3 — API ROUTES/HANDLERS

### Search Queries

```bash
# API routes
grep -r "persons" src/app/api/
grep -r "persons" src/pages/api/

# Server actions
grep -r "createPerson\|updatePerson" src/app/
```

### Expected Findings

```text
PATH: src/app/api/persons/route.ts
OPERATION: CREATE
ENVIRONMENT: PRODUCTION
LAYER: API
STATUS: ACTIVE
CUTOVER_ACTION: FREEZE (no new Person writes after cutover)
```

---

## 🔍 R0.6.4 — TEST HELPERS/FIXTURES

### Search Queries

```bash
# Test files
grep -r "createPerson\|create.*person" tests/ e2e/ src/**/*.test.ts src/**/*.spec.ts

# Fixtures
grep -r "persons" tests/fixtures/ e2e/fixtures/
```

### Expected Findings

```text
PATH: tests/helpers/create-test-person.ts
OPERATION: CREATE
ENVIRONMENT: TEST
LAYER: HELPER
STATUS: ACTIVE
CUTOVER_ACTION: MIGRATE_TO_PARTY

PATH: e2e/fixtures/persons.ts
OPERATION: INSERT
ENVIRONMENT: TEST
LAYER: FIXTURE
STATUS: ACTIVE
CUTOVER_ACTION: MIGRATE_TO_PARTY
```

---

## 🔍 R0.6.5 — MIGRATION/SEED SCRIPTS

### Search Queries

```bash
# Migration scripts
grep -r "persons" supabase/migrations/

# Seed scripts
grep -r "persons" supabase/seed*.sql scripts/seed*.ts
```

### Expected Findings

```text
PATH: supabase/seed_demo_2026.sql
OPERATION: INSERT
ENVIRONMENT: SEED
LAYER: DIRECT_DB
STATUS: ACTIVE
CUTOVER_ACTION: MIGRATE_TO_PARTY
```

---

## 📊 R0.6.6 — CENSUS RESULTS TEMPLATE

```text
═══════════════════════════════════════════════════════════════
R0.6 WRITE-PATH CENSUS RESULTS
═══════════════════════════════════════════════════════════════

DIRECT DATABASE WRITES
--------------------------------------------------------------------
1. supabase/seed.sql
   OPERATION: INSERT
   ENVIRONMENT: SEED
   LAYER: DIRECT_DB
   STATUS: ACTIVE
   CUTOVER_ACTION: MIGRATE_TO_PARTY

2. ...

REPOSITORY/SERVICE METHODS
--------------------------------------------------------------------
1. src/platform/host/person/person.repository.ts
   OPERATION: CREATE, UPDATE, DELETE
   ENVIRONMENT: PRODUCTION
   LAYER: REPOSITORY
   STATUS: ACTIVE
   CUTOVER_ACTION: FREEZE

2. ...

API ROUTES/HANDLERS
--------------------------------------------------------------------
1. src/app/api/persons/route.ts
   OPERATION: CREATE, UPDATE
   ENVIRONMENT: PRODUCTION
   LAYER: API
   STATUS: ACTIVE
   CUTOVER_ACTION: FREEZE

2. ...

TEST HELPERS/FIXTURES
--------------------------------------------------------------------
1. tests/helpers/create-test-person.ts
   OPERATION: CREATE
   ENVIRONMENT: TEST
   LAYER: HELPER
   STATUS: ACTIVE
   CUTOVER_ACTION: MIGRATE_TO_PARTY

2. ...

MIGRATION/SEED SCRIPTS
--------------------------------------------------------------------
1. supabase/seed_demo_2026.sql
   OPERATION: INSERT
   ENVIRONMENT: SEED
   LAYER: DIRECT_DB
   STATUS: ACTIVE
   CUTOVER_ACTION: MIGRATE_TO_PARTY

2. ...

═══════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════

Total Write Paths:                    XX
Production Paths:                     XX
Test Paths:                           XX
Migration/Seed Paths:                 XX

Cutover Actions:
  FREEZE (no new writes):             XX
  MIGRATE_TO_PARTY:                   XX
  DEPRECATE:                          XX
  NO_ACTION:                          XX

Unknown Paths:                        0
Unmapped Writers:                     0
```

---

## ✅ R0.6 PASS CRITERIA

```text
Unknown write paths                   = 0
Production writers mapped             = 100%
Test/fixture writers mapped           = 100%
Migration-only writers identified     = 100%
Legacy writers cutover action assigned= 100%

Every INSERT/UPDATE/DELETE classified
Every repository/service method mapped
Every API route handler mapped
Every test helper mapped
Every seed script mapped
```

---

## 🔴 BLOCKERS FOR R2

```text
R0.6 Write-Path Census                ▶ IN PROGRESS
R0.7 Contract/Caller Census           🔴 PENDING

CANNOT proceed to R2 until BOTH R0.6 + R0.7 complete.
```

---

**STATUS:** R0.6 specification complete, execution starting.

**NEXT:** Execute automated search + manual classification.
