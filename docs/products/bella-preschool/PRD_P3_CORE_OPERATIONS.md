# P3 — Core Operations

**Phase:** Foundation  
**Priority:** CRITICAL — Must complete before P4, P5, P6  
**Purpose:** Enable daily school operations

---

## Overview

Core operations are the foundation. Without these, the school cannot function.

**Scope:**
- Student & Guardian management
- Classroom & Teacher management
- Daily attendance workflow
- Operational dashboard

**User roles:**
- School Admin
- Teacher
- Staff

---

## Capabilities

### P3.1 — Student & Guardian Management

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P3-001 | List students | Admin, Teacher | View all students with filters | ✅ `listStudentsAction` | ❌ | ✅ List page | P0 | Can see all students with search/filter |
| PRE-P3-002 | Search students | Admin, Teacher | Search by name/code | ✅ Backend supports | ❌ | ✅ Search UI | P0 | Can find student quickly |
| PRE-P3-003 | Filter students | Admin, Teacher | Filter by status/class | ✅ Backend supports | ❌ | ✅ Filter UI | P0 | Can filter by active/withdrawn/graduated |
| PRE-P3-004 | View student profile | Admin, Teacher | Click student → see detail | ✅ `getStudentAction` | ❌ | ✅ Profile page | P0 | See full student info + guardians + classroom |
| PRE-P3-005 | Create student | Admin | Fill form → create student | ✅ `createStudentAction` | ❌ | ✅ Create form | P0 | Can create student with validation |
| PRE-P3-006 | Edit student | Admin | Edit form → save | ✅ `updateStudentAction` | ❌ | ✅ Edit form | P0 | Can update student info |
| PRE-P3-007 | Student status change | Admin | Change active/withdrawn/graduated | ✅ Backend supports | ❌ | ✅ Status UI | P1 | Can change status with confirmation |
| PRE-P3-008 | Add guardian | Admin | Link guardian to student | ✅ `createStudentAction` supports | ❌ | ✅ Guardian form | P0 | Can add multiple guardians |
| PRE-P3-009 | Edit guardian | Admin | Update guardian info | ⚠️ Via customers table | ⚠️ May need action | ✅ Edit form | P0 | Can update guardian contact |
| PRE-P3-010 | Guardian relationship | Admin | Set parent/grandparent/other | ✅ Schema supports | ❌ | ✅ Relationship UI | P0 | Can specify relationship type |
| PRE-P3-011 | Primary contact | Admin | Mark primary guardian | ✅ Schema field | ❌ | ✅ Toggle UI | P0 | Can mark one as primary |
| PRE-P3-012 | Emergency contact | Admin | Mark emergency contact | ✅ Schema field | ❌ | ✅ Toggle UI | P0 | Can mark emergency contacts |
| PRE-P3-013 | Authorized pickup | Admin | Authorize pickup | ✅ Schema field | ❌ | ✅ Toggle UI | P0 | Can authorize/revoke pickup |
| PRE-P3-014 | Student photo | Admin | Upload photo | ⚠️ Schema field exists | ❌ Upload logic needed | ✅ Upload UI | P1 | Can upload/display photo |

**Backend Reuse:**
- ✅ Student CRUD actions exist
- ✅ Guardian junction table exists
- ✅ Customers table reused for guardian contact info
- ❌ Guardian CRUD may need separate actions
- ❌ Photo upload logic needed

**New Backend Needed:**
- Guardian update action (or reuse customers update)
- Photo upload/storage integration

---

### P3.2 — Classroom & Teacher Management

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P3-015 | List classrooms | Admin, Teacher | View all classrooms | ✅ `listClassroomsAction` | ❌ | ✅ List page | P0 | See all classrooms with enrollment counts |
| PRE-P3-016 | View classroom | Admin, Teacher | Click classroom → see roster | ✅ `getClassroomAction` | ❌ | ✅ Detail page | P0 | See classroom info + students |
| PRE-P3-017 | Create classroom | Admin | Fill form → create | ✅ `createClassroomAction` | ❌ | ✅ Create form | P0 | Can create classroom |
| PRE-P3-018 | Edit classroom | Admin | Edit form → save | ⚠️ Not in current actions | ❌ Need action | ✅ Edit form | P0 | Can update classroom info |
| PRE-P3-019 | Classroom capacity | Admin | Set capacity | ✅ Schema field | ❌ | ✅ Form field | P0 | Can set max capacity |
| PRE-P3-020 | Age group | Admin | Set age range | ✅ Schema field | ❌ | ✅ Form field | P0 | Can specify age group |
| PRE-P3-021 | Assign lead teacher | Admin | Select teacher | ✅ Schema field | ❌ Need teacher list | ✅ Select UI | P0 | Can assign lead teacher |
| PRE-P3-022 | Assign assistant | Admin | Select teacher | ✅ Schema field | ❌ Need teacher list | ✅ Select UI | P1 | Can assign assistant |
| PRE-P3-023 | Classroom active/inactive | Admin | Toggle status | ✅ Schema field | ❌ Need action | ✅ Toggle UI | P1 | Can activate/deactivate classroom |
| PRE-P3-024 | Room location | Admin | Set location | ✅ Schema field | ❌ | ✅ Form field | P1 | Can specify room |
| PRE-P3-025 | Classroom roster | Admin, Teacher | View enrolled students | ✅ `getClassroomAction` | ❌ | ✅ Roster view | P0 | See all students in classroom |

