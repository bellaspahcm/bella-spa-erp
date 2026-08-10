# BELLA EDUCATION OS - QUICK START GUIDE

**Target:** Developer onboarding < 5 minutes  
**Goal:** Answer 5 questions before writing first line of code  

---

## �️ ARCHITECTURE PRINCIPLES (MUST FOLLOW)

### Principle 1: Student REFERENCES Person (not extends)
```typescript
// ✅ CORRECT: Student references Person
interface Student {
  studentId: string;
  personId: string; // Reference to Person aggregate
  studentCode: string;
  academicStatus: string;
}

// ❌ WRONG: Student extends Person
interface Student extends Person {
  studentCode: string; // Breaks aggregate boundary
}
```

**Why?** Person is shared identity (Host Platform). Student is Education domain projection.

---

### Principle 2: Aggregate = Business Logic ONLY (no infrastructure)
```typescript
// ✅ CORRECT: Pure domain logic
class StudentAggregate {
  static create(input: CreateStudentInput): StudentAggregate {
    // Business rules only
    if (!input.programId) {
      throw new Error('Student must be enrolled in a program');
    }
    return new StudentAggregate(student);
  }
}

// ❌ WRONG: Aggregate calls infrastructure
class StudentAggregate {
  static async create(input: CreateStudentInput): Promise<Student> {
    const person = await personCenter.createPerson(...); // ❌ Infrastructure call
    await eventBus.publish(...); // ❌ Infrastructure call
  }
}
```

**Why?** Aggregates should be testable without mocking infrastructure.

---

### Principle 3: Application Service = Orchestration (infrastructure calls)
```typescript
// ✅ CORRECT: Service orchestrates infrastructure
class StudentApplicationService {
  async createStudent(input: CreateStudentInput): Promise<Student> {
    // 1. Call Person Center (platform)
    const person = await this.personCenterClient.createPerson(...);
    
    // 2. Create domain aggregate (pure logic)
    const aggregate = StudentAggregate.create({ ...input, personId: person.personId });
    
    // 3. Persist via repository
    await this.studentRepository.save(aggregate.getStudent());
    
    // 4. Publish event
    await this.eventBus.publish(...);
  }
}
```

**Why?** Separation of concerns: domain logic vs infrastructure orchestration.

---

### Principle 4: Shared Capability = Consume ONLY (no modification)
```typescript
// ✅ CORRECT: Consume platform capability
const classrooms = await resourceManagement.queryResources({
  type: 'classroom',
  capacity: { min: 30 },
});

// ❌ WRONG: Modify platform capability
// DO NOT add education-specific code to platform/capabilities/resource-management/
```

**Why?** Platform modifications require governance. Education changes must not affect Healthcare.

**If capability insufficient:**
1. Create Capability Gap Request
2. Platform team evaluates
3. Platform team extends capability (if approved)
4. Education consumes updated capability

---

### Principle 5: Healthcare = Reference, NOT Template
```typescript
// ❌ WRONG: Copy Healthcare code
// Copy from: verticals/healthcare/domain/patient/patient.aggregate.ts
// Rename: Patient → Student

// ✅ CORRECT: Study Healthcare patterns, build Education from scratch
// Read Healthcare for: domain modeling patterns, aggregate boundaries
// Build Education using: platform contracts, Education domain model
```

**Why?** Copy-paste creates hidden coupling. Build from contracts creates true independence.

---

## �🎯 5-MINUTE ORIENTATION

### 1. Education là gì?

**Bella Education OS** manages academic operations for schools, training centers, and universities.

**Core workflows:**
- Student enrollment & registration
- Course & class management
- Attendance tracking
- Assessment & grading
- Academic progress monitoring

**NOT in scope:**
- Learning Management System (LMS)
- E-learning content delivery
- Video conferencing
- Student portals (future product pack)

---

### 2. Tôi được sửa ở đâu?

