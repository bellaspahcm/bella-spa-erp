# Bella Preschool — Gap Analysis

**Date:** September 7, 2026  
**Purpose:** Identify gaps between current Phase 2A implementation and Commercial Product requirements  
**Context:** Real customer exists, transitioning from Factory validation to Commercial Product Completion

---

## Current Implementation (Phase 2A ✅)

### Database Schema (5 Tables)

| Table | Columns | Status |
|-------|---------|--------|
| `preschool_students` | id, tenant_id, student_code, first_name, last_name, date_of_birth, gender, enrollment_date, status, photo_url, notes | ✅ Complete |
| `preschool_student_guardians` | id, tenant_id, student_id, guardian_customer_id, relationship_type, is_primary_contact, is_authorized_pickup, is_emergency_contact | ✅ Complete |
| `preschool_classrooms` | id, tenant_id, classroom_name, age_group, capacity, lead_teacher_id, assistant_teacher_id, is_active, room_location, notes | ✅ Complete |
| `preschool_enrollments` | id, tenant_id, student_id, classroom_id, enrollment_date, end_date, status | ✅ Complete |
| `preschool_attendance` | id, tenant_id, student_id, attendance_date, status, check_in_time, check_out_time, absence_reason, picked_up_by_guardian_id, notes | ✅ Complete |

**RLS Policies:** ✅ All tables have tenant isolation

### Server Actions (3 Files)

**student-actions.ts:**
- ✅ `listStudentsAction()` — List all students with guardians + current classroom
- ✅ `getStudentAction(id)` — Get student detail with full relationships
- ✅ `createStudentAction(input)` — Create student + link guardians
- ✅ `updateStudentAction(id, input)` — Update student info

**classroom-actions.ts:**
- ✅ `listClassroomsAction()` — List classrooms with enrollment counts
- ✅ `getClassroomAction(id)` — Get classroom with enrolled students
- ✅ `createClassroomAction(input)` — Create classroom
- ✅ `enrollStudentAction(input)` — Enroll student in classroom

**attendance-actions.ts:**
- ✅ `listAttendanceAction(filters)` — List attendance with filters
- ✅ `checkInAction(input)` — Check-in student
- ✅ `checkOutAction(input)` — Check-out student  
- ✅ `markAbsentAction(input)` — Mark student absent

### Tests

- ✅ 31/31 Unit tests (architecture + actions structure)
- ✅ 18/18 E2E tests (infrastructure + workflows + tenant isolation)

### UI Pages

- ✅ `/dashboard/preschool` — Main dashboard
- ✅ `/dashboard/preschool/students` — Students list
- ✅ `/dashboard/preschool/classrooms` — Classrooms list
- ✅ `/dashboard/preschool/attendance` — Attendance management

**Status:** Basic navigation + layout exists, detailed UI implementation unknown

---

## Gap Analysis by Phase

### Phase 3 — Core Daily Operations

#### Student Management

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Student CRUD | ✅ Backend complete | ⚠️ UI forms needed |
| Student list/search | ✅ Backend | ⚠️ Search/filter UI |
| Student profile view | ✅ Backend | ⚠️ Detail page UI |
| Photo upload | ⚠️ Schema field exists | ❌ Upload logic + storage |
| Bulk import | ❌ | ❌ Not implemented |
| Student status transitions | ✅ Backend (active/withdrawn/graduated) | ⚠️ UI workflow |
| Archive/soft delete | ⚠️ Schema has deleted_at | ❌ Archive logic |

#### Guardian Management

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Guardian CRUD | ⚠️ Partial (links to customers) | ❌ Full CRUD needed |
| Guardian relationships | ✅ Backend (junction table) | ⚠️ UI management |
| Emergency contacts | ✅ Schema field | ❌ UI + workflow |
| Pickup authorization | ✅ Schema field | ❌ UI + verification workflow |
| Multiple guardians per student | ✅ Backend | ⚠️ UI management |
| Guardian communication info | ✅ From customers table | ✅ Reuses existing |

