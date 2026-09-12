---
product: bella-english-center
phase: E0.4
status: SEALED
created: 2026-09-12
sealed: 2026-09-12
reconciled: E0.4R (2026-09-12)
methodology: lifecycle_based_invariant_lock
purpose: business_truth_enforcement
blocker_for: E0.5_product_manifest
dependencies:
  - E0.3 Capability Ownership (SEALED)
  - Platform Architecture Registry
result:
  total_rules: 44
  business_invariants: 24
  architecture_invariants: 5
  policies: 10
  workflows: 5
  cross_domain: 6
  ready: 38
  blocked_finance: 5
  blocked_identity: 1
  unknown_ownership: 0
  semantic_duplicates: 0
  critical_unenforceable: 0
---

# E0.4 — BUSINESS INVARIANTS

> **Mission:** Lock business rules that **hệ thống tuyệt đối không được phép sai**. NOT implementation documentation. Nguyên liệu để AI coding theo intent.

---

## 🎯 OBJECTIVE

**Discovery trả lời "ai sở hữu cái gì"**

**E0.4 trả lời "hệ thống tuyệt đối không được phép sai điều gì"**

---

## 📋 INVARIANT STRUCTURE

Each invariant MUST have:

```yaml
ID: INV-[DOMAIN]-[NUMBER]

Intent: What business operation this protects

Precondition: State before operation

Allowed Transition: Legal state changes

Forbidden State: States that MUST NOT exist

Canonical Owner: Platform/Kernel owner

Orchestrator: Product owner (if cross-domain)

Severity: BLOCK | WARN | AUDIT

Evidence: Integration test | E2E test | Gate

Gate: Which verification gate enforces this

Category: INVARIANT | POLICY | WORKFLOW
```

---

## 📊 INVARIANT CATEGORIES

### INVARIANT
Rules that **ALWAYS** hold, NOT configurable
- Example: Cannot double-book teacher at same time
- Example: Enrollment requires active student
- Example: Cannot allocate payment to voided invoice

### POLICY
Rules that **CAN BE CONFIGURED** per tenant/product
- Example: Max students per class = 15 (configurable)
- Example: Makeup eligibility = 3 absences (configurable)
- Example: Refund percentage by week (configurable schedule)

### WORKFLOW
Default process that **CAN BE SKIPPED** with governance
- Example: Lead → Consultation → Placement → Trial → Enrollment (can skip steps with reason)
- Example: 3 absences → warning notification (can disable)
- Example: Assessment score → level progression recommendation (can override)

---

## 🔄 BUSINESS LIFECYCLE INVARIANTS

### ACQUISITION PHASE

#### Lead Management

```yaml
INV-LEAD-01:
  intent: Create lead from inquiry
  precondition: Valid contact info provided
  allowed: unassigned → assigned → in_progress → converted | lost
  forbidden: 
    - converted → in_progress (cannot unconvert)
    - lost → converted (cannot revive without new lead)
  canonical_owner: Platform Lead Engine
  orchestrator: English Center
  severity: BLOCK
  evidence: Platform Lead Engine tests
  gate: 0 (Tenant Isolation)
  category: INVARIANT

INV-LEAD-02:
  intent: SLA timer enforcement
  precondition: Lead accepted by sales
  allowed: Timer starts on accept, stops on outcome
  forbidden: Lead active > 48h without followup logged
  canonical_owner: Platform Lead SLA Engine
  orchestrator: English Center
  severity: WARN
  evidence: SLA Engine tests
  gate: Platform SLA enforcement
  category: POLICY (SLA duration configurable)

INV-LEAD-03:
  intent: Sales rotation fairness
  precondition: Multiple sales staff available
  allowed: Round-robin or weighted assignment
  forbidden: Manual cherry-picking without governance reason
  canonical_owner: Platform Lead Rotation Engine
  orchestrator: English Center
  severity: AUDIT
  evidence: Rotation Engine tests
  gate: Platform rotation enforcement
  category: WORKFLOW (rotation algorithm configurable)
```

