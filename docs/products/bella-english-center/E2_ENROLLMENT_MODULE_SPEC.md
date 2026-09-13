# E2 — ENROLLMENT MODULE SPECIFICATION

**Product:** Bella English Center  
**Phase:** E2  
**Status:** Implementation  
**Architecture Compliance:** Education OS Constitution v1.0

---

## SCOPE

English Center enrollment management consuming Platform Education Enrollment Contract.

**IN SCOPE:**
- Branch-scoped enrollment (which branch student enrolls at)
- Program/Course context (which English program)
- Class assignment context
- Intake/cohort tracking
- English Center–specific enrollment metadata

**OUT OF SCOPE:**
- Creating new Enrollment Kernel (FROZEN — use Platform Education Enrollment)
- Direct access to `edu_enrollments` table
- Duplicate enrollment lifecycle
- Bypassing Education Enrollment Contract

---

## ARCHITECTURE

```
English Center UI
  ↓
English Enrollment Service
  ↓
Education Enrollment Contract ← PUBLIC BOUNDARY
  ↓
Education Enrollment Kernel (Platform)
  ↓
Canonical enrollment (edu_enrollments)
  ↓
English Center extension (english_center_enrollments)
```

**Ownership:**
- Platform Education OS owns: enrollment lifecycle, status, core data
- English Center owns: branch context, program context, English-specific metadata

**Relationship:**
- 1:1 between canonical enrollment and English Center extension
- FK from `english_center_enrollments.canonical_enrollment_id` → `edu_enrollments.id`
- UNIQUE constraint on `canonical_enrollment_id`

---

## DATA MODEL

**Table:** `english_center_enrollments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Extension record ID |
| `tenant_id` | UUID | NOT NULL, FK → tenants | Tenant isolation |
| `canonical_enrollment_id` | UUID | NOT NULL, UNIQUE, FK → edu_enrollments | 1:1 link to platform enrollment |
| `branch_id` | UUID | NOT NULL, FK → org_units | Which branch enrolled |
| `program_id` | UUID | NULL, FK → english_programs | English program (if exists) |
| `class_id` | UUID | NULL, FK → english_classes | Assigned class (if exists) |
| `intake` | VARCHAR | NULL | Cohort/intake identifier |
| `english_level_at_enrollment` | VARCHAR | NULL | Placement test result |
| `metadata` | JSONB | NULL | Additional English Center context |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | Created timestamp |
| `updated_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | Updated timestamp |

**Indexes:**
- `idx_english_enrollments_tenant` ON (`tenant_id`)
- `idx_english_enrollments_branch` ON (`branch_id`)
- `idx_english_enrollments_canonical` ON (`canonical_enrollment_id`) — enforces UNIQUE

**RLS:**
- Tenant isolation via `tenant_id`
- Branch-scope isolation via `branch_id` (user must have access to branch)

---

## API ENDPOINTS

### POST /api/english-center/enrollments
Create new English Center enrollment

**Request:**
```json
{
  "studentPartyId": "uuid",
  "courseId": "uuid",
  "branchId": "uuid",
  "programId": "uuid?",
  "classId": "uuid?",
  "intake": "string?",
  "englishLevelAtEnrollment": "string?",
  "metadata": "object?"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "canonicalEnrollmentId": "uuid",
  "branchId": "uuid",
  "programId": "uuid?",
  "classId": "uuid?",
  "intake": "string?",
  "englishLevelAtEnrollment": "string?",
  "enrollmentStatus": "active",
  "enrolledAt": "ISO8601",
  "createdAt": "ISO8601"
}
```

**Errors:**
- `400` Invalid input
- `401` Unauthorized
- `403` No access to branch
- `409` Already enrolled

---

### GET /api/english-center/enrollments
List English Center enrollments

**Query params:**
- `branchId` (optional) — filter by branch
- `status` (optional) — filter by enrollment status
- `limit`, `offset` — pagination

**Response:** `200 OK`
```json
{
  "enrollments": [...],
  "total": 123,
  "limit": 20,
  "offset": 0
}
```

---

### GET /api/english-center/enrollments/:id
Get enrollment detail

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "canonicalEnrollmentId": "uuid",
  "branchId": "uuid",
  "programId": "uuid?",
  "classId": "uuid?",
  "intake": "string?",
  "englishLevelAtEnrollment": "string?",
  "enrollmentStatus": "active",
  "enrolledAt": "ISO8601",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

---

### PATCH /api/english-center/enrollments/:id
Update English Center enrollment context (class assignment, metadata)

**Request:**
```json
{
  "classId": "uuid?",
  "metadata": "object?"
}
```

**Response:** `200 OK` (updated enrollment)

**Errors:**
- `400` Invalid input
- `403` No access
- `404` Not found

---

### POST /api/english-center/enrollments/:id/activate
Activate enrollment (delegates to Platform Enrollment Contract)

**Response:** `200 OK`

**Errors:**
- `400` Already active
- `403` No access
- `404` Not found

---

## UI PAGES

### 1. `/dashboard/english-center/enrollments` (List)
- Table: student name, branch, program, class, status, enrolled date
- Filters: branch, status
- Actions: View detail, Create new

### 2. `/dashboard/english-center/enrollments/new` (Create)
- Form: select student, branch, program, class, intake, level
- Calls Platform Enrollment Contract + creates English extension
- Redirects to detail on success

### 3. `/dashboard/english-center/enrollments/:id` (Detail)
- Shows: canonical enrollment data + English Center context
- Actions: Edit context (class, metadata), Activate (if pending)

---

## TESTS

### Service Tests
- ✅ Create enrollment → calls Platform contract → creates extension
- ✅ Create enrollment with existing canonical → reuses canonical
- ✅ Get enrollment by ID → fetches canonical + extension
- ✅ List enrollments with branch filter → respects tenant + branch scope
- ✅ Update context → only modifies extension fields
- ✅ Activate enrollment → delegates to Platform contract

### API Tests
- ✅ POST /enrollments → 201 Created
- ✅ POST /enrollments (duplicate) → 409 Conflict
- ✅ GET /enrollments → 200 OK with pagination
- ✅ GET /enrollments/:id → 200 OK
- ✅ GET /enrollments/:id (not found) → 404
- ✅ PATCH /enrollments/:id → 200 OK
- ✅ POST /enrollments/:id/activate → 200 OK

### Architecture Tests
- ✅ No direct `edu_enrollments` access from English Center
- ✅ All enrollment lifecycle via Platform contract
- ✅ Tenant isolation enforced
- ✅ Branch scope isolation enforced

---

## ACCEPTANCE CRITERIA

**E2 DONE when:**
1. Migration applied (english_center_enrollments table created)
2. Service layer implemented (calls Platform contract)
3. Repository layer implemented
4. API routes implemented (6 endpoints)
5. UI pages implemented (list, create, detail)
6. Service tests PASS (≥8 tests)
7. API tests PASS (≥7 tests)
8. Architecture Guard PASS
9. Typecheck PASS
10. Build PASS
11. PR created and merged
12. E2 sealed with evidence

---

**Constitution Compliance:**
- ✅ Consumes Platform Enrollment Contract (no Kernel bypass)
- ✅ No duplicate Enrollment Kernel
- ✅ Additive migration (CREATE table only)
- ✅ Tenant isolation (RLS)
- ✅ Single-scope PR (English Center only)