#### Classroom Management

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Classroom CRUD | ✅ Backend complete | ⚠️ UI forms needed |
| Teacher assignment | ✅ Schema (lead + assistant) | ❌ Teacher management logic |
| Age group configuration | ✅ Schema | ⚠️ UI + validation |
| Capacity management | ✅ Schema | ❌ Enrollment capacity check |
| Room/location | ✅ Schema | ⚠️ UI |
| Active/inactive status | ✅ Schema | ⚠️ UI toggle |

#### Enrollment

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Enroll student | ✅ Backend | ⚠️ UI workflow |
| Enrollment history | ✅ Schema (start/end dates) | ❌ History view UI |
| Transfer between classrooms | ⚠️ Can create new enrollment | ❌ Transfer workflow |
| Waiting list | ❌ | ❌ Not scoped |
| Enrollment status | ✅ Backend (active/transferred/completed/withdrawn) | ⚠️ UI |

#### Attendance

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Daily check-in/out | ✅ Backend complete | ⚠️ UI workflow |
| Absence recording | ✅ Backend | ⚠️ UI |
| Pickup verification | ✅ Schema (picked_up_by_guardian_id) | ❌ Verification workflow UI |
| Bulk attendance | ❌ | ❌ Not implemented |
| Attendance reports | ❌ | ❌ Not implemented |
| Late pickup tracking | ❌ | ❌ Not scoped |

#### Dashboard & Operations

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Today's attendance overview | ❌ | ❌ Dashboard widgets |
| Check-in/out today | ❌ | ❌ Quick action UI |
| Students by classroom | ❌ | ❌ Overview widgets |
| Alerts/notifications | ❌ | ❌ Not implemented |
| Search across entities | ❌ | ❌ Global search |

#### Validation & Error Handling

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Form validation | ⚠️ Basic server-side | ❌ Client-side validation |
| Error states | ⚠️ ActionResult pattern | ❌ User-friendly error UI |
| Required field enforcement | ⚠️ Schema constraints | ❌ UI validation feedback |
| Duplicate prevention | ⚠️ Unique constraints | ❌ UI feedback |

#### Audit & History

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Created/Updated timestamps | ✅ All tables | ✅ Complete |
| Audit trail | ❌ | ❌ Not scoped for Phase 3 |
| Change history | ❌ | ❌ Not scoped for Phase 3 |

---

### Phase 4 — Preschool-Specific Operations

#### Daily Care

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Daily care log schema | ❌ | ❌ New table needed |
| Meals tracking | ❌ | ❌ Schema + logic |
| Nap/sleep tracking | ❌ | ❌ Schema + logic |
| Hygiene/bathroom | ❌ | ❌ Schema + logic |
| Daily observations/notes | ⚠️ attendance.notes exists | ❌ Dedicated daily log |
| Incident recording | ❌ | ❌ Schema + logic |
| Teacher notes | ⚠️ attendance.notes | ❌ Structured notes system |
| Daily report for parents | ❌ | ❌ Report generation |

#### Health & Medical

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Health profile schema | ❌ | ❌ New table needed |
| Allergies tracking | ⚠️ students.notes (unstructured) | ❌ Structured allergies table |
| Medical history | ❌ | ❌ Schema + logic |
| Height/weight tracking | ❌ | ❌ Schema + logic |
| Health incidents | ❌ | ❌ Schema + workflow |
| Immunization records | ❌ | ❌ Schema + logic (if required) |
| Medication authorization | ❌ | ❌ Not scoped |
| Emergency procedures | ❌ | ❌ Document management |

---

### Phase 5 — Commercial/Financial

#### Tuition & Fees

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Tuition plans schema | ❌ | ❌ New tables needed |
| Fee structure | ❌ | ❌ Schema + logic |
| Pricing by age group/class | ❌ | ❌ Logic needed |
| Registration fees | ❌ | ❌ Schema + logic |
| Additional charges | ❌ | ❌ Schema + logic |
| Discounts/waivers | ❌ | ❌ Schema + logic |