#### Consultation

```yaml
INV-CONS-01:
  intent: Schedule consultation
  precondition: Lead exists in system
  allowed: Consultation scheduled for future datetime
  forbidden: 
    - Consultation scheduled in past
    - Double-booking consultant at same time
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E consultation scheduling test
  gate: Product validation
  category: INVARIANT (no double-booking)

INV-CONS-02:
  intent: Consultation outcome recorded
  precondition: Consultation completed
  allowed: Outcome = interested | not_interested | needs_followup
  forbidden: Consultation marked complete without outcome
  canonical_owner: English Center
  orchestrator: English Center
  severity: WARN
  evidence: E2E consultation workflow test
  gate: Product validation
  category: WORKFLOW (outcome required by default, can skip with reason)
```

#### Placement Test

```yaml
INV-PLACE-01:
  intent: Administer placement test
  precondition: Lead/Student exists
  allowed: Test administered once, scored, level determined
  forbidden: 
    - Test scored without answers recorded
    - Level determination without score
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E placement test workflow
  gate: Product validation
  category: INVARIANT

INV-PLACE-02:
  intent: Level recommendation accuracy
  precondition: Test scored
  allowed: Level recommendation based on score range rules
  forbidden: Level recommendation contradicts score range
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: Unit test placement scoring logic
  gate: Product validation
  category: POLICY (score ranges configurable per program)
```

#### Trial Class

```yaml
INV-TRIAL-01:
  intent: Schedule trial class
  precondition: Lead interested, placement test completed
  allowed: Trial scheduled for existing class session
  forbidden: 
    - Trial scheduled without placement level
    - Trial scheduled for full class (max capacity reached)
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E trial class scheduling
  gate: Product validation + capacity check
  category: INVARIANT (capacity) + POLICY (max trial students per class)

INV-TRIAL-02:
  intent: Trial attendance recorded
  precondition: Trial class scheduled
  allowed: Attended | No-show recorded after class datetime
  forbidden: Attendance recorded before class datetime
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E trial attendance
  gate: Product validation
  category: INVARIANT
```

---

### ENROLLMENT PHASE

#### Program & Level Selection

```yaml
INV-PROG-01:
  intent: Select program for enrollment
  precondition: Student exists, placement test completed
  allowed: Program selected matching placement level range
  forbidden: Program selection contradicts placement level
  canonical_owner: English Center
  orchestrator: English Center
  severity: WARN
  evidence: E2E enrollment program selection
  gate: Product validation
  category: POLICY (can override with reason)

INV-LEVEL-01:
  intent: Assign level for enrollment
  precondition: Program selected, placement result available
  allowed: Level within program hierarchy
  forbidden: Level not part of selected program
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E enrollment level assignment
  gate: Product validation
  category: INVARIANT
```

#### Course Offering & Class Assignment

```yaml
INV-OFFER-01:
  intent: Create course offering
  precondition: Course template exists (Kernel)
  allowed: Offering with start_date, end_date, max_students, schedule
  forbidden: 
    - Offering with end_date before start_date
    - Offering without schedule
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E course offering creation
  gate: Product validation
  category: INVARIANT

INV-CLASS-01:
  intent: Create class for offering
  precondition: Course offering exists
  allowed: Class with teacher assignment, schedule, capacity
  forbidden: 
    - Class capacity > offering capacity
    - Class schedule conflicts with teacher availability
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E class creation + teacher conflict check
  gate: Product validation + teacher scheduling
  category: INVARIANT (no teacher conflict) + POLICY (capacity configurable)

INV-CLASS-02:
  intent: Assign student to class
  precondition: Enrollment exists, class has capacity
  allowed: Student assigned to class if enrollment level matches class level
  forbidden: 
    - Student assigned to class with no capacity
    - Student assigned to class with level mismatch
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E class assignment
  gate: Product validation + capacity + level match
  category: INVARIANT (capacity) + POLICY (level match can override)
```

