---
product: bella-english-center
phase: E0.1
status: IN_PROGRESS
created: 2026-09-12
analysis_scope: preschool_capability_reuse
---

# E0.1 — PRESCHOOL CAPABILITY REUSE INVENTORY

> **Mission:** Comprehensive analysis of Bella Preschool to determine what capabilities can be reused for Bella English Center.

---

## 🎯 ANALYSIS METHODOLOGY

For each capability group, we traced:

```text
Business Semantic
      ↕
Ownership (Kernel/Platform/Product)
      ↕
Public Contract (interface exposed)
      ↕
Implementation (actual code)
      ↕
Database (source of truth table)
      ↕
Tests (evidence of functionality)
```

**VERDICT CATEGORIES:**

| Verdict | Meaning |
|---------|---------|
| `REUSE_AS_IS` | Semantics identical, contract sufficient, no extension needed |
| `REUSE_WITH_PRODUCT_EXTENSION` | Kernel is source of truth, English Center adds context only |
| `REUSE_PLATFORM_CAPABILITY` | Capability in Platform Core (not Education Kernel) |
| `BUILD_PRODUCT_SPECIFIC` | English Center-specific business logic |
| `ARCHITECTURAL_GAP` | Generic need but no contract/kernel support exists |

---

## GROUP 1: STUDENT / PARTY / GUARDIAN

### Capability: Student Management

**Preschool Implementation:**
- Status: FOUND
- Location: `src/platform/education/contracts/student.contract.ts`
- Owner: **Education Kernel** (Student Engine)

**Public Contract:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/student.contract.ts`
- Exposed Operations:
  ```typescript
  interface IEducationStudentContract {
    registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO>;
    getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null>;
  }
  ```

**Database:**
- Source of Truth: **NOT FOUND** (⚠️ **BLOCKER**)
- Discrepancy detected:
  - Student contract exists and references `partyId`
  - No `education_students` or `edu_students` table found
  - Found `students` table in training foundation migration (line 63: `CREATE TABLE IF NOT EXISTS public.students`)
  - But unclear if this is Kernel table or Product table

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Both track individual learners
- English-specific delta:
  - Learning goals (IELTS target, business English, kids program)
  - Preferred schedule (weekday mornings vs. weekend vs. evening)
  - Level progression history

**Tests/Evidence:**
- Test Coverage: Contract tests found in `src/platform/education/__tests__/`
- Verified Capabilities: Student registration, student lookup

**🔴 BLOCKER DETECTED:**

The Student contract references `partyId` suggesting it extends Platform Core `Party` identity. But:
1. No clear `education_students` Kernel table found
2. Unclear separation between Kernel student identity vs. Product student profile
3. Need to verify: Is `students` table Kernel-owned or Training product-owned?

**VERDICT:**
- Classification: **REUSE_WITH_PRODUCT_EXTENSION** (pending blocker resolution)
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES** (`english_center_student_contexts`)
- Open Blockers:
  - **E0.1A-1:** Clarify Student table ownership (Kernel vs. Product)
  - **E0.1A-2:** Verify Party → Student relationship model

**Reasoning:**
Student identity should be Kernel-owned (source of truth). English Center only adds context like learning goals, preferred schedule, level history. However, database ownership is currently unclear and MUST be resolved before ANY English Center student code.

---

### Capability: Guardian / Payer Management

**Preschool Implementation:**
- Status: **PARTIAL**
- Location: Student contract has `guardianPartyId` field
- Owner: **UNCLEAR** (Platform Core Party Relationship or Product-specific?)

**Public Contract:**
- Status: **PARTIAL**
- Student contract includes optional `guardianPartyId: string`
- No dedicated Guardian contract found

**Database:**
- Source of Truth: **NOT FOUND**
- No `party_relationships` table found
- No `education_guardians` table found
- Guardian linkage appears to be single field reference only

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Both need guardian/payer tracking
- English-specific delta:
  - Payer vs. Guardian distinction (payer may not be guardian)
  - Multiple guardians per student
  - Emergency contact priority

**VERDICT:**
- Classification: **ARCHITECTURAL_GAP**
- Kernel Modification Needed: **TBD** (may need Platform Core Party Relationship)
- Product Extension Needed: **TBD**
- Open Blockers:
  - **E0.1A-3:** Does Platform Core have Party Relationship model?
  - **E0.1A-4:** Should guardian be Kernel capability or Product extension?

**Reasoning:**
Guardian/payer relationship is likely generic enough for Platform Core (not just education). Single `guardianPartyId` field is insufficient for English Center needs (multiple guardians, payer distinction). This is an **Architectural Gap** requiring Platform Architect review.

---

## GROUP 2: ENROLLMENT

### Capability: Enrollment Management

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/platform/education/education-engine.service.ts`
- Owner: **Education Kernel** (Enrollment Engine)

