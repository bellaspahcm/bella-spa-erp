---
registry_type: platform_architecture_governance
purpose: machine_readable_architecture_rules
created: 2026-09-12
scope: bella_platform_all_verticals
intent_coding_ready: false
status: in_progress
---

# PLATFORM ARCHITECTURE REGISTRY

> **Mission:** Machine-readable architecture governance enabling AI intent-driven coding without manual investigation per product.

---

## 🎯 PROBLEM STATEMENT

**Current State:**
Each new product requires deep manual architecture investigation:
- Entity ownership discovery (Student → Education Kernel or Product?)
- Contract existence verification (Finance contract available?)
- Identity model reconciliation (Party vs. Person?)
- Extension policy analysis (Can product create context tables?)
- Gap detection (Platform capability missing?)

**Example:** English Center E0 Discovery required 3 sub-phases (E0.1A, E0.1A-1, E0.1B) to answer basic architectural questions.

**Target State:**
AI reads registry → resolves ownership → generates bounded implementation → gates verify.

Human intervention ONLY for:
- `UNKNOWN_CAPABILITY`
- `MISSING_CONTRACT`
- `SEMANTIC_CONFLICT`
- `ARCHITECTURAL_GAP`

---

## 📚 REGISTRY ARCHITECTURE

### Registry Components

```text
PLATFORM ARCHITECTURE REGISTRY
├── R1: Entity Ownership Registry
│   └── WHO owns canonical state for each entity?
├── R2: Contract Registry
│   └── WHAT public contracts exist for each capability?
├── R3: Extension Policy Registry
│   └── CAN products extend/duplicate this entity?
├── R4: Migration Policy Registry
│   └── WHEN can tables be modified?
└── R5: Gate Mapping Registry
    └── WHICH automated gates required per capability type?

INTENT RESOLVER
├── Parse user intent
├── Resolve ownership from R1
├── Resolve contracts from R2
├── Resolve extension rules from R3
├── Generate bounded implementation
└── Map required gates from R5

CODE GENERATION GUARD
├── Verify no duplicate source of truth
├── Verify contract usage (no raw SQL bypass)
├── Verify correct identity model
├── Verify additive migrations only
└── Verify all gates pass
```

---

## R1: ENTITY OWNERSHIP REGISTRY

**Purpose:** Canonical owner for each entity's source of truth.

**Schema:**
```typescript
interface EntityOwnership {
  entity: string;
  owner: 'platform_core' | 'kernel' | 'product';
  kernel?: 'education' | 'healthcare' | 'logistics' | 'real_estate';
  source_of_truth_table: string;
  identity_model: 'party' | 'person' | 'product_specific';
  extension_allowed: boolean;
  extension_pattern: 'context_table' | 'none';
  discovered_by: string; // Which product/phase discovered this
  locked_at: string;
}
```

**Registry Data:**

### Platform Core Entities

| Entity | Owner | Source of Truth | Identity Model | Extension Allowed | Discovered By |
|--------|-------|----------------|----------------|-------------------|---------------|
| **Party** | Platform Core | `party_parties` | Party (canonical) | No | Healthcare OS |
| **Person** | Platform Core | `persons` | Person (legacy) | No | Education OS (legacy) |
| **Tenant** | Platform Core | `tenants` | N/A | No | Platform Core |
| **User** | Platform Core | `users` | Party | No | Platform Core |
| **Organization** | Platform Core | `organizations` | Party | Product context | Real Estate |
| **Invoice** | Platform Core Finance | `finance_invoices` | Party | Product context | Finance F3 AR |
| **Payment** | Platform Core Finance | `finance_cash_movements` | Party | Product context | Finance F2 Cash |
| **Ledger Entry** | Platform Core Finance | `finance_transactions` | N/A | No | Finance F1 Ledger |

### Education Kernel Entities

