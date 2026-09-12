---
product: bella-english-center
phase: E0.1A
status: IN_PROGRESS
created: 2026-09-12
analysis_scope: semantic_entity_ownership
---

# E0.1A — SEMANTIC ENTITY OWNERSHIP MATRIX

> **Mission:** Lock ownership for EVERY entity to prevent semantic duplication. Apply Single Writer Principle.

---

## 🎯 METHODOLOGY

For each entity, we verify:

```text
1. Semantic Definition (what is this entity?)
2. Actual Code Owner (who implements it?)
3. Persistence/Source-of-Truth Owner (which table?)
4. Public Access Path (contract/API available?)
```

**Single Writer Principle:**
> For a canonical entity/state, only ONE bounded context is the authoritative writer.

---

## FINDING 1: STUDENT IDENTITY

### Evidence Chain

**1. Semantic Definition:**
- Student = Educational role assigned to a Person/Party
- Represents academic identity (student code, academic status, enrollment date)
- **NOT** a separate person identity

**2. Code Implementation:**
- Location: `src/platform/education/student/`
- Service: `StudentService` (Education Kernel)
- Aggregate: `StudentAggregate`
- Contract: `IEducationStudentContract` (`src/platform/education/contracts/student.contract.ts`)

**3. Database Source of Truth:**
- Table: `public.students`
- Owner: **Education Kernel** (⚠️ BUT see discrepancy below)
- Schema:
  ```sql
  student_id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  person_id UUID NOT NULL REFERENCES public.persons(id)  -- 🔴 FOUND FK
  student_code TEXT UNIQUE
  academic_status TEXT
  enrollment_type TEXT
  program_id TEXT
  enrollment_date DATE
  gpa NUMERIC(3,2)
  total_credits INTEGER
  metadata JSONB
  ```

**4. Public Contract:**
```typescript
interface IEducationStudentContract {
  registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO>;
  getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null>;
}

interface RegisterStudentInput {
  tenantId: string;
  partyId: string; // references generic Party profile identity
  studentCode: string;
  guardianPartyId?: string;
}
```

### Critical Findings

**✅ CONFIRMED ARCHITECTURE:**

```text
Platform Core Party
        │
        ├── person_id (identity aggregate root)
        │
        ▼
Education Kernel Student
        │
        ├── student_code (education-specific ID)
        ├── academic_status (education state)
        └── program_id (education context)
```

**Contract correctly uses `partyId` not `personId`:**
```typescript
// student.contract.impl.ts line 9
personId: input.partyId, // references generic Party profile identity
```

**BUT:**

🔴 **DISCREPANCY DETECTED:** 
- Database FK: `person_id → public.persons(id)`
- Contract interface: `partyId: string`
- Platform Core has: `public.party_parties` table

**Questions:**
1. Is `public.persons` an alias/view of `party_parties`?
2. Or is there legacy Person model separate from Party?
3. Should Student reference `party_parties.id` directly?

**Evidence of Platform Party:**
- ✅ Found: `src/platform/party/index.ts` with `PartyEngine`
- ✅ Found: `public.party_parties` table in migration `20260806000000`
- ✅ Found: `party_roles` table for cross-vertical roles
- ✅ Found: `party_relationships` table for guardian/parent relationships

**Evidence of Person vs. Party:**
- ⚠️ Student Service uses `PersonRepository` from `@/platform/host/person/`
- ⚠️ FK constraint: `students_person_fk REFERENCES public.persons(id)`
- ⚠️ Contract says `partyId` but implementation uses `personId`

### Verdict

**Classification:** `REUSE_WITH_PRODUCT_EXTENSION` ⚠️ (PENDING FK CLARIFICATION)

**Canonical Owner:** **Education Kernel**

**Source of Truth:** `public.students` table (Education Kernel-owned)

**Single Writer:** **Education Kernel StudentService**

**Product Extension Allowed:** **YES**

