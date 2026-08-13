# BELLA HEALTHCARE & EDUCATION PLATFORM — EDUCATION OS CONSTITUTION

> **Status:** FINAL MANDATORY SPECIFICATION FOR ALL AI CODING AGENTS  
> **Effective Milestone:** Phase E1 Education Kernel Boundary Lock (Kernel Frozen)  
> **Scope:** Mandatory for all Education Product Verticals (Bella School, Bella Training Center, and future education systems).

---

## I. NGUYÊN TẮC PHÂN LẬP NGÀNH DỌC (THE ISOLATION CONSTITUTION)

### 🚫 NO CROSS-INDUSTRY IMPORTS LAW
> [!IMPORTANT]
> **Industry OS systems must be completely isolated from each other.** 
> - Education OS components (Kernel, services, repositories, or products) are strictly forbidden from importing, referencing, or depending on Healthcare OS modules (`src/platform/healthcare/*` or any `hc_*` Supabase table).
> - Healthcare OS components are similarly forbidden from importing Education OS modules.
> - Both systems can only communicate with the `Shared Bella Core` (`src/platform/core/` and generic platform engines) and platform public contracts.

```
                   SHARED BELLA CORE
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
       HEALTHCARE OS               EDUCATION OS
   Kernel H1-H12 (🔒)          Education Kernel (🔒)
             │                           │
       ┌─────┴─────┐               ┌─────┴─────┐
       │           │               │           │
    Hospital     Dental         School      Training
    Product      Product        Product     Product
```

### 🔒 KERNEL FREEZE & CONTRACT BOUNDARY
- Core platform files in `src/platform/core/` are locked and can only be modified under Platform Architect supervision.
- The `src/platform/education/` directory represents the **Education Kernel** and is frozen after E1. Product verticals (School/Training) are strictly prohibited from modifying this directory.
- Education products must call the Education Kernel strictly through **Education Public Contracts** (interfaces declared in `src/platform/education/contracts/`), while the Shared Core provides only industry-neutral primitives.

---

## II. STEP 6: EDUCATION KERNEL BOUNDARY DESIGN

We define exactly **5 core Bounded Contexts** within the Education Kernel. Any capability not defined here belongs exclusively to the Product Vertical (e.g. customized reports, specialized enrollment workflows, school fees, etc.):

### 1. Course Bounded Context (`course-engine`)
- **Domain Responsibility:** Managing academic courses, catalogs, syllabus metadata, and prerequisites.
- **Shared Capability:** Yes (Schools and Training centers both need course registries).
- **Product-Specific logic (Excluded):** Timetabling, classroom layout planning, school-specific semester setups.

### 2. Enrollment Bounded Context (`enrollment-engine`)
- **Domain Responsibility:** Handling admission applications, course enrollment registration, prerequisites verification, waitlist queues, and drop-out state transitions.
- **Shared Capability:** Yes (All educational organizations require student-to-course registry).
- **Product-Specific logic (Excluded):** Registration fee refund rules, school admissions interviews.

### 3. Student Bounded Context (`student-engine`)
- **Domain Responsibility:** Resolving the generic platform `Party` identity into the vertical `Student` or `Instructor/Faculty` roles with academic identifiers (e.g. `student_code`).
- **Shared Capability:** Yes.
- **Product-Specific logic (Excluded):** Dormitory allocations, student club registries.

### 4. Attendance Bounded Context (`attendance-engine`)
- **Domain Responsibility:** Capturing lesson roll-call checkpoints, check-in timestamps, and absences.
- **Shared Capability:** Yes.
- **Product-Specific logic (Excluded):** School bus tracking integration, face-scanner hardware drivers.

### 5. Assessment Context (`assessment-engine`)
- **Domain Responsibility:** Grade registers, grading scales, examinations, grade reports, and GPA computations.
- **Shared Capability:** Yes (Calculates academic achievements).
- **Product-Specific logic (Excluded):** Dean's honors list selection criteria, grade appeal committee workflows.

---

## III. STEP 7: EDUCATION INVARIANTS (THE SUPREME LAWS)

1. **Course Enrollment limit Invariant:** A student cannot exceed 24 active credits / 6 active course cohort registrations per semester/term.
2. **Prerequisite Check Invariant:** Course enrollment is blocked if the student has not passed the required prerequisite courses. Any prerequisite override must be executed as a **Governed Override** (going through the Rule Governance Engine, recording the specific authorized Actor, custom justifications, Rule engine version, and issuing an Audit Evidence ledger package signature).
3. **No Retroactive History Modification Invariant:** Academic records (grades, GPA, attendance logs) cannot be edited directly; corrections must be recorded as additive temporal events using either the generic platform `timelineEngine` or a dedicated `EducationTemporal` module inside the Education Kernel, completely independent of Healthcare's H9 Engine or tables.
4. **Grading Rule Governance Invariant:** Grading scales and GPA formulas must match a registered SemVer governed rule checksum (H10).
5. **Multi-Tenant Isolation Invariant:** Student files, grades, and attendance can never cross-contaminate between different educational institutions (tenant_id check enforced).
6. **Event-After-Persistence Invariant:** Event messages must be published only after database transaction success.

---

## IV. STEP 8: 20 LAWS OF EDUCATION OS

