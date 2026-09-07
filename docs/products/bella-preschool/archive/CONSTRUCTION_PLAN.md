# Bella Preschool — Construction Plan

**Product:** Bella Preschool (Preschool/Kindergarten Management)  
**Date:** 2026-09-07  
**Approach:** Evidence-first, Platform-reuse-first, minimal vertical slice

---

## Architecture Decision

**Question:** Should Preschool reuse Education OS?

**Answer:** NO

**Evidence:**
- `bella-education` Product exists but is minimal (manifest + 4 services)
- Database schema `20260613100000_create_student_training_foundation.sql` is for **vocational/skills training**, NOT academic K-12 education
- Training students (adult learners) ≠ Preschool students (3-6 year old children)
- Domain concepts completely different:
  - Training: Courses, Modules, Lessons, Progress tracking
  - Preschool: Classrooms, Guardians, Check-in/out, Daily care records, Health tracking

**Decision:** Build Bella Preschool as **NEW PRODUCT**, reuse Platform capabilities only.

**Rationale:** No evidence of reusable Education Kernel. Following principle: "Do NOT create Kernel unless evidence shows genuine reusable capability required."

---

## Platform Capabilities to Reuse

Based on inspection of existing Platform:

✅ **Will reuse:**
1. **Tenant isolation** (`tenant_id`, RLS policies)
2. **Authentication** (`getCurrentUser`, Supabase Auth)
3. **Database** (Supabase PostgreSQL, migrations)
4. **UI Framework** (Next.js 16, Tailwind, Lucide icons)
5. **Action pattern** (`ActionResult<T>` from AutoMove)
6. **Customers table** (for parent/guardian management — already exists)

⏸️ **May reuse** (need to verify):
- `persons` table (if exists for identity management)
- Platform notification system
- Document storage

❌ **Will NOT reuse:**
- Education OS services (wrong domain)
- Student training schema (adult learners, not children)

---

## Minimal Vertical Slice (Phase 1)

**Goal:** Student → Guardian → Class → Enrollment → Attendance

**Scope:**
1. Create preschool student (with guardian relationship)
2. Assign student to classroom
3. Record daily attendance (check-in/check-out time)
4. List students by classroom
5. View attendance history

**Out of scope for Phase 1:**
- Daily care records (meals, sleep, hygiene)
- Health records (allergies, height/weight)
- Tuition/payments
- Parent communication
- Full UI forms

---

## Database Schema (Phase 1)

### Tables to create:

**1. `preschool_students`**
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- student_code (TEXT, unique per tenant, e.g. "PS-2026-001")
- first_name, last_name (TEXT)
- date_of_birth (DATE)
- enrollment_date (DATE)
- status (TEXT: 'active' | 'withdrawn' | 'graduated')
- created_at, updated_at (TIMESTAMPTZ)
```

**2. `preschool_guardians`**
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- customer_id (UUID, FK → customers) -- Reuse existing!
- relationship_type (TEXT: 'parent' | 'grandparent' | 'guardian')
- is_primary (BOOLEAN)
- is_authorized_pickup (BOOLEAN)
- emergency_contact (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

**3. `preschool_student_guardians`** (junction)
```sql
- id (UUID, PK)
- tenant_id (UUID)
- student_id (UUID, FK → preschool_students)
- guardian_id (UUID, FK → preschool_guardians)
- created_at (TIMESTAMPTZ)
- UNIQUE(student_id, guardian_id)
```

**4. `preschool_classrooms`**
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- classroom_name (TEXT, e.g. "Butterfly Class")
- age_group (TEXT, e.g. "3-4 years")
- capacity (INTEGER)
- created_at, updated_at (TIMESTAMPTZ)
```

**5. `preschool_enrollments`**
```sql
- id (UUID, PK)
- tenant_id (UUID)
- student_id (UUID, FK → preschool_students)
- classroom_id (UUID, FK → preschool_classrooms)
- enrollment_date (DATE)
- status (TEXT: 'active' | 'transferred' | 'completed')
- created_at, updated_at (TIMESTAMPTZ)
```