**English Center Pattern:**
```sql
-- DO NOT create english_center_students (would duplicate identity)
-- Kernel owns student identity via public.students
-- Product owns English-specific context:

CREATE TABLE english_center_student_contexts (
    student_id UUID PRIMARY KEY REFERENCES public.students(student_id),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    placement_test_score NUMERIC,
    entry_level TEXT, -- 'Foundation', 'Beginner', 'Intermediate'
    current_level TEXT,
    learning_goals JSONB, -- ["IELTS 7.0", "Business English"]
    preferred_schedule JSONB, -- {"weekdays": ["Mon", "Wed"], "time": "18:00-20:00"}
    english_proficiency_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Open Blockers:**
- **E0.1A-1:** Clarify Person vs. Party relationship
  - Is `public.persons` same as `party_parties`?
  - Should Student FK reference `party_parties.id` instead?
  - Is Platform migrating from Person to Party model?

**Recommendation:**
- English Center should use Education Student contract AS-IS
- Wait for Person/Party clarification before implementing guardian model
- Extension pattern is correct: separate context table, no identity duplication

---

## FINDING 2: GUARDIAN / PAYER IDENTITY

### Evidence Chain

**1. Semantic Definition:**
- Guardian = Person with legal responsibility for student
- Payer = Person financially responsible for student fees
- **MAY be the same person or different persons**
- Relationship type, not separate identity

**2. Code Implementation:**
- Status: **PARTIAL** — contract mentions `guardianPartyId` but no dedicated service
- Student Contract has optional field: `guardianPartyId?: string`
- No `IGuardianContract` found
- No Guardian Service found

**3. Database Source of Truth:**
- Status: **NOT FOUND AS DEDICATED TABLE**
- Platform Core has: `public.party_relationships` table
- Schema:
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  source_party_id UUID NOT NULL REFERENCES party_parties(id)
  target_party_id UUID NOT NULL REFERENCES party_parties(id)
  relationship_type TEXT -- 'parent_of', 'guardian_of', 'works_for', etc.
  attributes JSONB
  active_from TIMESTAMPTZ
  active_to TIMESTAMPTZ
  ```

**4. Public Contract:**
```typescript
// Platform Party Engine
interface AddRelationshipInput {
  sourcePartyId: string; // guardian
  targetPartyId: string; // student
  type: RelationshipType; // 'guardian_of'
  attributes?: Record<string, unknown>;
}

async linkParties(tenantId: string, input: AddRelationshipInput, actorId: string): Promise<void>
```

### Critical Findings

**✅ PLATFORM CORE CAPABILITY EXISTS:**

```text
Platform Core PartyEngine.linkParties()
        ↓
public.party_relationships
        ↓
relationship_type = 'guardian_of'
relationship_type = 'payer_for' (if different)
```

**Semantic Model:**
```text
Guardian (Party A)
        ↓ guardian_of
Student (Party B with role='student' in vertical='education')
        ↓
Payer (Party C)
        ↓ payer_for
Student (Party B)
```

**Platform supports multiple relationships:**
- ✅ `guardian_of` — legal guardian
- ✅ `parent_of` — biological parent
- ✅ Can add custom: `payer_for` — financial responsibility
- ✅ Attributes JSONB — store emergency contact priority, relationship notes

### Verdict

**Classification:** `REUSE_PLATFORM_CAPABILITY` ✅

**Canonical Owner:** **Platform Core PartyEngine**

**Source of Truth:** `public.party_relationships` table

**Single Writer:** **Platform Core PartyEngine.linkParties()**

**Product Extension Needed:** **MINIMAL** (only if English-specific attributes)