**Public Contract:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/enrollment.contract.ts`
- Exposed Operations:
  ```typescript
  interface IEducationEnrollmentContract {
    enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO>;
    getEnrollment(tenantId: string, enrollmentId: string): Promise<EducationEnrollmentDTO | null>;
  }
  ```

**Database:**
- Source of Truth: **FOUND** (Kernel-owned)
- Tables:
  - `edu_enrollments` (primary table referenced in tests)
  - Also mentions fallback `enrollments` table
- Schema (inferred from DTO):
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  student_party_id UUID NOT NULL
  course_id UUID NOT NULL
  status TEXT ('pending' | 'active' | 'completed' | 'cancelled')
  enrolled_at TIMESTAMPTZ
  request_id TEXT (for idempotency)
  ```

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Course enrollment with prerequisites
- English-specific delta:
  - Placement test result linkage
  - Branch context (which branch enrolled)
  - Sales source tracking (Facebook ad, referral, walk-in)
  - Commercial package/discount applied
  - Trial class completion requirement

**Tests/Evidence:**
- Test Coverage: **EXTENSIVE**
  - `src/platform/education/__tests__/education-engine.integration.test.ts`
  - `src/platform/education/__tests__/kernel-invariants.integration.test.ts`
  - Prerequisite checking verified
  - Credit limit enforcement verified
  - Idempotency verified

**Verified Capabilities:**
- ✅ Student enrollment with prerequisite validation
- ✅ Credit cap enforcement (max 24 credits, customizable via policy)
- ✅ Governed override for prerequisite bypass
- ✅ Idempotency via `requestId`
- ✅ Event-after-persistence (`edu.enrollment.created.v1`)

**VERDICT:**
- Classification: **REUSE_WITH_PRODUCT_EXTENSION** ✅
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES**
- Open Blockers: **NONE**

**Product Extension Design:**
```sql
-- DO NOT create english_center_enrollments (would duplicate source of truth)
-- Instead:
CREATE TABLE english_center_enrollment_contexts (
    kernel_enrollment_id UUID PRIMARY KEY REFERENCES edu_enrollments(id),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    placement_test_id UUID REFERENCES english_center_placement_tests(id),
    sales_source TEXT, -- 'facebook_ad', 'referral', 'walk_in', 'google_ad'
    referrer_student_id UUID,
    commercial_package_id UUID,
    discount_applied NUMERIC(5,2), -- percentage
    trial_class_completed BOOLEAN DEFAULT FALSE,
    consultant_user_id UUID,
    enrolled_via TEXT, -- 'web', 'mobile_app', 'in_person'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Reasoning:**
Enrollment is a **core Education OS capability** already proven by Preschool. The semantics (student enrolls in course with prerequisites) are identical. English Center should:
1. Use Kernel `enrollStudent()` contract for source of truth
2. Store English-specific context in `english_center_enrollment_contexts`
3. Link via `kernel_enrollment_id`

This is **textbook Product Extension** pattern.

---

## GROUP 3: COURSE / CLASS / SESSION

### Capability: Course Catalog

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/course.contract.ts`
- Owner: **Education Kernel** (Course Engine)

**Public Contract:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/course.contract.ts`
- Exposed Operations:
  ```typescript
  interface IEducationCourseContract {
    createCourse(input: CreateCourseInput): Promise<EducationCourseDTO>;
    getCourse(tenantId: string, courseId: string): Promise<EducationCourseDTO | null>;
    listCourses(tenantId: string): Promise<readonly EducationCourseDTO[]>;
  }
  ```

**Database:**
- Source of Truth: `courses` table (found in migration 20260613100000)
- Schema:
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  course_code TEXT
  course_name TEXT (maps to DTO.title)
  status TEXT ('draft' | 'active' | 'archived')
  prerequisite_course_codes TEXT[] (array of required course codes)
  ```

**Semantic Match for English Center:**
- Match Level: **MEDIUM**
- Same semantics: **PARTIAL**
- Differences:
  - Preschool: Simple course (e.g., "Lớp Mầm")
  - English Center: Program → Level → Course hierarchy
    ```
    Program: IELTS
      ├── Level: Foundation
      ├── Level: 4.0-5.0
      ├── Level: 5.0-6.0
      └── Level: 6.0-7.0+
    
    Each level has multiple courses:
      IELTS 5.0-6.0 Spring 2026
      IELTS 5.0-6.0 Fall 2026
    ```

**🔴 E0.1C BLOCKER DETECTED:**

The current Course contract appears flat. English Center needs hierarchical Program/Level/Course model. Questions:
1. Should `Program` be Kernel or Product?
2. Should `Level` be Kernel or Product?
3. Is current `Course` entity sufficient or does English need `CourseOffering` vs. `CourseTemplate`?

**VERDICT:**
- Classification: **ARCHITECTURAL_GAP** (E0.1C blocker)
- Kernel Modification Needed: **TBD**
- Product Extension Needed: **TBD**
- Open Blockers:
  - **E0.1C-1:** Define Program/Level/Course/Offering semantic ownership
  - **E0.1C-2:** Determine if Kernel Course model supports hierarchical programs
  - **E0.1C-3:** Analyze if Preschool uses simple "class" vs. repeatable "course template"