#### Billing & Receivables

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Invoice generation | ❌ | ❌ Logic + templates |
| Receivables tracking | ❌ | ❌ Schema + logic |
| Payment recording | ❌ | ❌ Schema + logic |
| Payment status | ❌ | ❌ Logic + UI |
| Overdue tracking | ❌ | ❌ Logic + alerts |
| Receipt generation | ❌ | ❌ Logic + templates |

#### Financial Reporting

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Revenue reports | ❌ | ❌ Reporting logic |
| Receivables reports | ❌ | ❌ Reporting logic |
| Payment collection reports | ❌ | ❌ Reporting logic |
| Financial dashboard | ❌ | ❌ Dashboard widgets |

**Note:** May be able to reuse Platform Core financial capabilities if they exist.

---

### Phase 6 — Parent Experience

#### Parent Portal

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Parent account/login | ❌ | ❌ Parent user type + auth |
| Parent profile | ❌ | ❌ Schema + logic |
| Parent-child relationship | ⚠️ Via guardian link | ❌ Portal access logic |

#### Parent Views

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Child profile view | ❌ | ❌ Parent UI |
| Attendance view | ❌ | ❌ Parent UI |
| Daily care view | ❌ | ❌ Parent UI (requires Phase 4) |
| Health information view | ❌ | ❌ Parent UI (requires Phase 4) |
| Tuition/billing view | ❌ | ❌ Parent UI (requires Phase 5) |

#### Parent Communication

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Announcements | ❌ | ❌ Schema + logic + UI |
| Notifications | ❌ | ❌ Notification system |
| Direct messaging | ❌ | ❌ Not scoped |
| Photo sharing | ❌ | ❌ Not scoped |

#### Parent Actions

| Capability | Current Status | Gap |
|------------|---------------|-----|
| Authorized pickup list | ⚠️ Schema exists | ❌ Parent UI to manage |
| Absence notification | ❌ | ❌ Logic + UI |
| Payment (if online) | ❌ | ❌ Payment integration |

---

## Summary: Current vs Required

### What Exists (Phase 2A ✅)

**Database Foundation:**
- ✅ 5 core tables with RLS
- ✅ Student → Guardian → Classroom → Enrollment → Attendance relationships
- ✅ Tenant isolation enforced

**Backend Logic:**
- ✅ Core CRUD operations (students, classrooms, attendance)
- ✅ Basic workflows (enrollment, check-in/out, absence)
- ✅ Platform reuse (auth, tenant context, DB)

**Testing:**
- ✅ 49/49 tests PASS (31 unit + 18 E2E)
- ✅ Verified workflows on real database with real auth
- ✅ Tenant isolation verified

**UI:**
- ✅ Basic navigation structure
- ⚠️ Detailed forms/workflows status unknown

### What's Missing for Commercial Product

**Immediate Gaps (Phase 3 — Core Operations):**

1. **Complete UI Implementation**
   - Student/Guardian/Classroom forms
   - Attendance daily workflow UI
   - Search/filter functionality
   - Profile detail pages

2. **Teacher Management**
   - Teacher CRUD
   - Teacher-classroom assignment workflow
   - Staff management (if needed)

3. **Enrollment Workflow**
   - Multi-step enrollment UI
   - Capacity validation
   - Transfer workflow

4. **Pickup Authorization**
   - Verification workflow
   - Authorization list management UI

5. **Dashboard Operations**
   - Today's attendance overview
   - Quick actions (check-in/out)
   - Operational alerts

6. **Validation & UX**
   - Form validation (client + server)
   - Error handling UI
   - Loading states
   - Success feedback

**Medium Priority (Phase 4 — Preschool Operations):**

1. **Daily Care System** (Critical for preschool differentiation)
   - Schema: daily_care_logs table
   - Meals, nap, hygiene tracking
   - Daily observations
   - Parent daily report