| Entity | Owner | Source of Truth | Identity Model | Extension Allowed | Discovered By |
|--------|-------|----------------|----------------|-------------------|---------------|
| **Student** | Education Kernel | `students` (⚠️ uses Person FK) | Person → Party migration required | Product context | Education OS |
| **Course** | Education Kernel | `courses` | N/A | Product context | Education OS |
| **Enrollment** | Education Kernel | `edu_enrollments` | Party | Product context | Preschool P1 |
| **Attendance** | Education Kernel | `edu_attendance` | Party | Product context | Preschool P2 |
| **Assessment** | Education Kernel | `edu_assessments` | Party | Product context | Preschool P3 |
| **Teacher Assignment** | Education Kernel | `teacher_assignments` | Party | Product context | Preschool P3 |

### Healthcare Kernel Entities

| Entity | Owner | Source of Truth | Identity Model | Extension Allowed | Discovered By |
|--------|-------|----------------|----------------|-------------------|---------------|
| **Patient** | Healthcare Kernel | `hc_patients` | Party | Product context | Healthcare OS |
| **Doctor** | Healthcare Kernel | `hc_doctors` | Party | Product context | Healthcare OS |
| **Encounter** | Healthcare Kernel | `hc_encounters` | Party | Product context | Healthcare OS |
| **Prescription** | Healthcare Kernel | `hc_prescriptions` | Party | Product context | Healthcare OS |

### Logistics Kernel Entities

| Entity | Owner | Source of Truth | Identity Model | Extension Allowed | Discovered By |
|--------|-------|----------------|----------------|-------------------|---------------|
| **Inventory Item** | Logistics Kernel | `inventory_items` | N/A | Product context | Logistics OS |
| **Movement** | Logistics Kernel | `inventory_movements` | N/A | No (append-only) | Logistics OS |
| **Shipment** | Logistics Kernel | `shipments` | Party | Product context | Logistics OS |
| **Route** | Logistics Kernel | `routes` | N/A | Product context | Logistics OS |

### Platform Core Entities (Additional — E0.3)

| Entity | Owner | Source of Truth | Identity Model | Extension Allowed | Discovered By |
|--------|-------|----------------|----------------|-------------------|---------------|
| **Lead** | Platform Core | Lead Engine (`ManagedLead` interface) | Party | Product context | English Center E0.3 |

### Product-Specific Entities (Examples)

| Entity | Owner | Source of Truth | Identity Model | Extension Allowed | Product |
|--------|-------|----------------|----------------|-------------------|---------|
| **Placement Test** | English Center | `english_center_placement_tests` | Party | N/A | English Center E0.3 |
| **Trial Class** | English Center | `english_center_trial_classes` | Party | N/A | English Center E0.3 |
| **Package Discount** | English Center | `english_center_discount_policies` | N/A | N/A | English Center |
| **Renewal Opportunity** | English Center | `english_center_renewal_opportunities` | Party | N/A | English Center E0.3 |
| **Makeup Session** | English Center | `english_center_makeup_sessions` | Party | N/A | English Center E0.3 |
| **Property Unit** | Real Estate | `property_units` | N/A | N/A | Real Estate |
| **Reservation** | Real Estate | `reservations` | Party | N/A | Real Estate |
| **Meal Log** | Preschool | `meal_logs` | Party | N/A | Preschool |

---

## R2: CONTRACT REGISTRY

**Purpose:** Public contracts available for each capability.

**Schema:**
```typescript
interface ContractRegistration {
  capability: string;
  contract_interface: string;
  location: string;
  owner: 'platform_core' | 'kernel';
  kernel?: string;
  status: 'available' | 'pending' | 'missing';
  operations: string[];
  events_published: string[];
  requires_party_identity: boolean;
  discovered_by: string;
  blocked_products?: string[];
}
```

**Registry Data:**

### Platform Core Contracts

