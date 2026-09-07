# Bella Preschool — Implementation Dependencies & Order

**Purpose:** Define implementation order based on technical and logical dependencies  
**Last Updated:** September 7, 2026

---

## Dependency Graph

```text
Platform Core (existing)
    ↓
P3.1 Navigation & Layout
    ↓
P3.2 Student Management ←─────────────┐
    ↓                                  │
P3.3 Guardian Management              │
    ↓                                  │
P3.4 Classroom Management             │
    ↓                                  │
P3.5 Enrollment ─────────────────────┘
    ↓
P3.6 Attendance
    ↓
P3.7 Dashboard ←──────────────────────┐
    │                                  │
    ├─→ P4 Daily Care ────────────────┤
    │       ↓                          │
    │   P4 Health                      │
    │       ↓                          │
    ├─→ P5 Tuition Plans               │
    │       ↓                          │
    │   P5 Student Billing             │
    │       ↓                          │
    │   P5 Payments & Receivables ─────┤
    │       ↓                          │
    ├─→ P6 Parent Auth                 │
    │       ↓                          │
    │   P6 Child Profile               │
    │       ↓                          │
    │   P6 Daily Timeline              │
    │       ↓                          │
    │   P6 Financial View              │
    │       ↓                          │
    │   P6 Communication ──────────────┤
    │                                  │
    ├─→ P7 Staff Management            │
    │       ↓                          │
    │   P7 Announcements ──────────────┤
    │       ↓                          │
    │   P7 Reports ────────────────────┤
    │       ↓                          │
    │   P7 Settings ───────────────────┤
    │                                  │
    └─→ P8 Polish & Readiness ←────────┘
```

---

## Critical Path

**Phase 1: Foundation (P3.1-P3.7)**

Must be completed in order. Each builds on previous.

```text
1. Navigation & Layout
   └─> Provides structure for all pages

2. Student Management
   └─> Core entity, needed by everything

3. Guardian Management
   └─> Requires Student (parent-child relationship)

4. Classroom Management
   └─> Independent entity, but conceptually follows Student

5. Enrollment
   └─> Links Student ↔ Classroom (requires both)

6. Attendance
   └─> Requires Enrollment (can only attend if enrolled)

7. Dashboard
   └─> Aggregates Student + Classroom + Attendance
```

**Estimated duration:** 3-4 weeks (full-time)

---

## Phase 2: Parallel Tracks (P4, P5, P6, P7)

After P3.7 complete, these can be developed in parallel:

### Track A: Daily Care (P4)
**Depends on:** P3 Student + Attendance  
**Duration:** 2-3 weeks

```text
P4.1 Daily Care Schema
    ↓
P4.2 Meal/Nap/Hygiene Recording
    ↓
P4.3 Observations & Incidents
    ↓
P4.4 Health & Allergies
    ↓
P4.5 Timeline View
```

### Track B: Tuition & Finance (P5)
**Depends on:** P3 Student + Enrollment  
**Duration:** 2-3 weeks

```text
P5.1 Platform Finance Check
    ↓
P5.2 Tuition Plans
    ↓
P5.3 Student Billing
    ↓
P5.4 Payment Recording
    ↓
P5.5 Receivables & Reports
```

### Track C: Parent Experience (P6)
**Depends on:** P3 (Student/Attendance) + P4 (Daily Care) + P5 (Finance)  
**Duration:** 2 weeks  
**⚠️ Must wait for P4 and P5 data to exist**

```text
P6.1 Parent Authentication
    ↓
P6.2 Child Profile View
    ↓
P6.3 Daily Timeline (uses P4 data)
    ↓
P6.4 Financial View (uses P5 data)
    ↓
P6.5 Communication
```

### Track D: School Management (P7)
**Depends on:** P3 only (minimal dependencies)  
**Duration:** 1-2 weeks

```text
P7.1 Staff Management (reuse Platform)
    ↓
P7.2 Teacher Assignments
    ↓
P7.3 Announcements
    ↓
P7.4 Reports (uses all P3-P6 data)
    ↓
P7.5 Settings
```

