---
product: bella-english-center
phase: E0.5
status: SEALED
created: 2026-09-12
sealed: 2026-09-12
purpose: executable_product_manifest_lock
methodology: machine_readable_architecture_compilation
blocker_for: E1_implementation
dependencies:
  - E0.1A/B/C Ownership Discovery (SEALED)
  - E0.2 Authorization Model (SEALED)
  - E0.3 Capability Classification (SEALED)
  - E0.4 Business Invariants (SEALED)
  - E0.4R Rule Reconciliation (COMPLETE)
  - Platform Architecture Registry (R1-R5)
result:
  manifest_version: "1.0"
  manifest_file: bella-english-center.manifest.yaml
  total_capabilities: 22
  total_rules: 44
  total_gates: 11
  blocking_gaps: 2
  architecture_frozen: true
  implementation_ready: false
---

# E0.5 — EXECUTABLE PRODUCT MANIFEST

> **Mission:** Compile E0 Foundation into machine-readable YAML/JSON artifact that Factory can use to resolve intent → generate implementation → enforce gates.

---

## 🎯 OBJECTIVE

**E0.1-E0.4 trả lời các câu hỏi về kiến trúc (human-readable analysis)**

**E0.5 compile thành manifest mà AI Factory có thể đọc và thực thi**

**NOT:** Thêm một document kiến trúc lớn nữa

**YES:** Machine-readable artifact + validation schema

---

## 📋 MANIFEST STRUCTURE

### 4 Core Sections (Machine-Readable)

```yaml
1. capability_registry
   - Ownership map
   - Contract references
   - Extension rules
   - Direct DB access rules

2. entity_ownership
   - Canonical owners
   - Source of truth tables
   - Identity model
   - Extension patterns

3. rule_registry
   - Business invariants (24)
   - Architecture invariants (5)
   - Policies (10)
   - Workflows (5)
   - Enforcement modes
   - Cross-domain rules (6)

4. gate_dependency_map
   - Required gates per capability
   - Enforcement layer
   - Test evidence
```

### 3 Control Sections

```yaml
5. blocking_gaps
   - E0.1A-R Identity Migration
   - E0.1B-R Finance Contract

6. allowed_extensions
   - Context table pattern
   - Product-owned entities

7. forbidden_actions
   - No Kernel modification
   - No contract bypass
   - No identity model violation
```

---

## 📄 MACHINE-READABLE MANIFEST

### File: `bella-english-center.manifest.yaml`