```
✅ ALLOWED (Your workspace):
verticals/education/
├── domain/           ← Build domain logic here
├── workflows/        ← Education-specific workflows
├── api/              ← Education API routes
├── events/           ← education.* event definitions
└── tests/            ← Education tests

❌ FORBIDDEN (Platform code):
platform/host/        ← Never touch
platform/capabilities/← Never touch
verticals/healthcare/ ← Never touch
```

**Golden Rule:** If it's NOT in `verticals/education/`, you need approval.

---

### 3. Tôi dùng capability nào?

### Host Platform (100% reuse, no code needed)

| Capability | Use For | Import From |
|------------|---------|-------------|
| Person Center | Student identity | `@/platform/host/person-center` |
| Workflow Runtime | Enrollment approval | `@/platform/host/workflow-runtime` |
| Event Bus | education.* events | `@/platform/host/event-bus` |
| Notification | Email/SMS students | `@/platform/host/notification` |
| Document Management | Transcripts, certificates | `@/platform/host/document` |
| File Storage | Upload documents | `@/platform/host/file-storage` |
| AI Platform | Academic insights | `@/platform/host/ai-platform` |

### Shared Capabilities (consume via contract, DO NOT modify)

| Capability | Use For | Status | Notes |
|------------|---------|--------|-------|
| Resource Management | Classrooms, labs | ✅ Available | Use existing API |
| Scheduling | Class timetables | ✅ Available | Use existing API |
| Analytics | Academic dashboards | ✅ Available | Use existing API |
| Workforce | Teacher management | ✅ Available | Use existing API |
| Billing | Tuition payments | ✅ Available | Use existing API |

**CRITICAL RULE:** If capability doesn't meet Education needs:
1. ❌ DO NOT modify platform code directly
2. ✅ Create **Capability Gap Request** → Platform Governance
3. ✅ Wait for platform team to extend capability
4. ✅ Use workaround in Education domain (temporary)

### Education-Specific (build from scratch)

| Engine | Purpose | Status |
|--------|---------|--------|
| Curriculum Engine | Program structure, prerequisites | 🔴 To Build |
| Grading Engine | GPA, transcripts | 🔴 To Build |
| Academic Workflow | Add/drop, appeals | 🔴 To Build |

---

### 4. Task đầu tiên là gì?

**Recommended first task:** Implement `Student` aggregate (extends Person)

**Why this task?**
- Low complexity (85% reuse from Person Center)
- Foundation for all Education workflows
- Tests platform integration patterns

**File to create:**
```
verticals/education/domain/student/student.aggregate.ts
```

**Template:**
```typescript
import { PersonService, CreatePersonRequest } from '@/platform/host/person';

// Domain Model (pure business logic, no infrastructure)
export interface Student {
  studentId: string;
  studentCode: string;
  personId: string; // References Person (not extends)
  admissionDate: Date;
  academicStatus: 'enrolled' | 'on_leave' | 'graduated' | 'dropped_out';
  programId: string;
  advisorId?: string;
}

export class StudentAggregate {
  constructor(private student: Student) {}

  // Business invariants only (no infrastructure calls)
  static create(input: CreateStudentInput): StudentAggregate {
    const student: Student = {
      studentId: generateId(),
      studentCode: generateStudentCode(),
      personId: input.personId, // Person already created by Application Service
      admissionDate: new Date(),
      academicStatus: 'enrolled',
      programId: input.programId,
    };

    // Validate business rules
    if (!input.programId) {
      throw new Error('Student must be enrolled in a program');
    }

    return new StudentAggregate(student);
  }

  getStudent(): Student {
    return this.student;
  }
}

// Application Service (orchestrates infrastructure)
export class StudentApplicationService {
  constructor(
    private personService: PersonService,
    private studentRepository: StudentRepository,
    private eventBus: EventBus
  ) {}

  async createStudent(input: CreateStudentInput): Promise<Student> {
    // 1. Create Person (platform capability)
    const personRequest: CreatePersonRequest = {
      tenantId: input.tenantId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      contacts: input.contacts,
    };

    const personResponse = await this.personService.createPerson(personRequest);
    
    if (!personResponse.success) {
      throw new Error(`Failed to create person: ${personResponse.error?.message}`);
    }

    // 2. Create Student aggregate (domain logic)
    const studentAggregate = StudentAggregate.create({
      ...input,
      personId: personResponse.data.personId,
    });

    // 3. Persist to repository
    const student = studentAggregate.getStudent();
    await this.studentRepository.save(student);

    // 4. Publish domain event
    await this.eventBus.publish({
      eventType: 'education.student.created',
      version: '1.0.0',
      payload: student,
    });

    return student;
  }
}
```