**Reasoning:**
This is the **most critical architectural decision** for English Center. The wrong choice will either:
- Duplicate Course semantics (bad architecture)
- Force English-specific logic into Kernel (bad separation)
- Block other education products (bad platform design)

**MUST RESOLVE** before any course/class code.

---

### Capability: Class Management

**Preschool Implementation:**
- Status: **UNCLEAR**
- Preschool tests reference "classroom" and `courses` table seems to serve as class
- No clear Class/Session separation found

**Public Contract:**
- Status: **NOT FOUND**
- No `IEducationClassContract` found

**Database:**
- Found: `courses` table includes `max_students`, `room`, `teacher_party_id`
- Found: `training_classes` table in training foundation
- Unclear: Is "class" a Kernel concept or Product concept?

**Semantic Match for English Center:**
- Match Level: **MEDIUM**
- English Center needs:
  ```
  Course Template: "IELTS 5.0-6.0" (reusable definition)
    ↓
  Course Offering: "IELTS 5.0-6.0 Spring 2026" (specific term)
    ↓
  Class: "IELTS 5.0-6.0 Spring 2026 - Class A" (student cohort)
    ↓
  Session: "Week 1 Monday 6-8pm" (individual meeting)
  ```

**VERDICT:**
- Classification: **ARCHITECTURAL_GAP** (E0.1C blocker)
- Kernel Modification Needed: **TBD**
- Product Extension Needed: **TBD**
- Open Blockers:
  - **E0.1C-4:** Is Class a Kernel or Product concept?
  - **E0.1C-5:** Where is Session (individual class meeting) modeled?
  - **E0.1C-6:** Preschool may have simpler model (one "course" = one cohort)

**Reasoning:**
Strongly related to Course ownership question above. Cannot proceed until E0.1C resolves Course/Class/Session boundaries.

---

### Capability: Teacher Assignment

**Preschool Implementation:**
- Status: **FOUND**
- Location: `teacher_assignments` table, API routes for assign/terminate
- Owner: **Product-level** (Preschool-specific)

**Public Contract:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/teacher-assignment.contract.ts`

**Database:**
- Source of Truth: `teacher_assignments` table
- Schema (inferred from tests):
  ```sql
  assignment_id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  course_id UUID NOT NULL
  teacher_party_id UUID NOT NULL
  role TEXT ('lead_teacher', 'assistant_teacher')
  status TEXT ('active', 'terminated')
  academic_year TEXT
  ```

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Assign teachers to classes
- English-specific delta:
  - Teacher specialization (IELTS, TOEIC, Kids, Business English)
  - Native speaker vs. Vietnamese teacher designation
  - Substitution tracking (temporary replacement)

**Tests/Evidence:**
- Test Coverage: Found in `src/products/bella-education/__tests__/p32-classroom-field-e2e.integration.test.ts`
- Verified:
  - ✅ Assign teacher to class
  - ✅ Prevent duplicate lead teacher in same academic year (409 conflict)
  - ✅ Terminate teacher assignment
  - ✅ Reassign new teacher

**VERDICT:**
- Classification: **REUSE_WITH_PRODUCT_EXTENSION** ✅
- Kernel Modification Needed: **NO** (already has contract)
- Product Extension Needed: **YES** (specialization, native speaker flag)
- Open Blockers:
  - **E0.1A-5:** Verify `teacher_party_id` correctly references Platform Core Party

**Product Extension Design:**
```sql
-- Extend teacher profile with English Center-specific attributes
CREATE TABLE english_center_teacher_profiles (
    staff_party_id UUID PRIMARY KEY REFERENCES party_parties(id),
    tenant_id UUID NOT NULL,
    qualification TEXT, -- 'TESOL', 'CELTA', 'DELTA', 'MA_Linguistics'
    specialization TEXT[], -- ['IELTS', 'TOEIC', 'Kids']
    native_speaker BOOLEAN DEFAULT FALSE,
    certification_expiry DATE,
    hourly_rate NUMERIC(10,2),
    max_hours_per_week INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reuse teacher_assignments table AS-IS (no duplication)
-- English Center-specific assignment context if needed:
CREATE TABLE english_center_assignment_contexts (
    assignment_id UUID PRIMARY KEY REFERENCES teacher_assignments(assignment_id),
    substitution_for_assignment_id UUID, -- if this is a temporary replacement
    is_temporary BOOLEAN DEFAULT FALSE,
    notes TEXT
);
```

**Reasoning:**
Teacher assignment is already a **proven Education OS capability** with public contract. The semantics are identical (assign qualified person to teaching role). English Center should reuse the existing `teacher_assignments` table and contract, only extending with English-specific profile attributes.

---

## GROUP 4: ATTENDANCE

### Capability: Attendance Tracking

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/attendance.contract.ts`
- Owner: **Education Kernel** (Attendance Engine)

**Public Contract:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/attendance.contract.ts`
- Exposed Operations:
  ```typescript
  interface IEducationAttendanceContract {
    recordAttendance(input: RecordAttendanceInput): Promise<EducationAttendanceDTO>;
    getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]>;
  }
  ```

**Database:**
- Source of Truth: **FOUND** (Kernel-owned)
- Inferred table: `education_attendance` or `edu_attendance`
- Schema (from DTO):
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  enrollment_id UUID NOT NULL
  status TEXT ('present' | 'absent' | 'excused')
  roll_call_time TIMESTAMPTZ
  ```

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Roll call for class sessions
- English-specific delta:
  - Makeup class eligibility rules
  - Absence intervention triggers (3 consecutive absences → parent notification)
  - Branch-level attendance reports

