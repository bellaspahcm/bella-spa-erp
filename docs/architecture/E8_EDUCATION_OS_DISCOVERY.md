# E8 Education OS — Phase 0 Discovery Report

**Date:** 2026-09-03  
**Factory Run:** E8.1 Education OS Kernel  
**Objective:** Discover existing Education footprint before Factory execution

---

## Executive Summary

**Education OS classification: CONTROLLED RECONSTRUCTION (not greenfield)**

Previous implementation deleted in commit `dd0afa2e` (102 diagnostics → 0) due to fundamental schema/code mismatch. Clean baseline preserved for governance-compliant rebuild.

---

## Assets Discovered

### ✅ PRESERVED (Canonical Baseline)

**1. Database Schema (Canonical Truth)**
- **File:** `supabase/migrations/20260812060000_create_education_schema.sql`
- **Tables:** `edu_courses`, `edu_enrollments` (public schema)
- **Features:**
  - Tenant isolation (tenant_id + RLS)
  - Referential integrity (ON DELETE RESTRICT)
  - Tenant-scoped uniqueness
  - Status enums
  - Performance indexes
  - RLS policies enabled

**2. Generated Contract**
- **File:** `src/shared/database.types.ts` (includes edu_courses, edu_enrollments types)
- **Status:** ✅ Already generated from canonical DB

**3. Domain Entities (Clean)**
- **Files:**
  - `src/platform/education/domain/course.entity.ts` (Course aggregate)
  - `src/platform/education/domain/enrollment.entity.ts` (Enrollment aggregate)
- **Pattern:** Class-based aggregates with private state, lifecycle methods
- **Status:** ✅ 4/4 tests PASS (course-enrollment.domain.test.ts)

**4. Scoped TypeScript Config**
- **File:** `tsconfig.platform-education.json`
- **Status:** ✅ 0 errors (scoped typecheck PASS)

**5. Minimal Exports**
- **File:** `src/platform/education/index.ts` (domain exports only)
- **File:** `src/platform/education/education-engine.registration.ts` (stub)

---

### ❌ DELETED (Commit dd0afa2e - 9,126 lines)

**Root Cause:** Schema/code fundamental mismatch
- Repositories expected `courses` table, DB has `edu_courses`
- SupabaseClient typing caused never[] inference
- 102 TypeScript diagnostics across 8 modules

**Deleted Assets:**
- `student/` - broken repositories (4 files, ~1,200 LOC)
- `course/` - schema mismatch (4 files, ~1,400 LOC)
- `enrollment/` - schema mismatch (4 files, ~800 LOC)
- `repositories/` - wrong table names (3 files, ~600 LOC)
- `contracts/` - 14 contract files (~800 LOC)
- `assessment/` - incomplete (5 files, ~1,400 LOC)
- `attendance/` - incomplete (5 files, ~1,600 LOC)
- `shared-kernel/` - drift (4 files, ~680 LOC)
- `education-engine.service.ts` - broken imports (256 LOC)

**Total deleted:** 49 files, 9,126 lines

---

## Canonical Truth Analysis

### Entity Model (from migration)

```
edu_courses
  ├─ id (uuid, PK)
  ├─ tenant_id (uuid, FK → tenants)
  ├─ course_code (text, unique per tenant)
  ├─ title (text)
  ├─ status (draft|active|archived)
  ├─ created_at, updated_at

edu_enrollments
  ├─ id (uuid, PK)
  ├─ tenant_id (uuid, FK → tenants)
  ├─ student_party_id (uuid, FK → party_parties)
  ├─ course_id (uuid, FK → edu_courses)
  ├─ status (pending|active|completed|cancelled)
  ├─ enrolled_at, created_at, updated_at
  └─ UNIQUE(tenant_id, student_party_id, course_id)
```

### Observations

**1. Party Pattern Reuse**
- `student_party_id` references `party_parties` (Platform Core)
- No separate `students` table
- Pattern: Student = Party with Student role

**2. Minimal Scope**
- Only 2 core entities (Course, Enrollment)
- No Assessment, Attendance, Grade tables in migration
- CC-3 POC scope (proof of concept)

**3. Schema Naming**
- Tables: `edu_*` prefix (not `education.*` schema)
- Lives in `public` schema
- Different from E7 Logistics (`logistics` schema)

**4. Constraints**
- ON DELETE RESTRICT (strict referential integrity)
- Tenant isolation mandatory
- Status lifecycle defined

---

## Evidence Summary