**Backend Reuse:**
- ✅ Classroom list/get actions exist
- ✅ Create action exists
- ⚠️ Update/status change actions missing

**New Backend Needed:**
- `updateClassroomAction(id, input)`
- `setClassroomStatusAction(id, is_active)`
- Teacher list action (or reuse Platform users query)

---

### P3.3 — Enrollment

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P3-026 | Enroll student | Admin | Select student + classroom → enroll | ✅ `enrollStudentAction` | ❌ | ✅ Enroll form | P0 | Can enroll student in classroom |
| PRE-P3-027 | View enrollment history | Admin | See past enrollments | ✅ Schema supports | ❌ Need query action | ✅ History view | P1 | See enrollment timeline |
| PRE-P3-028 | Transfer classroom | Admin | Move student to different classroom | ⚠️ Can create new enrollment | ❌ Transfer workflow needed | ✅ Transfer UI | P1 | Can transfer with history |
| PRE-P3-029 | End enrollment | Admin | Mark enrollment complete/withdrawn | ✅ Schema status field | ❌ Need action | ✅ Status UI | P1 | Can end enrollment |
| PRE-P3-030 | Capacity check | System | Prevent over-enrollment | ❌ | ❌ Need validation | ✅ Error display | P0 | Cannot exceed capacity |

**Backend Reuse:**
- ✅ Enroll action exists
- ❌ Transfer workflow missing
- ❌ Capacity validation missing

**New Backend Needed:**
- `transferStudentAction(student_id, from_classroom, to_classroom)`
- `endEnrollmentAction(enrollment_id, end_date, status)`
- Capacity validation in enroll action

---

### P3.4 — Daily Attendance

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P3-031 | Today's attendance board | Teacher, Admin | See all students for today | ✅ `listAttendanceAction` | ❌ May need optimization | ✅ Board UI | P0 | See today's status at a glance |
| PRE-P3-032 | Check-in student | Teacher, Staff | Click check-in → record time | ✅ `checkInAction` | ❌ | ✅ Check-in button | P0 | Can check-in with timestamp |
| PRE-P3-033 | Check-out student | Teacher, Staff | Click check-out → record time + pickup | ✅ `checkOutAction` | ❌ | ✅ Check-out UI | P0 | Can check-out with pickup verification |
| PRE-P3-034 | Mark absent | Teacher, Admin | Mark student absent | ✅ `markAbsentAction` | ❌ | ✅ Absent button | P0 | Can mark absent with reason |
| PRE-P3-035 | Authorized pickup check | Staff | Verify pickup authorization | ✅ Schema supports | ❌ Need guardian list query | ✅ Pickup verification UI | P0 | See authorized pickups before checkout |
| PRE-P3-036 | Bulk attendance | Teacher | Mark multiple at once | ❌ | ❌ Need bulk action | ✅ Bulk UI | P1 | Can check-in multiple students |
| PRE-P3-037 | Attendance history | Admin, Teacher | View past attendance | ✅ `listAttendanceAction` with filters | ❌ | ✅ History view | P1 | See attendance by date/student |
| PRE-P3-038 | Attendance notes | Teacher | Add notes to attendance | ✅ Schema field | ❌ | ✅ Notes field | P1 | Can add attendance notes |

**Backend Reuse:**
- ✅ Check-in/check-out/absent actions exist
- ❌ Bulk actions missing
- ❌ Authorized pickup query missing

**New Backend Needed:**
- `bulkCheckInAction(student_ids[], check_in_time)`
- `getAuthorizedPickupsAction(student_id)` → returns authorized guardians
- Optimize `listAttendanceAction` for today's board (if needed)

---

### P3.5 — Operational Dashboard

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P3-039 | Today's summary | Admin, Teacher | See today's attendance stats | ❌ | ❌ Need stats query | ✅ Dashboard widgets | P0 | See total/present/absent/checked-out |
| PRE-P3-040 | Students by classroom | Admin | See classroom breakdown | ❌ | ❌ Need stats query | ✅ Classroom widget | P0 | See students per classroom |
| PRE-P3-041 | Quick check-in/out | Teacher | Quick actions from dashboard | ✅ Reuse actions | ❌ | ✅ Quick action UI | P1 | Can check-in/out without navigating |
| PRE-P3-042 | Alerts | Admin | See alerts (late pickup, etc.) | ❌ | ❌ Need alert logic | ✅ Alert widget | P2 | See operational alerts |
| PRE-P3-043 | Navigation | All | Quick access to all modules | ❌ | ❌ | ✅ Nav menu | P0 | Can navigate easily |