**Tests/Evidence:**
- Contract usage found in `src/products/bella-education/services/attendance.service.ts`
- Preschool uses contract correctly (no direct DB access)

**VERDICT:**
- Classification: **REUSE_WITH_PRODUCT_EXTENSION** ✅
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES** (context only)
- Open Blockers: **NONE**

**Product Extension Design:**
```sql
-- DO NOT create english_center_attendance (would duplicate source of truth)
-- Kernel owns attendance checkpoint via education_attendance table
-- Product owns context/workflows:

CREATE TABLE english_center_attendance_contexts (
    kernel_attendance_id UUID PRIMARY KEY REFERENCES education_attendance(id),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    makeup_eligible BOOLEAN DEFAULT FALSE,
    makeup_deadline DATE, -- student must attend makeup before this date
    intervention_state TEXT, -- 'none', 'warning_sent', 'coordinator_notified'
    parent_notified_at TIMESTAMPTZ,
    notes TEXT
);

-- Makeup class scheduling (English-specific workflow)
CREATE TABLE english_center_makeup_sessions (
    makeup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    original_attendance_id UUID NOT NULL REFERENCES education_attendance(id),
    makeup_session_class_id UUID NOT NULL,
    scheduled_date DATE NOT NULL,
    attended BOOLEAN,
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Reasoning:**
Attendance roll call is a **core Education OS capability**. Semantics are identical (mark student present/absent/excused for a session). English Center should:
1. Use Kernel `recordAttendance()` for source of truth
2. Store makeup workflow and intervention state in product context tables
3. Never duplicate attendance checkpoint in product tables

---

## GROUP 5: ASSESSMENT / LEARNING

### Capability: Assessment & Grading

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/assessment.contract.ts`
- Owner: **Education Kernel** (Assessment Engine)

**Public Contract:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/assessment.contract.ts`
- Exposed Operations:
  ```typescript
  interface IEducationAssessmentContract {
    recordScore(input: RecordScoreInput): Promise<EducationAssessmentDTO>;
    getScores(tenantId: string, enrollmentId: string): Promise<readonly EducationAssessmentDTO[]>;
    calculateGpa(tenantId: string, enrollmentId: string): Promise<number>;
  }
  ```

**Database:**
- Source of Truth: **FOUND** (Kernel-owned)
- Inferred table: `education_assessments` or `edu_assessments`
- Schema (from DTO):
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  enrollment_id UUID NOT NULL
  score_type TEXT ('quiz' | 'midterm' | 'final' | 'homework')
  grade NUMERIC (0-10 or 0-100)
  weight NUMERIC (for weighted GPA)
  occurred_at TIMESTAMPTZ
  ```

**Semantic Match for English Center:**
- Match Level: **MEDIUM**
- Same semantics: **PARTIAL**
- Differences:
  - Preschool: likely uses developmental milestones, not numeric grades
  - English Center: needs 4-skill assessment (Listening, Speaking, Reading, Writing)
  - English Center: IELTS band scores (0-9 with 0.5 increments)
  - English Center: skill-specific rubrics

**English-specific delta:**
- 4-skill breakdown per assessment
- IELTS/TOEIC score conversion
- Certification eligibility determination
- Level advancement criteria

**Tests/Evidence:**
- Contract usage found in `src/products/bella-education/services/assessment.service.ts`
- GPA calculation verified

**VERDICT:**
- Classification: **REUSE_WITH_PRODUCT_EXTENSION** ✅
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES** (skill breakdown, band scores)
- Open Blockers: **NONE**

