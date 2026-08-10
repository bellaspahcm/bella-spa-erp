# BELLA EDUCATION OS CONSTITUTION v1.0.0

**Status:** DRAFT (Phase 0 - Architecture Blueprint)  
**Freeze Date:** TBD (After ARB Approval + Hospital Pilot Success)  
**Expected Lifetime:** 15-20 Years  
**Change Policy:** ADR Required  

---

## CRITICAL PRINCIPLE

```
Education may consume the frozen platform boundary,
but may NOT redefine the platform boundary.
```

---

## STRATEGIC POSITIONING

**Education OS is a SIBLING Operating System to Healthcare OS, NOT:**
- ❌ A fork of Healthcare OS
- ❌ An extension of Healthcare OS
- ❌ A separate platform
- ❌ A vertical ERP

**Architecture:**
```
BELLA HOST PLATFORM (Meta-Platform)
         │
    ┌────┴────┐
    │         │
Healthcare  Education
   OS         OS
    │         │
  (sibling) (sibling)
```

---

## THE 11 LAWS OF EDUCATION OS

### Law 1: Student is the Aggregate Root
- ✅ **Student** is the unified Aggregate Root for all academic activities
- All engine operations reference `studentId` or `enrollmentId`
- **Enforcement:** All Education domain events MUST trace to Student aggregate

### Law 2: No Direct DB Access from Product Packs
- ✅ **Engines provide abstraction** over Supabase
- School/Training Center pages use engine hooks: `useStudentEngine()`, `useEnrollmentEngine()`, `useAssessmentEngine()`
- **Example:**
  ```typescript
  // ❌ WRONG:
  const { data } = await supabase.from('ed_students').select('*');
  
  // ✅ CORRECT:
  const { queryStudents } = useStudentEngine();
  const result = await queryStudents({ tenantId, programId });
  ```

### Law 3: Execution-Engine Decoupled Model
- ✅ **Engines live in Education Platform**, not in School Product Pack
- **Path:** `src/platform/education/engines/`
- **Engines:**
  - Student Engine
  - Enrollment Engine
  - Learning Activity Engine
  - Assessment Engine
  - Academic Progress Engine
  - Course Engine
  - Class Engine
  - Curriculum Engine
  - Attendance Engine
  - Academic Workflow Engine

### Law 4: Additive Migration Only
- ✅ All Education migrations are **additive** (new tables, new columns)
- ❌ **FORBIDDEN:** `ALTER TABLE DROP COLUMN`, `NOT NULL` on existing columns, type changes
- **Examples:**
  ```sql
  -- ✅ ALLOWED:
  CREATE TABLE ed_students (...);
  ALTER TABLE ed_students ADD COLUMN graduation_date DATE;
  
  -- ❌ FORBIDDEN:
  ALTER TABLE ed_students DROP COLUMN student_code;
  ALTER TABLE ed_students ALTER COLUMN program_id SET NOT NULL;
  ```

### Law 5: Event-First Architecture
- ✅ All domain changes MUST publish **Domain Events** to Event Bus
- **Event Namespace:** `education.*`
- **Examples:**
  ```typescript
  await eventBus.publish({
    eventType: 'education.student.created',
    version: '1.0.0',
    payload: { studentId, tenantId, programId }
  });
  
  await eventBus.publish({
    eventType: 'education.enrollment.approved',
    version: '1.0.0',
    payload: { enrollmentId, studentId, courseId }
  });
  ```

### Law 6: Metadata-Driven Paradigm
- ✅ All screens, forms, workflows driven by **Metadata Platform**
- ❌ No hardcoded UI in React components
- **Implementation:** Phase 1+ (after Host Platform metadata service available)

### Law 7: Capability-First Enforcement
- ✅ Runtime MUST check `CapabilityPlatform.hasCapability()` before EVERY operation
- **Example:**
  ```typescript
  if (!await capabilityPlatform.hasCapability('education_school', { tenantId })) {
    return notFound();
  }
  ```

### Law 8: Registry-First & ADR Compliance
- ✅ All architectural decisions MUST go through **ARB** (Architecture Review Board)
- ✅ All API contracts registered in **Contract Registry**
- ✅ All capabilities registered in **Capability Registry**
- **ADR Template:** `docs/architecture/adr/YYYY-MM-DD-education-<title>.md`

### Law 9: Zero Regression Guarantee
- ✅ Education MUST NOT affect Healthcare or Beauty Spa tenants
- ✅ Capability flags prevent unintended feature leakage
- **Enforcement:** Pre-merge checklist, automated tests, manual QA

### Law 10: No Direct DB Query for AI
- ✅ AI MUST NOT query OLTP database directly
- ✅ AI operates through **AI Platform Runtime**, **Education Knowledge Graph**, or **Data Platform**

### Law 11: Strictly No `any` Types Allowed
- ✅ **ABSOLUTE BAN** on `any` types in all TypeScript code
- ✅ 100% strongly-typed using Interfaces, Generics, or Supabase schemas
- **Examples:**
  ```typescript
  // ❌ FORBIDDEN:
  function processStudent(data: any) { ... }
  
  // ✅ REQUIRED:
  function processStudent(data: StudentCreateRequest) { ... }
  const response: EngineResponse<Student> = await createStudent(...);
  ```