| Artifact | Status | Evidence |
|----------|--------|----------|
| **DB Migration** | ✅ Canonical | Applied, RLS enabled |
| **Generated Types** | ✅ Exists | database.types.ts includes edu_* |
| **Domain Entities** | ✅ Clean | 4/4 tests PASS |
| **Scoped Typecheck** | ✅ GREEN | 0 errors |
| **Repositories** | ❌ None | Deleted in dd0afa2e |
| **Contracts** | ❌ None | Deleted in dd0afa2e |
| **Services** | ❌ None | Deleted in dd0afa2e |
| **Tests** | 🟡 Minimal | Only domain unit tests |

---

## Classification Decision

**Type:** CONTROLLED RECONSTRUCTION

**Not greenfield because:**
- Canonical DB schema exists and is applied
- Generated contract exists
- Domain entities proven (4 tests PASS)
- Scoped config proven (0 errors)

**Not repair because:**
- Previous implementation deleted (not fixable)
- Schema/code mismatch was fundamental
- Cheaper to rebuild than repair 102 diagnostics

**Reconstruction strategy:**
- PRESERVE: DB schema, domain entities, generated types
- REBUILD: Repositories, tests, services (if needed)
- REUSE: Factory machinery from E7

---

## Scope Determination

### Canonical Scope (from migration)

**IN SCOPE (E8.1):**
- Course (aggregate)
- Enrollment (aggregate)

**OUT OF SCOPE:**
- Assessment (no table in migration)
- Attendance (no table in migration)
- Student entity (uses Party pattern)
- Grade/Transcript (no table)
- Schedule (no table)

### Minimal E8.1 Objective

> **Build conformant repositories and tests for edu_courses and edu_enrollments using Factory machinery, without expanding canonical scope.**

---

## Factory Reuse Assessment

### FROM E7 LOGISTICS (reuse without rebuild)

✅ **Architecture Guard** - no modification needed  
✅ **P0 Controlled Rebuild Scope** - pattern proven  
✅ **Scoped typecheck pattern** - config exists  
✅ **G0.5 regression** - add education scope  
✅ **DB → Generated Contract flow** - types exist  
✅ **Result monad** - proven pattern (if needed)  
✅ **Minimal implementation principle** - proven  

### DIFFERENT FROM E7

❌ **Schema location:** E7 = `logistics` schema, E8 = `public.edu_*` prefix  
❌ **Domain pattern:** E7 = functional + Result, E8 = class-based aggregates  
❌ **Party integration:** E8 uses party_parties (Platform Core dependency)  
❌ **Scope size:** E7 = 6 components, E8 = 2 components  

---

## Risks & Constraints

### Risks

1. **Schema prefix inconsistency** - E7 uses schema, E8 uses prefix
   - Mitigation: Document pattern difference, not blocking

2. **Party dependency** - student_party_id requires Party platform
   - Mitigation: Verify party_parties table exists and has RLS

3. **Domain pattern drift** - E7 functional, E8 class-based
   - Mitigation: Both valid, choose based on evidence

4. **Minimal scope** - Only 2 entities, limited behavioral coverage
   - Mitigation: Build only what canonical requires

### Constraints

1. **No schema changes** - DB migration already applied
2. **No domain entity changes** - 4 tests already PASS
3. **No new tables** - Build only for edu_courses/edu_enrollments
4. **No Platform Core changes** - Party pattern is given

---

## Next Phase Decision

**Proceed to Phase 1: Canonical Truth Establishment**

**Actions:**
1. Document canonical scope (Course, Enrollment only)
2. Identify invariants from migration + domain entities
3. Map relationships (Course ←→ Enrollment, Student via Party)
4. Freeze E8.1 boundary
5. Proceed to behavioral specification

**No schema changes. No entity changes. Build repositories + tests using Factory.**

---

## References

- **Commit dd0afa2e:** "fix(education): RESET - delete broken repositories, preserve domain+schema"
- **AGENTS.md:** Principle #1 (Kernel-First), #7 (Minimal Complexity)
- **AI_CODING_CONTRACT.md:** Known Pattern Rule
- **E7 Logistics:** Factory Qualification Run evidence
- **Platform Status:** 43 PASS / 0 FAIL / 1 HOTSPOT (Logistics deferred)

---

**Discovery Status:** ✅ COMPLETE  
**Classification:** CONTROLLED RECONSTRUCTION  
**Ready for Phase 1:** YES  
**Blockers:** NONE