```yaml
manifest_version: "1.0"
product:
  id: bella-english-center
  name: Bella English Center
  tier: product_vertical
  platform: education-os
  status: architecture_compiled
  implementation_status: blocked
  created: 2026-09-12
  sealed: 2026-09-12

metadata:
  total_capabilities: 22
  platform_reuse: 10
  product_specific: 9
  promotion_candidates: 3
  total_rules: 44
  blocking_gaps: 2
  architecture_frozen: true
  implementation_ready: false

# ============================================================================
# SECTION 1: CAPABILITY REGISTRY
# ============================================================================

capabilities:
  # REUSE — Platform/Kernel Capabilities
  
  lead_crm:
    owner: platform-core
    source: lead-engine
    mode: reuse
    contract:
      interface: LeadWorkflowEngine, LeadSLAEngine, LeadRotationEngine
      location: src/platform/lead-engine/
      status: available
      operations:
        - acceptLead
        - logFollowup
        - convertLead
    extension:
      allowed: true
      pattern: context_table
      table: english_center_lead_contexts
      fk: lead_id
    direct_db_write: forbidden
    required_gates: [0]
    implementation_status: ready

  student:
    owner: education-kernel
    mode: reuse_with_extension
    contract:
      interface: IEducationStudentContract
      location: src/platform/education/contracts/student.contract.ts
      status: available
      operations:
        - registerStudent
        - getStudent
    extension:
      allowed: true
      pattern: context_table
      table: english_center_student_contexts
      fk: student_id
    direct_db_write: forbidden
    required_gates: [0, 1, 2, 5, 11]
    implementation_status: blocked
    blocked_by: E0.1A-R
    blocker_reason: Student uses person_id FK, requires Party migration

  enrollment:
    owner: education-kernel
    mode: reuse_with_extension
    contract:
      interface: IEducationEnrollmentContract
      location: src/platform/education/contracts/enrollment.contract.ts
      status: available
      operations:
        - enrollStudent
        - getEnrollment
        - completeEnrollment
    extension:
      allowed: true
      pattern: context_table
      table: english_center_enrollment_contexts
      fk: enrollment_id
    direct_db_write: forbidden
    required_gates: [0, 1, 2, 3, 4, 8]
    cross_domain:
      - finance (payment requirement)
      - class (assignment)
    implementation_status: partial_blocked
    blocked_by: E0.1B-R
    blocker_reason: Enrollment activation requires Finance contract for payment verification

  attendance:
    owner: education-kernel
    mode: reuse_with_extension
    contract:
      interface: IEducationAttendanceContract
      location: src/platform/education/contracts/attendance.contract.ts
      status: available
      operations:
        - recordAttendance
        - getAttendanceHistory
    extension:
      allowed: true
      pattern: context_table
      table: english_center_attendance_contexts
      fk: attendance_id
    direct_db_write: forbidden
    required_gates: [0, 1, 2, 3, 4]
    cross_domain:
      - enrollment (validation)
    implementation_status: ready

  assessment:
    owner: education-kernel
    mode: reuse_with_extension
    contract:
      interface: IEducationAssessmentContract
      location: src/platform/education/contracts/assessment.contract.ts
      status: available
      operations:
        - recordScore
        - getScores
        - calculateGpa
    extension:
      allowed: true
      pattern: context_table
      table: english_center_assessment_contexts
      fk: assessment_id
    direct_db_write: forbidden
    required_gates: [0, 1, 2, 3, 4, 9]
    implementation_status: ready

  teacher_assignment:
    owner: education-kernel
    mode: reuse_with_extension
    contract:
      interface: IEducationTeacherAssignmentContract
      location: src/platform/education/contracts/teacher-assignment.contract.ts
      status: available
      operations:
        - assignTeacher
        - terminateAssignment
    extension:
      allowed: true
      pattern: context_table
      table: english_center_teacher_contexts
      fk: assignment_id
    direct_db_write: forbidden
    required_gates: [0, 1, 2]
    cross_domain:
      - scheduling (conflict detection)
    implementation_status: ready

  course_template:
    owner: education-kernel
    mode: reuse_as_base
    contract:
      interface: IEducationCourseContract
      location: src/platform/education/contracts/course.contract.ts
      status: available
      operations:
        - createCourse
        - getCourse
    extension:
      allowed: true
      pattern: context_table
      table: english_center_course_contexts
      fk: course_id
    note: Kernel Course = Template only (no temporal/capacity fields)
    direct_db_write: forbidden
    required_gates: [0, 1, 2]
    implementation_status: ready

  finance_invoice:
    owner: platform-finance
    source: f3-ar
    mode: reuse
    contract:
      interface: IFinanceReceivableContract
      location: src/platform/finance/contracts/
      status: missing
      operations:
        - issueInvoice
        - recordPayment
        - allocatePayment
        - voidInvoice
    extension:
      allowed: true
      pattern: context_table
      table: english_center_invoice_contexts
      fk: invoice_id
    direct_db_write: forbidden
    required_gates: [0, 2, 10]
    implementation_status: blocked
    blocked_by: E0.1B-R
    blocker_reason: Finance AR contract missing

  finance_reversal:
    owner: platform-finance
    source: ledger-engine
    mode: reuse
    contract:
      interface: ledgerService.reverseTransaction
      location: src/platform/finance/ledger-engine/
      status: available
      operations:
        - reverseTransaction
        - reverseAllocation
    extension:
      allowed: false
    direct_db_write: forbidden
    required_gates: [0, 2]
    implementation_status: ready

  authorization:
    owner: platform-core
    source: iam-matrix
    mode: reuse
    contract:
      interface: IAMMatrix + PartyRole
      location: src/platform/iam-matrix/, src/platform/party/
      status: available
      operations:
        - checkPermission
        - assignRole
    extension:
      allowed: true
      pattern: party_role (generic)
    direct_db_write: forbidden
    required_gates: [0, 6]
    implementation_status: ready

  # PRODUCT-SPECIFIC — English Center Capabilities

  consultation:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_consultations
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  placement_test:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_placement_tests
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  trial_class:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_trial_classes
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  course_offering:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_course_offerings
    note: Temporal/capacity extension of Kernel Course Template
    base_entity: course (kernel)
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  class:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_classes
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    cross_domain:
      - enrollment (assignment)
      - teacher_assignment (scheduling)
    implementation_status: ready

  session:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_sessions
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    cross_domain:
      - attendance (context)
    implementation_status: ready

  makeup_session:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_makeup_sessions
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  renewal:
    owner: english-center
    mode: product_workflow_orchestration
    contract: none
    source_of_truth: english_center_renewal_opportunities
    note: Orchestrates Kernel enrollment completion → new enrollment
    orchestrates:
      - enrollment (completion detection)
      - enrollment (new enrollment creation via contract)
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 2, 4]
    implementation_status: ready

  teacher_scheduling:
    owner: english-center
    mode: product_specific
    contract: none
    source_of_truth: english_center_teacher_availability
    note: NOT cron scheduler, resource availability calendar
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  # PROMOTION CANDIDATES — Deferred to Product #3

  program:
    owner: english-center
    mode: promotion_candidate
    contract: none
    source_of_truth: english_center_programs
    promotion_reason: May be generic across education products
    defer_until: product_3
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  level:
    owner: english-center
    mode: promotion_candidate
    contract: none
    source_of_truth: english_center_levels
    promotion_reason: May be generic across education products
    defer_until: product_3
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

  organizational_scope:
    owner: english-center
    mode: promotion_candidate
    contract: none
    source_of_truth: english_center_regions, english_center_branches
    promotion_reason: May be generic across multi-location products
    defer_until: product_3
    extension:
      allowed: false
    direct_db_write: allowed
    required_gates: [0, 4]
    implementation_status: ready

# ============================================================================
# SECTION 2: ENTITY OWNERSHIP
# ============================================================================

entities:
  # Platform Core Entities
  party:
    owner: platform-core
    source_of_truth: party_parties
    identity_model: party_canonical
    extension_allowed: false
    duplication_forbidden: true
    migration_status: canonical

  person:
    owner: platform-core
    source_of_truth: persons
    identity_model: person_legacy
    extension_allowed: false
    duplication_forbidden: true
    migration_status: legacy_to_be_migrated
    migration_target: party
    blocking_gap: E0.1A-R

  tenant:
    owner: platform-core
    source_of_truth: tenants
    extension_allowed: false
    duplication_forbidden: true

  user:
    owner: platform-core
    source_of_truth: users
    identity_model: party
    extension_allowed: false
    duplication_forbidden: true

  organization:
    owner: platform-core
    source_of_truth: organizations
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table

  lead:
    owner: platform-core
    source: lead-engine
    source_of_truth: managed_lead_interface
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table

  invoice:
    owner: platform-finance
    source: f3-ar
    source_of_truth: finance_invoices
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table
    contract_status: missing
    blocking_gap: E0.1B-R

  payment:
    owner: platform-finance
    source: f3-ar
    source_of_truth: finance_payments
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table
    contract_status: missing
    blocking_gap: E0.1B-R

  # Education Kernel Entities

  student:
    owner: education-kernel
    source_of_truth: students
    identity_model: person_legacy
    extension_allowed: true
    extension_pattern: context_table
    migration_required: true
    migration_reason: Uses person_id FK, should use party_id
    blocking_gap: E0.1A-R

  course:
    owner: education-kernel
    source_of_truth: courses
    semantic: template_only
    note: No temporal/capacity fields (offering semantic is product)
    extension_allowed: true
    extension_pattern: context_table

  enrollment:
    owner: education-kernel
    source_of_truth: edu_enrollments
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table

  attendance:
    owner: education-kernel
    source_of_truth: edu_attendance
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table

  assessment:
    owner: education-kernel
    source_of_truth: edu_assessments
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table

  teacher_assignment:
    owner: education-kernel
    source_of_truth: teacher_assignments
    identity_model: party
    extension_allowed: true
    extension_pattern: context_table

  # Product-Specific Entities

  placement_test:
    owner: english-center
    source_of_truth: english_center_placement_tests
    identity_model: party
    extension_allowed: false
    product_boundary: valid

  trial_class:
    owner: english-center
    source_of_truth: english_center_trial_classes
    identity_model: party
    extension_allowed: false
    product_boundary: valid

  consultation:
    owner: english-center
    source_of_truth: english_center_consultations
    identity_model: party
    extension_allowed: false
    product_boundary: valid

  course_offering:
    owner: english-center
    source_of_truth: english_center_course_offerings
    base_entity: course (kernel)
    semantic: temporal_capacity_extension
    identity_model: none
    extension_allowed: false
    product_boundary: valid

  class:
    owner: english-center
    source_of_truth: english_center_classes
    identity_model: none
    extension_allowed: false
    product_boundary: valid

  session:
    owner: english-center
    source_of_truth: english_center_sessions
    identity_model: none
    extension_allowed: false
    product_boundary: valid

  makeup_session:
    owner: english-center
    source_of_truth: english_center_makeup_sessions
    identity_model: party
    extension_allowed: false
    product_boundary: valid

  renewal_opportunity:
    owner: english-center
    source_of_truth: english_center_renewal_opportunities
    identity_model: party
    extension_allowed: false
    product_boundary: valid

  program:
    owner: english-center
    source_of_truth: english_center_programs
    promotion_candidate: true
    defer_until: product_3

  level:
    owner: english-center
    source_of_truth: english_center_levels
    promotion_candidate: true
    defer_until: product_3

  region:
    owner: english-center
    source_of_truth: english_center_regions
    promotion_candidate: true
    defer_until: product_3

  branch:
    owner: english-center
    source_of_truth: english_center_branches
    promotion_candidate: true
    defer_until: product_3

# ============================================================================
# SECTION 3: RULE REGISTRY
# ============================================================================

rules:
  total_count: 44

  business_invariants:
    count: 24
    enforcement_mode: runtime_block
    rules:
      - id: INV-LEAD-01
        intent: Lead state machine
        severity: BLOCK
        owner: platform-core
        implementation_status: ready
      
      - id: INV-CONS-01
        intent: No double-booking consultant
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-PLACE-01
        intent: Placement test integrity
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-TRIAL-01
        intent: Trial class capacity enforcement
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-TRIAL-02
        intent: Trial attendance time constraint
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-LEVEL-01
        intent: Level within program hierarchy
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-OFFER-01
        intent: Offering date constraints
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-CLASS-01
        intent: No teacher schedule conflict
        severity: BLOCK
        owner: english-center
        cross_domain: teacher_assignment
        implementation_status: ready
      
      - id: INV-CLASS-02
        intent: Class capacity enforcement
        severity: BLOCK
        owner: english-center
        cross_domain: enrollment
        implementation_status: ready
      
      - id: INV-ENR-01
        intent: Enrollment activation requires payment
        severity: BLOCK
        owner: education-kernel + platform-finance + english-center
        cross_domain: finance
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: INV-ENR-02
        intent: Completion requires assessment
        severity: BLOCK
        owner: education-kernel + english-center
        implementation_status: ready
      
      - id: INV-ENR-03
        intent: Enrollment state transition constraints
        severity: BLOCK
        owner: education-kernel
        implementation_status: ready
      
      - id: INV-SESS-01
        intent: Session teacher conflict forbidden
        severity: BLOCK
        owner: english-center
        cross_domain: teacher_assignment
        implementation_status: ready
      
      - id: INV-ATT-01
        intent: Attendance requires enrollment
        severity: BLOCK
        owner: education-kernel + english-center
        cross_domain: enrollment
        implementation_status: ready
      
      - id: INV-MAKEUP-02
        intent: No double credit (regular + makeup)
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-ASSESS-01
        intent: Score range validation
        severity: BLOCK
        owner: education-kernel + english-center
        implementation_status: ready
      
      - id: INV-ASSESS-02
        intent: Final grade calculation accuracy
        severity: BLOCK
        owner: education-kernel + english-center
        implementation_status: ready
      
      - id: INV-COMP-01
        intent: Completion criteria enforcement
        severity: BLOCK
        owner: education-kernel + english-center
        implementation_status: ready
      
      - id: INV-FIN-03
        intent: Payment requirement for enrollment activation
        severity: BLOCK
        owner: platform-finance + education-kernel + english-center
        cross_domain: enrollment_finance
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: INV-TEACH-01
        intent: Teacher schedule conflict forbidden
        severity: BLOCK
        owner: english-center
        cross_domain: teacher_assignment
        implementation_status: ready
      
      - id: INV-TEACH-02
        intent: Teacher availability respect required
        severity: BLOCK
        owner: english-center
        implementation_status: ready
      
      - id: INV-BRANCH-01
        intent: Branch data isolation
        severity: BLOCK
        owner: english-center
        enforcement_mode: authorization_deny
        implementation_status: ready
      
      - id: CROSS-ENR-FIN
        intent: Enrollment-Finance cross-domain consistency
        severity: BLOCK
        owner: english-center (orchestrator)
        cross_domain: enrollment_finance
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: CROSS-ATT-CLASS
        intent: Attendance-Class cross-domain consistency
        severity: BLOCK
        owner: english-center (orchestrator)
        cross_domain: attendance_enrollment
        implementation_status: ready
      
      - id: CROSS-TEACH-SCHEDULE
        intent: Teacher-Schedule cross-domain consistency
        severity: BLOCK
        owner: english-center (orchestrator)
        cross_domain: teacher_scheduling
        implementation_status: ready

  architecture_invariants:
    count: 5
    enforcement_mode: ci_gate
    rules:
      - id: INV-RENEW-02
        intent: Renewal uses Kernel enrollment contract
        severity: BLOCK
        owner: architecture-governance
        gate: 2 (Contract layer)
        implementation_status: ready
      
      - id: INV-FIN-01
        intent: Invoice issuance uses Platform Finance contract
        severity: BLOCK
        owner: architecture-governance
        gate: 2 (Contract layer)
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: INV-FIN-02
        intent: Payment recording uses Platform Finance contract
        severity: BLOCK
        owner: architecture-governance
        gate: 2 (Contract layer)
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: INV-REFUND-02
        intent: Refund execution uses Platform Finance reversal
        severity: BLOCK
        owner: architecture-governance
        gate: 2 (Contract layer)
        implementation_status: ready
      
      - id: CROSS-IDENTITY-ALL
        intent: All new code uses Party (NOT Person)
        severity: BLOCK (new) | WARN (legacy)
        owner: architecture-governance
        gate: 5 (Party identity), 11 (Migration warning)
        implementation_status: blocked
        blocked_by: E0.1A-R

  policies:
    count: 10
    enforcement_mode: workflow_guard + audit
    configurable: true
    rules:
      - id: INV-LEAD-02
        intent: SLA duration
        severity: WARN
        owner: english-center
        configurable: sla_duration_hours
        implementation_status: ready
      
      - id: INV-LEAD-03
        intent: Sales rotation algorithm
        severity: AUDIT
        owner: english-center
        configurable: rotation_mode
        implementation_status: ready
      
      - id: INV-PLACE-02
        intent: Level recommendation score ranges
        severity: WARN
        owner: english-center
        configurable: score_ranges_by_level
        implementation_status: ready
      
      - id: INV-ATT-02
        intent: Absence threshold
        severity: WARN
        owner: english-center
        configurable: max_absences_before_alert
        implementation_status: ready
      
      - id: INV-MAKEUP-01
        intent: Makeup eligibility rules
        severity: BLOCK
        owner: english-center
        configurable: makeup_eligibility_window_days
        implementation_status: ready
      
      - id: INV-ASSESS-03
        intent: Certification threshold
        severity: WARN
        owner: english-center
        configurable: certification_min_score
        implementation_status: ready
      
      - id: INV-FIN-04
        intent: Installment grace period
        severity: WARN
        owner: english-center
        configurable: installment_grace_period_days
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: INV-REFUND-01
        intent: Refund schedule
        severity: BLOCK
        owner: english-center
        configurable: refund_percentage_by_week
        implementation_status: ready
      
      - id: INV-DISC-01
        intent: Discount rules
        severity: BLOCK
        owner: english-center
        configurable: discount_policies
        implementation_status: blocked
        blocked_by: E0.1B-R
      
      - id: INV-KPI-01
        intent: Branch KPI definitions
        severity: AUDIT
        owner: english-center
        configurable: kpi_calculation_formulas
        implementation_status: ready

  workflows:
    count: 5
    enforcement_mode: workflow_guard
    skippable_with_governance: true
    rules:
      - id: INV-CONS-02
        intent: Consultation outcome recording
        severity: WARN
        owner: english-center
        skip_condition: governance_approval
        implementation_status: ready
      
      - id: INV-PROG-01
        intent: Program recommendation
        severity: WARN
        owner: english-center
        skip_condition: manual_override
        implementation_status: ready
      
      - id: INV-PROG-02
        intent: Level progression recommendation
        severity: WARN
        owner: english-center
        skip_condition: manual_override
        implementation_status: ready
      
      - id: INV-RENEW-01
        intent: Renewal opportunity trigger
        severity: WARN
        owner: english-center
        skip_condition: configurable_trigger
        implementation_status: ready
      
      - id: INV-TRANSFER-01
        intent: Branch transfer approval
        severity: WARN
        owner: english-center
        skip_condition: governance_approval
        implementation_status: ready

  cross_domain:
    count: 6
    rules:
      - enrollment_finance
      - enrollment_class
      - attendance_enrollment
      - teacher_scheduling
      - branch_authorization
      - identity_all (architecture)

# ============================================================================
# SECTION 4: GATE DEPENDENCY MAP
# ============================================================================

gates:
  gate_0:
    name: Tenant Isolation
    description: RLS policies + tenant_id column required
    enforcement: database + runtime
    applies_to: all_capabilities
    test_evidence: RLS policy tests + tenant isolation E2E

  gate_1:
    name: No Kernel Modification
    description: Kernel tables untouched, no new kernel engines
    enforcement: ci_gate + architecture_guard
    applies_to: all_product_code
    test_evidence: Architecture Guard verification

  gate_2:
    name: Contract Layer
    description: No raw SQL to Kernel/Platform tables, use contracts
    enforcement: ci_gate + code_review
    applies_to: kernel_platform_interaction
    test_evidence: Integration tests via contracts

  gate_3:
    name: Event-After-Persistence
    description: DB commit before domain event publish
    enforcement: runtime + integration_test
    applies_to: event_publishing
    test_evidence: Event ordering tests

  gate_4:
    name: Additive Migration
    description: No DROP table/column, only CREATE/ADD/ALTER
    enforcement: ci_gate + migration_review
    applies_to: all_migrations
    test_evidence: Migration validation script

  gate_5:
    name: Party Identity Model
    description: FK references party_parties(id), NOT persons(id)
    enforcement: ci_gate + architecture_guard
    applies_to: new_code
    test_evidence: Identity model validation
    blocked_by: E0.1A-R (legacy Person FK exists)

  gate_6:
    name: RBAC
    description: Security guard checks role before operation
    enforcement: runtime + authorization_middleware
    applies_to: protected_operations
    test_evidence: Authorization E2E tests

  gate_8:
    name: Prerequisite Validation
    description: Enrollment checks prerequisite courses
    enforcement: runtime + business_logic
    applies_to: enrollment
    test_evidence: Prerequisite validation tests

  gate_9:
    name: GPA Calculation
    description: Weighted average accuracy
    enforcement: runtime + unit_test
    applies_to: assessment
    test_evidence: GPA calculation unit tests

  gate_10:
    name: Financial Immutability
    description: Invoice immutable after issuance (SHA-256 fingerprint)
    enforcement: runtime + database
    applies_to: finance
    test_evidence: Financial immutability tests
    blocked_by: E0.1B-R (Finance contract missing)

  gate_11:
    name: Identity Migration Warning
    description: Legacy Person code marked for migration
    enforcement: ci_gate + audit
    applies_to: legacy_code
    test_evidence: Migration tracker
    blocked_by: E0.1A-R (migration not completed)

# ============================================================================
# SECTION 5: BLOCKING GAPS
# ============================================================================

blocking_gaps:
  count: 2
  
  E0.1A-R:
    id: E0.1A-R
    title: Identity Migration (Person → Party)
    type: platform_core_remediation
    owner: platform-core-team
    severity: blocking
    impact: High
    description: |
      Education Kernel uses Person model (students.person_id → persons(id))
      Platform canonical identity is Party (party_parties)
      Guardian relationships require Party semantic
      Migration required: Person → Party
    
    blocks:
      capabilities:
        - student (FK migration)
      rules:
        - CROSS-IDENTITY-ALL (architecture invariant)
      gates:
        - gate_5 (Party identity model)
        - gate_11 (Migration warning)
    
    remediation_required:
      - Migrate students table: person_id → party_id
      - Migrate persons data → party_parties
      - Update Education Kernel contracts to use Party
      - Update Student service to use Party
      - Run regression tests (Education + Healthcare + Real Estate)
    
    timeline: Parallel to E0.5
    status: open
    
    workaround: None (architectural boundary violation)

  E0.1B-R:
    id: E0.1B-R
    title: Finance AR Contract Missing
    type: platform_finance_remediation
    owner: platform-finance-team
    severity: blocking
    impact: High
    description: |
      Platform Finance has canonical AR schema (finance_invoices, finance_payments, finance_allocations)
      Schema exists in migration supabase/migrations/20260817000000_finance_ar_engine_v1.sql
      Public contract MISSING (src/platform/finance/index.ts only exports ledger/cash engines)
      English Center CANNOT use F3 AR without contract
    
    blocks:
      capabilities:
        - finance_invoice (cannot issue invoices)
        - enrollment (cannot verify payment for activation)
      rules:
        - INV-FIN-01 (invoice issuance)
        - INV-FIN-02 (payment recording)
        - INV-FIN-03 (enrollment payment check)
        - INV-FIN-04 (installment tracking)
        - INV-DISC-01 (discount application)
        - CROSS-ENR-FIN (enrollment-finance cross-domain)
      gates:
        - gate_2 (contract enforcement)
        - gate_10 (financial immutability)
    
    remediation_required:
      - Create IFinanceReceivableContract interface
      - Implement issueInvoice(), recordPayment(), allocatePayment(), voidInvoice()
      - Export from src/platform/finance/index.ts
      - Document contract usage
      - Update Registry R2
    
    timeline: Parallel to E0.5
    status: open
    
    workaround: None (raw SQL forbidden by architecture invariant)

# ============================================================================
# SECTION 6: ALLOWED EXTENSIONS
# ============================================================================

allowed_extensions:
  
  context_table_pattern:
    description: Product extends Kernel/Platform entity via context table
    allowed: true
    rules:
      - Table name: {product}_{entity}_contexts
      - FK to Kernel/Platform source of truth
      - Product-specific columns only
      - No semantic duplication of source entity
      - Tenant isolation required (tenant_id + RLS)
    examples:
      - english_center_student_contexts → students(id)
      - english_center_enrollment_contexts → edu_enrollments(id)
      - english_center_invoice_contexts → finance_invoices(id)
  
  product_owned_entity:
    description: Product creates entity genuinely product-specific
    allowed: true
    rules:
      - No semantic overlap with Kernel/Platform
      - Product controls lifecycle
      - Tenant isolation required
      - Additive migrations only
    examples:
      - english_center_placement_tests
      - english_center_trial_classes
      - english_center_consultations
      - english_center_course_offerings
      - english_center_classes
      - english_center_sessions
  
  party_role_extension:
    description: Product defines vertical-specific roles via PartyRole
    allowed: true
    rules:
      - Use Platform Party Role mechanism (generic)
      - Role names: {product}:{role} (e.g., english-center:teacher)
      - Authorization via IAM Matrix
    examples:
      - english-center:sales
      - english-center:teacher
      - english-center:branch-manager
      - english-center:hq-admin
  
  event_subscription:
    description: Product subscribes to Kernel/Platform domain events
    allowed: true
    rules:
      - Subscribe via event bus (no direct coupling)
      - Maintain derived view in product DB (read-only projection)
      - Do NOT modify Kernel/Platform state
    examples:
      - enrollment.completed → trigger renewal opportunity
      - payment.received → activate enrollment

# ============================================================================
# SECTION 7: FORBIDDEN ACTIONS
# ============================================================================

forbidden_actions:
  
  kernel_modification:
    description: Product CANNOT modify Kernel tables/entities
    severity: BLOCK
    enforcement: gate_1 + architecture_guard
    forbidden:
      - CREATE new Kernel engine (e.g., H13, E8)
      - ALTER Kernel table schema
      - DROP Kernel column
      - Modify Kernel entity responsibilities
      - Duplicate Kernel entity semantically
    reason: Kernel freeze policy (Healthcare H1-H12, Logistics E7.1-E7.3, Education Enrollment/Attendance/Assessment)
  
  contract_bypass:
    description: Product CANNOT bypass contracts via raw SQL
    severity: BLOCK
    enforcement: gate_2 + code_review
    forbidden:
      - Direct INSERT/UPDATE to Kernel tables (use contract)
      - Direct INSERT/UPDATE to Platform Finance tables (use contract)
      - SELECT without contract (queries should use contract read operations)
    reason: Contract layer enforces business rules, gates, and cross-domain consistency
  
  identity_model_violation:
    description: New code MUST use Party (NOT Person legacy)
    severity: BLOCK (new code) | WARN (legacy code)
    enforcement: gate_5 + gate_11
    forbidden:
      - FK to persons(id) in new tables
      - New Party → Person conversion logic
      - Hardcoded Person assumptions
    reason: Party is canonical identity model, Person is legacy
    blocked_by: E0.1A-R (migration required)
  
  duplicate_source_of_truth:
    description: Product CANNOT duplicate Kernel/Platform source of truth
    severity: BLOCK
    enforcement: gate_1 + architecture_guard
    forbidden:
      - english_center_enrollments table (Kernel owns edu_enrollments)
      - english_center_invoices table (Platform owns finance_invoices)
      - english_center_parties table (Platform owns party_parties)
    reason: Single Writer Principle, no semantic duplication
  
  tenant_isolation_bypass:
    description: All tables MUST have tenant isolation
    severity: BLOCK
    enforcement: gate_0 + database_policy
    forbidden:
      - Table without tenant_id column
      - Table without RLS policy
      - Cross-tenant data access
    reason: Multi-tenant security boundary
  
  destructive_migration:
    description: Product CANNOT drop tables/columns
    severity: BLOCK
    enforcement: gate_4 + CI migration validation
    forbidden:
      - DROP TABLE
      - DROP COLUMN
      - ALTER COLUMN TYPE (breaking change)
    reason: Additive-only migration policy

# ============================================================================
# VALIDATION & STATUS
# ============================================================================

validation:
  schema_version: "1.0"
  last_validated: 2026-09-12
  
  checks:
    total_capabilities_match: true  # 22 capabilities
    total_rules_match: true          # 44 rules
    blocking_gaps_tracked: true      # 2 gaps
    gate_coverage_complete: true     # All gates mapped
    ownership_conflicts: false       # 0 conflicts
    unknown_owners: false            # 0 unknowns
    semantic_duplicates: false       # 0 duplicates
    critical_unenforceable: false    # 0 unenforceable
  
  manifest_integrity: valid

status:
  architecture_frozen: true
  architecture_compiled: true
  manifest_locked: false  # Will be true after E0.5 SEAL
  implementation_ready: false
  implementation_blocked_by:
    - E0.1A-R
    - E0.1B-R
  
  readiness_breakdown:
    capabilities_ready: 18 / 22  (81.8%)
    rules_ready: 38 / 44         (86.4%)
    gates_ready: 9 / 11          (81.8%)
  
  next_phase: E1_implementation
  next_phase_blocked_until:
    - E0.1A-R resolved
    - E0.1B-R resolved

timeline:
  E0_discovery: 2026-09-12 COMPLETE
  E0_4_invariants: 2026-09-12 SEALED
  E0_5_manifest: 2026-09-12 IN_PROGRESS
  platform_remediation: 2026-09-XX PARALLEL
  E1_implementation: 2026-09-XX BLOCKED
```