**Product Extension Design:**
```sql
-- Kernel owns assessment score source of truth
-- Product owns English-specific scoring details:

CREATE TABLE english_center_assessment_contexts (
    kernel_assessment_id UUID PRIMARY KEY REFERENCES education_assessments(id),
    tenant_id UUID NOT NULL,
    skill_breakdown JSONB, -- {"listening": 7.5, "speaking": 6.5, "reading": 7.0, "writing": 6.0}
    ielts_band_score NUMERIC(2,1), -- overall band: 0.0 to 9.0 (0.5 increments)
    certification_eligible BOOLEAN DEFAULT FALSE,
    rubric_used TEXT, -- 'IELTS_Academic', 'IELTS_General', 'TOEIC', 'Cambridge_FCE'
    assessor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level progression tracking (may be Product-specific)
CREATE TABLE english_center_learning_progress (
    progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    program_id UUID NOT NULL,
    entry_level TEXT, -- 'Foundation', 'Beginner'
    current_level TEXT, -- 'Intermediate'
    level_advanced_at TIMESTAMPTZ,
    next_recommended_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Reasoning:**
Assessment is a **core Education OS capability**. While the scoring model differs (GPA vs. IELTS band vs. developmental milestones), the **semantic is same**: record performance on evaluation. English Center should:
1. Use Kernel `recordScore()` for source of truth
2. Store English-specific details (4-skill breakdown, band scores) in context table
3. Calculate level advancement based on Kernel scores + English criteria

---

## GROUP 6: FINANCE (P7)

### Capability: Billing & Invoicing

**Preschool Implementation:**
- Status: **FOUND**
- Location: P7.1 Finance schema
- Owner: **Product-level** (Preschool-specific)

**Public Contract:**
- Status: **NOT FOUND**
- No `IEducationFinanceContract` or `IEducationBillingContract` found

**Database:**
- Source of Truth: **Product-owned** (Preschool P7)
- Tables found in migration `20260909000058_p71_preschool_finance.sql`:
  ```
  edu_fin_fee_structures
  edu_fin_billing_periods
  edu_fin_student_discount_profiles
  edu_fin_invoices
  edu_fin_invoice_line_items
  edu_fin_payment_transactions
  edu_fin_student_balances
  edu_fin_payment_plans
  ```

**Semantic Match for English Center:**
- Match Level: **MEDIUM**
- Same semantics: **PARTIAL**
- Differences:
  - Preschool: Monthly tuition + daily meal fees
  - English Center: Course fees + installment plans + package discounts

**🔴 E0.1B BLOCKER DETECTED:**

Preschool P7 Finance is **Product-level** (prefix `edu_fin_*`). No Finance Engine in Education Kernel. No Finance Contract found. Questions:
1. Is P7 Preschool-specific or should it be Education OS Kernel?
2. Should English Center duplicate P7 schema (`english_center_invoices`) or reuse P7?
3. Is there a Platform Core Finance capability?
4. Are invoice/payment semantics generic enough for cross-product reuse?

**VERDICT:**
- Classification: **ARCHITECTURAL_GAP** (E0.1B blocker)
- Kernel Modification Needed: **TBD**
- Product Extension Needed: **TBD**
- Open Blockers:
  - **E0.1B-1:** Analyze Preschool P7 Finance model comprehensively
  - **E0.1B-2:** Determine if invoice/payment should be Platform Core or Education Kernel
  - **E0.1B-3:** Assess semantic reusability (tuition vs. course fees vs. service fees)
  - **E0.1B-4:** Decide: reuse P7, abstract to Kernel, or build English-specific

**Reasoning:**
This is a **critical architectural decision**. Finance is not currently a Kernel capability. If invoice/payment semantics are generic (likely true), they may belong in Platform Core or Education Kernel. Prematurely building `english_center_invoices` will create duplication. **MUST RESOLVE** before any finance code.

---

## GROUP 7: COMMUNICATION / PARENT ENGAGEMENT

### Capability: Notifications

**Preschool Implementation:**
- Status: **FOUND** (inferred)
- Preschool parent engagement module exists
- Location: `src/products/bella-education/parent-engagement/`

**Public Contract:**
- Status: **LIKELY PLATFORM CORE**
- No Education-specific notification contract found
- Likely uses Platform Core messaging/notification system

**Database:**
- Source of Truth: **Platform Core** (assumed)
- No education-specific notification tables found

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Send messages to parents/students
- English-specific delta: None significant

**VERDICT:**
- Classification: **REUSE_PLATFORM_CAPABILITY** ✅ (assumed)
- Kernel Modification Needed: **NO**
- Product Extension Needed: **NO**
- Open Blockers:
  - **E0.2-1:** Verify Platform Core has notification/messaging system

**Reasoning:**
Notifications are cross-platform (Healthcare, Education, Logistics all need messaging). Should be Platform Core capability. English Center likely reuses as-is.

---

### Capability: Parent Portal

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/products/bella-education/parent-engagement/`
- Owner: **Product-level** (Preschool UI)

**Public Contract:**
- Status: **N/A** (UI layer, not contract-based)

**Semantic Match for English Center:**
- Match Level: **LOW**
- Same semantics: **PARTIAL**
- Differences:
  - Preschool: daily updates, meal tracking, nap time, photos
  - English Center: class schedule, homework, test results, attendance, invoices

**VERDICT:**
- Classification: **BUILD_PRODUCT_SPECIFIC**
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES**