**What to test:**
```typescript
// tests/student.aggregate.test.ts (Domain tests - pure logic)
describe('StudentAggregate', () => {
  it('should create student with valid business rules', () => {
    const aggregate = StudentAggregate.create({
      personId: 'person-123',
      programId: 'program-123',
    });

    const student = aggregate.getStudent();
    expect(student.personId).toBe('person-123');
    expect(student.studentCode).toMatch(/^STU\d{6}$/);
    expect(student.academicStatus).toBe('enrolled');
  });

  it('should throw error if program not specified', () => {
    expect(() => {
      StudentAggregate.create({
        personId: 'person-123',
        programId: '', // Invalid
      });
    }).toThrow('Student must be enrolled in a program');
  });
});

// tests/student.application-service.test.ts (Integration tests)
describe('StudentApplicationService', () => {
  it('should create student with Person integration', async () => {
    const mockPersonService = {
      createPerson: jest.fn().mockResolvedValue({ 
        success: true,
        data: { personId: 'person-123' },
      }),
    };
    const mockRepo = {
      save: jest.fn(),
    };
    const mockEventBus = {
      publish: jest.fn(),
    };

    const service = new StudentApplicationService(
      mockPersonService,
      mockRepo,
      mockEventBus
    );

    const student = await service.createStudent({
      tenantId: 'tenant-123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2005-01-15',
      gender: 'male',
      programId: 'program-123',
    });

    expect(mockPersonService.createPerson).toHaveBeenCalled(); // ✅ Person created
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'person-123' })
    ); // ✅ Student saved
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'education.student.created',
      })
    ); // ✅ Event published
  });
});
```

**Success criteria:**
- ✅ Student created in database
- ✅ Person linked in Person Center
- ✅ Event published to Event Bus
- ✅ Test passes

**Estimated time:** 2-4 hours (with platform reuse)

---

### 5. Test thế nào?

### Unit Tests (mandatory)
```bash
cd verticals/education
npm run test:unit
```

### Integration Tests (mandatory before commit)
```bash
npm run test:integration -- --grep "Student"
```

### Platform Integration Check (automated)
```bash
npm run test:platform-integration
```

**Checks:**
- ✅ Person Center reachable
- ✅ Event Bus connected
- ✅ Workflow Runtime available
- ✅ No direct database access (must use engines)

---

## 🚀 GETTING STARTED CHECKLIST

Before writing code:
- [ ] Read this guide (< 5 minutes)
- [ ] Read `EDUCATION_VERTICAL_ASSESSMENT.md` (10 minutes, optional)
- [ ] Check capability map: what's reusable?
- [ ] Clone task template from above
- [ ] Run existing tests to verify setup

First commit:
- [ ] Implement Student aggregate
- [ ] Write unit tests (TDD)
- [ ] Verify platform integration
- [ ] Publish education.student.created event
- [ ] Commit with message: `feat(education): implement Student aggregate`

---

## 📚 LEARNING PATH

### Day 1: Foundation
1. Implement `Student` (2-4 hours)
2. Implement `Enrollment` (4-6 hours)
3. Understand Person Center + Workflow reuse