2. **Health & Medical**
   - Structured allergies
   - Medical incidents
   - Basic health tracking

**Lower Priority (Phase 5 & 6):**

1. **Financial System** (Depends on customer payment model)
2. **Parent Portal** (Requires Phase 4 daily care content)

---

## Recommended Implementation Sequence

### Sprint 1: Core Operations MVP (Highest Priority)

**Goal:** School can operate daily with the software

1. **Student Management UI**
   - Create/edit student form
   - Student list with search
   - Student profile page
   - Guardian management within student

2. **Classroom Management UI**
   - Create/edit classroom
   - Classroom list
   - Teacher assignment (basic)

3. **Daily Attendance Workflow**
   - Today's attendance view
   - Quick check-in/out
   - Mark absent
   - Pickup authorization check

4. **Basic Dashboard**
   - Today's attendance summary
   - Students by classroom
   - Quick navigation

**Acceptance:** School staff can manage students, classrooms, and daily attendance.

### Sprint 2: Operational Completeness

1. **Enrollment Workflow**
   - Enroll student UI
   - Transfer between classrooms
   - Enrollment history view

2. **Search & Filter**
   - Global search
   - Filter by status/classroom/age

3. **Validation & Error Handling**
   - Form validation
   - Error states
   - User feedback

4. **Reports (Basic)**
   - Attendance report
   - Student roster by classroom

**Acceptance:** School can fully operate without manual workarounds.

### Sprint 3: Preschool Differentiation (If Required by Customer)

1. **Daily Care System**
   - Daily care log schema
   - Meals/nap/hygiene tracking
   - Daily observations
   - Simple parent daily report

2. **Health Management**
   - Allergies (structured)
   - Health incidents
   - Medical notes

**Acceptance:** Product is clearly a preschool system, not generic student management.

### Sprint 4+: Commercial & Parent Portal (Based on Customer Priority)

1. **Financial System** (if customer needs billing)
2. **Parent Portal** (if customer wants parent access)

---

## Questions for Customer Requirements

Before proceeding, need to confirm:

### Must-Have vs Nice-to-Have

1. **Daily Care Tracking (Phase 4)**
   - Is this required for initial sale?
   - Or can it come in v1.1?

2. **Financial/Billing (Phase 5)**
   - Does customer handle billing externally?
   - Or must software manage tuition/payments?

3. **Parent Portal (Phase 6)**
   - Required for launch?
   - Or phased rollout (staff first, parents later)?

4. **Teacher Management**
   - Basic assignment enough?
   - Or need full teacher CRUD + roles?

5. **Reporting**
   - Which reports are critical?
   - Attendance? Enrollment? Financial?

### Integration Requirements

1. **Payment Processing**
   - External payment gateway needed?
   - Or manual payment recording sufficient?

2. **Photo/Document Storage**
   - Student photos required?
   - Document management (enrollment forms, medical records)?

3. **Communication**
   - Email/SMS notifications required?
   - Or manual communication acceptable?

### Scale & Performance

1. **School Size**
   - How many students?
   - How many classrooms?
   - How many staff users?

2. **Timeline**
   - When does customer need to go live?
   - Pilot vs full deployment?

---

## Next Steps

**Recommended approach:**

1. **Get Customer Requirements** — Confirm must-have vs nice-to-have
2. **Prioritize Sprints** — Based on customer timeline + criticality
3. **Implement Sprint 1** — Core Operations MVP
4. **Customer Validation** — Demo + feedback loop
5. **Iterate** — Sprint 2, 3, 4 based on validated priorities

**Do NOT build everything speculatively.**

**Build minimum viable → validate → iterate.**

---

## Status

🔍 **GAP ANALYSIS COMPLETE**  
⏸️ **AWAITING CUSTOMER REQUIREMENTS CONFIRMATION**

Ready to proceed with implementation once priorities confirmed.