**English Center Pattern:**
```typescript
// Reuse Platform Core PartyEngine
import { partyEngine } from '@/platform/party';

// Create guardian relationship
await partyEngine.linkParties(tenantId, {
  sourcePartyId: guardianPartyId,
  targetPartyId: studentPartyId,
  type: 'guardian_of',
  attributes: {
    emergencyContact: true,
    priority: 1,
    relationship: 'mother'
  }
}, actorId);

// Create payer relationship (if different from guardian)
await partyEngine.linkParties(tenantId, {
  sourcePartyId: payerPartyId,
  targetPartyId: studentPartyId,
  type: 'payer_for',
  attributes: {
    paymentMethod: 'bank_transfer',
    invoiceEmail: 'payer@example.com'
  }
}, actorId);
```

**No Product Table Needed:**
- ✅ Platform Core already handles relationships
- ✅ JSONB attributes support custom metadata
- ✅ Multiple relationships per student supported

**Open Blockers:** **NONE**

**Recommendation:**
- Reuse Platform Core `party_relationships` AS-IS
- No English Center-specific guardian table
- Use `attributes` JSONB for English-specific fields (payment preferences, communication language)

---

## FINDING 3: TEACHER / STAFF IDENTITY

### Evidence Chain

**1. Semantic Definition:**
- Teacher = Staff member with teaching role
- Has professional profile (qualifications, specializations)
- Assigned to classes/courses
- **NOT** a separate person identity

**2. Code Implementation:**
- Status: **FOUND** — `teacher_assignments` table
- Service: Teacher assignment via Education API routes
- Test evidence: `src/products/bella-education/__tests__/p32-classroom-field-e2e.integration.test.ts`
- Contract: `ITeacherAssignmentContract` exists

**3. Database Source of Truth:**
- Tables:
  ```sql
  -- Teacher assignments (Education-level)
  teacher_assignments (
      assignment_id UUID PRIMARY KEY
      tenant_id UUID NOT NULL
      course_id UUID NOT NULL
      teacher_party_id UUID NOT NULL  -- 🔴 REFERENCES PARTY
      role TEXT -- 'lead_teacher', 'assistant_teacher'
      status TEXT -- 'active', 'terminated'
      academic_year TEXT
  )
  ```

**4. Public Contract:**
```typescript
// From test evidence
POST /api/education/courses/{id}/teachers
Body: {
  tenantId: string,
  teacherPartyId: string,  // 🔴 USES PARTY_ID
  role: 'lead_teacher' | 'assistant_teacher',
  academicYear: string
}
```

### Critical Findings

**✅ CONFIRMED ARCHITECTURE:**

```text
Platform Core Party
        │
        ├── party_id (identity aggregate root)
        │
        ▼
Platform Core Party Role (optional)
        │
        ├── vertical: 'education'
        ├── roleType: 'teacher'
        └── attributes: {...}
        │
        ▼
Education Kernel Teacher Assignment
        │
        ├── teacher_party_id → party_parties.id
        ├── course_id (which class)
        ├── role (lead vs. assistant)
        └── status (active vs. terminated)
```

**Test Evidence (p32 line 138):**
```typescript
expect(dbAssign?.teacher_party_id).toBe(teacherParty1);
expect(dbAssign?.role).toBe('lead_teacher');
```

**Constraints Found:**
- ✅ Prevent duplicate lead teacher in same academic year (409 conflict)
- ✅ Termination workflow (status: 'active' → 'terminated')
- ✅ Reassignment workflow (terminate old, assign new)

### Verdict

**Classification:** `REUSE_WITH_PRODUCT_EXTENSION` ✅

**Canonical Owner:** 
- **Identity:** Platform Core Party
- **Assignment:** Education Kernel (or shared Teacher Assignment capability)

**Source of Truth:** 
- Identity: `public.party_parties`
- Assignment: `public.teacher_assignments`

**Single Writer:** 
- Identity: Platform Core PartyEngine
- Assignment: Education Teacher Assignment Service

**Product Extension Needed:** **YES** (professional profile)