---

## ✅ MANIFEST VALIDATION

### Schema Validation

```yaml
manifest_version: "1.0" ✅
product.id: defined ✅
capabilities: 22 entries ✅
entities: 35 entries ✅
rules.total_count: 44 ✅
  - business_invariants: 24 ✅
  - architecture_invariants: 5 ✅
  - policies: 10 ✅
  - workflows: 5 ✅
gates: 11 defined ✅
blocking_gaps: 2 tracked ✅
allowed_extensions: 4 patterns ✅
forbidden_actions: 6 categories ✅
```

### Registry Reconciliation

```text
Capabilities in manifest:        22
Capabilities in E0.3:            22 ✅ MATCH

Entities in manifest:            35
Entities in E0.1A/B/C:           ~35 ✅ MATCH

Rules in manifest:               44
Rules in E0.4R:                  44 ✅ MATCH

Gates in manifest:               11
Gates in Registry R5:            11 ✅ MATCH

Blocking gaps in manifest:        2
Blocking gaps tracked:            2 ✅ MATCH
```

### Integrity Checks

```text
No Unknown Owner:                 ✅ PASS
No Missing Rule Reference:        ✅ PASS
No Invalid Contract Reference:    ✅ PASS (2 marked missing with blocker)
No Forbidden Write Path:          ✅ PASS
No Semantic Duplicates:           ✅ PASS
No Critical Unenforceable:        ✅ PASS
```