---

## Phase 3: Polish (P8)

**Depends on:** ALL features (P3-P7) complete  
**Duration:** 2 weeks  
**Cannot start until everything works**

```text
P8.1 UI Consistency Audit
    ↓
P8.2 Role-Aware Navigation
    ↓
P8.3 Demo Dataset
    ↓
P8.4 E2E Testing
    ↓
P8.5 Documentation
    ↓
P8.6 Performance Optimization
    ↓
P8.7 Deployment Verification
```

---

## Recommended Implementation Schedule

### Option A: Sequential (Safest)
**Total: 10-12 weeks**

```text
Week 1-4:  P3 Core Operations
Week 5-6:  P4 Daily Care
Week 7-8:  P5 Tuition & Finance
Week 9:    P6 Parent Experience
Week 10:   P7 School Management
Week 11-12: P8 Commercial Readiness
```

### Option B: Parallel (Faster, requires coordination)
**Total: 7-9 weeks**

```text
Week 1-4:  P3 Core Operations (blocking path)
Week 5-6:  P4 + P5 in parallel (Track A + B)
Week 7:    P7 (Track D, can overlap with P4/P5)
Week 8:    P6 (Track C, after P4/P5 complete)
Week 9:    P8 Polish & Readiness
```

**Recommended:** Option A for Factory/AI execution (fewer coordination points)

---

## Blocking Dependencies

### P3 → Everything
**Reason:** Student, Classroom, Attendance are core entities used everywhere  
**Impact:** Cannot start any other phase until P3 functional

### P4 + P5 → P6
**Reason:** Parent Experience displays data from Daily Care and Finance  
**Impact:** P6 timeline and financial views depend on P4/P5 tables existing

### P3-P7 → P8
**Reason:** Cannot polish what doesn't exist  
**Impact:** P8 must be last phase

---

## Data Dependencies

### Student Entity
**Used by:**
- P3.5 Enrollment
- P3.6 Attendance
- P4 All daily care
- P5 Tuition assignment
- P6 Parent view
- P7 Reports

**Must exist first.**

### Enrollment
**Used by:**
- P3.6 Attendance (can only attend if enrolled)
- P4 Daily care (implicitly for classroom context)
- P5 Tuition (often tied to enrollment period)

**Must exist before Attendance.**

### Daily Care Logs
**Used by:**
- P6 Parent timeline
- P7 Daily care reports

**P4 must complete before P6 timeline functional.**

### Financial Data
**Used by:**
- P6 Parent financial view
- P7 Financial reports

**P5 must complete before P6 financial features work.**

---

## Backend Action Dependencies

### Student Actions (P3.2)
```typescript
createStudentAction()    // Foundation
updateStudentAction()    // Requires create
getStudentAction()       // Requires create
listStudentsAction()     // Requires create
```

**Must implement in order: create → get/list → update**

### Classroom Actions (P3.4)
```typescript
createClassroomAction()  // Foundation
getClassroomAction()     // Requires create
listClassroomsAction()   // Requires create
updateClassroomAction()  // Requires create (P7)
```

### Enrollment (P3.5)
```typescript
enrollStudentAction(student_id, classroom_id)
// Requires: Student exists, Classroom exists
```

**Cannot implement until Student + Classroom actions exist.**

### Attendance (P3.6)
```typescript
checkInAction(student_id, date)
// Requires: Student enrolled in classroom
```

**Cannot implement until Enrollment works.**

### Daily Care (P4)
```typescript
recordMealAction(student_id, meal_data)
recordNapAction(student_id, nap_data)
// Requires: Student exists, preferably enrolled
```

**Can implement after Student exists, but conceptually follows Attendance.**

### Tuition (P5)
```typescript
assignTuitionPlanAction(student_id, plan_id)
// Requires: Student exists, Tuition plan exists
```

**Requires Student + Plan creation first.**

