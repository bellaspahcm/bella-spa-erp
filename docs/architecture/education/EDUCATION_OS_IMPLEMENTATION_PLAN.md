# BELLA EDUCATION OS — IMPLEMENTATION PLAN
**Version:** 1.0  
**Date:** 2026-08-10  
**Status:** Phase 0A - Planning  
**Owner:** Architecture Team

---

## 🎯 STRATEGIC OBJECTIVE

This is NOT about "building another education software."

This is **Architecture Validation #2** for Bella Meta-Platform.

**Proof Goal:**
```
Bella AI Platform
       │
       ├─────── Healthcare OS (Depth Test)
       │         └── Hospital Product
       │
       └─────── Education OS (Generalization Test)
                 └── School Product
```

**Success means:** Education OS reuses Bella Host Platform WITHOUT forking, WITHOUT Healthcare coupling, WITH evidence-based architecture boundaries.

---

## 📋 EXECUTION PRINCIPLES

### 1. Evidence-Based Architecture
- ❌ No ADRs before audit
- ❌ No assumptions about boundaries
- ✅ Audit Healthcare first → Extract evidence → Freeze boundaries → Write ADRs

### 2. Zero Healthcare Coupling
- Education MUST NOT import Healthcare domain code
- Healthcare MUST NOT import Education domain code
- Shared code MUST be in Host Platform with cross-industry contracts

### 3. 7 Architecture Gates (Pass/Fail)
1. **Gate 1 - Boundary:** Healthcare → Education coupling = 0
2. **Gate 2 - Host Reuse:** Education uses Host Platform directly (no fork)
3. **Gate 3 - Kernel Independence:** Education Kernel ≠ Healthcare Kernel
4. **Gate 4 - Product Manifest:** School enabled by manifest/config (no fork)
5. **Gate 5 - Event Independence:** `education.*` vs `healthcare.*` namespaces
6. **Gate 6 - Migration Safety:** Host Platform extraction doesn't break Hospital OS
7. **Gate 7 - Replacement Test:** Can delete Healthcare package → Education still builds

---

## 🗓️ PHASE ROADMAP

### Phase 0A: Healthcare Architecture Extraction (Week 1-3)
**Goal:** Evidence-based Host Platform boundary identification

#### Week 1: Repository Audit
- **Day 1-2:** Directory structure mapping
  - Scan `src/platform/`, `src/services/`, `src/lib/`, `src/app/`
  - Classify: Host Platform / Healthcare / Product / Shared
  - Create initial ownership matrix

- **Day 3-4:** Dependency graph analysis
  - Build import tree: Who imports whom?
  - Find Healthcare leakage in `platform/` code
  - Search for healthcare terms in generic code:
    ```bash
    grep -r "patient\|encounter\|clinical\|doctor\|nurse" src/platform/host/
    grep -r "patient\|encounter\|clinical\|doctor\|nurse" src/lib/
    ```

- **Day 5:** Database schema audit
  - Review Supabase migrations
  - Classify tables: Host / Healthcare / Product
  - Identify shared vs industry-specific schemas

#### Week 2: Extraction Matrix
- **Day 1-2:** API & Event contract inventory
  - Review `src/platform/healthcare/contracts/`
  - Catalog all RPC functions, events, types
  - Tag: cross-industry vs healthcare-only

- **Day 3-4:** Host Platform extraction matrix
  - Create evidence table:
    ```
    Component | Healthcare-specific? | Cross-industry? | Dependencies | Reuse Level | Refactor Needed
    ```
  - Example rows:
    - Identity/IAM → No | Yes | None | High | None
    - Person Engine → No | Yes | None | High | Remove healthcare terms
    - Encounter Engine → Yes | No | Clinical | None | Move to Healthcare Kernel
    - Workflow Engine → No | Yes | Events | High | None

- **Day 5:** Healthcare leakage analysis
  - Document all violations:
    - Healthcare terms in `platform/host/`
    - Healthcare assumptions in workflow engine
    - Patient references in Person engine
  - Quantify severity: Critical / High / Medium / Low