| Capability | Contract Interface | Location | Status | Operations | Blocked Products |
|-----------|-------------------|----------|--------|-----------|-----------------|
| **Finance AR** | `IFinanceReceivableContract` | `src/platform/finance/contracts/` | ⚠️ **MISSING** | `issueInvoice`, `recordPayment`, `allocatePayment`, `voidInvoice` | English Center E1 |
| **Finance Cash** | `ICashEngineContract` | `src/platform/finance/contracts/cash-engine.contract.ts` | ✅ Available | `recordMovement`, `getCashPosition` | None |
| **Finance Ledger** | `ILedgerContract` | `src/platform/finance/contracts/ledger-engine.contract.ts` | ✅ Available | `postJournalEntry`, `getTransactions`, `reverseTransaction` | None |
| **Finance Reversal** | `ledgerService.reverseTransaction()` | `src/platform/finance/ledger-engine/` | ✅ Available | `reverseTransaction`, `reverseAllocation` | None (E0.3) |
| **Lead Management** | Platform Lead Workflow/SLA/Rotation Engines | `src/platform/lead-engine/` | ✅ Available | `acceptLead`, `logFollowup`, `convertLead` | None (E0.3) |
| **Party Management** | `IPartyEngine` | `src/platform/party/` | ✅ Available | `createParty`, `getParty` | None |
| **Notification** | `INotificationHub` | `src/platform/notification-hub/` | ✅ Available | `sendNotification` | None |

### Education Kernel Contracts

| Capability | Contract Interface | Location | Status | Operations | Blocked Products |
|-----------|-------------------|----------|--------|-----------|-----------------|
| **Student** | `IEducationStudentContract` | `src/platform/education/contracts/student.contract.ts` | ✅ Available | `registerStudent`, `getStudent` | None |
| **Course** | `IEducationCourseContract` | `src/platform/education/contracts/course.contract.ts` | ✅ Available | `createCourse`, `getCourse` | None |
| **Enrollment** | `IEducationEnrollmentContract` | `src/platform/education/contracts/enrollment.contract.ts` | ✅ Available | `enrollStudent`, `getEnrollment`, `completeEnrollment` | None (E0.3) |
| **Attendance** | `IEducationAttendanceContract` | `src/platform/education/contracts/attendance.contract.ts` | ✅ Available | `recordAttendance`, `getAttendanceHistory` | None |
| **Assessment** | `IEducationAssessmentContract` | `src/platform/education/contracts/assessment.contract.ts` | ✅ Available | `recordScore`, `getScores`, `calculateGpa` | None |
| **Teacher Assignment** | `IEducationTeacherAssignmentContract` | `src/platform/education/contracts/teacher-assignment.contract.ts` | ✅ Available | `assignTeacher`, `terminateAssignment` | None |

### Healthcare Kernel Contracts

| Capability | Contract Interface | Location | Status | Operations | Blocked Products |
|-----------|-------------------|----------|--------|-----------|-----------------|
| **Patient** | `IPatientEngine` | `src/platform/healthcare/contracts/` | ✅ Available | `registerPatient`, `getPatient` | None |
| **Encounter** | `IEncounterEngine` | `src/platform/healthcare/contracts/` | ✅ Available | `startEncounter`, `completeEncounter` | None |
| **Prescription** | `IPrescriptionEngine` | `src/platform/healthcare/contracts/` | ✅ Available | `createPrescription` | None |

### Logistics Kernel Contracts

| Capability | Contract Interface | Location | Status | Operations | Blocked Products |
|-----------|-------------------|----------|--------|-----------|-----------------|
| **Inventory** | `IInventoryContract` | `src/platform/logistics/contracts/inventory.contract.ts` | ✅ Available | `receiveItem`, `issueItem` | None |
| **Shipment** | `IShipmentContract` | `src/platform/logistics/contracts/shipment-management.contract.ts` | ✅ Available | `createShipment`, `updateStatus` | None |
| **Freight Audit** | `IFreightAuditContract` | `src/platform/logistics/contracts/freight-audit.contract.ts` | ✅ Available | `createInvoice`, `validateRate` | None |

---

## R3: EXTENSION POLICY REGISTRY

**Purpose:** Rules for product extensions.

**Schema:**
```typescript
interface ExtensionPolicy {
  entity: string;
  owner: string;
  product_extension_allowed: boolean;
  extension_pattern: 'context_table' | 'none' | 'event_subscription';
  table_naming_pattern?: string;
  fk_to_source_of_truth: boolean;
  duplicate_source_of_truth_forbidden: boolean;
  examples: string[];
  discovered_by: string;
}
```