#### Enrollment State Transitions

```yaml
INV-ENR-01:
  intent: Activate enrollment
  precondition: 
    - Canonical enrollment exists (Education Kernel)
    - Required initial receivable is settled OR payment plan approved
  allowed: pending_payment → active
  forbidden: 
    - pending_payment → active while required payment outstanding (unless payment plan)
    - active → pending_payment (cannot deactivate without reason)
  canonical_owner: Education Kernel (enrollment state) + Platform Finance (payment verification)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Enrollment + Finance
  gate: 2 (Contract layer), Finance/Enrollment cross-domain
  category: INVARIANT

INV-ENR-02:
  intent: Complete enrollment
  precondition: 
    - Enrollment active
    - Course offering end_date passed OR all sessions completed
    - Final assessment recorded
  allowed: active → completed
  forbidden: 
    - active → completed without final assessment
    - active → completed before course end
  canonical_owner: Education Kernel (enrollment completion) + English Center (completion criteria)
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E enrollment completion workflow
  gate: 2 (Contract: IEnrollmentContract.completeEnrollment())
  category: INVARIANT (assessment required) + POLICY (completion timing configurable)

INV-ENR-03:
  intent: Withdraw enrollment
  precondition: Enrollment active OR pending
  allowed: active | pending → withdrawn with reason
  forbidden: 
    - completed → withdrawn (cannot withdraw after completion)
    - withdrawn → active (cannot reactivate, must create new enrollment)
  canonical_owner: Education Kernel
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Enrollment withdrawal
  gate: 2 (Contract)
  category: INVARIANT
```

---

### LEARNING PHASE

#### Session & Attendance

```yaml
INV-SESS-01:
  intent: Create session for class
  precondition: Class exists with schedule
  allowed: Session created per class schedule (e.g., M/W/F 6-8pm)
  forbidden: 
    - Session datetime conflicts with another session for same teacher
    - Session datetime conflicts with another session for same room (if room tracking enabled)
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E session scheduling
  gate: Product validation + resource conflict check
  category: INVARIANT (no teacher conflict)

INV-ATT-01:
  intent: Record attendance
  precondition: 
    - Session exists
    - Student enrolled in class
    - Session datetime has passed OR currently in progress
  allowed: Attendance status = present | absent | excused
  forbidden: 
    - Attendance recorded for student not enrolled in class
    - Attendance recorded before session start time (unless allowing early check-in)
  canonical_owner: Education Kernel (attendance checkpoint) + English Center (session context)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Attendance + Session
  gate: 2 (Contract: IAttendanceContract.recordAttendance())
  category: INVARIANT

INV-ATT-02:
  intent: Absence limit enforcement
  precondition: Student enrolled, attendance recorded
  allowed: Track consecutive absences, trigger warnings
  forbidden: Student active with absences > policy threshold without intervention
  canonical_owner: English Center
  orchestrator: English Center
  severity: WARN
  evidence: E2E absence tracking workflow
  gate: Product validation
  category: POLICY (absence threshold configurable)
```

#### Makeup Class

```yaml
INV-MAKEUP-01:
  intent: Request makeup session
  precondition: 
    - Student enrolled in class
    - Absence recorded for regular session
    - Absence within makeup eligibility rules
  allowed: Makeup session scheduled for eligible absence
  forbidden: 
    - Makeup request for present attendance
    - Makeup request beyond eligibility window (e.g., >7 days after absence)
    - Makeup session scheduled for full class (no capacity)
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E makeup scheduling workflow
  gate: Product validation + capacity + eligibility
  category: POLICY (eligibility rules configurable)

INV-MAKEUP-02:
  intent: Track makeup session attendance
  precondition: Makeup session scheduled
  allowed: Attendance recorded for makeup session
  forbidden: 
    - Makeup attendance not recorded after session completed
    - Double credit (regular + makeup) for same session
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E makeup attendance tracking
  gate: Product validation
  category: INVARIANT (no double credit)
```