**English Center Pattern:**
```typescript
// Step 1: Register teacher as Party (if not exists)
const teacherParty = await partyEngine.register(tenantId, {
  partyType: 'person',
  displayName: 'Cô Nguyễn Hoàng Yến',
  // ... person details
}, actorId);

// Step 2: Assign 'teacher' role in 'education' vertical (optional, may be implicit)
await partyEngine.assignRole(tenantId, {
  partyId: teacherParty.id,
  vertical: 'education',
  roleType: 'teacher',
  attributes: {} // generic teacher attributes
}, actorId);

// Step 3: Create English Center professional profile
await supabase.from('english_center_teacher_profiles').insert({
  staff_party_id: teacherParty.id,
  tenant_id: tenantId,
  qualification: 'CELTA',
  specialization: ['IELTS', 'TOEIC'],
  native_speaker: false,
  certification_expiry: '2026-12-31',
  hourly_rate: 350000,
  max_hours_per_week: 20
});

// Step 4: Assign to class (reuse Education teacher_assignments)
await teacherAssignmentContract.assign({
  tenantId,
  courseId: classId,
  teacherPartyId: teacherParty.id,
  role: 'lead_teacher',
  academicYear: '2025-2026'
});
```

**Product Extension Table:**
```sql
-- English Center-specific teacher professional profile
CREATE TABLE english_center_teacher_profiles (
    staff_party_id UUID PRIMARY KEY REFERENCES party_parties(id),
    tenant_id UUID NOT NULL,
    branch_id UUID, -- which branch this teacher primarily works at
    qualification TEXT, -- 'TESOL', 'CELTA', 'DELTA', 'MA_Linguistics'
    specialization TEXT[], -- ['IELTS', 'TOEIC', 'Kids', 'Business']
    native_speaker BOOLEAN DEFAULT FALSE,
    certification_expiry DATE,
    hourly_rate NUMERIC(10,2),
    max_hours_per_week INTEGER,
    availability JSONB, -- {"Mon": ["18:00-20:00"], "Wed": ["18:00-20:00"], "Sat": ["09:00-12:00"]}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reuse teacher_assignments table AS-IS (no duplication)
-- Optional: English Center-specific assignment context
CREATE TABLE english_center_assignment_contexts (
    assignment_id UUID PRIMARY KEY REFERENCES teacher_assignments(assignment_id),
    substitution_for_assignment_id UUID, -- if temporary replacement
    is_temporary BOOLEAN DEFAULT FALSE,
    requested_by UUID,
    notes TEXT
);
```

**Open Blockers:** **NONE**

**Recommendation:**
- ✅ Reuse Platform Party for teacher identity
- ✅ Reuse Education `teacher_assignments` for class assignment
- ✅ English Center owns only professional profile extensions

---

## FINDING 4: ENROLLMENT OWNERSHIP

### Evidence Chain

**1. Semantic Definition:**
- Enrollment = Student registration in Course
- Includes prerequisite checking, credit limits, idempotency
- State machine: pending → active → completed → cancelled

**2. Code Implementation:**
- Owner: **Education Kernel**
- Service: `EducationEngineService.enrollStudent()`
- Contract: `IEducationEnrollmentContract`
- Repository: `IEducationRepository`

**3. Database Source of Truth:**
- Table: `public.edu_enrollments`
- Schema (inferred from code + tests):
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  student_party_id UUID NOT NULL
  course_id UUID NOT NULL
  status TEXT -- 'pending', 'active', 'completed', 'cancelled'
  enrolled_at TIMESTAMPTZ
  request_id TEXT -- idempotency key
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  ```

**4. Public Contract:**
```typescript
interface IEducationEnrollmentContract {
  enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO>;
  getEnrollment(tenantId: string, enrollmentId: string): Promise<EducationEnrollmentDTO | null>;
}
```

### Preschool Usage Verification

**Evidence from `src/products/bella-education/services/enrollment.service.ts`:**
```typescript
export class EnrollmentProductService {
  constructor(
    private readonly enrollmentContract: IEducationEnrollmentContract,  // ✅ Uses contract
    private readonly accountingContract: IAccountingContract
  ) {}