**6. `preschool_attendance`**
```sql
- id (UUID, PK)
- tenant_id (UUID)
- student_id (UUID, FK → preschool_students)
- attendance_date (DATE)
- check_in_time (TIMESTAMPTZ)
- check_out_time (TIMESTAMPTZ, nullable)
- checked_in_by (UUID, FK → users, nullable)
- checked_out_by (UUID, FK → users, nullable)
- notes (TEXT, nullable)
- created_at, updated_at (TIMESTAMPTZ)
- UNIQUE(tenant_id, student_id, attendance_date)
```

**RLS:** All tables tenant-isolated with standard policies.

---

## Server Actions (Phase 1)

**student-actions.ts:**
- `listStudentsAction()` — List all students
- `getStudentAction(id)` — Get student detail with guardians
- `createStudentAction(input)` — Register new student

**classroom-actions.ts:**
- `listClassroomsAction()` — List all classrooms
- `getClassroomAction(id)` — Get classroom with enrolled students

**attendance-actions.ts:**
- `listAttendanceAction(filters)` — Query attendance records
- `checkInStudentAction(studentId, time)` — Record check-in
- `checkOutStudentAction(attendanceId, time)` — Record check-out

---

## UI Pages (Phase 1)

**Dashboard:** `/dashboard/preschool`
- Quick stats (total students, today's attendance)
- Quick actions (add student, view attendance)

**Students:** `/dashboard/preschool/students`
- List view with student name, age, classroom, status
- Empty state: "No students enrolled yet"

**Classrooms:** `/dashboard/preschool/classrooms`
- List view with classroom name, age group, enrollment count
- Empty state: "No classrooms created yet"

**Attendance:** `/dashboard/preschool/attendance`
- Daily attendance view
- Check-in/check-out buttons
- Attendance history

---

## Product Structure

```
src/products/bella-preschool/
├── manifest.ts                    # Product manifest (menus, capabilities)
├── types.ts                       # TypeScript interfaces
├── actions/
│   ├── index.ts                   # Export all actions
│   ├── student-actions.ts         # Student CRUD
│   ├── classroom-actions.ts       # Classroom management
│   └── attendance-actions.ts      # Attendance tracking
├── __tests__/
│   ├── bella-preschool-actions.test.ts
│   └── bella-preschool-architecture.test.ts
└── README.md
```

```
src/app/(authenticated)/dashboard/preschool/
├── page.tsx                       # Dashboard
├── students/
│   └── page.tsx                   # Students list
├── classrooms/
│   └── page.tsx                   # Classrooms list
└── attendance/
    └── page.tsx                   # Attendance tracking
```

```
supabase/migrations/
└── 20260907000000_create_preschool_schema.sql
```

---

## Validation Strategy

**Unit tests (required):**
- 9+ action tests (3 per domain: student, classroom, attendance)
- Architecture compliance tests

**E2E tests:**
- Dashboard navigation
- Students list (empty state + with data)
- Classrooms list
- Attendance check-in workflow

**Gates:**
- Product tests: Target 100% PASS
- E2E: Target 100% PASS
- Architecture Guard: PASS
- Production Build: SUCCESS
- TypeScript: PASS (or timeout acceptable per platform)

---

## Success Criteria

✅ **Minimal vertical slice working:**
- Student registration
- Classroom assignment
- Daily attendance tracking

✅ **Platform reuse demonstrated:**
- Tenant isolation via RLS
- Auth via Platform
- Customers table for guardians
- Standard action pattern

✅ **Tests passing:**
- Unit tests GREEN
- E2E tests GREEN (or documented limitations)
- Architecture Guard PASS

✅ **Evidence documented:**
- What was reused
- What was new
- Architectural decisions
- Remaining gaps

---

## Next Phase (Deferred)

**Phase 2** (if required):
- Daily care records (meals, sleep, hygiene)
- Health tracking (allergies, height/weight, immunizations)
- Form pages (student registration, classroom creation)

**Phase 3** (if required):
- Tuition management
- Payment tracking
- Parent communication (announcements, messaging)

**Principle:** Build Phase 1 completely, validate, THEN decide if Phase 2 needed.

---

**Status:** ⏸️ READY TO IMPLEMENT  
**Next:** Create database migration for Phase 1 schema