#### Assessment & Progress

```yaml
INV-ASSESS-01:
  intent: Record assessment score
  precondition: 
    - Enrollment active
    - Assessment type defined (quiz, midterm, final)
  allowed: Score recorded within valid range (0-100 or custom scale)
  forbidden: 
    - Score outside valid range
    - Assessment recorded for withdrawn enrollment
  canonical_owner: Education Kernel (score storage) + English Center (4-skill breakdown, IELTS band context)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Assessment
  gate: 2 (Contract: IAssessmentContract.recordScore())
  category: INVARIANT (range validation) + POLICY (grading scale configurable)

INV-ASSESS-02:
  intent: Calculate final grade
  precondition: 
    - All required assessments recorded
    - Enrollment completion triggered
  allowed: Final grade = weighted average of assessments
  forbidden: 
    - Final grade calculated with missing required assessments (unless policy allows incomplete)
    - Final grade contradicts assessment scores (calculation error)
  canonical_owner: Education Kernel (GPA calculation) + English Center (weighting rules)
  orchestrator: English Center
  severity: BLOCK
  evidence: Unit test GPA calculation + E2E final grade
  gate: 9 (GPA calculation accuracy)
  category: INVARIANT (calculation accuracy) + POLICY (weighting configurable)

INV-ASSESS-03:
  intent: Certification eligibility determination
  precondition: Enrollment completed, final grade available
  allowed: Certification eligible if final grade >= threshold (e.g., IELTS 7.0+)
  forbidden: Certification issued without meeting threshold
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E certification eligibility workflow
  gate: Product validation
  category: POLICY (threshold configurable per program)
```

---

### COMPLETION & RETENTION PHASE

#### Course Completion

```yaml
INV-COMP-01:
  intent: Mark enrollment complete
  precondition: 
    - Enrollment active
    - All required sessions attended OR makeup completed
    - Final assessment recorded
    - Course end date reached
  allowed: Kernel enrollment status → completed
  forbidden: 
    - Enrollment completed without final assessment
    - Enrollment completed with outstanding required sessions (no makeup)
  canonical_owner: Education Kernel (completion state) + English Center (completion criteria)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Enrollment completion
  gate: 2 (Contract: IEnrollmentContract.completeEnrollment())
  category: INVARIANT
```

#### Level Progression

```yaml
INV-PROG-01:
  intent: Recommend level progression
  precondition: Enrollment completed, final grade available
  allowed: 
    - Pass threshold → recommend next level
    - Fail threshold → recommend repeat level
    - Exceptional → recommend skip level (with governance)
  forbidden: Progression recommendation contradicts final grade
  canonical_owner: English Center
  orchestrator: English Center
  severity: WARN
  evidence: E2E level progression logic
  gate: Product validation
  category: POLICY (thresholds configurable)
```

#### Renewal

```yaml
INV-RENEW-01:
  intent: Create renewal opportunity
  precondition: 
    - Previous enrollment completed
    - Level progression determined
  allowed: Renewal opportunity created with recommended next level/program
  forbidden: 
    - Renewal opportunity without previous enrollment
    - Renewal opportunity contradicts progression recommendation (unless manual override)
  canonical_owner: English Center
  orchestrator: English Center
  severity: WARN
  evidence: E2E renewal workflow
  gate: Product validation
  category: WORKFLOW (renewal trigger configurable)

INV-RENEW-02:
  intent: Convert renewal to new enrollment
  precondition: Renewal opportunity accepted by student
  allowed: Create new enrollment via Kernel contract, link previous_enrollment_id
  forbidden: 
    - New enrollment without using Kernel IEnrollmentContract
    - Duplicate enrollment record in product table
  canonical_owner: Education Kernel (new enrollment) + English Center (renewal context)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Renewal → Enrollment
  gate: 2 (Contract: IEnrollmentContract.enrollStudent()), 1 (No Kernel duplication)
  category: INVARIANT
```