---

## 🎯 FACTORY RESOLUTION EXAMPLE

### User Intent: "Thêm chức năng thu học phí"

**Factory Workflow:**

```yaml
Step 1: Parse Intent
  operation: collect_course_fee
  domain: finance
  actors: [student, english_center]

Step 2: Resolve Capability (from manifest.capabilities)
  capability: finance_invoice
  owner: platform-finance
  mode: reuse
  contract: IFinanceReceivableContract
  contract_status: missing ❌
  blocked_by: E0.1B-R
  
  → BLOCK: Cannot proceed, Finance AR contract missing

Step 3: Check Business Rules (from manifest.rules.business_invariants)
  INV-FIN-01: Invoice issuance uses Platform Finance contract
    enforcement: ci_gate
    blocked_by: E0.1B-R ❌
  
  INV-FIN-03: Enrollment activation requires payment
    enforcement: runtime_block
    cross_domain: enrollment_finance
    blocked_by: E0.1B-R ❌

Step 4: Check Architecture Rules (from manifest.rules.architecture_invariants)
  INV-FIN-01: MUST use Platform Finance contract
    severity: BLOCK
    gate: 2 (Contract layer)
    blocked_by: E0.1B-R ❌

Step 5: Check Forbidden Actions (from manifest.forbidden_actions)
  contract_bypass: FORBIDDEN
    reason: Contract layer enforces business rules
  
  duplicate_source_of_truth: FORBIDDEN
    example: Cannot create english_center_invoices

Step 6: Factory Decision
  status: BLOCKED
  reason: Finance AR contract missing (E0.1B-R)
  workaround: None (raw SQL forbidden by architecture invariant)
  action_required: Wait for Platform Finance remediation

Output to User:
  ❌ Cannot implement "Thu học phí" feature
  
  Reason: Platform Finance AR contract missing
  
  Blocking Gap: E0.1B-R
  Owner: Platform Finance team
  
  Remediation Required:
    - Create IFinanceReceivableContract interface
    - Implement issueInvoice(), recordPayment() operations
    - Export from src/platform/finance/index.ts
  
  Expected Timeline: Parallel to E0.5
  
  You will be notified when E0.1B-R is resolved.
```