#### Week 3: Boundary Freeze
- **Day 1-2:** Shared Kernel candidate list
  - **Group A: Bella Core** (cross-industry)
    - Identity, Tenant, Organization, Authorization
    - RLS, Audit, API Gateway, Event Bus
    - Workflow, Policy, Notification, File, Search
    - Observability, AI Runtime, Data Fabric, Integration

  - **Group B: Industry OS** (industry-specific)
    - Healthcare Kernel: Person, Encounter, Clinical, Medication, Surgery...
    - Education Kernel: Person, Learning Journey, Academic, Assessment...

  - **Group C: Products** (product-specific)
    - Healthcare: Hospital, Clinic, Dental, Lab, Pharmacy
    - Education: School, University, Academy, Training Center

- **Day 3:** Boundary freeze document
  - Create: `BELLA_META_PLATFORM_BOUNDARY.md`
  - Document Host Platform boundary with evidence
  - Document Healthcare Kernel boundary
  - Document Product boundary

- **Day 4:** Architecture review
  - Validate 7 Architecture Gates feasibility
  - Identify required refactoring before Education OS
  - Estimate refactoring effort

- **Day 5:** Regression validation plan
  - Migration strategy for Host Platform extraction
  - Feature flags for gradual rollout
  - Rollback plan if Hospital OS breaks

**Deliverables:**
- ✅ `docs/architecture/BELLA_META_PLATFORM_EXTRACTION_AUDIT.md`
- ✅ `docs/architecture/BELLA_META_PLATFORM_BOUNDARY.md`
- ✅ `docs/architecture/HEALTHCARE_LEAKAGE_ANALYSIS.md`
- ✅ `docs/architecture/HOST_PLATFORM_EXTRACTION_MATRIX.csv`

---

### Phase 0B: Meta-Platform Boundary Freeze (Week 4)
**Goal:** Freeze Host Platform boundaries with ARB approval

#### Activities
1. **Architecture Review Board (ARB) Session 1**
   - Present extraction audit findings
   - Present boundary proposal
   - Discuss refactoring requirements
   - Vote on boundary freeze

2. **Refactoring Planning**
   - Prioritize leakage fixes: Critical → High → Medium
   - Estimate effort per component
   - Create refactoring roadmap
   - Define feature flags strategy

3. **Documentation**
   - Finalize boundary documentation
   - Document migration strategy
   - Define contract versioning rules
   - Create Host Platform API catalog

**Deliverables:**
- ✅ ARB approval on boundaries
- ✅ `docs/architecture/HOST_PLATFORM_REFACTORING_PLAN.md`
- ✅ `docs/architecture/HOST_PLATFORM_API_CATALOG.md`

---

### Phase 0C: Education Architecture Blueprint (Week 5-6)
**Goal:** Design Education OS architecture based on frozen Host Platform boundaries

#### Week 5: Education Domain Discovery
- **Day 1-2:** Domain modeling workshop
  - Identify core entities: Person, Organization, Program, Curriculum, Course, Class, Student, Teacher
  - Define bounded contexts: Academic, Learning, Assessment, Resource, Workforce, Finance
  - Identify aggregates vs entities
  - Define invariants

- **Day 3-4:** Learning Journey analysis
  - Test if Learning Journey should be aggregate root
  - Compare alternatives:
    - Learning Journey as orchestration concept
    - Enrollment as aggregate root
    - Course Enrollment as separate aggregate
  - Decision criteria: invariants, transaction boundaries, consistency rules

- **Day 5:** Academic vs Learning separation
  - **Academic Context:** Curriculum, Program, Course Catalog (structure)
  - **Learning Context:** Enrollment, Learning Activity, Progress (execution)
  - Validate boundary with ubiquitous language

#### Week 6: Education Kernel Design
- **Day 1:** Core engines identification
  - PersonEngine (reuse from Host)
  - OrganizationEngine (reuse from Host)
  - AcademicEngine (new)
  - LearningEngine (new)
  - AssessmentEngine (new)
  - WorkforceEngine (new)
  - ResourceEngine (new)
  - FinanceEngine (adapt from Host)

- **Day 2-3:** Event taxonomy design
  - Event namespaces: `education.*`
  - Example events:
    ```
    education.person.created.v1
    education.student.enrolled.v1
    education.program.started.v1
    education.course.started.v1
    education.learning.activity.completed.v1
    education.assessment.submitted.v1
    education.assessment.evaluated.v1
    education.learning.outcome.achieved.v1
    education.student.at_risk.detected.v1
    education.intervention.created.v1
    education.program.completed.v1
    education.graduation.approved.v1
    ```