**Registry Data:**

| Entity | Extension Allowed | Pattern | FK Required | Duplicate Forbidden | Example |
|--------|------------------|---------|-------------|-------------------|---------|
| **Party** | ❌ No | None | N/A | ✅ Yes | Cannot create `english_center_parties` |
| **Lead** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_lead_contexts` → Lead Engine (E0.3) |
| **Invoice** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_invoice_contexts` → `finance_invoices(id)` |
| **Student** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_student_contexts` → `students(id)` |
| **Enrollment** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_enrollment_contexts` → `edu_enrollments(id)` |
| **Attendance** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_attendance_contexts` → `edu_attendance(id)` |
| **Assessment** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_assessment_contexts` → `edu_assessments(id)` |
| **Course** | ✅ Yes | Context table | ✅ Yes | ✅ Yes | `english_center_course_contexts` → `courses(id)` |
| **Placement Test** | ✅ Yes | Product-owned | N/A | N/A | `english_center_placement_tests` (product-specific, E0.3) |
| **Trial Class** | ✅ Yes | Product-owned | N/A | N/A | `english_center_trial_classes` (product-specific, E0.3) |
| **Renewal Opportunity** | ✅ Yes | Product-owned | N/A | N/A | `english_center_renewal_opportunities` (product-specific, E0.3) |
| **Makeup Session** | ✅ Yes | Product-owned | N/A | N/A | `english_center_makeup_sessions` (product-specific, E0.3) |

**Extension Pattern Rules:**

```text
CONTEXT TABLE PATTERN:
✅ Allowed:
  - {product}_{entity}_contexts table
  - FK to Kernel/Platform source of truth
  - Product-specific columns only
  - No semantic duplication of source entity

❌ Forbidden:
  - Duplicate {entity} table in product
  - Bypass contract via raw SQL
  - FK to wrong identity model (Person vs Party)

PRODUCT-OWNED PATTERN:
✅ Allowed:
  - New entity genuinely product-specific
  - No semantic overlap with Kernel/Platform
  - Product controls lifecycle

EVENT SUBSCRIPTION PATTERN:
✅ Allowed:
  - Subscribe to Kernel/Platform domain events
  - Maintain derived view in product DB
  - Read-only projection
```

---

## R4: MIGRATION POLICY REGISTRY

**Purpose:** When tables can be modified.

**Schema:**
```typescript
interface MigrationPolicy {
  scope: 'kernel' | 'platform_core' | 'product';
  modification_allowed: boolean;
  pattern: 'frozen' | 'additive_only' | 'unrestricted';
  approval_required?: string;
  locked_artifacts?: string[];
  discovered_by: string;
}
```

**Registry Data:**

| Scope | Modification Allowed | Pattern | Approval Required | Locked Artifacts |
|-------|---------------------|---------|-------------------|-----------------|
| **Healthcare Kernel H1-H12** | ❌ No | Frozen | Architecture Change Request (ACR) | 52 kernel files, 12 entities |
| **Logistics Kernel E7.1-E7.3** | ❌ No | Frozen | ACR | 25 artifacts, 547 tests |
| **Platform Core Finance** | ⚠️ Limited | Additive only | Platform Architect | `finance_*` tables |
| **Platform Core Party** | ⚠️ Limited | Additive only | Platform Architect | `party_parties`, `persons` |
| **Education Kernel** | ⚠️ Limited | Additive only | Kernel Owner | Enrollment, Attendance, Assessment |
| **Product Tables** | ✅ Yes | Additive only | Product Owner | None |

**Migration Pattern Rules:**

```text
FROZEN (Kernel):
❌ Cannot CREATE new kernel table
❌ Cannot ALTER existing kernel table
❌ Cannot DROP kernel column
❌ Cannot modify kernel entity responsibilities
✅ Can CREATE product context tables with FK to kernel

ADDITIVE_ONLY (Platform Core):
❌ Cannot DROP table
❌ Cannot DROP column
❌ Cannot ALTER column type (breaking change)
✅ Can ADD new table
✅ Can ADD new column (nullable or with default)
✅ Can CREATE index

UNRESTRICTED (Product):
✅ Can CREATE product table
✅ Can ALTER product table (additive)
✅ Can DROP product table (if no dependencies)
❌ Cannot ALTER if would break contract
```

