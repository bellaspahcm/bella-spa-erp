---
product: Bella English Center
type: Product Roadmap
status: E1_IN_PROGRESS
date: 2026-09-12
---

# BELLA ENGLISH CENTER — PRODUCT ROADMAP

---

## 📊 OVERALL PROGRESS

```text
FOUNDATION (E0)                 ✅ SEALED
├─ Identity Remediation         ✅ SEALED
├─ Finance F3 AR Remediation    ✅ SEALED
└─ Org Unit Contract           ✅ SEALED

PRODUCT IMPLEMENTATION
├─ E1 Chain Management          🟡 RUNTIME VERIFICATION
├─ E2 Student Enrollment        ⏸️ BLOCKED (waiting E1 seal)
├─ E3 Program/Course/Class      ⏸️ BLOCKED
├─ E4 Teacher & Workforce       ⏸️ BLOCKED
├─ E5 Timetable & Scheduling    ⏸️ BLOCKED
├─ E6 Attendance & Learning     ⏸️ BLOCKED
├─ E7 Tuition & Billing         ⏸️ BLOCKED
├─ E8 Parent/Student Engagement ⏸️ BLOCKED
├─ E9 Chain Command Center      ⏸️ BLOCKED
└─ E10 Full Reconciliation & RC ⏸️ BLOCKED

CURRENT PRIORITY: E1 Runtime Verification (P0)
```

---

## E0: FOUNDATION ✅ SEALED

### E0.1A-R: Identity Remediation
- **Status:** 🔒 SEALED
- **Scope:** Platform IAM contract (848 parties, 37 tests)
- **Impact:** English Center can use identityEngine

### E0.1B-R: Finance F3 AR Contract
- **Status:** 🔒 SEALED
- **Scope:** Platform Finance AR contract (68/68 tests)
- **Impact:** English Center can use arEngine for tuition receivables

### E0.1D-R: Org Unit Contract
- **Status:** 🔒 SEALED
- **Scope:** Platform Org Unit contract (44 tests: 29 unit + 15 integration)
- **Impact:** English Center (and all future products) can use orgUnitEngine

**E0 Readiness:** 7/7 ✅ COMPLETE

---

## E1: CHAIN MANAGEMENT 🟡 IN PROGRESS

### Scope
- Company → Region → Branch hierarchy
- Branch metadata (address, capacity, contact)
- Branch lifecycle (create, update, archive)
- Branch selection UI (dropdown, tree view)
- Academic-to-branch mapping (enrollments, courses at branch)

### Status: Implementation Complete, Runtime Verification Pending

**Implementation:** ✅ COMPLETE
- Service layer (EnglishBranchService)
- Repository layer (EnglishBranchRepository)
- Database migration (branch_id to education tables)
- API routes (GET/POST/PATCH/DELETE + hierarchy)
- UI components (BranchSelector, BranchHierarchyTree)
- Tests (36/36 PASS: 29 Platform + 7 Product)

**Build:** ✅ PASS (52s compile)

**Runtime Verification:** ⏸️ PENDING
- Migration deployment
- API smoke tests
- Tenant isolation
- Branch authorization
- UI rendering
- E2E flow
- Evidence reconciliation

**Seal Criteria:** 11/19 complete

**Blocker:** Staging/CI environment needed for runtime tests

**Priority:** **P0 — MUST COMPLETE BEFORE E2-E10**

**Next:** Execute `E1_RUNTIME_VERIFICATION_PLAN.md`

---

## E2: STUDENT ENROLLMENT & BRANCH ASSIGNMENT ⏸️ BLOCKED

**Blocked By:** E1 runtime verification (branch scope must be proven first)

### Planned Scope
- Student registration (basic info, contact, emergency)
- Enrollment to courses/programs at specific branch
- Enrollment status lifecycle (pending → active → completed → withdrawn)
- Branch transfer (student moves from branch-q1 to branch-q3)
- Enrollment history (track all enrollments per student)
- Branch-scoped student queries (all students at branch-q1)

### Dependencies
- ✅ Platform Identity (students as Parties)
- ✅ Platform Org Unit (branch assignment)
- ⏸️ E1 branch scope proven (must complete runtime verification)

### Technical Design
- **Student table:** Extend `parties` or create `students` table with branch_id
- **Enrollment table:** Already has branch_id (E1 migration)
- **Branch transfer:** History log + update current branch_id
- **Queries:** Scoped by branch for multi-branch centers

### Exit Criteria
- Student CRUD operations
- Enrollment with branch assignment
- Branch transfer workflow
- Branch-scoped student list
- Tenant isolation verified
- Tests: unit + integration + E2E