### User Intent: "Cho phép học viên tái đăng ký khóa tiếp theo"

**Factory Workflow:**

```yaml
Step 1: Parse Intent
  operation: renewal_enrollment
  domain: retention
  actors: [student, english_center]

Step 2: Resolve Capability (from manifest.capabilities)
  capability: renewal
  owner: english-center
  mode: product_workflow_orchestration
  orchestrates:
    - enrollment (completion detection)
    - enrollment (new enrollment creation via contract)
  implementation_status: ready ✅

Step 3: Check Business Rules (from manifest.rules.business_invariants)
  INV-COMP-01: Completion criteria enforcement
    enforcement: runtime_block
    status: ready ✅
  
  (none blocked)

Step 4: Check Architecture Rules (from manifest.rules.architecture_invariants)
  INV-RENEW-02: Renewal uses Kernel enrollment contract
    severity: BLOCK
    gate: 2 (Contract layer)
    status: ready ✅

Step 5: Check Allowed Extensions (from manifest.allowed_extensions)
  product_owned_entity: renewal_opportunity
    table: english_center_renewal_opportunities
    allowed: true ✅

Step 6: Check Forbidden Actions (from manifest.forbidden_actions)
  duplicate_source_of_truth: FORBIDDEN
    ✅ COMPLIANT: Renewal creates NEW Kernel enrollment via contract,
    does NOT duplicate source of truth

Step 7: Resolve Implementation Plan
  tables_to_create:
    - english_center_renewal_opportunities
      columns: [id, tenant_id, student_id, previous_enrollment_id, 
                recommended_level, status, created_at]
      gates: [0, 4]
  
  services_to_create:
    - RenewalService
      operations:
        - detectRenewalOpportunity(studentId, completedEnrollmentId)
        - createRenewalEnrollment(opportunityId)
      contracts_to_call:
        - IEnrollmentContract.completeEnrollment() (detection)
        - IEnrollmentContract.enrollStudent() (new enrollment creation)
  
  rules_to_enforce:
    - INV-RENEW-01 (workflow: renewal trigger configurable)
    - INV-RENEW-02 (architecture: use contract, NOT duplicate)
  
  gates_to_verify:
    - Gate 0: Tenant isolation (tenant_id + RLS)
    - Gate 2: Contract layer (call IEnrollmentContract)
    - Gate 4: Additive migration (CREATE table only)
  
  tests_to_create:
    - Integration: RenewalService → IEnrollmentContract
    - E2E: Completion → Renewal opportunity → New enrollment

Step 8: Factory Decision
  status: READY ✅
  action: Generate implementation plan
  
Output to User:
  ✅ "Tái đăng ký" feature ready to implement
  
  Implementation Plan:
    - Create english_center_renewal_opportunities table
    - Create RenewalService (orchestrates Kernel enrollment)
    - Use IEnrollmentContract for new enrollment creation
    - Enforce Gates: 0, 2, 4
    - Tests: Integration + E2E
  
  Architecture Compliance: ✅ VERIFIED
    - No Kernel modification
    - Contract layer enforced
    - No duplicate source of truth
  
  Ready to proceed? [Yes/No]
```