---

## R5: GATE MAPPING REGISTRY

**Purpose:** Required automated verification gates per capability type.

**Schema:**
```typescript
interface GateMapping {
  capability_type: string;
  required_gates: number[];
  gate_descriptions: Record<number, string>;
  enforcement: 'blocking' | 'warning';
  discovered_by: string;
}
```

**Registry Data:**

### Universal Gates (All Capabilities)

| Gate | Name | Check | Enforcement |
|------|------|-------|-------------|
| **0** | Tenant Isolation | RLS policies present, tenant_id column | Blocking |
| **1** | No Kernel Modification | Kernel tables untouched | Blocking |
| **2** | Contract Layer | No raw SQL to Kernel/Platform tables | Blocking |
| **3** | Event-After-Persistence | DB commit before domain event | Blocking |
| **4** | Additive Migration | No DROP table/column | Blocking |

### Entity-Specific Gates

| Capability Type | Required Gates | Additional Checks |
|----------------|---------------|-------------------|
| **Student Management** | 0, 1, 2, 3, 4, 5, 11 | Gate 5: Party identity model, Gate 11: Person→Party migration |
| **Enrollment** | 0, 1, 2, 3, 4, 8 | Gate 8: Prerequisite validation |
| **Finance** | 0, 1, 2, 3, 4, 10 | Gate 10: Immutability (SHA-256 fingerprint) |
| **Refund** | 0, 2 | Contract for finance reversal, refund policy compliance (E0.3) |
| **Attendance** | 0, 1, 2, 3, 4 | None |
| **Assessment** | 0, 1, 2, 3, 4, 9 | Gate 9: GPA calculation accuracy |
| **Authorization** | 0, 2, 6 | Gate 6: Role-based access control |
| **Renewal** | 0, 2 | Contract for enrollment, completion verification, level progression eligibility (E0.3) |
| **Product-Specific** | 0, 4 | Minimal (tenant isolation + additive) |

**Gate Definitions:**

```text
Gate 0: Tenant Isolation
  ✅ tenant_id column exists
  ✅ RLS policy created
  ✅ Policy filters by app.current_tenant_id

Gate 1: No Kernel Modification
  ✅ No ALTER on hc_*, edu_*, inventory_*, etc.
  ✅ No new H13, E8, L8 kernel engines

Gate 2: Contract Layer
  ✅ Product calls contract interface
  ✅ No direct INSERT/UPDATE to kernel tables

Gate 3: Event-After-Persistence
  ✅ DB transaction commits first
  ✅ Domain event published second
  ✅ No event if DB rollback

Gate 4: Additive Migration
  ✅ Only CREATE TABLE, ADD COLUMN, CREATE INDEX
  ✅ No DROP TABLE, DROP COLUMN, ALTER TYPE

Gate 5: Party Identity Model
  ✅ FK references party_parties(id)
  ✅ NOT persons(id) for new code

Gate 6: RBAC
  ✅ Security guard checks role
  ✅ Operation fails if unauthorized

Gate 8: Prerequisite Validation
  ✅ Enrollment checks prerequisite courses
  ✅ Blocks enrollment if missing

Gate 9: GPA Calculation
  ✅ Weighted average correct
  ✅ Handles missing scores

Gate 10: Financial Immutability
  ✅ Invoice immutable after issuance
  ✅ SHA-256 fingerprint present

Gate 11: Identity Migration
  ✅ New code uses Party
  ✅ Legacy Person code marked for migration
```

---

## 🤖 INTENT RESOLVER (FUTURE)

**Purpose:** Translate user intent → architecture-compliant implementation.

**Example Flow:**