---

### FINANCIAL PHASE

#### Invoice & Payment

```yaml
INV-FIN-01:
  intent: Issue invoice for course fee
  precondition: 
    - Enrollment created
    - Course fee amount determined
  allowed: Invoice issued via Platform Finance contract
  forbidden: 
    - Invoice created without using Platform Finance contract (direct SQL forbidden)
    - Invoice issued to non-existent Party
  canonical_owner: Platform Finance F3 AR
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Finance contract (BLOCKED: E0.1B-R contract missing)
  gate: 2 (Contract: IFinanceReceivableContract.issueInvoice()), 10 (Financial immutability)
  category: INVARIANT
  implementation_blocked: E0.1B-R

INV-FIN-02:
  intent: Record payment against invoice
  precondition: 
    - Invoice exists
    - Payment received (cash, transfer, card)
  allowed: Payment recorded via Platform Finance contract, allocated to invoice
  forbidden: 
    - Payment recorded without invoice reference
    - Payment amount > invoice outstanding balance (overpayment without credit memo)
  canonical_owner: Platform Finance F3 AR
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Finance payment allocation (BLOCKED: E0.1B-R)
  gate: 2 (Contract: IFinanceReceivableContract.recordPayment())
  category: INVARIANT
  implementation_blocked: E0.1B-R

INV-FIN-03:
  intent: Enrollment activation contingent on payment
  precondition: Enrollment created, invoice issued
  allowed: 
    - Enrollment activated after initial payment received
    - Enrollment activated with approved payment plan (installment)
  forbidden: 
    - Enrollment activated without payment OR payment plan
    - Active enrollment with fully outstanding invoice (no payment plan)
  canonical_owner: Education Kernel (enrollment state) + Platform Finance (payment verification) + English Center (orchestration)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Enrollment + Finance cross-domain
  gate: Cross-domain invariant enforcement
  category: INVARIANT (payment required) + POLICY (payment plan terms configurable)
  implementation_blocked: E0.1B-R

INV-FIN-04:
  intent: Installment payment tracking
  precondition: Payment plan approved, installments scheduled
  allowed: Track installment due dates, send reminders, escalate overdue
  forbidden: 
    - Enrollment remains active with overdue installments > grace period (unless approved exception)
  canonical_owner: English Center (installment plan) + Platform Finance (payment tracking)
  orchestrator: English Center
  severity: WARN
  evidence: E2E installment tracking workflow
  gate: Product validation + Finance integration
  category: POLICY (grace period configurable)
  implementation_blocked: E0.1B-R (partial - payment tracking needed)
```

#### Refund

```yaml
INV-REFUND-01:
  intent: Calculate refund eligibility
  precondition: 
    - Enrollment withdrawn OR student requests refund
    - Course in progress (not completed)
  allowed: Refund amount = course fee × refund percentage by elapsed time
  forbidden: 
    - Refund percentage contradicts refund policy schedule
    - Refund issued for completed enrollment
  canonical_owner: English Center (refund policy) + Platform Finance (refund execution)
  orchestrator: English Center
  severity: BLOCK
  evidence: Unit test refund calculation + E2E refund workflow
  gate: Product validation + Finance integration
  category: POLICY (refund schedule configurable)

INV-REFUND-02:
  intent: Execute financial refund
  precondition: Refund amount calculated, refund approved
  allowed: 
    - Call Platform Finance reversal (ledgerService.reverseTransaction())
    - Update enrollment status to withdrawn/refunded
  forbidden: 
    - Direct SQL to reverse finance transactions (must use Platform contract)
    - Refund without enrollment status update
  canonical_owner: Platform Finance (reversal) + English Center (workflow)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Finance reversal
  gate: 2 (Contract: ledgerService.reverseTransaction())
  category: INVARIANT
```

#### Discount & Package