- **Day 4:** Command & query design
  - CQRS pattern validation
  - Command contracts
  - Query contracts
  - Read model design

- **Day 5:** Architecture blueprint document
  - Create comprehensive architecture doc
  - Include diagrams (Mermaid)
  - Document design decisions

**Deliverables:**
- ✅ `docs/architecture/education/BELLA_EDUCATION_OS_ARCHITECTURE.md`
- ✅ `docs/architecture/education/EDUCATION_DOMAIN_MODEL.md`
- ✅ `docs/architecture/education/EDUCATION_BOUNDED_CONTEXTS.md`
- ✅ `docs/architecture/education/EDUCATION_EVENT_TAXONOMY.md`

---

### Phase 0D: ADR Freeze (Week 7)
**Goal:** Document architectural decisions based on evidence

#### ADR List (12 ADRs)
1. **ADR-E01:** Education OS Architecture
2. **ADR-E02:** Person as Universal Education Identity
3. **ADR-E03:** Learning Journey Domain Model & Aggregate Boundary
4. **ADR-E04:** Academic vs Learning Bounded Context Separation
5. **ADR-E05:** Assessment & Competency Model
6. **ADR-E06:** Education Event Contract Registry
7. **ADR-E07:** Education Capability Registry
8. **ADR-E08:** Education Product Manifest Pattern
9. **ADR-E09:** Education AI Governance Rules
10. **ADR-E10:** Education Capability Risk Matrix
11. **ADR-E11:** Education Data Standardization & Integration Strategy
12. **ADR-E12:** Cross-Industry Shared Kernel Boundary Guard

#### ADR Writing Process
- **Day 1-2:** Write ADR-E01 to ADR-E06
- **Day 3-4:** Write ADR-E07 to ADR-E12
- **Day 5:** ARB review and approval

#### Critical ADR: ADR-E12 (Cross-Industry Boundary)
Must answer:
- What can Healthcare and Education share?
- What is forbidden to share?
- How to enforce boundaries at compile time?
- How to prevent leakage over time?

**Deliverables:**
- ✅ `docs/architecture/education/adr/ADR-E01-education-os-architecture.md`
- ✅ `docs/architecture/education/adr/ADR-E02-person-universal-identity.md`
- ✅ ... (all 12 ADRs)
- ✅ ARB approval on all ADRs

---

### Phase 1: Education Domain Design (Week 8-11)
**Goal:** Deep DDD design with aggregate boundaries, state machines, invariants

#### Week 8: Core Aggregates Design
- **Person Aggregate** (reuse from Host)
  - Root: Person
  - Roles: Student, Teacher, Parent, Guardian, Staff, Administrator
  - Invariants: Person identity uniqueness, role lifecycle

- **Organization Aggregate** (reuse from Host)
  - Root: Organization
  - Children: Department, Faculty, Office
  - Invariants: Hierarchy consistency, unit ownership

- **Program Aggregate** (new)
  - Root: Program
  - Children: Curriculum, Course Requirements, Prerequisites
  - Invariants: Credit requirements, prerequisite graph validity

- **Enrollment Aggregate** (new - candidate for root)
  - Root: Enrollment
  - Children: Student, Program, Cohort, Status, Effective Period
  - Invariants: Enrollment uniqueness, status lifecycle, effective period validation

- **Learning Journey** (orchestration concept - NOT aggregate)
  - Concept that links: Enrollment → Activities → Assessments → Outcomes
  - No aggregate root (to avoid god aggregate)
  - Query-side projection

#### Week 9: Bounded Contexts Deep Dive
- **Academic Context**
  - Entities: Institution, Program, Curriculum, Course, CourseOffering, Prerequisite
  - Responsibilities: Define WHAT to learn
  - Example: "Computer Science Bachelor program requires 120 credits"

- **Learning Context**
  - Entities: Enrollment, Class, LearningActivity, Attendance, Progress
  - Responsibilities: Execute HOW students learn
  - Example: "Student John is attending CS101 class, completed 5/10 activities"

- **Assessment Context**
  - Entities: Assessment, Submission, Evaluation, Rubric, Competency, LearningOutcome
  - Responsibilities: Measure learning achievement
  - Example: "Student John scored 85/100 on Midterm, achieved 'Proficient' in Algorithm Design"