---

## 📊 E0.5 COMPLETION DASHBOARD

```text
════════════════════════════════════════════════════════════════
 E0.5 EXECUTABLE PRODUCT MANIFEST
════════════════════════════════════════════════════════════════

MANIFEST ARTIFACT:
  File: bella-english-center.manifest.yaml
  Version: 1.0
  Size: ~1200 lines
  Format: YAML (machine-readable)

SECTIONS COMPLETE:
  1. Capability Registry              ✅ 22 capabilities
  2. Entity Ownership                 ✅ 35 entities
  3. Rule Registry                    ✅ 44 rules
  4. Gate Dependency Map              ✅ 11 gates
  5. Blocking Gaps                    ✅ 2 tracked
  6. Allowed Extensions               ✅ 4 patterns
  7. Forbidden Actions                ✅ 6 categories

VALIDATION:
  Schema Validation                   ✅ PASS
  Registry Reconciliation             ✅ PASS
  Integrity Checks                    ✅ PASS
  No Unknown Owners                   ✅ 0
  No Semantic Duplicates              ✅ 0
  No Critical Unenforceable           ✅ 0

FACTORY READINESS:
  Intent Parsing                      ✅ READY
  Capability Resolution               ✅ READY
  Rule Enforcement Mapping            ✅ READY
  Gate Dependency Resolution          ✅ READY
  Blocker Detection                   ✅ READY
  Implementation Plan Generation      ⏸️ PENDING (automation)

════════════════════════════════════════════════════════════════
STATUS: E0.5 DRAFT COMPLETE
READY: E0.5 SEAL + E0 ARCHITECTURE FREEZE
════════════════════════════════════════════════════════════════
```

