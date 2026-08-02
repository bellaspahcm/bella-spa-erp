# ADR-010: Domain Model

**Status:** APPROVED  
**Date:** 2026-08-02  
**Decision Makers:** Chief Architect, Domain Experts  
**Consulted:** All Engineering Teams  
**Informed:** Product, QA

---

## Context

Bella AI Platform serves multiple industries with shared capabilities. Without a clear domain model:
- **Naming conflicts** - "User" means different things in different modules
- **Inconsistent relationships** - Is Organization parent of Tenant, or vice versa?
- **Duplicate entities** - Partner, Employee, Customer all have separate tables
- **Integration complexity** - Cross-module features require understanding multiple mental models

**Question:** What is the canonical domain model for Bella AI Platform?

---

## Decision

We will adopt **Domain-Driven Design (DDD)** principles and define a **Ubiquitous Language** that all teams must use.

---

## Core Domain Model

### Aggregate Roots (Entities with Lifecycle)

```
Identity (Root)
  ├── Credential
  ├── Role Assignment
  └── Permission

Organization (Root)
  ├── Tenant
  ├── Branch
  └── Department

Registration (Root)
  ├── Application
  ├── Document
  └── Verification

Workflow (Root)
  ├── Definition
  ├── Instance
  └── Task

Package (Root)
  ├── Tier
  ├── Module Assignment
  └── License

Policy (Root)
  ├── Rule
  ├── Condition
  └── Action

Document (Root)
  ├── File
  ├── Version
  └── Access Control

Notification (Root)
  ├── Template
  ├── Delivery
  └── Status
```

---

## Entity Definitions

### 1. Identity

**Definition:** An entity that can authenticate and perform actions in the system.

**Types:**
- **Human:** Partner, Employee, Customer, Supplier, Vendor, Consultant, Freelancer
- **Organization:** Agency, Company, Branch, Franchise
- **System:** AI Employee, Service Account, API Client, Integration

**Key Attributes:**
- `id` (uuid, PK)
- `identity_type` (enum: human, organization, system)
- `identity_category` (enum: partner, employee, customer, supplier, vendor, affiliate, franchise, ai_employee, service_account)
- `display_name` (string)
- `legal_name` (string, nullable)
- `metadata` (jsonb, extensible)
- `status` (enum: draft, pending_verification, active, suspended, archived)

**Relationships:**
- Has many `Credential`
- Has many `Role Assignment`
- Belongs to `Organization`
- Has many `Registration` (historical)

**Business Rules:**
- Identity can have multiple credentials (email, phone, API key)
- Identity can have multiple roles (admin + partner)
- Identity cannot be deleted, only soft-deleted (`deleted_at`)
- Identity status transitions must be audited

---

### 2. Organization

**Definition:** A legal entity or group that uses Bella AI Platform.

**Types:**
- **Enterprise:** Multi-location business (e.g., Spa chain, Hospital network)
- **SME:** Single-location business
- **Agency:** Partner organization (e.g., Real Estate agency)

**Key Attributes:**
- `id` (uuid, PK)
- `organization_type` (enum: enterprise, sme, agency)
- `legal_name` (string)
- `tax_code` (string, unique)
- `metadata` (jsonb)
- `status` (enum: active, suspended, archived)

**Relationships:**
- Has many `Tenant` (one per industry module)
- Has many `Branch` (physical locations)
- Has many `Identity` (employees, partners, customers)

**Business Rules:**
- Organization must have at least one active Tenant
- Tax code must be unique across all Organizations
- Cannot delete Organization with active Tenants

---

### 3. Tenant

**Definition:** An isolated instance of an industry module.

**Example:**
- **Real Estate Tenant:** Has access to Lead, Inventory, Commission modules
- **Beauty Spa Tenant:** Has access to Booking, Membership, Payroll modules

**Key Attributes:**
- `id` (uuid, PK)
- `organization_id` (uuid, FK)
- `industry_module` (enum: real_estate, beauty_spa, baby_care, healthcare, retail, education)
- `tenant_name` (string)
- `status` (enum: active, suspended, archived)
- `metadata` (jsonb)

