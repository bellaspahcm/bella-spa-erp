# Education Developer Quick Start

**Goal:** Get from task → first code in <5 minutes.

---

## 1. Platform Capabilities You Can Use

**Already available — just import and use:**

| Capability | Import From | What It Does |
|------------|-------------|--------------|
| **Person** | `@/platform/host/person` | Identity (name, DOB, contacts) — DO NOT duplicate |
| **Workflow** | `@/platform/host/workflow` | Approval flows, state machines |
| **Event Bus** | `@/platform/host/event-bus` | Publish domain events |
| **Notification** | `@/platform/host/notification` | Email, SMS, push |
| **Document** | `@/platform/host/document` | File storage, versioning |

**Coming soon:**
- Billing Engine (shared with Healthcare)
- Queue Engine (shared with Healthcare)

---

## 2. Folder Structure (Standard Pattern)

```
src/products/bella-education/
├── shared-kernel/
│   └── types.ts              # Domain types (Student, Course, etc.)
├── student/
│   ├── student.aggregate.ts  # Business logic
│   ├── student.repository.ts # Database access
│   ├── student.service.ts    # Orchestration
│   └── __tests__/
│       └── student.aggregate.test.ts
├── enrollment/
│   └── ... (same pattern)
└── QUICK_START.md            # This file
```

**Rule:** Each domain entity = 1 folder with aggregate + repository + service + tests.

---

## 3. Database Naming Convention

| Entity | Table Name | Person FK | Unique Code |
|--------|------------|-----------|-------------|
| Student | `students` | `person_id` | `student_code` (EDU-YYYY-NNN) |
| Course | `courses` | - | `course_code` (CSE-101) |
| Enrollment | `enrollments` | - | - |
| Attendance | `attendance_records` | - | - |
| Assessment | `assessments` | - | - |

**Rule:** Table names are plural, lowercase with underscores.

---

## 4. Identity Pattern (CRITICAL)

**✅ DO:**
```typescript
interface Student {
  studentId: string;
  personId: string;  // ← References Person for identity
  studentCode: string;
  academicStatus: 'enrolled' | 'on_leave' | 'graduated';
  programId: string;
  // ... student-specific fields only
}
```

**❌ DON'T:**
```typescript
interface Student {
  studentId: string;
  firstName: string;   // ❌ Duplication — use Person
  lastName: string;    // ❌ Duplication — use Person
  dateOfBirth: string; // ❌ Duplication — use Person
  // ...
}
```

**Why:** Person is Platform capability. Every vertical references it, no duplication.

---

## 5. New Entity Checklist (30-Minute Template)

Building a new entity (e.g., Course)? Follow this exact sequence:

### Step 1: Types (5 min)
```typescript
// shared-kernel/types.ts
export interface Course {
  courseId: string;
  tenantId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  // ... domain fields
}
```

### Step 2: Aggregate (10 min)
```typescript
// course/course.aggregate.ts
export class CourseAggregate {
  static create(request: CreateCourseRequest): CourseAggregate { ... }
  update(request: UpdateCourseRequest): CourseAggregate { ... }
  // ... business methods
}
```

### Step 3: Tests (10 min)
```typescript
// course/__tests__/course.aggregate.test.ts
describe('CourseAggregate', () => {
  it('should create course with valid data', () => { ... });
  it('should throw error if invalid', () => { ... });
});
```

### Step 4: Database (5 min)
```bash
# Run in Supabase SQL Editor
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL UNIQUE,
  // ... columns
);
```

**Total time: ~30 min from idea → tested aggregate.**

---

## 6. Integration Patterns

### Referencing Person
```typescript
import { PersonService } from '@/platform/host/person';

const person = await PersonService.getById(student.personId);
console.log(`${person.firstName} ${person.lastName}`);
```

### Publishing Events
```typescript
import { EventBus } from '@/platform/host/event-bus';

await EventBus.publish({
  type: 'StudentEnrolled',
  payload: { studentId, programId, enrollmentDate },
});
```

### Using Workflow
```typescript
import { WorkflowService } from '@/platform/host/workflow';

await WorkflowService.startWorkflow('student-registration', {
  studentId,
  approvers: ['dean@university.edu'],
});
```

---

## 7. When to Extract to Platform

**DON'T extract immediately.** Build in vertical first, extract when 2nd vertical needs it.

**Extract if:**
- Healthcare needs it (e.g., Billing)
- Real Estate needs it (e.g., Document signing)
- 3+ verticals will use it

**Example:**
- ✅ Person: Healthcare + Education + Beauty → **extract**
- ❌ StudentCode generator: Only Education → **keep in vertical**

---

## 8. Testing Strategy

**Unit tests (required):**
- Aggregate business logic
- 100% coverage for validations
- Run in <1 second

**Integration tests (after unit tests pass):**
- Repository + database
- Service + Supabase
- Verify foreign keys work

**E2E tests (smoke test only):**
- Critical paths (create student, enroll, graduate)
- Not every edge case

---

## 9. Common Mistakes

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| Duplicate identity in Student | Person already has it | Reference `personId` |
| Create MPI in Education | Healthcare has it | Import from Healthcare Platform |
| Hardcode tenant in code | Multi-tenant system | Always filter by `tenantId` |
| Skip RLS policies | Security vulnerability | Always enable RLS + policies |
| Use `any` types | Law 11 violation | Strict typing required |

---

## 10. Getting Help

**Stuck? Check these first:**

1. **Person capability:** `src/platform/host/person/README.md`
2. **Healthcare pattern:** `src/platform/healthcare/` (reference implementation)
3. **Database schema:** Supabase Studio → Tables
4. **Constitution:** `AGENTS.md` (11 Laws, must follow)

**Still stuck?** Create capability gap request: `docs/platform/capability-gaps/CAP-XXX.md`

---

## 11. Next Steps

**Current status:**
- ✅ Person capability deployed
- ✅ Student aggregate + tests complete
- 🔄 Student database + repository (in progress)

**Your first task:**
1. Run `scripts/manual_create_students_table.sql` in SQL Editor
2. Verify table created: `SELECT * FROM students LIMIT 1;`
3. Create Student Repository (follow Healthcare Patient pattern)
4. Create Student Service
5. Write integration test (verify Person FK works)

**Time estimate:** ~2 hours to Student E2E.

---

**Remember:** Platform makes vertical development fast. You should spend 80% time on domain logic, 20% on infrastructure.

If you're spending 50%+ time searching for APIs or patterns → create an issue, Platform needs improvement.