```text
USER INTENT:
"Add placement test feature for English Center"

INTENT RESOLVER:
1. Parse intent
   - Entity: Placement Test
   - Product: English Center
   - Operations: create, score, determine level

2. Resolve ownership (R1)
   - Entity: Placement Test
   - Owner: Product (English Center)
   - Source of truth: english_center_placement_tests
   - Identity model: Party
   - Extension: N/A (product-owned)

3. Resolve contracts (R2)
   - Student → IEducationStudentContract ✅
   - Assessment → IEducationAssessmentContract ✅
   - Enrollment → IEducationEnrollmentContract ✅
   - Finance → IFinanceReceivableContract ⚠️ MISSING

4. Resolve extension policy (R3)
   - New product table allowed ✅
   - FK to students table via Party ✅
   - No duplication of kernel entities ✅

5. Map required gates (R5)
   - Gate 0: Tenant isolation ✅
   - Gate 4: Additive migration ✅
   - Gate 5: Party identity model ✅

6. Generate bounded implementation
   - Table: english_center_placement_tests
   - Service: PlacementTestService
   - API: POST /api/english-center/placement-tests
   - Tests: Integration + E2E

7. Verify gates
   - Run architecture guard
   - Run automated tests
   - Pass → Merge
   - Fail → Block with reason

RESULT:
✅ Implementation generated
✅ All gates pass
✅ No manual architecture investigation needed
```

**Fallback to Human:**

```text
IF ownership unknown → UNKNOWN_CAPABILITY → Ask architect
IF contract missing → ARCHITECTURAL_GAP → Block product
IF semantic conflict → SEMANTIC_CONFLICT → Ask architect
IF extension forbidden → POLICY_VIOLATION → Block + suggest fix
```

---

## 📊 DISCOVERY TRACKER

**Purpose:** Track which products discovered which architectural patterns.

| Pattern | Discovered By | Phase | Locked |
|---------|--------------|-------|--------|
| Party canonical identity | Healthcare OS | H1 | ✅ |
| Person legacy identity | Education OS | Legacy | ⚠️ Migration required |
| Student → Person FK (wrong) | English Center E0.1A-1 | E0.1A-1 | ⚠️ Migration required |
| Enrollment context pattern | Preschool | P1 | ✅ |
| Finance AR gap | English Center E0.1B | E0.1B | 🔴 Blocker |
| Preschool P7 legacy finance | English Center E0.1B | E0.1B | ⚠️ Migration candidate |
| Course hierarchy needs | English Center E0.1C | E0.1C | ⏸️ Pending |
| Installment plan ownership | English Center E0.1B | E0.1B | ⏸️ Needs design |
| Lead Engine reuse | English Center E0.3 | E0.3 | ✅ |
| Enrollment completion | English Center E0.3 | E0.3 | ✅ |
| Renewal workflow orchestration | English Center E0.3 | E0.3 | ✅ |
| Refund policy + Platform reversal | English Center E0.3 | E0.3 | ✅ |
| No generic scheduling for resources | English Center E0.3 | E0.3 | ✅ |
| No marketing/churn platform | English Center E0.3 | E0.3 | ✅ |

---

## 🎯 REGISTRY ROADMAP

### Phase 1: Capture Existing Decisions (NOW)
- ✅ Create R1 Entity Ownership Registry
- ✅ Create R2 Contract Registry
- ✅ Create R3 Extension Policy Registry
- ✅ Create R4 Migration Policy Registry
- ✅ Create R5 Gate Mapping Registry

### Phase 2: Validate with English Center (E0.1C → E0.5)
- ⏸️ Use registry to answer E0.1C Course/Class questions
- ⏸️ Verify registry eliminates manual investigation
- ⏸️ Update registry with E0.1C discoveries

### Phase 3: Automate Intent Resolution (F0-F6)
- ⏸️ Build Intent Parser
- ⏸️ Build Ownership Resolver
- ⏸️ Build Contract Checker
- ⏸️ Build Code Generator Guard
- ⏸️ Integrate with Architecture Guard

### Phase 4: Test with Product #4 (Post English Center)
- ⏸️ Product #4 uses Intent Resolver exclusively
- ⏸️ Verify no manual architecture investigation needed
- ⏸️ Measure reduction in discovery overhead

---

## 🚀 USAGE EXAMPLES

### Example 1: AI Generates Student Feature

**Intent:** "Add student registration for English Center"