- **Resource Context**
  - Entities: Classroom, Laboratory, Equipment, Schedule, Allocation
  - Responsibilities: Manage physical/digital resources
  - Example: "Lab 201 is booked by CS101 class on Monday 9-11am"

- **Workforce Context**
  - Entities: Teacher, TeachingAssignment, Workload, Performance, Availability
  - Responsibilities: Manage academic staff
  - Example: "Prof. Smith teaches 3 courses, 12 hours/week, available Mon-Thu"

- **Finance Context**
  - Entities: Tuition, Invoice, Payment, Scholarship, Discount, Refund
  - Responsibilities: Financial transactions (NOT accounting)
  - Accounting Boundary Guard: Finance Context generates transactions, Accounting System records them

#### Week 10: State Machines & Invariants
- **Enrollment State Machine**
  ```
  Draft → Submitted → Approved → Active → Completed / Withdrawn
  ```
  - Invariants:
    - Cannot approve if prerequisites not met
    - Cannot withdraw if tuition refund period expired
    - Cannot complete if required courses incomplete

- **Assessment State Machine**
  ```
  Assigned → Submitted → Evaluated → Published → Locked
  ```
  - Invariants:
    - Cannot submit after deadline (unless extension)
    - Cannot modify after published
    - Cannot delete after locked

- **Course Offering State Machine**
  ```
  Draft → Open for Enrollment → Closed → In Progress → Completed → Archived
  ```
  - Invariants:
    - Cannot start if min enrollment not met
    - Cannot close if students enrolled and not migrated

#### Week 11: Commands, Events, Queries
- **Command Design**
  - EnrollStudent
  - AssignTeacher
  - ScheduleClass
  - SubmitAssessment
  - RecordAttendance
  - GrantScholarship

- **Event Design** (versioned, immutable)
  - StudentEnrolled.v1
  - TeacherAssigned.v1
  - ClassScheduled.v1
  - AssessmentSubmitted.v1
  - AttendanceRecorded.v1
  - ScholarshipGranted.v1

- **Query Design**
  - GetStudentTranscript
  - GetTeacherSchedule
  - GetClassRoster
  - GetProgramRequirements
  - GetStudentProgress

**Deliverables:**
- ✅ `docs/architecture/education/domain/AGGREGATES.md`
- ✅ `docs/architecture/education/domain/BOUNDED_CONTEXTS.md`
- ✅ `docs/architecture/education/domain/STATE_MACHINES.md`
- ✅ `docs/architecture/education/domain/INVARIANTS.md`
- ✅ `docs/architecture/education/domain/COMMANDS.md`
- ✅ `docs/architecture/education/domain/EVENTS.md`
- ✅ `docs/architecture/education/domain/QUERIES.md`
- ✅ `docs/architecture/education/diagrams/` (Mermaid diagrams)

---

## 🚧 PHASE 2-8 (Execution Phases)

### Phase 2: Host Platform Refactoring (Week 12-15)
**Goal:** Extract and freeze Bella Host Platform

- Refactor healthcare leakage from Host Platform
- Move Healthcare-specific code to `src/platform/healthcare/`
- Version all Host Platform APIs
- Feature flag migration strategy
- Zero regression validation

### Phase 3: Education Kernel Implementation (Week 16-21)
**Goal:** Build 8 core engines

- PersonEngine (reuse)
- OrganizationEngine (reuse)
- AcademicEngine
- LearningEngine
- AssessmentEngine
- WorkforceEngine
- ResourceEngine
- FinanceEngine

### Phase 4: Education Capability Registry (Week 22-23)
**Goal:** Register all education capabilities

- Capability manifest schema
- Capability dependency graph
- Capability risk matrix
- Policy enforcement rules

### Phase 5: Bella School OS (Week 24-29)
**Goal:** First product validation

- School Product Manifest
- Student/Teacher/Admin experiences
- Core workflows: Enrollment, Attendance, Assessment, Grading
- Integration with existing SIS/LMS

### Phase 6: Education Intelligence (Week 30-35)
**Goal:** AI-powered education insights

- Student Copilot
- Teacher Copilot
- Academic Advisor AI
- School COO AI
- Predictive analytics: dropout risk, performance trends

### Phase 7: Bella University OS (Week 36-41)
**Goal:** Second product validation

- University Product Manifest
- Faculty, Department, Research, Thesis workflows
- Validate kernel reusability

### Phase 8: Architecture Validation (Week 42)
**Goal:** Validate 7 Architecture Gates