**Relationships:**
- Belongs to `Organization`
- Has many `Module Assignment`
- Has many `License`
- Has many `Identity` (via tenant membership)

**Business Rules:**
- Tenant data is isolated via Row-Level Security (RLS)
- Tenant can only access assigned modules
- Tenant status change triggers workflow (suspend → disable access)

---

### 4. Registration

**Definition:** A request to create a new Identity with provisioning.

**Types:**
- **Partner Registration:** External partners apply to join platform
- **Employee Registration:** HR creates employee accounts
- **Customer Registration:** Customers self-sign-up

**Key Attributes:**
- `id` (uuid, PK)
- `registration_type` (enum: partner, employee, customer, supplier, vendor)
- `applicant_type` (enum: individual, organization)
- `status` (enum: draft, pending_verification, need_more_info, approved, rejected, provisioned, activated)
- `submitted_at` (timestamptz)
- `approved_at` (timestamptz, nullable)
- `approved_by` (uuid, FK → Identity)
- `tenant_id` (uuid, FK → Tenant, nullable, set after provisioning)
- `identity_id` (uuid, FK → Identity, nullable, set after provisioning)
- `metadata` (jsonb)

**Relationships:**
- Has many `Document` (uploaded during registration)
- Has many `Verification` (email, phone, document checks)
- Creates `Identity` (after approval)
- Creates `Tenant` (if organization registration)

**Business Rules:**
- Status transitions: draft → pending_verification → approved → provisioned → activated
- Cannot approve without email verification
- Cannot provision without approval
- Cannot activate without credential setup

---

### 5. Workflow

**Definition:** A multi-step process with approvals, tasks, and state transitions.

**Types:**
- **Approval Workflow:** Registration approval, expense approval, leave approval
- **Operational Workflow:** Booking fulfillment, lead nurturing, payroll processing

**Key Attributes:**
- `id` (uuid, PK)
- `workflow_type` (enum: approval, operational, notification)
- `definition` (jsonb, workflow steps)
- `status` (enum: active, paused, archived)

**Workflow Instance:**
- `instance_id` (uuid, PK)
- `workflow_id` (uuid, FK)
- `current_step` (string)
- `status` (enum: pending, in_progress, completed, failed, cancelled)
- `started_at` (timestamptz)
- `completed_at` (timestamptz, nullable)

**Business Rules:**
- Workflow definition is versioned (cannot modify running instances)
- Workflow instance tracks all state transitions
- Workflow can have conditional branches
- Workflow can trigger other workflows

---

### 6. Package

**Definition:** A bundle of features, quotas, and modules offered to tenants.

**Types:**
- **Starter:** Basic features, 5 users, 1 location
- **Professional:** Advanced features, 20 users, 5 locations
- **Enterprise:** All features, unlimited users/locations, custom integrations

**Key Attributes:**
- `id` (uuid, PK)
- `package_name` (string)
- `package_tier` (enum: starter, professional, enterprise)
- `pricing` (jsonb: monthly_price, annual_price)
- `quotas` (jsonb: max_users, max_locations, max_storage)
- `features` (jsonb: feature flags)
- `modules` (array: enabled modules)

**Relationships:**
- Has many `License` (tenant subscriptions)
- Has many `Module Assignment`

**Business Rules:**
- Package upgrade: Immediate (no downtime)
- Package downgrade: End of billing cycle
- Cannot downgrade if usage exceeds new quota

---

### 7. Policy

**Definition:** Configurable business rules that govern system behavior.

**Types:**
- **Validation Policy:** Required fields, document types, data format
- **Approval Policy:** Who can approve, escalation rules
- **Pricing Policy:** Discount rules, commission tiers

**Key Attributes:**
- `id` (uuid, PK)
- `policy_type` (enum: validation, approval, pricing, rotation, notification)
- `policy_name` (string)
- `conditions` (jsonb: if-then rules)
- `actions` (jsonb: what to do when conditions met)
- `priority` (int, for policy ordering)
- `status` (enum: active, inactive)