**AI Workflow:**
1. Read R1 → Student owned by Education Kernel
2. Read R2 → IEducationStudentContract available
3. Read R3 → Context table allowed
4. Read R5 → Gates 0,1,2,3,4,5,11 required
5. Generate:
   ```typescript
   // Product service calls contract (NOT raw SQL)
   const student = await educationStudentContract.registerStudent({
     tenantId,
     partyId, // Uses Party, not Person
     ...
   });
   
   // Product context
   await db.insert('english_center_student_contexts', {
     student_id: student.id, // FK to kernel
     placement_test_id,
     preferred_schedule,
     learning_goals,
   });
   ```
6. Verify gates → Pass → Merge

### Example 2: AI Detects Finance Gap

**Intent:** "Add invoice generation for course fees"

**AI Workflow:**
1. Read R1 → Invoice owned by Platform Finance
2. Read R2 → IFinanceReceivableContract status = MISSING ❌
3. **BLOCK:** Architectural gap detected
4. Report to human:
   ```text
   ARCHITECTURAL GAP DETECTED
   
   Capability: Invoice management
   Owner: Platform Core Finance
   Contract: IFinanceReceivableContract
   Status: MISSING
   
   Action Required:
   Platform Finance must implement F3 AR contract
   before English Center E1 can proceed.
   
   Blocked Products:
   - English Center E1
   ```

### Example 3: AI Prevents Duplication

**Intent:** "Create english_center_enrollments table"

**AI Workflow:**
1. Read R1 → Enrollment owned by Education Kernel
2. Read R3 → Duplicate source of truth FORBIDDEN
3. **BLOCK:** Policy violation
4. Suggest fix:
   ```text
   POLICY VIOLATION
   
   Attempted: CREATE english_center_enrollments
   
   Problem: Duplicate source of truth forbidden
   
   Correct Pattern:
   - Use edu_enrollments (kernel source of truth)
   - Create english_center_enrollment_contexts
   - FK to edu_enrollments(id)
   ```

---

## 📝 MAINTENANCE

**Registry Updates:**
- New entity discovered → Add to R1
- New contract delivered → Update R2 status
- New extension pattern → Document in R3
- New gate required → Add to R5
- Product ships → Update discovery tracker

**Validation:**
- Each product MUST reference registry
- Architecture guard MUST enforce registry rules
- Products CANNOT bypass registry (even with "urgency")

**Governance:**
- Registry changes require Platform Architect approval
- Breaking changes require migration plan
- Discovery insights feed back to registry

---

## ✅ CURRENT STATUS

```text
PLATFORM ARCHITECTURE REGISTRY

R1 Entity Ownership        ✅ INITIAL VERSION (updated E0.3)
R2 Contract Registry       ✅ INITIAL VERSION (updated E0.3)
R3 Extension Policy        ✅ INITIAL VERSION (updated E0.3)
R4 Migration Policy        ✅ INITIAL VERSION
R5 Gate Mapping            ✅ INITIAL VERSION (updated E0.3)

Validated By:
  Healthcare OS            ✅ IMPLICIT
  Logistics OS             ✅ IMPLICIT
  Preschool                ✅ IMPLICIT
  English Center E0.1A/B/C ✅ EXPLICIT
  English Center E0.2      ✅ EXPLICIT
  English Center E0.3      ✅ EXPLICIT

Ready for:
  English Center E0.4      ✅ YES (Business Invariants)
  English Center E0.5      ✅ YES (Product Manifest Lock)
  Intent Resolver          ⏸️ FUTURE (Phase 3)

Intent Coding Ready:       ⚠️ FOUNDATION COMPLETE
  - Registry proven via E0.1A/B/C, E0.2, E0.3
  - Registry hit rate: 27.3% (E0.3), 66.7% (E0.2), 16.7% (E0.1C)
  - Need E0.5 machine-readable manifest (YAML/JSON)
  - Need F0-F6 automation
  - Target: Product #4 uses exclusively
```

---

**NEXT:** Use this registry to answer E0.1C Course/Class/Session ownership questions **WITHOUT manual investigation**.