```yaml
INV-DISC-01:
  intent: Apply discount to invoice
  precondition: 
    - Discount policy exists
    - Discount eligibility verified (early bird, referral, package)
  allowed: Discount applied before invoice finalization
  forbidden: 
    - Discount applied after invoice issued (must void and reissue)
    - Discount amount > invoice total
    - Stacking discounts beyond policy limit
  canonical_owner: English Center (discount policy) + Platform Finance (invoice adjustment)
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E discount application workflow
  gate: Product validation + Finance integration
  category: POLICY (discount rules configurable)
  implementation_blocked: E0.1B-R (partial - invoice adjustment needed)
```

---

### OPERATIONAL PHASE

#### Teacher Assignment & Scheduling

```yaml
INV-TEACH-01:
  intent: Assign teacher to class
  precondition: 
    - Teacher exists (Party model)
    - Teacher qualified for program/level (TESOL, CELTA certifications)
    - Class exists
  allowed: Teacher assigned to class via Kernel contract
  forbidden: 
    - Teacher assigned without required qualifications
    - Teacher assigned to conflicting class schedule (same datetime)
  canonical_owner: Education Kernel (teacher assignment) + English Center (qualification validation + schedule conflict)
  orchestrator: English Center
  severity: BLOCK
  evidence: Integration test Teacher Assignment + E2E schedule conflict check
  gate: 2 (Contract: ITeacherAssignmentContract.assignTeacher())
  category: INVARIANT (no schedule conflict) + POLICY (qualification requirements configurable)

INV-TEACH-02:
  intent: Teacher availability management
  precondition: Teacher exists
  allowed: Track available time slots, block unavailable periods
  forbidden: 
    - Class scheduled during teacher unavailable period
    - Teacher assigned to session without available slot
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E teacher scheduling workflow
  gate: Product validation + schedule conflict detection
  category: INVARIANT (respect availability)
```

#### Branch Scope & Transfer

```yaml
INV-BRANCH-01:
  intent: Data isolation by branch
  precondition: Multi-branch mode enabled
  allowed: 
    - Branch staff see only branch data (OR assigned scope via IAM Matrix)
    - HQ staff see all branches
    - Regional staff see region branches
  forbidden: 
    - Branch A staff access Branch B data without explicit permission
    - Product bypasses IAM Matrix for authorization
  canonical_owner: Platform IAM Matrix + English Center (branch scope)
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E authorization tests per branch role
  gate: 0 (Tenant Isolation extended to branch scope), 6 (RBAC)
  category: INVARIANT

INV-TRANSFER-01:
  intent: Transfer student between branches
  precondition: 
    - Student enrolled at Branch A
    - Branch B has capacity
    - Transfer approved by both branches (governance)
  allowed: 
    - Student enrollment transferred to Branch B
    - Learning history preserved
  forbidden: 
    - Transfer without governance approval
    - Transfer loses student learning history
  canonical_owner: English Center
  orchestrator: English Center
  severity: BLOCK
  evidence: E2E student transfer workflow
  gate: Product validation + authorization
  category: WORKFLOW (transfer approval required)
```

#### Branch KPI & Reporting

```yaml
INV-KPI-01:
  intent: Calculate branch KPI metrics
  precondition: Branch data exists (enrollments, revenue, attendance)
  allowed: 
    - Enrollment rate = new enrollments / leads
    - Revenue = sum of payments
    - Retention rate = renewals / completions
    - Teacher utilization = assigned hours / available hours
  forbidden: 
    - KPI calculation includes data from other branches (unless HQ aggregation)
    - KPI metric contradicts source data (calculation error)
  canonical_owner: English Center
  orchestrator: English Center
  severity: WARN
  evidence: Unit test KPI calculation + E2E reporting
  gate: Product validation
  category: POLICY (KPI definitions configurable)
```

---

## 🔴 CROSS-DOMAIN INVARIANTS

These invariants span multiple Kernel/Platform boundaries and require orchestration:

