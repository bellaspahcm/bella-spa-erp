# E3 — PROGRAM / COURSE / CLASS MANAGEMENT

**Product:** Bella English Center  
**Phase:** E3  
**Status:** Implementation  
**Depends on:** E2 (Enrollment)

---

## SCOPE

English Center program structure: Programs → Courses → Classes.

**IN SCOPE:**
- Program definition (General English, Business English, IELTS, TOEIC)
- Course definition within programs (levels, durations)
- Class management (scheduling, capacity, teacher assignment)
- Branch-level program/course/class context

**OUT OF SCOPE:**
- Creating new Education OS Course Kernel (reuse Platform if exists)
- Student enrollment (handled by E2)
- Teacher workforce management (E4)
- Detailed timetabling (E5)

---

## ARCHITECTURE

```
English Center UI
  ↓
Program/Course/Class Service
  ↓
[Check Platform Education Course Contract if exists]
  ↓ (if not exists)
Product-level Program/Course/Class entities
  ↓
english_center_programs
english_center_courses
english_center_classes
```

**Ownership:**
- English Center owns: program catalog, course catalog, class instances
- Platform may own: generic course structure (TBD based on Platform contracts)

---

## DATA MODEL

### Table: `english_center_programs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Program ID |
| `tenant_id` | UUID | NOT NULL, FK → tenants | Tenant isolation |
| `branch_id` | UUID | NULL, FK → org_units | Branch-specific or chain-wide |
| `code` | VARCHAR(50) | NOT NULL | Program code (e.g., "GE", "BE", "IELTS") |
| `name` | VARCHAR(200) | NOT NULL | Program name |
| `description` | TEXT | NULL | Description |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active/inactive |
| `metadata` | JSONB | NULL | Additional config |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |

**Indexes:**
- `idx_programs_tenant` ON (`tenant_id`)
- `idx_programs_code` ON (`code`)
- `UNIQUE (tenant_id, code)`

---

### Table: `english_center_courses`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Course ID |
| `tenant_id` | UUID | NOT NULL, FK → tenants | Tenant isolation |
| `program_id` | UUID | NOT NULL, FK → english_center_programs | Parent program |
| `code` | VARCHAR(50) | NOT NULL | Course code (e.g., "GE-A1", "IELTS-6.5") |
| `name` | VARCHAR(200) | NOT NULL | Course name |
| `level` | VARCHAR(50) | NULL | CEFR level (A1, A2, B1, B2, C1, C2) |
| `duration_hours` | INTEGER | NULL | Total hours |
| `description` | TEXT | NULL | |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | |
| `metadata` | JSONB | NULL | |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |

**Indexes:**
- `idx_courses_tenant` ON (`tenant_id`)
- `idx_courses_program` ON (`program_id`)
- `UNIQUE (tenant_id, program_id, code)`

---

### Table: `english_center_classes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Class ID |
| `tenant_id` | UUID | NOT NULL, FK → tenants | Tenant isolation |
| `branch_id` | UUID | NOT NULL, FK → org_units | Which branch |
| `course_id` | UUID | NOT NULL, FK → english_center_courses | Which course |
| `code` | VARCHAR(50) | NOT NULL | Class code (e.g., "GE-A1-M01") |
| `name` | VARCHAR(200) | NOT NULL | Class name |
| `capacity` | INTEGER | NOT NULL DEFAULT 20 | Max students |
| `enrolled_count` | INTEGER | NOT NULL DEFAULT 0 | Current enrolled |
| `teacher_id` | UUID | NULL, FK → parties | Assigned teacher |
| `start_date` | DATE | NULL | Class start |
| `end_date` | DATE | NULL | Class end |
| `schedule_days` | VARCHAR[] | NULL | Days of week (Mon, Tue, etc.) |
| `schedule_time` | VARCHAR(50) | NULL | Time slot (e.g., "18:00-20:00") |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'planned' | planned/active/completed/cancelled |
| `metadata` | JSONB | NULL | |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |

**Indexes:**
- `idx_classes_tenant` ON (`tenant_id`)
- `idx_classes_branch` ON (`branch_id`)
- `idx_classes_course` ON (`course_id`)
- `idx_classes_teacher` ON (`teacher_id`)
- `UNIQUE (tenant_id, branch_id, code)`

---

## API ENDPOINTS

### Programs

**POST /api/english-center/programs** - Create program  
**GET /api/english-center/programs** - List programs  
**GET /api/english-center/programs/:id** - Get program detail  
**PATCH /api/english-center/programs/:id** - Update program  

### Courses

**POST /api/english-center/courses** - Create course  
**GET /api/english-center/courses** - List courses (filter by program)  
**GET /api/english-center/courses/:id** - Get course detail  
**PATCH /api/english-center/courses/:id** - Update course  

### Classes

**POST /api/english-center/classes** - Create class  
**GET /api/english-center/classes** - List classes (filter by branch/course)  
**GET /api/english-center/classes/:id** - Get class detail  
**PATCH /api/english-center/classes/:id** - Update class  
**POST /api/english-center/classes/:id/assign-teacher** - Assign teacher  

---

## UI PAGES

### Programs
- `/dashboard/english-center/programs` - List programs
- `/dashboard/english-center/programs/new` - Create program
- `/dashboard/english-center/programs/:id` - Program detail

### Courses
- `/dashboard/english-center/courses` - List courses
- `/dashboard/english-center/courses/new` - Create course
- `/dashboard/english-center/courses/:id` - Course detail

### Classes
- `/dashboard/english-center/classes` - List classes
- `/dashboard/english-center/classes/new` - Create class
- `/dashboard/english-center/classes/:id` - Class detail

---

## TESTS

### Service Tests
- Create program/course/class
- List with filters (branch, status, program)
- Update operations
- Status transitions
- Capacity validation

### API Tests
- CRUD operations
- Authorization (tenant/branch scope)
- Validation (required fields, unique constraints)

---

## ACCEPTANCE CRITERIA

**E3 DONE when:**
1. Migration applied (3 tables created)
2. Service layer implemented (3 services)
3. Repository layer implemented (3 repositories)
4. API routes implemented (12+ endpoints)
5. UI pages implemented (9 pages)
6. Service tests PASS (≥15 tests)
7. Architecture Guard PASS
8. Build PASS
9. PR merged
10. E3 sealed with evidence

---

## CONSTITUTION COMPLIANCE

- ✅ Single scope (English Center only)
- ✅ Additive migration (CREATE tables only)
- ✅ Tenant + branch isolation
- ✅ No Platform Kernel bypass
- ✅ Product-level entities (not duplicating frozen Kernel)