- Run Replacement Test (delete Healthcare → Education still builds)
- Measure Host Platform reuse %
- Validate zero coupling
- Document lessons learned
- Prepare for Industry OS #3

---

## 📊 SUCCESS METRICS

### Architecture Quality
- ✅ 7 Architecture Gates: All PASS
- ✅ Host Platform reuse: >80%
- ✅ Healthcare → Education coupling: 0 violations
- ✅ Replacement Test: PASS

### Code Quality
- ✅ TypeScript strict mode: 0 `any` types
- ✅ Test coverage: >80% for Education Kernel
- ✅ ADR compliance: 100%

### Operational Quality
- ✅ School OS pilot: 1 school, 500+ students, 3 months
- ✅ Zero regression: Hospital OS still functional
- ✅ Event Bus: >95% event delivery
- ✅ API availability: >99.9%

### Business Validation
- ✅ Education MVP validates Platform-of-Platforms architecture
- ✅ School product proves Product Manifest pattern
- ✅ University product proves kernel reusability
- ✅ Foundation ready for Industry OS #3 (Retail/Manufacturing/Finance)

---

## 🚨 RISK REGISTER

### Architecture Risks
1. **Healthcare leakage too deep**
   - Mitigation: Phase 0A audit identifies this early
   - Fallback: Refactor Host Platform first before Education

2. **Shared Kernel boundary unclear**
   - Mitigation: Evidence-based extraction matrix
   - Fallback: Conservative approach (less sharing, more isolation)

3. **Replacement Test fails**
   - Mitigation: Continuous integration tests, feature flags
   - Fallback: Additional refactoring phase

### Execution Risks
1. **Phase 0 takes longer than 7 weeks**
   - Mitigation: Time-box each week, adjust scope
   - Impact: Delay Education Kernel, but foundation is critical

2. **ARB does not approve boundaries**
   - Mitigation: Multiple review cycles, evidence presentation
   - Fallback: Iterate on boundaries until approval

3. **Hospital OS breaks during refactoring**
   - Mitigation: Feature flags, canary rollout, automated tests
   - Rollback: Revert changes, run on old architecture

---

## 📝 GOVERNANCE

### Architecture Review Board (ARB)
- **Members:** Architect, Tech Lead, Domain Expert, Security Lead
- **Cadence:** Weekly during Phase 0, bi-weekly after
- **Decision Authority:** ADR approval, boundary freeze, gate validation

### Decision Log
| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-08-10 | Start with Phase 0A audit | Evidence before ADRs | Approved |
| TBD | Host Platform boundary freeze | After extraction matrix | Pending |
| TBD | Education Kernel architecture | After domain design | Pending |

---

## 📚 REFERENCE DOCUMENTS

### Current System
- `docs/architecture/BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md`
- `docs/architecture/adr/ADR-010-Phase-0-Platform-Refactor.md`
- `AGENTS.md` (Bella Platform Constitution)

### To Be Created (Phase 0)
- `docs/architecture/BELLA_META_PLATFORM_EXTRACTION_AUDIT.md`
- `docs/architecture/BELLA_META_PLATFORM_BOUNDARY.md`
- `docs/architecture/HEALTHCARE_LEAKAGE_ANALYSIS.md`
- `docs/architecture/HOST_PLATFORM_EXTRACTION_MATRIX.csv`

### To Be Created (Phase 0C-0D)
- `docs/architecture/education/BELLA_EDUCATION_OS_ARCHITECTURE.md`
- `docs/architecture/education/adr/ADR-E01.md` through `ADR-E12.md`

---

## ✅ NEXT ACTIONS

**Immediate (Week 1):**
1. ✅ Create this implementation plan document
2. ⏳ Start Task #1: Repository Structure Audit
3. ⏳ Map `src/` directories to ownership matrix
4. ⏳ Search for healthcare leakage in platform code
5. ⏳ Document initial findings

**This Week:**
- Complete Week 1 audit tasks
- Begin extraction matrix
- Prepare Week 2 ARB presentation

**This Month:**
- Complete Phase 0A (Healthcare Extraction)
- ARB approval on boundaries
- Begin Education Architecture Blueprint

---

**Last Updated:** 2026-08-10  
**Next Review:** 2026-08-17 (Weekly ARB)  
**Status:** ✅ Plan Approved - Execution Starting