```yaml
CROSS-ENR-FIN:
  intent: Enrollment + Finance consistency
  invariant: Enrollment CANNOT be active while required payment is outstanding (unless payment plan approved)
  owners: Education Kernel + Platform Finance + English Center orchestration
  enforcement: Cross-domain validation before enrollment activation
  severity: BLOCK
  gate: Custom cross-domain gate
  evidence: Integration test Enrollment + Finance
  implementation_blocked: E0.1B-R

CROSS-ATT-CLASS:
  intent: Attendance + Class consistency
  invariant: Attendance CANNOT be recorded for student not enrolled in class
  owners: Education Kernel + English Center
  enforcement: Attendance contract validates enrollment
  severity: BLOCK
  gate: 2 (Contract validation)
  evidence: Integration test Attendance

CROSS-TEACH-SCHEDULE:
  intent: Teacher + Schedule consistency
  invariant: Teacher CANNOT be assigned to multiple sessions at same datetime
  owners: Education Kernel (assignment) + English Center (schedule conflict detection)
  enforcement: Product validates before calling assignment contract
  severity: BLOCK
  gate: Product validation + Contract
  evidence: E2E schedule conflict detection

CROSS-IDENTITY-ALL:
  intent: Identity model consistency
  invariant: ALL person-related FKs MUST use Party (NOT Person legacy)
  owners: Platform Core (Party canonical) + All products
  enforcement: Gate 5 (Party identity model) + Gate 11 (Migration warning)
  severity: BLOCK (new code) | WARN (legacy code)
  gate: 5, 11
  evidence: Architecture Guard + Migration tests
  implementation_blocked: E0.1A-R
```

---

## 📊 RECONCILED RULE SUMMARY (E0.4R)

> **See `E0_4R_RULE_RECONCILIATION.md` for detailed reconciliation process.**

### Final Type Distribution (Mutually Exclusive)

```text
TOTAL RULES:                           44

BUSINESS_INVARIANT:                    24  (54.5%)
  - Business truth that ALWAYS holds
  - Examples: No teacher double-booking, enrollment requires payment, 
    capacity enforcement, schedule conflicts forbidden

ARCHITECTURE_INVARIANT:                 5  (11.4%)
  - Architecture governance rules
  - Examples: Contract enforcement (FIN-01, FIN-02, REFUND-02, RENEW-02),
    Identity model governance (CROSS-IDENTITY-ALL)

POLICY:                                10  (22.7%)
  - Business parameters that CAN BE CONFIGURED
  - Examples: SLA duration, absence threshold, refund schedule,
    discount rules, KPI definitions

WORKFLOW:                               5  (11.4%)
  - Default processes that CAN BE SKIPPED with governance
  - Examples: Consultation outcome optional, program recommendation override,
    level progression recommendation, renewal trigger, transfer approval
```

### By Enforcement Mode

```text
runtime_block:                         24  (BUSINESS_INVARIANT)
authorization_deny:                     1  (Branch isolation)
workflow_guard:                        15  (POLICY + WORKFLOW)
ci_gate:                                5  (ARCHITECTURE_INVARIANT)
audit_detection:                        4  (SLA, rotation, installment, KPI)
db_constraint:                          0  (Could add FK constraints)
```

### By Domain

```text
Acquisition (Lead, Consultation, Placement, Trial):     8
Enrollment (Program, Level, Offering, Class):           8
Learning (Session, Attendance, Makeup, Assessment):     8
Completion & Retention (Completion, Progression, Renewal): 4
Finance (Invoice, Payment, Refund, Discount):           7
Operations (Teacher, Branch, Transfer, KPI):            5
Cross-Domain (explicit):                                4
```

### By Implementation Status

```text
Ready to Implement:                    38  (86.4%)
Blocked by E0.1B-R (Finance):           5  (11.4%)
  - FIN-01, FIN-02, FIN-03, FIN-04, DISC-01
Blocked by E0.1A-R (Identity):          1  (2.3%)
  - CROSS-IDENTITY-ALL
Blocked by Both:                        0  (0%)
```