**Backend Reuse:**
- ✅ Check-in/out actions reusable
- ❌ Dashboard stats missing

**New Backend Needed:**
- `getDashboardStatsAction(date?)` → today's attendance summary
- `getClassroomStatsAction()` → students per classroom
- Alert logic (if P2 prioritized)

---

## Platform Reuse Analysis

### Existing Platform Capabilities

**From Platform Core:**
- ✅ `createClient()` — Supabase client
- ✅ `getCurrentUser()` — Auth + tenant context
- ✅ Customers table — Guardian contact info
- ✅ Users table — Teachers/staff
- ✅ Tenants table — Multi-tenant support
- ✅ RLS policies — Tenant isolation
- ✅ `get_auth_tenant_id()` — Tenant context function

**From Preschool Backend (Phase 2A):**
- ✅ Student CRUD actions (list, get, create, update)
- ✅ Classroom actions (list, get, create, enroll)
- ✅ Attendance actions (list, check-in, check-out, absent)
- ✅ 5 tables with RLS

### New Backend Required

| Action | Purpose | Estimated LOC | Priority |
|--------|---------|---------------|----------|
| `updateClassroomAction` | Edit classroom | ~50 | P0 |
| `setClassroomStatusAction` | Activate/deactivate | ~30 | P1 |
| `updateGuardianAction` | Edit guardian info | ~50 | P0 |
| `getAuthorizedPickupsAction` | Pickup verification | ~40 | P0 |
| `bulkCheckInAction` | Bulk attendance | ~60 | P1 |
| `transferStudentAction` | Transfer workflow | ~80 | P1 |
| `endEnrollmentAction` | End enrollment | ~40 | P1 |
| `getDashboardStatsAction` | Dashboard stats | ~100 | P0 |
| `getClassroomStatsAction` | Classroom breakdown | ~50 | P0 |
| Photo upload integration | Student photos | ~100 | P1 |
| **Total** | | **~600 LOC** | |

### UI Required

**Pages:**
- Student list + search/filter
- Student profile
- Student create/edit form
- Classroom list
- Classroom detail + roster
- Classroom create/edit form
- Enrollment form
- Attendance board (today's view)
- Attendance history
- Dashboard (home)

**Components:**
- Navigation menu (role-aware)
- Layout wrapper
- Form components (input, select, date, etc.)
- Table/list components
- Search/filter components
- Confirmation dialogs
- Loading/empty states
- Error displays

**Estimated UI LOC:** ~2,000-3,000 LOC

---

## Implementation Order

**Priority 0 (Critical path):**

1. **Navigation & Layout** — Foundation for all pages
2. **Student List + Profile** — Entry point
3. **Student Create/Edit** — Core CRUD
4. **Guardian Management** — Within student
5. **Classroom List + Detail** — Second entity
6. **Classroom Create/Edit** — Core CRUD
7. **Enrollment** — Link students to classrooms
8. **Attendance Board** — Daily operations
9. **Check-in/Check-out UI** — Daily workflow
10. **Dashboard** — Operational overview

**Priority 1 (Soon after):**
- Transfer workflow
- Bulk attendance
- Attendance history
- Status changes
- Photos

**Priority 2 (Nice to have):**
- Alerts
- Advanced filters

---

## Dependencies

```text
Navigation & Layout
      ↓
Student Management
      ↓
Guardian Management (within Student)
      ↓
Classroom Management
      ↓
Enrollment (links Student ↔ Classroom)
      ↓
Attendance (requires enrolled students)
      ↓
Dashboard (aggregates all data)
```

**Cannot start:**
- Enrollment without Student + Classroom
- Attendance without Enrollment
- Dashboard without Student + Classroom + Attendance

---

## Acceptance Criteria (P3 Complete)

### Functional
- ✅ Can create/edit students with guardians
- ✅ Can create/edit classrooms
- ✅ Can enroll students in classrooms
- ✅ Can check-in/check-out students daily
- ✅ Can view today's attendance at a glance
- ✅ Can search/filter students
- ✅ Can verify authorized pickups
- ✅ Dashboard shows operational summary

### Non-Functional
- ✅ UI is responsive (desktop + tablet minimum)
- ✅ Forms validate input
- ✅ Errors display clearly
- ✅ Loading states shown
- ✅ Empty states handled
- ✅ Confirmations for destructive actions
- ✅ Role-based navigation
- ✅ RLS enforced (tenant isolation)

### Demo-Ready
- ✅ Can create demo school with students/classrooms
- ✅ Can demonstrate daily workflow (check-in → check-out)
- ✅ UI looks professional (not test interface)
- ✅ Can show to prospects without apology

### Evidence
- ✅ Backend actions tested (unit tests)
- ✅ UI integration tested (manual or E2E)
- ✅ Real-auth workflow verified
- ✅ Persistence verified
- ✅ Authorization verified
- ✅ Critical E2E passes

---

## Next Phase

After P3 complete → **P4: Preschool Care** (daily care, meals, health)

P4 depends on P3 Student + Attendance foundation.