### Parent View (P6)
```typescript
getAuthorizedStudents(customer_id)
// Requires: Student-guardian junction
getDailyTimeline(student_id, date)
// Requires: Daily care logs (P4)
getStudentBalance(student_id)
// Requires: Financial data (P5)
```

**Cannot implement fully until P4 + P5 complete.**

---

## UI Dependencies

### Layout & Navigation (P3.1)
**Blocks:** All other UI pages  
**Reason:** Common wrapper for all pages

### Student List (P3.2)
**Enables:** Student profile, enrollment UI  
**Reason:** Entry point to student management

### Classroom List (P3.4)
**Enables:** Enrollment UI, attendance board  
**Reason:** Must select classroom before enrollment/attendance

### Attendance Board (P3.6)
**Enables:** Daily care entry  
**Reason:** Daily care often entered alongside attendance

### Dashboard (P3.7)
**Integrates:** All P3-P7 data  
**Reason:** Aggregates everything, must be built last in P3

---

## RLS Dependencies

### Tenant Isolation (Platform)
**Required for:** All tables  
**Must verify:** Before each phase deployment

### Parent Authorization (P6)
**Depends on:** `student_guardians` junction  
**Must implement:** Custom RLS for parent access

### Role-Based Access (P7)
**Depends on:** Platform roles  
**Must implement:** Role checks in UI + backend

---

## Testing Dependencies

### Unit Tests
**Can run:** Independently per action  
**No blocking dependencies**

### Integration Tests
**Depends on:** Multiple actions existing

Example:
```typescript
// Test: Complete enrollment flow
test('enroll student', async () => {
  const student = await createStudentAction(...);    // Requires P3.2
  const classroom = await createClassroomAction(...); // Requires P3.4
  const enrollment = await enrollStudentAction(...);  // Requires P3.5
  // All three must exist
});
```

### E2E Tests
**Depends on:** Full UI + backend for workflow

Example:
```typescript
// Test: Daily care workflow
test('teacher records daily care', async () => {
  // Requires: Student exists, enrolled, checked-in
  // Then: Record meal, nap, observation
  // Verify: Parent sees timeline
  // Needs: P3.2 + P3.5 + P3.6 + P4 + P6 all working
});
```

**E2E tests mostly in P8** after all features complete.

---

## Migration Dependencies

### Schema Migrations
**Order matters:**

```sql
-- 1. Core entities
CREATE TABLE preschool_students;
CREATE TABLE preschool_classrooms;

-- 2. Junctions (depend on core)
CREATE TABLE preschool_student_guardians;
CREATE TABLE preschool_enrollments;

-- 3. Transactional (depend on core + junctions)
CREATE TABLE preschool_attendance;
CREATE TABLE preschool_daily_care_logs;
CREATE TABLE preschool_charges;
CREATE TABLE preschool_payments;

-- 4. Supporting (depend on above)
CREATE TABLE preschool_announcements;
CREATE TABLE preschool_messages;
```

**Cannot create `enrollments` before `students` and `classrooms` exist.**

### RLS Policies
**Order:**

```sql
-- 1. Tenant isolation (all tables)
CREATE POLICY tenant_isolation ON preschool_students;
CREATE POLICY tenant_isolation ON preschool_classrooms;

-- 2. Role-based (staff access)
CREATE POLICY staff_access ON preschool_students;

-- 3. Parent access (after student_guardians exists)
CREATE POLICY parent_students ON preschool_students;
CREATE POLICY parent_care_logs ON preschool_daily_care_logs;
```

---

## Verification Checkpoints

### After P3 Complete
- ✅ Can create student with guardians
- ✅ Can create classroom
- ✅ Can enroll student in classroom
- ✅ Can check-in/check-out student
- ✅ Dashboard shows today's summary
- ✅ All P3 E2E tests pass

**Blocker:** If any fail, DO NOT proceed to P4-P7

### After P4 Complete
- ✅ Can record meal/nap/hygiene
- ✅ Can view daily timeline
- ✅ Can record observations/incidents
- ✅ Allergies stored properly
- ✅ All P4 tests pass