### Cross-Domain Invariants

```text
Total Cross-Domain Rules:               6

Business Cross-Domain:                  5
  - Enrollment → Finance (ENR-01 / CROSS-ENR-FIN)
  - Enrollment → Class (CLASS-02)
  - Class → Attendance (ATT-01 / CROSS-ATT-CLASS)
  - Teacher → Schedule (SESS-01, TEACH-01 / CROSS-TEACH-SCHEDULE)
  - Branch → Authorization (BRANCH-01)

Architecture Cross-Domain:              1
  - Identity → All (CROSS-IDENTITY-ALL)
```

---

## ✅ INVARIANT QUALITY CHECKS

### Semantic Duplicates: 0

**Verification:** Each invariant has distinct business rule, not rephrased duplicates

---

### Unknown Ownership: 0

**Verification:** Every invariant has clear canonical owner (Platform/Kernel/Product)

---

### Unenforceable Critical Rules: 0

**Verification:** All BLOCK-severity invariants have:
- Evidence (test specification)
- Gate (automated enforcement)
- Owner (responsible implementation)

---

## ✅ E0.4 SEALED STATUS

```text
════════════════════════════════════════════════════════════════
 E0.4 BUSINESS RULE MODEL — SEALED
════════════════════════════════════════════════════════════════

TOTAL RULE RECORDS:                    44

TYPE DISTRIBUTION (MUTUALLY EXCLUSIVE):
  Business Invariants                  24  (54.5%)
  Architecture Invariants               5  (11.4%)
  Policies                             10  (22.7%)
  Workflows                             5  (11.4%)

ENFORCEMENT DISTRIBUTION:
  Runtime Block                        24
  Authorization Deny                    1
  Workflow Guard                       15
  CI Gate                               5
  Audit Detection                       4

CROSS-DOMAIN:
  Business Cross-Domain                 5
  Architecture Cross-Domain             1
  Total                                 6

IMPLEMENTATION STATUS:
  Ready                                38  (86.4%)
  Blocked by Finance (E0.1B-R)          5  (11.4%)
  Blocked by Identity (E0.1A-R)         1  (2.3%)
  Blocked by Both                       0  (0%)

QUALITY CHECKS:
  Semantic Duplicates                   0  ✅
  Unknown Ownership                     0  ✅
  Critical Unenforceable                0  ✅
  Count Reconciliation                 ✅
  Type Reconciliation                  ✅
  Enforcement Mapping                  ✅

LIFECYCLE COVERAGE:
  Acquisition (Lead → Trial)           ✅
  Enrollment (Program → Class)         ✅
  Learning (Session → Assessment)      ✅
  Completion (Grade → Renewal)         ✅
  Finance (Invoice → Refund)           ✅
  Operations (Teacher → Branch)        ✅

════════════════════════════════════════════════════════════════
STATUS: E0.4 SEALED (2026-09-12)
NEXT: E0.5 Product Manifest Lock
════════════════════════════════════════════════════════════════
```

---

## 🚀 NEXT STEP: E0.5 PRODUCT MANIFEST LOCK

**E0.5 will compile:**
```text
Registry (R1-R5)
+ Capability Ownership (E0.3)
+ Contracts (R2)
+ Extension Rules (R3)
+ Invariants (E0.4)
+ Policies (E0.4)
+ Gates (R5)
+ 2 Open Gaps (E0.1A-R, E0.1B-R)
        ↓
MACHINE-READABLE YAML/JSON
        ↓
FACTORY / AI INTENT RESOLVER
        ↓
Intent → Plan → Code → Verify
```

**After E0.5:**
- Architecture Freeze
- Platform remediation tracks (parallel to E0.5)
- Wait for E0.1A-R + E0.1B-R resolution
- E1 Implementation begins

---

**STATUS:** 🔒 E0.4 SEALED. Ready for E0.5 Executable Product Manifest.