**Example Policy:**
```json
{
  "policy_type": "approval",
  "policy_name": "Real Estate Partner Approval",
  "conditions": {
    "applicant_type": "agency",
    "fraud_score": { "lte": 0.2 },
    "documents_complete": true
  },
  "actions": {
    "auto_approve": true,
    "notify": ["admin@company.com"]
  }
}
```

**Business Rules:**
- Policy evaluation order determined by priority
- First matching policy wins (short-circuit)
- Policy changes are versioned
- Policy audit log tracks all evaluations

---

### 8. Document

**Definition:** A file uploaded to the system with access control.

**Key Attributes:**
- `id` (uuid, PK)
- `owner_type` (enum: identity, registration, booking, invoice, contract)
- `owner_id` (uuid)
- `document_category` (enum: identification, business_license, contract, invoice, receipt)
- `file_name` (string)
- `file_size` (bigint, bytes)
- `file_type` (string, MIME type)
- `storage_path` (string, Supabase Storage path)
- `visibility` (enum: private, tenant, public)
- `uploaded_by` (uuid, FK → Identity)
- `uploaded_at` (timestamptz)
- `deleted_at` (timestamptz, nullable, soft delete)

**Relationships:**
- Belongs to `owner_type` (polymorphic)
- Has many `Version` (if versioned document)
- Has many `Access Control` (who can view/edit)

**Business Rules:**
- Document access enforced via RLS
- Document cannot be permanently deleted (compliance)
- Document version history preserved
- Document upload triggers virus scan

---

### 9. Notification

**Definition:** A message sent to an Identity via email, SMS, push, or in-app.

**Key Attributes:**
- `id` (uuid, PK)
- `recipient_id` (uuid, FK → Identity)
- `notification_type` (enum: email, sms, push, in_app)
- `template_name` (string)
- `subject` (string, for email)
- `body` (text)
- `status` (enum: pending, sent, delivered, failed, read)
- `sent_at` (timestamptz, nullable)
- `delivered_at` (timestamptz, nullable)
- `read_at` (timestamptz, nullable)
- `error_message` (text, nullable)

**Relationships:**
- Belongs to `Identity` (recipient)
- Triggered by `Event` (domain event)

**Business Rules:**
- Notification retry: 3 attempts with exponential backoff
- Notification delivery tracked for audit
- Notification preferences configurable per Identity
- Failed notifications moved to Dead Letter Queue (DLQ)

---

## Bounded Contexts

### Core Context (Platform)
- Identity, Organization, Tenant, Registration, Workflow, Policy, Package, Document, Notification

### CRM Context
- Lead, Contact, Opportunity, Pipeline, Campaign

### Sales Context
- Inventory, Booking, Reservation, Session, Package

### Finance Context
- Revenue, Expense, Invoice, Payment, Commission, Payroll

### HR Context
- Employee, Attendance, Leave, Performance, Salary

### Industry Contexts (Examples)
- **Real Estate Context:** Property, Project, Unit, Agent, Reservation
- **Beauty Spa Context:** Treatment, Membership, KTV, Session
- **Healthcare Context:** Patient, Appointment, EMR, Prescription

---

## Ubiquitous Language Dictionary

| Term | Definition | Anti-Pattern |
|------|------------|--------------|
| **Identity** | Entity that can authenticate | ❌ "User", "Account" |
| **Organization** | Legal entity | ❌ "Company", "Business" |
| **Tenant** | Isolated instance | ❌ "Client", "Customer" |
| **Registration** | Identity creation request | ❌ "Application", "Sign-up" |
| **Workflow** | Multi-step process | ❌ "Flow", "Process" |
| **Policy** | Business rule | ❌ "Rule", "Config" |
| **Package** | Feature bundle | ❌ "Plan", "Subscription" |
| **Document** | Uploaded file | ❌ "File", "Attachment" |
| **Notification** | Message to user | ❌ "Alert", "Message" |
| **Capability** | Platform building block | ❌ "Feature", "Module" |
| **Event** | Domain state change | ❌ "Message", "Notification" |
| **Aggregate** | Consistency boundary | ❌ "Entity", "Object" |