### Day 2-3: Core Workflows
4. Implement `Course` & `Class` (6-8 hours)
5. Implement `Attendance` (4-6 hours)
6. Understand Resource + Scheduling reuse

### Day 4-5: Advanced Features
7. Implement `Assessment` & `Grade` (8-10 hours)
8. Implement `AcademicProgress` (6-8 hours)
9. Understand Analytics + AI Platform reuse

**Milestone:** After 5 days, you should be able to:
- ✅ Create students
- ✅ Enroll in courses
- ✅ Track attendance
- ✅ Record grades
- ✅ View academic progress

---

## 🔍 TROUBLESHOOTING

### "I don't know which capability to use"
→ Check `EDUCATION_VERTICAL_ASSESSMENT.md` Section: "Capability Mapping"

### "Person Center not working"
→ Run `npm run test:platform-integration` to diagnose

### "Should I create a new engine or extend existing?"
→ Rule: If Healthcare uses it, reuse. If education-specific, create new.

### "Where do I put database migrations?"
→ `verticals/education/migrations/` (education-specific tables only)

### "Can I modify Person Center schema?"
→ NO. Student references Person via `personId`, doesn't modify Person tables.

### "How do I request a platform capability change?"
→ Create **Capability Gap Request**:
1. Document the gap: What capability? What's missing?
2. Propose solution: Extend existing or create new?
3. Submit to Platform Governance (#platform-governance channel)
4. Wait for approval (do NOT modify platform code directly)
5. Use temporary workaround in Education domain if urgent

### "What if Resource Management doesn't support 'lab equipment'?"
→ **Capability Gap Request Example:**
```markdown
# Capability Gap Request: Resource Management - Lab Equipment

**Current State:** Resource Management supports rooms only
**Gap:** Education needs lab equipment tracking (microscopes, computers)
**Proposed Solution:** Extend Resource type enum: 'room' | 'equipment'
**Impact:** Healthcare may also benefit (medical equipment)
**Workaround:** Education stores equipment in separate table (temporary)
```

### "How do I publish events?"
→ Use Event Bus: `eventBus.publish({ eventType: 'education.*', ... })`

---

## 📞 GETTING HELP

### Architecture Questions
→ Read `EDUCATION_VERTICAL_ASSESSMENT.md`

### Platform API Reference
→ Check `platform/host/*/README.md` for capability contracts

### Healthcare as Reference (NOT template)
→ Healthcare is a reference implementation, NOT a template to copy
→ **DO NOT:** Copy Healthcare code and rename to Education
→ **DO:** Study Healthcare for patterns, then build Education using platform contracts

### Code Examples
→ Look for domain modeling patterns (aggregate, entity, value object)
→ Look for application service patterns (orchestration, infrastructure)
→ **DO NOT copy-paste Healthcare code**

### Stuck on Implementation?
→ Ask in #engineering-education channel

---

## 🎯 DEFINITION OF DONE

Your first contribution is complete when:

1. ✅ Student aggregate implemented
2. ✅ Person Center integrated (not duplicated)
3. ✅ Event published to Event Bus
4. ✅ Unit tests pass (>80% coverage)
5. ✅ Integration tests pass
6. ✅ No direct database queries (uses engines)
7. ✅ No `any` types (100% TypeScript strict)
8. ✅ Code review approved
9. ✅ Merged to main

**Time to first contribution:** < 1 day (target)

---

## 📖 REFERENCE LINKS

- [Education Vertical Assessment](./EDUCATION_VERTICAL_ASSESSMENT.md) - Capability mapping & gap analysis
- [Platform Capabilities](../../platform/README.md) - Host + Shared capabilities reference
- [Healthcare Reference](../healthcare/README.md) - Similar vertical implementation
- [Architecture Decision Records](../adr/) - Why we made these choices

---

**LAST UPDATED:** 2026-08-10  
**FEEDBACK:** This guide should evolve. If anything is unclear, update it!

---

**END OF QUICK START GUIDE**
