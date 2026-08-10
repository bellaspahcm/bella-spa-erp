# BELLA VERTICAL CREATION FRAMEWORK

**Version:** 1.0.0  
**Audience:** Developers building new industry verticals  
**Reading Time:** 5 minutes  

---

## PRINCIPLE

> **Build vertical, don't rebuild platform.**

---

## THE 5 STEPS

### 1. DEFINE (30 minutes)

**Answer these questions:**
- What does this vertical do? (1 sentence)
- What are the core domain entities? (3-5 entities)
- What are the main workflows? (3-5 workflows)

**Example (Education):**
- **Purpose:** Manage academic operations for schools and universities
- **Entities:** Student, Enrollment, Course, Class, Assessment
- **Workflows:** Student registration, Course enrollment, Grade recording

**Output:** Write 1-page domain overview

---

### 2. REUSE (1 hour)

**Check what's already available:**

#### Host Platform (Always Available)
- Identity & IAM
- Workflow Runtime
- Event Bus
- Notification Center
- Document Management
- AI Platform Runtime
- Feature Flags

#### Shared Capabilities (May Need Adapters)
- Billing
- Scheduling
- Resource Management
- Analytics
- Workforce

**For each capability:**
- ✅ Can use as-is → Use it
- ⚠️ Needs domain adapter → Create adapter
- ❌ Doesn't exist → Build vertical-specific (Step 3)

**Output:** Capability mapping spreadsheet (10 rows max)

---

### 3. BUILD (Weeks)

**Your workspace:**
```
src/products/[your-vertical]/
├── domain/           ← Your domain logic here
│   ├── student/
│   ├── enrollment/
│   └── course/
├── workflows/        ← Your workflows here
├── api/              ← Your API routes here
├── events/           ← Your event definitions here
└── tests/            ← Your tests here
```

**Note:** Documentation may reference `verticals/` but actual path is `src/products/` in current codebase.

**Rules:**
- ✅ Write code in `src/products/[your-vertical]/`
- ✅ Import from `platform/host/` and `platform/capabilities/`
- ❌ DO NOT copy code from other verticals
- ❌ DO NOT modify `platform/host/` or `platform/capabilities/` without approval

**If you need to modify Platform:**
→ Create **Capability Gap Request** (see Step 5)

**Note:** If a capability documented in Quick Start doesn't exist in codebase, create Capability Gap Request instead of implementing workaround.

---

### 4. TEST (Continuous)

**Three test levels:**

**Level 1: Domain Tests (Unit)**
```typescript
// Test your business logic in isolation
describe('Student', () => {
  it('should create student with valid data', () => {
    const student = Student.create({ ... });
    expect(student.status).toBe('enrolled');
  });
});
```

**Level 2: Platform Integration Tests**
```typescript
// Test interaction with Platform capabilities
describe('Student + Person Center', () => {
  it('should link student to person identity', async () => {
    const person = await personCenter.create({ ... });
    const student = await Student.create({ personId: person.id });
    expect(student.personId).toBe(person.id);
  });
});
```

**Level 3: Contract Compliance Tests**
```typescript
// Ensure you don't break Platform contracts
describe('Platform Contract Compliance', () => {
  it('should not modify Person aggregate', async () => {
    const person = await personCenter.get(personId);
    expect(person).not.toHaveProperty('educationRole'); // ✅ No modification
  });
  
  it('should publish events with correct schema', async () => {
    const event = await eventBus.getLastEvent('education.student.created');
    expect(event.version).toBe('1.0.0'); // ✅ Contract respected
  });
});
```

**Note:** Global regression testing (Healthcare, Education, Real Estate) is Platform CI/CD responsibility, not your vertical tests.

**Test coverage target:** >80%

---

### 5. ESCALATE (When Needed)

**When to escalate:**

#### Scenario A: Missing Capability
```
You need: Generic scheduling
Platform has: Nothing
Action: Create Capability Gap Request
```

#### Scenario B: Capability Insufficient
```
You need: Resource allocation with custom policies
Platform has: Generic resource allocation (no policies)
Action: Create Adapter (your vertical), NOT modify Platform
```

#### Scenario C: Modify Platform Implementation
```
You need: Fix bug or improve performance in existing capability
Action: Submit PR with tests, platform team reviews (no ARB)
```

#### Scenario D: Change Platform Contract or Invariant
```
You need: Change Core API contract, event schema, or architectural boundary
Action: Architecture Review Board (ARB) approval required
Examples: Change Person aggregate root, modify event bus contract, break backward compatibility
```

**Key Principle:** ARB protects contracts and invariants, not every line of platform code.