**Rule:** All code, documentation, and conversations must use these terms consistently.

---

## Entity Relationship Diagram (Simplified)

```
Organization (1) ──┬── (M) Tenant
                   └── (M) Identity

Identity (1) ──┬── (M) Credential
               ├── (M) Role Assignment
               └── (M) Registration

Registration (1) ──┬── (M) Document
                   └── (M) Verification

Tenant (1) ──┬── (M) Module Assignment
             ├── (M) License
             └── (M) Package

Workflow (1) ──┬── (M) Workflow Instance
               └── (M) Task

Policy (1) ──── (M) Rule

Document (1) ──┬── (M) Version
               └── (M) Access Control

Notification (1) ──── (1) Identity (recipient)
```

---

## Design Patterns

### Pattern 1: Aggregate Root
**Rule:** All database operations must go through the Aggregate Root.

❌ BAD:
```typescript
await db.update('credentials').set({ verified: true }).where('id', credentialId);
```

✅ GOOD:
```typescript
const identity = await identityRepository.findById(identityId);
identity.verifyCredential(credentialId);
await identityRepository.save(identity);
```

---

### Pattern 2: Value Objects
**Rule:** Immutable objects with no identity.

**Examples:**
- `Address` (street, city, postal_code)
- `Money` (amount, currency)
- `DateRange` (start_date, end_date)

```typescript
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {
    if (amount < 0) throw new Error('Amount cannot be negative');
  }
  
  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

---

### Pattern 3: Domain Events
**Rule:** All state changes publish events.

```typescript
class Identity {
  approve(approvedBy: Identity) {
    this.status = 'approved';
    this.approvedAt = new Date();
    this.approvedBy = approvedBy.id;
    
    this.publishEvent({
      eventType: 'IdentityApproved',
      aggregateId: this.id,
      payload: { approvedBy: approvedBy.id }
    });
  }
}
```

---

### Pattern 4: Repository Pattern
**Rule:** Encapsulate data access logic.

```typescript
interface IdentityRepository {
  findById(id: string): Promise<Identity | null>;
  findByEmail(email: string): Promise<Identity | null>;
  save(identity: Identity): Promise<void>;
  delete(id: string): Promise<void>; // Soft delete
}
```

---

## Migration Strategy

### Phase 1: Introduce New Entities (Week 1-2)
- Create `identities`, `organizations`, `tenants` tables
- Do NOT remove old tables yet
- Run both systems in parallel

### Phase 2: Migrate Data (Week 3-4)
- Migrate `spa_staff` → `identities` (category: employee)
- Migrate `baby_care_employees` → `identities`
- Migrate `partners` → `identities` (category: partner)

### Phase 3: Update Foreign Keys (Week 5-6)
- Update all tables referencing `spa_staff_id` → `identity_id`
- Create database views for backward compatibility

### Phase 4: Deprecate Old Tables (Week 7-8)
- Mark old tables as deprecated
- Remove old tables after 3 months

---

## Testing Strategy

### Unit Tests (Domain Logic)
- Test aggregate business rules
- Test value object validation
- Test domain event publishing

### Integration Tests (Repository)
- Test CRUD operations
- Test complex queries
- Test transaction boundaries

### Domain Tests (Specifications)
- Test business scenarios end-to-end
- Test workflow state transitions
- Test policy evaluation

---

## Related Documents

- [Capability Map](../02-capabilities/CAPABILITY_MAP.md)
- [Bounded Contexts](../03-domain/BOUNDED_CONTEXTS.md)
- [Ubiquitous Language](../03-domain/UBIQUITOUS_LANGUAGE.md)
- [ADR-001: Identity Platform](./ADR-001-identity-platform.md)

---

## Approval

- [x] **Chief Architect:** Approved - 2026-08-02
- [x] **Domain Experts:** Approved - 2026-08-02
- [x] **All Engineering Teams:** Approved - 2026-08-02

---

**Decision:** APPROVED  
**Effective Date:** 2026-08-02  
**Review Date:** 2026-11-02

---

**"One language, one model, one platform."**