---

## E3: PROGRAM / COURSE / CLASS MANAGEMENT ⏸️ BLOCKED

**Blocked By:** E2 (students must exist before class enrollment)

### Planned Scope
- **Program:** English program structure (Basic → Intermediate → Advanced)
- **Course:** Individual courses within program (English 101, 102, etc.)
- **Class:** Scheduled class instances (English 101 Mon/Wed 6-8pm, Instructor X, Room 201, Branch Q1)
- Course-to-branch assignment (course offered at which branches)
- Class capacity management
- Class status (draft → active → completed → cancelled)

### Dependencies
- ✅ E1 branch management
- ⏸️ E2 student enrollment (students enroll in classes)
- ⏸️ E4 teachers (classes need instructors)

### Technical Design
- **Programs table:** program_id, name, description, duration, prerequisites
- **Courses table:** Already exists, add program_id FK
- **Classes table:** class_id, course_id, branch_id, teacher_id, room, schedule, capacity, status
- **Class enrollment:** Link students to class instances

---

## E4: TEACHER & ACADEMIC WORKFORCE ⏸️ BLOCKED

**Blocked By:** E3 (teachers assigned to classes)

### Planned Scope
- Teacher registration (profile, qualifications, subjects, experience)
- Teacher-to-branch assignment (primary branch + teaches at multiple)
- Teacher availability/schedule
- Teacher-class assignment
- Teacher performance tracking (student feedback, retention)
- Substitute teacher workflow

### Dependencies
- ✅ E1 branch management
- ✅ Platform Identity (teachers as Parties)
- ⏸️ E3 classes (teachers teach classes)

### Technical Design
- **Teachers table:** teacher_id, party_id, primary_branch_id, subjects, qualifications
- **Teacher availability:** day_of_week, time_slot, branch_id
- **Teacher assignments:** teacher_id, class_id, role (primary/substitute)

---

## E5: TIMETABLE & ROOM SCHEDULING ⏸️ BLOCKED

**Blocked By:** E4 (teachers + classes must exist)

### Planned Scope
- Room management (room_id, branch_id, capacity, equipment)
- Timetable scheduling (class schedule per branch)
- Conflict detection (teacher double-booking, room overlap)
- Schedule changes (reschedule class, swap rooms)
- Calendar view (per teacher, per branch, per room)

### Dependencies
- ✅ E1 branch management
- ⏸️ E3 classes
- ⏸️ E4 teachers

### Technical Design
- **Rooms table:** room_id, branch_id, name, capacity, equipment
- **Schedules table:** schedule_id, class_id, room_id, teacher_id, day, time_start, time_end
- **Conflict checks:** RPC functions for overlap detection

---

## E6: ATTENDANCE & LEARNING OPERATIONS ⏸️ BLOCKED

**Blocked By:** E5 (attendance tracks scheduled class sessions)

### Planned Scope
- Daily attendance tracking (present/absent/late/excused)
- Attendance reports (by student, by class, by branch)
- Learning content delivery (assignments, materials)
- Student progress tracking (lessons completed, scores)
- Homework submission
- In-class notes/observations

### Dependencies
- ⏸️ E2 students
- ⏸️ E3 classes
- ⏸️ E5 scheduled sessions

### Technical Design
- **Attendance table:** attendance_id, class_session_id, student_id, status, timestamp
- **Progress table:** student_id, lesson_id, status, score, completed_at
- **Assignments table:** assignment_id, class_id, due_date, submissions

---

## E7: TUITION & BILLING ⏸️ BLOCKED

**Blocked By:** E2 (tuition tied to enrollments)

### Planned Scope
- Tuition fee structure (per course, per program, per branch)
- Invoice generation (enrollment triggers invoice)
- Payment recording (cash, transfer, installments)
- Accounts receivable aging (overdue invoices)
- Discount/scholarship application
- Financial reports per branch

### Dependencies
- ✅ Platform Finance F3 AR contract
- ⏸️ E2 student enrollment (invoices tied to enrollments)

### Technical Design
- **Use Platform F3 AR:** ar_invoices, ar_payments via arEngine
- **Tuition rates:** tuition_rates table (course_id, branch_id, amount, currency)
- **Invoice generation:** Triggered by enrollment creation
- **Branch reports:** Aggregate AR by branch_id

---

## E8: PARENT/STUDENT ENGAGEMENT ⏸️ BLOCKED

**Blocked By:** E2-E6 (engagement features depend on enrollment/attendance/progress data)