### After P5 Complete
- ✅ Can create tuition plans
- ✅ Can assign plan to student
- ✅ Can record payment
- ✅ Balance calculates correctly
- ✅ All P5 tests pass

### After P6 Complete
- ✅ Parent can authenticate
- ✅ Parent sees only own children
- ✅ Parent sees daily timeline
- ✅ Parent sees financial balance
- ✅ RLS prevents cross-family access
- ✅ All P6 tests pass

### After P7 Complete
- ✅ Can manage staff
- ✅ Can assign teachers to classrooms
- ✅ Can create announcements
- ✅ Reports generate correctly
- ✅ All P7 tests pass

### After P8 Complete
- ✅ UI consistent across all pages
- ✅ Demo flow completes smoothly
- ✅ All E2E tests pass
- ✅ Production build succeeds
- ✅ RLS verified
- ✅ Performance targets met
- ✅ Documentation complete
- ✅ **Commercial baseline achieved**

---

## Risk: Dependency Violations

**If you skip dependencies:**

### Example: Build P6 before P4
**Problem:** Parent timeline has no data to display  
**Impact:** Must refactor P6 UI after P4 complete

### Example: Build Attendance before Enrollment
**Problem:** Cannot determine which classroom student belongs to  
**Impact:** Logic errors, must refactor

### Example: Start P8 before P3-P7 complete
**Problem:** Polishing unfinished features  
**Impact:** Wasted work, must re-polish after features complete

---

## Dependency Enforcement

**How to prevent violations:**

1. **Automated checks:**
   ```typescript
   // In P6 parent timeline test
   beforeAll(async () => {
     // Verify P4 tables exist
     const tables = await checkTables(['preschool_daily_care_logs']);
     if (!tables.allExist) throw new Error('P4 not complete');
   });
   ```

2. **Manual checkpoints:**
   - Verify phase complete before starting next
   - Review evidence from previous phase
   - Confirm acceptance criteria met

3. **Implementation protocol:**
   - Follow PRD order: P3 → P4 → P5 → P6 → P7 → P8
   - Do not skip phases
   - Do not start phase until dependencies verified

---

## Summary

### Absolute Requirements

1. **P3 must complete first** — everything depends on it
2. **P4 + P5 before P6** — parent view needs data
3. **P3-P7 before P8** — cannot polish what doesn't exist

### Parallel Opportunities

1. **P4 + P5 can be parallel** — independent tracks (after P3)
2. **P7 can overlap with P4/P5** — minimal dependencies

### Sequential Requirements

1. **Within P3:** Navigation → Student → Guardian → Classroom → Enrollment → Attendance → Dashboard
2. **Within P4:** Schema → Recording actions → Timeline
3. **Within P5:** Platform check → Plans → Billing → Payments
4. **Within P6:** Auth → Profile → Timeline → Finance
5. **Within P8:** Features → Polish → Test → Deploy

---

## Final Implementation Order (Recommended)

```text
Week 1:   P3.1-P3.3 (Nav, Student, Guardian)
Week 2:   P3.4-P3.5 (Classroom, Enrollment)
Week 3:   P3.6-P3.7 (Attendance, Dashboard)
Week 4:   P3 verification + P4.1-P4.2 (Daily care foundation)
Week 5:   P4.3-P4.5 (Observations, health, timeline)
Week 6:   P5.1-P5.3 (Finance recon, plans, billing)
Week 7:   P5.4-P5.5 (Payments, reports) + P7.1-P7.2 (Staff)
Week 8:   P6.1-P6.3 (Parent auth, profile, timeline)
Week 9:   P6.4-P6.5 (Finance view, communication) + P7.3-P7.5 (Announcements, reports, settings)
Week 10:  P8.1-P8.3 (UI polish, demo data)
Week 11:  P8.4-P8.6 (Testing, docs, performance)
Week 12:  P8.7-P8.9 (Deployment, verification, DONE)
```

**Total: 12 weeks to commercial baseline**

**After Week 12:** Product ready for customer demos and deployment.