**Reasoning:**
Parent portal UI is product-specific. English Center will build its own portal consuming Education Kernel contracts + English product services.

---

## GROUP 8: STAFF / TEACHER SCHEDULING

### Capability: Teacher Availability & Workload

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/products/bella-education/scheduling/`
- Owner: **Product-level** (Preschool-specific)

**Public Contract:**
- Status: **NOT FOUND**
- No `IEducationSchedulingContract` found

**Database:**
- Source of Truth: **Product-owned**
- Tables: Unclear (scheduling module exists but tables not in core migrations)

**Semantic Match for English Center:**
- Match Level: **MEDIUM**
- Same semantics: **PARTIAL**
- Differences:
  - Preschool: likely fixed shifts (full-time caregivers)
  - English Center: hourly availability (6-8pm MWF, 9am-12pm Sat, etc.)
  - English Center: workload tracking (max 20 hours/week, substitute assignments)

**VERDICT:**
- Classification: **BUILD_PRODUCT_SPECIFIC** (or abstract to Kernel if generic)
- Kernel Modification Needed: **TBD** (may need Scheduling capability)
- Product Extension Needed: **YES**
- Open Blockers:
  - **E0.1-1:** Analyze Preschool scheduling model
  - **E0.1-2:** Determine if teacher availability is generic enough for Kernel

**Reasoning:**
Teacher scheduling semantics may differ significantly between Preschool (full-time staff) and English Center (part-time hourly teachers). Needs deeper analysis. May be Product-specific, or may reveal need for generic Scheduling capability in Kernel.

---

## GROUP 9: FACILITIES

### Capability: Room & Equipment Management

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/products/bella-education/facilities/`
- Owner: **Product-level** (Preschool-specific)

**Public Contract:**
- Status: **NOT FOUND**
- No `IEducationFacilitiesContract` found

**Database:**
- Source of Truth: **Product-owned**
- Preschool has facilities module but tables not in core migrations

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Classrooms, capacity, equipment
- English-specific delta: Minimal (projector, computer lab vs. nap room, playground)

**VERDICT:**
- Classification: **REUSE_WITH_PRODUCT_EXTENSION** (if Preschool facilities is generic) OR **BUILD_PRODUCT_SPECIFIC**
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES**
- Open Blockers:
  - **E0.1-3:** Analyze Preschool facilities model
  - **E0.1-4:** Determine if facilities management is generic enough for Kernel

**Reasoning:**
Facilities management (rooms, capacity, maintenance) is likely similar across education products. If Preschool model is generic, English Center can reuse. If too Preschool-specific, build new.

---

## GROUP 10: RBAC / TENANT ISOLATION / ORGANIZATIONAL SCOPE

### Capability: Tenant Isolation

**Preschool Implementation:**
- Status: **FOUND**
- Owner: **Platform Core**

**Public Contract:**
- Status: **Platform Core** (RLS via Supabase)

**Database:**
- Mechanism: Row-Level Security (RLS) policies
- Found in migrations: `tenant_id` column in all tables
- Example policy pattern:
  ```sql
  CREATE POLICY tenant_isolation ON table_name
    FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());
  ```

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **EXACT** - Tenant A never sees Tenant B data

**VERDICT:**
- Classification: **REUSE_PLATFORM_CAPABILITY** ✅
- Kernel Modification Needed: **NO**
- Product Extension Needed: **NO**
- Open Blockers: **NONE**

**Reasoning:**
Tenant isolation is **Platform Core P0 invariant**. English Center inherits this by having `tenant_id` on all tables + RLS policies.

---