1. **Law 1: NO CORE PLATFORM MODIFICATION.** Core platform engines in `src/platform/` can only be updated if approved by the Platform Architect.
2. **Law 2: Product Vertical Scoping.** Education products must live strictly within `src/products/bella-school/` and `src/products/bella-training/`.
3. **Law 3: Contract-Only Access.** Product modules must call the Education Kernel through public contracts (`Product → Education Contract → Education Kernel`).
4. **Law 4: Additive Database Migrations.** Any database change must be additive (`CREATE` new education tables). Cấm modifying core platform tables.
5. **Law 5: Identity Primitive Reuse.** Do not create `education_students` tables. Students must register as a vertical `role` on the generic `Party` profile.
6. **Law 6: Transaction-First Event Publishing.** Events are dispatched only after DB commit.
7. **Law 7: Zero-Tolerance Tenant Isolation (Gate 0 / P0).** All queries must filter by `tenant_id` and have active RLS.
8. **Law 8: Academic Safety Routing.** All grading calculations and enrollment eligibility checks must route through the `Rule Governance` platform engine.
9. **Law 9: Full Auditability & Evidence.** All exam grading and enrollment completions must issue an Audit Evidence package with SHA-256 Fingerprint.
10. **Law 10: Mandatory 11 Verification Gates.** Every new feature requires a dedicated 11 Verification Gates integration test suite.
11. **Law 11: Architectural Gap Reporting.** If a product vertical requires a missing Kernel capability, AI must report `ARCHITECTURAL GAP DETECTED`.
12. **Law 12: Enrollment/Academic Record Aggregate Boundary Enforcement.** All student mutations must align with the `Enrollment/Academic Record` aggregate root.
13. **Law 13: Bitemporal Provenance Preservation.** Timeline snapshots must map through the platform timeline events.
14. **Law 14: Strict Typing.** No `any` types allowed in the Education OS code.
15. **Law 16: Non-Bypassable Block.** Admission blocks or prerequisite blocks cannot be bypassed by the UI (Law 15).
16. **Law 16: Anti-False-Compliance Invariant.** Missing audit packages return `REQUIRES_REVIEW` state.
17. **Law 17: Read-Model Projection Isolation.** Grade dashboards must query projection tables, never write models.
18. **Law 18: Idempotent Event Consumer.** All event handlers must support idempotency de-duplication.
19. **Law 19: Row Level Security (RLS).** Every education table must have active Supabase RLS.
20. **Law 20: NO CROSS-INDUSTRY COUPLING.** Education OS is prohibited from importing Healthcare OS codes or tables.

---

## V. STEP 9: AI CODING FIREWALL CONFIGURATION

### Cursor & AI Coding Firewall Guard Rules (`.cursorrules`)
Add the following strict instructions to `.cursorrules`:
```text
# READ EDUCATION CONSTITUTION BEFORE ANY EDUCATION TASK
# Path: docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md

1. EDUCATION OS KERNEL IS FROZEN. NEVER MODIFY THE KERNEL DIRECTORY (src/platform/education/) SILENTLY.
2. NO CROSS-INDUSTRY IMPORT. REJECT ANY CODE FROM platform/healthcare/ INSIDE platform/education/ OR products/bella-school/.
3. CALL PUBLIC CONTRACTS ONLY (src/platform/education/contracts/).
4. EXECUTE FULL VERIFICATION FLOW:
   a. Check local vertical boundaries & no cross-imports.
   b. Run education validation tests.
   c. Run 'npm run healthcare:verify' to ensure zero healthcare regression.
```

---

## VI. STEP 10: REFERENCE PRODUCTS & ARCHITECTURE FREEZE

We select **2 Reference Products** to validate the Education Kernel:

1. **Bella School (Primary Reference):** Represents long-term semester-based academic environments with complex grading GPA metrics and prerequisite dependencies.
2. **Bella Training Center (Secondary Reference):** Represents short-term cohort-based certification courses.

### Checkpoint Boundary
> [!WARNING]
> No database migrations, no product vertical coding, and no engine registration in code will take place. This constitution is locked at **Architecture Freeze Checkpoint**.

---

## VII. DEFINITION OF THE 11 AUTOMATED VERIFICATION GATES

Every education vertical feature must pass the following 11 automated verification tests:

| Gate # | Test Gate | Verification Focus |
| :---: | :--- | :--- |
| **Gate 1** | **Architecture Compliance** | Rejects cross-industry imports, enforces strict typing and boundary folder locks. |
| **Gate 2** | **Contract Boundary** | Verifies interactions go strictly through public contracts, not direct DB calls. |
| **Gate 3** | **Tenant Isolation (P0)** | Proves data isolation between Tenant A and Tenant B. |
| **Gate 4** | **RLS & Authorization** | Proves role authorization rules (Student vs Instructor vs Admin). |
| **Gate 5** | **Database Migration Safety** | Confirms all SQL migrations are additive only. |
| **Gate 6** | **Event-After-Persistence** | Verifies events are sent only after DB transaction commits. |
| **Gate 7** | **Academic Safety Routing** | Proves assessment calculations route through the rule platform engine. |
| **Gate 8** | **Temporal Provenance** | Reconstructs historical academic states at time T. |
| **Gate 9** | **Rule Governance** | Validates grading scales match governed rule checksums. |
| **Gate 10** | **Audit Evidence Integrity** | Verifies SHA-256 Fingerprint generation on transcript exports. |
| **Gate 11** | **Platform Regression** | Ensures all platform/healthcare tests remain 100% GREEN. |