  async enrollStudent(request: EnrollStudentRequest): Promise<EnrollmentDTO> {
    // Preschool calls Education Kernel via contract
    const result = await this.enrollmentContract.enrollStudent({
      tenantId: request.tenantId,
      studentPartyId: request.studentId,
      courseId: request.courseId,
      requestId: request.requestId
    });
    // ... product-specific workflow
  }
}
```

**Verified Capabilities:**
- ✅ Prerequisite checking (course.prerequisiteCourseCodes)
- ✅ Credit limit enforcement (max 24 credits, customizable via PolicyRegistry)
- ✅ Governed override (prerequisite bypass with audit trail)
- ✅ Idempotency (requestId deduplication)
- ✅ Event-after-persistence (`edu.enrollment.created.v1`)

### Verdict

**Classification:** `REUSE_WITH_PRODUCT_EXTENSION` ✅

**Canonical Owner:** **Education Kernel**

**Source of Truth:** `public.edu_enrollments`

**Single Writer:** **Education Kernel EducationEngineService.enrollStudent()**

**Product Extension Allowed:** **YES** (context only)

**English Center Pattern:**
```sql
-- DO NOT create english_center_enrollments (would duplicate source of truth)
-- Kernel owns enrollment via edu_enrollments
-- Product owns English-specific context:

CREATE TABLE english_center_enrollment_contexts (
    kernel_enrollment_id UUID PRIMARY KEY REFERENCES edu_enrollments(id),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    placement_test_id UUID REFERENCES english_center_placement_tests(id),
    sales_source TEXT, -- 'facebook_ad', 'referral', 'walk_in', 'google_ad', 'website'
    referrer_student_id UUID, -- if referral
    commercial_package_id UUID, -- if enrolled in package deal
    discount_applied NUMERIC(5,2), -- percentage
    discount_reason TEXT,
    trial_class_completed BOOLEAN DEFAULT FALSE,
    trial_class_id UUID,
    consultant_user_id UUID, -- sales person who converted
    enrolled_via TEXT, -- 'web', 'mobile_app', 'in_person'
    conversion_timestamp TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Workflow:**
```typescript
// Step 1: English Center placement/trial
const placementResult = await englishCenterService.conductPlacementTest(...);
const trialCompleted = await englishCenterService.conductTrialClass(...);

// Step 2: Call Kernel enrollment (source of truth)
const enrollment = await enrollmentContract.enrollStudent({
  tenantId,
  studentPartyId,
  courseId: recommendedCourseId,
  requestId: crypto.randomUUID() // idempotency
});

// Step 3: Store English-specific context
await supabase.from('english_center_enrollment_contexts').insert({
  kernel_enrollment_id: enrollment.id,
  tenant_id: tenantId,
  branch_id: branchId,
  placement_test_id: placementResult.id,
  sales_source: 'facebook_ad',
  discount_applied: 15.0,
  trial_class_completed: true,
  consultant_user_id: salesPersonId
});
```

**Open Blockers:** **NONE**

**Recommendation:**
- ✅ Reuse Education Kernel enrollment AS-IS
- ✅ Store English-specific context in separate table
- ✅ Link via `kernel_enrollment_id` FK

---

## FINDING 5: ATTENDANCE OWNERSHIP

### Evidence Chain

**1. Semantic Definition:**
- Attendance = Roll call checkpoint for student in session
- Status: present / absent / excused
- Timestamp of roll call

**2. Code Implementation:**
- Owner: **Education Kernel**
- Contract: `IEducationAttendanceContract`
- Service: `AttendanceContractImpl`

**3. Database Source of Truth:**
- Table: **INFERRED** `education_attendance` or `edu_attendance`
- Schema (from DTO):
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  enrollment_id UUID NOT NULL
  status TEXT -- 'present', 'absent', 'excused'
  roll_call_time TIMESTAMPTZ
  ```

**4. Public Contract:**
```typescript
interface IEducationAttendanceContract {
  recordAttendance(input: RecordAttendanceInput): Promise<EducationAttendanceDTO>;
  getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]>;
}
```

### Preschool Usage Verification

**Evidence from `src/products/bella-education/services/attendance.service.ts`:**
```typescript
export class AttendanceProductService {
  constructor(private readonly attendanceContract: IEducationAttendanceContract) {}  // ✅ Uses contract