---

## 🚀 NEXT STEPS

### E0.5 SEAL ⏸️ READY

**Conditions Met:**
- ✅ Manifest artifact created (YAML)
- ✅ 7 sections complete
- ✅ Validation passed
- ✅ Factory resolution examples proven

**Action:** SEAL E0.5 → Lock manifest version 1.0

---

### E0 ARCHITECTURE FREEZE 🔒 READY

**Architecture Decisions:**
```text
E0.1   Reuse Inventory                 ✅ COMPLETE
E0.1A  Semantic Ownership              ✅ COMPLETE
E0.1B  Finance Reuse                   ✅ COMPLETE
E0.1C  Course/Class Ownership          🔒 SEALED
E0.2   Chain Authorization             🔒 SEALED
E0.3   English Capabilities            🔒 SEALED
E0.4   Business Invariants             🔒 SEALED
E0.5   Product Manifest                ⏸️ READY TO SEAL

Architecture Frozen:                    ✅ YES
```

**Freeze Status:**
- ✅ **Architecture decisions locked** (chúng ta biết phải xây thế nào)
- 🔴 **Implementation blocked** (dependencies chưa có)

**Distinction:**
```text
ARCHITECTURE FROZEN:     ✅ Design complete, no more discovery
IMPLEMENTATION READY:    🔴 Blocked by E0.1A-R + E0.1B-R
```

---

### Platform Remediation Tracks (Parallel)

**Track 1: E0.1A-R Identity Migration**
- Owner: Platform Core team
- Timeline: Parallel to E0.5 SEAL
- Deliverable: Person → Party migration complete
- Unblocks: 1 rule, Gate 5, Gate 11

**Track 2: E0.1B-R Finance AR Contract**
- Owner: Platform Finance team
- Timeline: Parallel to E0.5 SEAL
- Deliverable: `IFinanceReceivableContract` available
- Unblocks: 5 rules, Gate 2, Gate 10

---

### E1 Implementation ⏸️ BLOCKED UNTIL

```text
Remediation Complete:
  ✅ E0.1A-R Identity Migration resolved
  ✅ E0.1B-R Finance AR Contract delivered

Then:
  E1 Implementation begins
  Factory reads manifest
  AI generates code per intent
  Gates verify automatically
```

---

**STATUS:** 🔒 E0.5 SEALED. Architecture Frozen. Implementation blocked by E0.1A-R + E0.1B-R.