---

## DOMAIN BOUNDARIES

### Education Domain Namespace
- **Database:** `ed_*` tables or `education.*` schema
- **Events:** `education.*` namespace
- **APIs:** `/api/education/*` routes
- **Engines:** `src/platform/education/engines/`

### Forbidden Namespaces
- ❌ `hc_*` (Healthcare)
- ❌ `healthcare.*` (Healthcare events)
- ❌ Reusing Healthcare engines with renamed tables

---

## CAPABILITY INHERITANCE

### Host Platform Capabilities (Consume, NOT Redefine)
1. Identity & IAM
2. Tenant Management
3. Organization Center
4. Person Center
5. Notification Center
6. Document Management
7. File Storage
8. Workflow Runtime
9. Policy Runtime
10. Rule Engine
11. Event Bus
12. Automation Runtime
13. AI Platform Runtime
14. Integration Runtime
15. Contract Registry
16. Capability Registry
17. Feature Flag Platform
18. Metadata Platform
19. Audit & Compliance
20. Plugin Runtime

### Shared Capabilities (Cross-Industry - Consume, NOT Redefine)
1. Scheduling
2. Queue Management
3. Resource Management
4. Billing
5. Payment
6. Reporting
7. Analytics
8. Communication
9. Collaboration
10. Approval Workflows
11. KPI Management
12. Dashboard

### Education-Specific Capabilities (Education OS Owns)
1. Student Management
2. Enrollment Management
3. Course Management
4. Class Management
5. Curriculum Management
6. Learning Activity Management
7. Assessment Management
8. Academic Progress Tracking
9. Attendance Management
10. Academic Workflow

---

## NON-NEGOTIABLES

### 1. Education NEVER Redefines Host Platform
- Education consumes Host services (Workflow, Notification, AI)
- Education NEVER implements its own workflow engine, notification system, or AI runtime

### 2. Education NEVER Forks Healthcare
- No copy-paste from Healthcare engines
- No renaming `hc_*` tables to `ed_*`
- Build Education engines from scratch using Education domain model

### 3. Healthcare Remains Untouched
- No changes to Healthcare tables
- No changes to Healthcare events
- No changes to Healthcare engines
- Education implementation MUST NOT cause Healthcare regression

### 4. Architecture Blueprint First, Code Second
- **Phase 0:** Architecture design (THIS PHASE)
- **Phase 1+:** Implementation (AFTER ARB freeze + Hospital Pilot success)

### 5. Governance Before Implementation
- All Education architecture MUST pass ARB approval
- Hospital Pilot lessons MUST be incorporated before Education implementation
- Education design status: DRAFT → ARB REVIEW → FROZEN → IMPLEMENTATION READY

---

## IMPLEMENTATION FREEZE POLICY

**Current Status:** DRAFT (Architecture Blueprint Phase)

**Path to Frozen:**
1. ✅ ARB Governance Track (Week 1-3)
2. ✅ Hospital Pilot Operational Validation (Week 1-8)
3. ✅ Lessons Learned incorporated
4. ✅ ARB approval of Education Architecture Blueprint
5. ✅ Boundary freeze confirmation
6. ✅ Status change: DRAFT → FROZEN

**After Freeze:**
- Education Architecture becomes **reference specification**
- Implementation teams execute against frozen blueprint
- Changes require ADR + ARB approval

---

## COMPLIANCE ENFORCEMENT

### Pre-Commit Checklist (Education Implementation Phase)
- [ ] Migration is additive only (Law 4)
- [ ] No Healthcare tables touched (Law 9)
- [ ] Zero `any` types (Law 11)
- [ ] TypeScript compilation passes
- [ ] ESLint passes with 0 warnings

### Pre-Merge Checklist (Education Implementation Phase)
- [ ] No direct DB queries in Product Packs (Law 2)
- [ ] Engines in Education Platform, not Product Pack (Law 3)
- [ ] Domain events published (Law 5)
- [ ] Capability checks enforced (Law 7)
- [ ] ADR created if architectural decision made (Law 8)
- [ ] All tests pass

### Architecture Audit (ARB Review)
- [ ] Domain boundaries respected
- [ ] No Healthcare/Host Platform redefinitions
- [ ] Event namespace compliance
- [ ] Database namespace compliance
- [ ] Capability mapping validated
- [ ] ADR registry complete

---

## NEXT STEPS

**Phase 0 Deliverables (Design Only, NO Code):**
1. ✅ Education OS Constitution (THIS DOCUMENT)
2. ⏳ Domain Boundary Definition
3. ⏳ Domain Model (Aggregates, Entities, State Machines)
4. ⏳ Event Catalog
5. ⏳ Database Boundary Design
6. ⏳ Capability Mapping
7. ⏳ ADRs
8. ⏳ Implementation Readiness Checklist

**NOT Included in Phase 0:**
- ❌ Database migrations
- ❌ TypeScript code
- ❌ API routes
- ❌ UI components
- ❌ Test files

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-08-10 | Architecture Team | Initial Constitution (Phase 0 - DRAFT) |

---

**END OF CONSTITUTION**