  async markAttendance(request: MarkAttendanceRequest): Promise<AttendanceDTO> {
    // Preschool calls Education Kernel via contract
    const result = await this.attendanceContract.recordAttendance({
      tenantId: request.tenantId,
      enrollmentId: request.enrollmentId,
      status: request.status,
      rollCallTime: request.timestamp
    });
    // ... product-specific workflow
  }
}
```

### Verdict

**Classification:** `REUSE_WITH_PRODUCT_EXTENSION` ✅

**Canonical Owner:** **Education Kernel**

**Source of Truth:** `education_attendance` or `edu_attendance` table

**Single Writer:** **Education Kernel AttendanceContract.recordAttendance()**

**Product Extension Allowed:** **YES** (context only, NOT duplicate checkpoint)

**English Center Pattern:**
```sql
-- DO NOT create english_center_attendance (would duplicate checkpoint)
-- Kernel owns attendance checkpoint
-- Product owns workflow context:

CREATE TABLE english_center_attendance_contexts (
    kernel_attendance_id UUID PRIMARY KEY REFERENCES education_attendance(id),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    makeup_eligible BOOLEAN DEFAULT FALSE,
    makeup_deadline DATE, -- must attend makeup before this
    intervention_state TEXT, -- 'none', 'warning_sent', 'coordinator_notified', 'parent_meeting_scheduled'
    parent_notified_at TIMESTAMPTZ,
    consecutive_absences INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- English Center-specific: Makeup class scheduling
CREATE TABLE english_center_makeup_sessions (
    makeup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL,
    original_attendance_id UUID NOT NULL REFERENCES education_attendance(id),
    makeup_session_class_id UUID NOT NULL,
    scheduled_date DATE NOT NULL,
    attended BOOLEAN,
    makeup_attendance_id UUID REFERENCES education_attendance(id),
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Workflow:**
```typescript
// Step 1: Mark attendance via Kernel (source of truth)
const attendance = await attendanceContract.recordAttendance({
  tenantId,
  enrollmentId,
  status: 'absent',
  rollCallTime: new Date().toISOString()
});

// Step 2: English Center absence intervention
const consecutiveAbsences = await englishCenterService.countConsecutiveAbsences(studentId);
if (consecutiveAbsences >= 3) {
  await englishCenterService.triggerAbsenceIntervention(studentId);
  
  await supabase.from('english_center_attendance_contexts').insert({
    kernel_attendance_id: attendance.id,
    tenant_id: tenantId,
    intervention_state: 'parent_notified',
    parent_notified_at: new Date().toISOString(),
    consecutive_absences: consecutiveAbsences
  });
}
```

**Open Blockers:** **NONE**

**Recommendation:**
- ✅ Reuse Education Kernel attendance AS-IS
- ✅ Store intervention workflow in English context table
- ✅ Never duplicate attendance checkpoint in product table

---

## FINDING 6: ASSESSMENT OWNERSHIP

### Evidence Chain

**1. Semantic Definition:**
- Assessment = Score/grade for student on evaluation
- Includes score type, grade value, weight
- GPA calculation capability

**2. Code Implementation:**
- Owner: **Education Kernel**
- Contract: `IEducationAssessmentContract`
- Service: `AssessmentContractImpl`

**3. Database Source of Truth:**
- Table: **INFERRED** `education_assessments` or `edu_assessments`
- Schema (from DTO):
  ```sql
  id UUID PRIMARY KEY
  tenant_id UUID NOT NULL
  enrollment_id UUID NOT NULL
  score_type TEXT -- 'quiz', 'midterm', 'final', 'homework'
  grade NUMERIC
  weight NUMERIC
  occurred_at TIMESTAMPTZ
  ```

**4. Public Contract:**
```typescript
interface IEducationAssessmentContract {
  recordScore(input: RecordScoreInput): Promise<EducationAssessmentDTO>;
  getScores(tenantId: string, enrollmentId: string): Promise<readonly EducationAssessmentDTO[]>;
  calculateGpa(tenantId: string, enrollmentId: string): Promise<number>;
}
```

### Verdict

**Classification:** `REUSE_WITH_PRODUCT_EXTENSION` ✅

**Canonical Owner:** **Education Kernel**

**Source of Truth:** `education_assessments` or `edu_assessments` table

**Single Writer:** **Education Kernel AssessmentContract.recordScore()**

**Product Extension Allowed:** **YES** (skill breakdown, band scores)

**English Center Pattern:**
```sql
-- DO NOT create english_center_assessments (would duplicate grade)
-- Kernel owns assessment score
-- Product owns English-specific scoring details:

CREATE TABLE english_center_assessment_contexts (
    kernel_assessment_id UUID PRIMARY KEY REFERENCES education_assessments(id),
    tenant_id UUID NOT NULL,
    skill_breakdown JSONB, -- {"listening": 7.5, "speaking": 6.5, "reading": 7.0, "writing": 6.0}
    ielts_band_score NUMERIC(2,1), -- overall: 0.0 to 9.0 in 0.5 increments
    certification_eligible BOOLEAN DEFAULT FALSE,
    rubric_used TEXT, -- 'IELTS_Academic', 'IELTS_General', 'TOEIC', 'Cambridge_FCE'
    assessor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level progression tracking (Product-specific workflow)
CREATE TABLE english_center_learning_progress (
    progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    program_id UUID NOT NULL, -- 'IELTS', 'TOEIC', 'Cambridge'
    entry_level TEXT, -- 'Foundation', 'Beginner'
    current_level TEXT, -- 'Intermediate'
    level_advanced_at TIMESTAMPTZ,
    next_recommended_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Workflow:**
```typescript
// Step 1: Record score via Kernel (source of truth)
const assessment = await assessmentContract.recordScore({
  tenantId,
  enrollmentId,
  scoreType: 'midterm',
  grade: 7.0, // overall IELTS band
  weight: 0.3
});

// Step 2: Store English-specific skill breakdown
await supabase.from('english_center_assessment_contexts').insert({
  kernel_assessment_id: assessment.id,
  tenant_id: tenantId,
  skill_breakdown: {
    listening: 7.5,
    speaking: 6.5,
    reading: 7.0,
    writing: 6.0
  },
  ielts_band_score: 7.0,
  certification_eligible: false, // needs 6.5+ in all skills
  rubric_used: 'IELTS_Academic'
});

// Step 3: Check level advancement
if (overall_band >= 7.0 && all_skills >= 6.5) {
  await englishCenterService.advanceStudentLevel(studentId, 'Intermediate', 'Advanced');
}
```

**Open Blockers:** **NONE**

**Recommendation:**
- ✅ Reuse Education Kernel assessment AS-IS
- ✅ Store skill breakdown in English context table
- ✅ Level progression is English-specific workflow

---

## 📊 SEMANTIC OWNERSHIP MATRIX

| Entity | Canonical Owner | Source of Truth | Public Contract | Single Writer | Product Extension | Status |
|--------|----------------|----------------|----------------|--------------|-------------------|---------|
| **Person/Party Identity** | Platform Core | `party_parties` | `PartyEngine` | ✅ PartyEngine | YES (roles, attributes) | ✅ LOCKED |
| **Guardian Relationship** | Platform Core | `party_relationships` | `PartyEngine.linkParties()` | ✅ PartyEngine | MINIMAL (attributes) | ✅ LOCKED |
| **Student Identity** | Education Kernel | `students` | `IEducationStudentContract` | ✅ StudentService | YES (context) | ⚠️ Person/Party FK needs clarification |
| **Teacher Identity** | Platform Core | `party_parties` | `PartyEngine` | ✅ PartyEngine | YES (professional profile) | ✅ LOCKED |
| **Teacher Assignment** | Education Kernel | `teacher_assignments` | `ITeacherAssignmentContract` | ✅ Assignment Service | YES (temp/substitute) | ✅ LOCKED |
| **Enrollment** | Education Kernel | `edu_enrollments` | `IEducationEnrollmentContract` | ✅ EnrollmentService | YES (context) | ✅ LOCKED |
| **Attendance** | Education Kernel | `education_attendance` | `IEducationAttendanceContract` | ✅ AttendanceContract | YES (workflow context) | ✅ LOCKED |
| **Assessment** | Education Kernel | `education_assessments` | `IEducationAssessmentContract` | ✅ AssessmentContract | YES (skill details) | ✅ LOCKED |
| **Lead** | English Center | `english_center_leads` | Product service | ✅ English Service | N/A | ✅ LOCKED |
| **Placement Test** | English Center | `english_center_placement_tests` | Product service | ✅ English Service | N/A | ✅ LOCKED |
| **Branch** | English Center | `english_center_branches` | Product service | ✅ English Service | N/A | ✅ LOCKED |

---

## 🔴 OPEN BLOCKERS

### Critical (MUST resolve before E0.2)

**E0.1A-1: Person vs. Party FK Reconciliation**
- **Issue:** Student table has FK to `persons(id)` but Platform uses `party_parties`
- **Impact:** Unclear which is canonical identity aggregate
- **Action Required:**
  1. Investigate `src/platform/host/person/` vs. `src/platform/party/`
  2. Determine if `persons` is legacy or alias
  3. Clarify migration path if Platform is moving to Party model
- **Blocked:** Student identity architecture decision

---

## ✅ CONFIRMED PRINCIPLES

### Single Writer Principle Validated

| State | Authoritative Writer | Read Access | Verification |
|-------|---------------------|------------|--------------|
| Party Identity | Platform Core PartyEngine | Public | ✅ |
| Party Relationships | Platform Core PartyEngine | Public | ✅ |
| Student Identity | Education Kernel StudentService | Public Contract | ✅ |
| Enrollment State | Education Kernel EnrollmentService | Public Contract | ✅ |
| Attendance Checkpoint | Education Kernel AttendanceContract | Public Contract | ✅ |
| Assessment Score | Education Kernel AssessmentContract | Public Contract | ✅ |

### Extension Pattern Validated

✅ **Correct Pattern:**
```text
Kernel owns canonical state
    ↓
Product owns context/workflow
    ↓
Link via FK to kernel_entity_id
    ↓
NO duplication of source of truth
```

❌ **Anti-Pattern (FORBIDDEN):**
```text
Kernel has students table
    +
Product creates english_center_students
    =
SEMANTIC DUPLICATION (VIOLATION)
```

---

## 📋 NEXT STEPS

### Immediate (before E0.1B)

1. **Resolve E0.1A-1** — Person vs. Party FK
   - Read `src/platform/host/person/` code
   - Compare with `src/platform/party/`
   - Determine canonical identity model

### After E0.1A Complete

2. **Proceed to E0.1B** — Finance Reuse Reconciliation
   - Analyze Preschool P7 Finance model
   - Determine Invoice/Payment ownership
   - Decide reuse strategy

3. **Then E0.1C** — Course/Class/Session Ownership
   - Resolve Program/Level hierarchy
   - Lock Course vs. CourseTemplate semantics
   - Prevent academic model duplication

---

**Status:** E0.1A PARTIALLY COMPLETE ⚠️ **1 CRITICAL BLOCKER** (Person/Party FK)

**Next Phase:** Resolve E0.1A-1, then proceed to E0.1B

**Approval Required:** Human Architect review after E0.1A-1 resolution