### Planned Scope
- Parent portal (view child's schedule, attendance, progress, invoices)
- Notifications (class reminders, payment reminders, announcements)
- Student portal (view schedule, assignments, grades)
- Communication (messages between parents/teachers/admin)
- Event calendar (holidays, exams, parent-teacher meetings)

### Dependencies
- ⏸️ E2 students
- ⏸️ E6 attendance/progress
- ⏸️ E7 billing

### Technical Design
- **Portal access:** JWT tokens scoped to parent/student role
- **Notifications:** Event-driven via Platform event bus
- **Messages:** messages table (sender, recipient, subject, body, thread_id)

---

## E9: CHAIN COMMAND CENTER ⏸️ BLOCKED

**Blocked By:** E2-E8 (dashboard aggregates data from all features)

### Planned Scope
- Chain-wide KPIs (total enrollments, revenue, teacher count)
- Branch comparison (rank branches by enrollments, revenue, retention)
- Exception queue (overdue invoices, low attendance, capacity alerts)
- Real-time dashboards (enrollment trends, revenue trends)
- Executive reports (monthly summary, quarterly growth)

### Dependencies
- ⏸️ All E2-E8 features (data sources)

### Technical Design
- **Aggregate views:** Materialized views per branch
- **KPI calculations:** SQL RPCs for performance
- **Dashboard API:** Caching layer for real-time updates
- **Alerts:** Rule engine for threshold breaches

---

## E10: FULL PRODUCT RECONCILIATION & RC ⏸️ BLOCKED

**Blocked By:** E2-E9 (all features must be complete)

### Planned Scope
- Full E2E tests (enrollment → payment → attendance → graduation)
- UI flow tests (all screens navigable, no broken links)
- Regression suite (all features work together)
- Performance testing (load, stress, scalability)
- Security audit (auth, authorization, data protection)
- Documentation (user guide, admin guide, API docs)
- Release Candidate build

### Exit Criteria
- [ ] All E2-E9 features implemented + tested
- [ ] Full E2E test suite passing
- [ ] No P0/P1 bugs
- [ ] Documentation complete
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] RC build deployed to staging
- [ ] User acceptance testing complete

**After E10 SEALED:** Bella English Center → Production Ready

---

## 📅 ESTIMATED TIMELINE

```text
Current Date: 2026-09-12

E1 Runtime Verification     1-2 days   (manual environment setup + tests)
E1 Seal                     +1 day     (evidence reconciliation)

E2 Student Enrollment       2-3 days   (autonomous execution)
E3 Program/Course/Class     3-4 days   (autonomous execution)
E4 Teacher & Workforce      2-3 days   (autonomous execution)
E5 Timetable & Scheduling   3-4 days   (autonomous execution)
E6 Attendance & Learning    3-4 days   (autonomous execution)
E7 Tuition & Billing        2-3 days   (use Platform F3)
E8 Parent/Student Engagement 3-4 days  (autonomous execution)
E9 Chain Command Center     2-3 days   (dashboards + reports)
E10 Reconciliation & RC     3-5 days   (E2E + documentation)

TOTAL ESTIMATE: 24-35 days from E1 seal
```

**Note:** Timeline assumes autonomous execution with no architectural blockers. Actual duration may vary based on:
- Complexity of business rules discovered during implementation
- Integration testing findings
- User feedback iterations

---

## 🎯 CURRENT PRIORITY

**P0: E1 Runtime Verification**

**Action:** Execute `E1_RUNTIME_VERIFICATION_PLAN.md`

**Blocker:** Staging/CI environment

**After E1 SEALED:** Autonomous execution E2 → E10 (report milestones only)

---

## 📌 ARCHITECTURE PRINCIPLES

**Platform First:**
- Always check if Platform has capability before building product-specific
- Consume Platform contracts, don't duplicate Kernel logic
- Elevate to Platform if multiple products need same capability

**Autonomous Execution:**
- AI self-executes implementation → test → verify → seal
- Human approval only for: architecture gaps, ambiguous business decisions, high-risk migrations
- Report milestones, not ask permission for routine steps

**Evidence-Based Sealing:**
- Features sealed only after runtime verification
- 19-point checklist: implementation + build + runtime + architecture
- No "buildable but not verified" production deployments

**Reusability:**
- English Center patterns reusable by Preschool/Spa/Clinic/Hospital
- Platform contracts stable across products
- Product-specific logic stays in product namespace

---

**Date:** 2026-09-12  
**Status:** E1 runtime verification — E2-E10 roadmap defined  
**Next:** Deploy to staging → verify → seal E1 → proceed E2