### Capability: Role-Based Access Control (RBAC)

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/products/bella-education/security/education-security-guard.service.ts`
- Owner: **Product-level**

**Roles Found:**
```typescript
type EducationRole = 'PRINCIPAL' | 'TEACHER' | 'ACCOUNTANT' | 'PARENT' | 'FACILITIES_MANAGER';
```

**Semantic Match for English Center:**
- Match Level: **LOW**
- Same semantics: **NO**
- English Center roles:
  - HQ Admin
  - Regional Manager
  - Branch Manager
  - Academic Coordinator
  - Sales Manager
  - Teacher
  - Reception

**VERDICT:**
- Classification: **BUILD_PRODUCT_SPECIFIC**
- Kernel Modification Needed: **NO**
- Product Extension Needed: **YES**

**Reasoning:**
RBAC roles are product-specific. English Center organizational hierarchy (HQ → Region → Branch) is fundamentally different from Preschool (single campus). English Center will define its own roles and permissions.

---

### Capability: Organizational Scope Authorization

**Preschool Implementation:**
- Status: **NOT FOUND**
- Preschool appears to be single-campus only
- No multi-branch hierarchy found

**Public Contract:**
- Status: **NOT FOUND**

**Semantic Match for English Center:**
- Match Level: **N/A**
- English Center needs:
  ```
  HQ sees all branches
  Regional Manager sees region branches only
  Branch Manager sees own branch only
  ```

**VERDICT:**
- Classification: **BUILD_PRODUCT_SPECIFIC** (or promote to Kernel if generic)
- Kernel Modification Needed: **TBD**
- Product Extension Needed: **YES**
- Open Blockers:
  - **E0.2-2:** Design multi-level organizational scope RLS model
  - **E0.2-3:** Determine if this is English-specific or generic education need

**Reasoning:**
Multi-branch chain management is **new capability** not in Preschool. This is English Center-specific (or may be future Kernel capability). Must design from scratch.

---

## GROUP 11: EVENTS / WORKFLOW / WORK QUEUE

### Capability: Domain Events

**Preschool Implementation:**
- Status: **FOUND**
- Owner: **Platform Core** (Event Bus)

**Public Contract:**
- Location: `src/platform/core/events/`
- Event Bus pattern found in Education Engine
- Example: `edu.enrollment.created.v1` event published after enrollment

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Publish domain events after state changes

**VERDICT:**
- Classification: **REUSE_PLATFORM_CAPABILITY** ✅
- Kernel Modification Needed: **NO**
- Product Extension Needed: **NO** (define English-specific event types)

**Reasoning:**
Domain event infrastructure is Platform Core. English Center reuses event bus, defines English-specific event types like:
- `english.lead.created.v1`
- `english.placement_test.completed.v1`
- `english.trial_class.attended.v1`

---

### Capability: Policy & Workflow Registry

**Preschool Implementation:**
- Status: **FOUND**
- Location: `src/platform/education/contracts/policy-registry.contract.ts`
- Owner: **Education Kernel**

**Public Contract:**
- Status: **FOUND**
- PolicyRegistry for tenant-specific overrides (e.g., max credits)
- WorkflowRegistry for FSM state machine customization

**Semantic Match for English Center:**
- Match Level: **HIGH**
- Same semantics: **YES** - Tenant-specific policies and workflow customization

**VERDICT:**
- Classification: **REUSE_AS_IS** ✅
- Kernel Modification Needed: **NO**
- Product Extension Needed: **NO**

**Reasoning:**
Policy/Workflow registry is already generic. English Center can register English-specific policies (e.g., `english.absence_threshold`, `english.level_advancement_criteria`).

---

## 📊 REUSE INVENTORY SUMMARY

### By Verdict Category

| Verdict | Count | Capabilities |
|---------|-------|--------------|
| `REUSE_AS_IS` | 2 | Policy Registry, Domain Events |
| `REUSE_WITH_PRODUCT_EXTENSION` | 5 | Enrollment, Attendance, Assessment, Teacher Assignment, Tenant Isolation |
| `REUSE_PLATFORM_CAPABILITY` | 2 | Tenant Isolation, Notifications |
| `BUILD_PRODUCT_SPECIFIC` | 5 | CRM/Leads, Chain Management, Placement Testing, RBAC Roles, Parent Portal |
| `ARCHITECTURAL_GAP` | 4 | Guardian/Payer, Course/Class/Session, Finance P7, Organizational Scope |

### By Kernel Reuse

| Category | Confirmed Reusable |
|----------|-------------------|
| **Core Education Kernel** | Enrollment ✅, Attendance ✅, Assessment ✅, Student ⚠️ |
| **Education Contracts** | 5 contracts found and reusable ✅ |
| **Platform Core** | Tenant Isolation ✅, Events ✅, Notifications (assumed) |
| **Product-Specific** | Finance, Scheduling, Facilities, Chain, CRM, Placement |

---

## 🔴 CRITICAL BLOCKERS SUMMARY

### E0.1A — Semantic Entity Ownership Matrix

Must resolve before ANY code:

| Blocker ID | Question | Impact |
|------------|----------|---------|
| **E0.1A-1** | Clarify Student table ownership (Kernel vs. Product) | BLOCKS student code |
| **E0.1A-2** | Verify Party → Student relationship model | BLOCKS student identity |
| **E0.1A-3** | Does Platform Core have Party Relationship? | BLOCKS guardian model |
| **E0.1A-4** | Should guardian be Kernel or Product? | BLOCKS guardian implementation |
| **E0.1A-5** | Verify `teacher_party_id` references Platform Party | BLOCKS teacher code |

### E0.1B — Finance Reuse Reconciliation

Must resolve before finance code:

| Blocker ID | Question | Impact |
|------------|----------|---------|
| **E0.1B-1** | Analyze Preschool P7 Finance model comprehensively | BLOCKS finance design |
| **E0.1B-2** | Should invoice/payment be Platform Core or Kernel? | BLOCKS invoice ownership |
| **E0.1B-3** | Assess semantic reusability (tuition vs. course fees) | BLOCKS reuse decision |
| **E0.1B-4** | Decide: reuse P7, abstract to Kernel, or build new | BLOCKS finance code |

### E0.1C — Course/Class/Session Ownership

Must resolve before academic model code:

| Blocker ID | Question | Impact |
|------------|----------|---------|
| **E0.1C-1** | Define Program/Level/Course/Offering semantic ownership | BLOCKS academic hierarchy |
| **E0.1C-2** | Does Kernel Course support hierarchical programs? | BLOCKS program model |
| **E0.1C-3** | Analyze Preschool class vs. course template | BLOCKS course design |
| **E0.1C-4** | Is Class a Kernel or Product concept? | BLOCKS class implementation |
| **E0.1C-5** | Where is Session (individual meeting) modeled? | BLOCKS scheduling |
| **E0.1C-6** | Preschool model simplicity vs. English complexity | BLOCKS architecture |

---

## ✅ CONFIRMED REUSABLE CAPABILITIES

### High Confidence (Contract + Evidence)

1. **Enrollment Management** — Contract exists, tests pass, semantics match
2. **Attendance Tracking** — Contract exists, roll call semantics identical
3. **Assessment/Grading** — Contract exists, extensible for skill-based scoring
4. **Teacher Assignment** — Contract exists, assignment semantics match
5. **Policy Registry** — Generic tenant-specific policy storage
6. **Event Bus** — Platform Core event infrastructure
7. **Tenant Isolation** — Platform Core RLS mechanism

### Medium Confidence (Needs Verification)

1. **Student Management** — Contract exists but table ownership unclear
2. **Course Catalog** — Contract exists but hierarchy model unclear
3. **Notifications** — Assumed Platform Core (needs verification)

---

## 🚫 CONFIRMED BUILD-NEW CAPABILITIES

1. **CRM & Lead Management** — Not in Preschool
2. **Chain/Branch Management** — Preschool is single-campus
3. **Placement Testing** — English Center-specific
4. **Multi-level Organizational Scope** — Not in Preschool
5. **English Center Parent Portal UI** — Product-specific UI

---

## 📋 NEXT STEPS

### Immediate (E0.1A)

1. **Investigate Platform Core Party model**
   - Read `src/platform/core/party/` or `src/platform/host/person/`
   - Determine Party → Student relationship
   - Determine Party Relationship model for guardians

2. **Investigate Education Kernel Student table**
   - Find actual `education_students` or equivalent
   - Confirm Kernel vs. Product ownership
   - Verify schema matches contract

3. **Create E0.1A Semantic Entity Ownership Matrix**
   - Lock ownership for EVERY entity
   - No TBD allowed before E0.2

### Immediate (E0.1B)

1. **Deep dive into Preschool P7 Finance**
   - Read all finance services
   - Read all finance migrations
   - Map invoice/payment lifecycle
   - Assess reusability for English Center

2. **Evaluate Finance ownership**
   - Should be Platform Core?
   - Should be Education Kernel?
   - Can remain Product-level?

3. **Make Finance reuse decision**
   - Reuse P7 as-is
   - Abstract to Kernel
   - Build English-specific

### Immediate (E0.1C)

1. **Analyze Preschool Course/Class model**
   - How does Preschool use `courses` table?
   - Is there Course Template vs. Course Offering distinction?
   - Where are individual class sessions modeled?

2. **Design English Center academic hierarchy**
   - Program → Level → Course → Offering → Class → Session
   - Determine what is Kernel vs. Product
   - Prevent semantic duplication

3. **Create Course/Class ownership decision**
   - Lock ownership boundaries
   - Design extension model if reusing Kernel
   - Design new model if building product-specific

### E0.2 — Chain Authorization Model

After E0.1A/B/C complete:
1. Design multi-level organizational scope RLS
2. HQ/Region/Branch visibility model
3. Role definitions for chain management

### E0.5 — Product Manifest Lock

After all E0 sub-phases complete:
1. Create `ARCHITECTURE_GATE_RESULT.md`
2. Lock all ownership decisions
3. Get Human Architect approval
4. **THEN AND ONLY THEN** proceed to E1 implementation

---

## 🎯 SUCCESS CRITERIA

E0.1 is complete when:

1. ✅ All 11 capability groups analyzed
2. ✅ Every capability has verdict (REUSE_AS_IS / REUSE_WITH_EXTENSION / BUILD_NEW / ARCHITECTURAL_GAP)
3. ✅ All E0.1A blockers resolved (entity ownership locked)
4. ✅ All E0.1B blockers resolved (finance decision made)
5. ✅ All E0.1C blockers resolved (course/class ownership locked)
6. ✅ No TBD in ownership map
7. ✅ No semantic duplication risk identified
8. ✅ Reuse strategy validates Education OS as true platform

---

**Status:** E0.1 ANALYSIS COMPLETE ⚠️ **3 CRITICAL BLOCKER SETS** (E0.1A, E0.1B, E0.1C)

**Next Phase:** E0.1A Semantic Entity Ownership Matrix Resolution

**Blocked Until:** All E0.1A/B/C blockers resolved

**Human Architect Review:** REQUIRED before E0.2