**Capability Gap Request Template:**
```markdown
# Capability Gap Request: [Capability Name]

**Requester:** [Your name]
**Vertical:** [Your vertical]
**Date:** [Date]

## Gap Description
What capability is missing?

## Use Case
Why do you need it?

## Proposed Solution
- Option A: Build in Platform (cross-vertical)
- Option B: Build in Vertical (vertical-specific)

## Cross-Vertical Evidence
Does this capability benefit existing or expected verticals?

**Existing verticals:**
- Healthcare: [Yes/No/Unknown] + reason
- Education: [Yes/No/Unknown] + reason
- Real Estate: [Yes/No/Unknown] + reason

**Expected future verticals:**
- Automotive: [Likely/Unlikely] + reason
- Retail: [Likely/Unlikely] + reason

**Generic nature:** Is the core abstraction industry-agnostic?
- [ ] Yes - truly cross-vertical (e.g., Billing, Scheduling)
- [ ] No - domain-specific (e.g., Prescription, Curriculum)

**Note:** A capability can be Platform-worthy even if only 1 vertical uses it now, IF it's clearly generic and expected to be reused.

## Decision
- [ ] Approved: Build in Platform
- [ ] Rejected: Build in Vertical
- [ ] Needs more evidence
```

---

## ANTI-PATTERNS (DON'T DO THIS)

### ❌ Anti-Pattern 1: Copy-Paste from Another Vertical
```typescript
// ❌ WRONG: Copy Healthcare code
// Copy from: verticals/healthcare/domain/patient.ts
// Rename: Patient → Student

// ✅ CORRECT: Build from scratch using Platform contracts
import { PersonProjection } from '@/platform/host/person-center';
export class Student { /* Build new */ }
```

### ❌ Anti-Pattern 2: Modify Platform Without Approval
```typescript
// ❌ WRONG: Directly edit platform code
// File: platform/host/person-center/person.ts
// Add: educationRole field

// ✅ CORRECT: Create vertical projection
// File: verticals/education/domain/student.ts
interface Student {
  personId: string; // References Person, doesn't modify it
  studentRole: string; // Education-specific
}
```

### ❌ Anti-Pattern 3: Over-Engineer for "Future Verticals"
```typescript
// ❌ WRONG: Build generic StudentOrPatientOrCustomer
interface GenericPerson {
  role: 'student' | 'patient' | 'customer'; // Too generic
}

// ✅ CORRECT: Build specific for your vertical
interface Student {
  studentId: string;
  academicStatus: AcademicStatus; // Education domain
}
```

---

## SUCCESS CRITERIA

### Vertical Success (Functional)
**Your vertical is ready when:**
- ✅ Functional requirements complete
- ✅ Code in `verticals/[your-vertical]/` only
- ✅ No Healthcare/other vertical dependencies
- ✅ Tests pass (unit + integration)
- ✅ Platform contracts respected (no boundary violations)

### Platform Maturity Metrics (Validation)
**Your vertical helps validate Meta-Platform when:**
- 📊 Effort: Measured vs Healthcare baseline (target: <50%, acceptable: <70%)
- 📊 Reuse: Platform capability usage % (target: >70%)
- 📊 Platform modifications: Count of contract changes (target: 0-2)
- 📊 Developer onboarding: Time to first commit (target: <1 day)

**Note:** Vertical can succeed even if platform metrics don't hit targets. Metrics show platform maturity, not vertical quality.

**Example:**
- Education takes 60% effort (vs 50% target) → Education succeeds, Platform needs more extraction
- Education takes 45% effort → Education succeeds, Platform maturity validated

---

## REFERENCES

**For Developers:**
- [Education Quick Start](./architecture/education/EDUCATION_QUICK_START.md) - Example vertical onboarding
- [Platform Capabilities](./platform/README.md) - What's available to reuse
- [Host Platform API](./platform/host/README.md) - Core services reference

**For Decision History (Optional Reading):**
- [Phase 0 Education Diagnostic](./architecture/PHASE_0_EDUCATION_DIAGNOSTIC_REPORT.md) - Why this framework exists
- [Education Vertical Assessment](./architecture/education/EDUCATION_VERTICAL_ASSESSMENT.md) - Example capability mapping

---

## GETTING STARTED

**Day 1:**
1. Read this framework (5 min)
2. Read your vertical's Quick Start guide (5 min)
3. Define your domain (30 min)
4. Check capability reuse (1 hour)
5. Write your first aggregate (4 hours)

**Week 1:**
- Build 3-5 core aggregates
- Write tests (80% coverage)
- Platform integration working

**Month 1:**
- Main workflows complete
- Regression tests pass
- Ready for pilot

---

**Principle:** *If creating your vertical is harder than this framework describes, the Platform needs more work—not your vertical.*

---

**Last Updated:** 2026-08-10  
**Owner:** Architecture Team  
**Status:** ✅ ACTIVE
