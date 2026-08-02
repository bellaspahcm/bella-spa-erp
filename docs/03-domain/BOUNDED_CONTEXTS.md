# Bella AI Platform - Bounded Contexts

**Version:** 1.0  
**Last Updated:** 2026-08-02  
**Owner:** Chief Architect, Domain Experts

---

## Purpose

This document defines the **bounded contexts** for Bella AI Platform using Domain-Driven Design (DDD) principles.

**Bounded Context:** A logical boundary where a domain model is defined and applicable. Each context has its own ubiquitous language and may have different representations of the same concept.

---

## Context Map

```
┌─────────────────────────────────────────────────────────┐
│               Bella AI Platform                         │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐    ┌──────▼──────┐  ┌────▼────┐
   │  Core   │    │  Supporting │  │Industry │
   │Contexts │    │  Contexts   │  │Contexts │
   └─────────┘    └─────────────┘  └─────────┘
```

---

## 1. Core Contexts (Platform)

These contexts are fundamental to Bella AI Platform and shared across all industries.

### 1.1 Identity & Access Context

**Purpose:** Manage who can access what in the platform.

**Core Concepts:**
- Identity (root)
- Credential
- Role
- Permission
- Authentication
- Authorization

**Ubiquitous Language:**
- **Identity**: Entity that can authenticate (not "User")
- **Credential**: Authentication method (not "Login")
- **Role**: Collection of permissions (not "Group")

**Bounded By:**
- Identity lifecycle (registration → verification → activation)
- Authentication mechanisms
- Authorization rules

**Dependencies:**
- ← Organization Context (Identity belongs to Organization)
- → All other contexts (for authentication)

**Events Published:**
- `IdentityCreated`
- `IdentityVerified`
- `IdentityActivated`
- `IdentitySuspended`
- `CredentialAdded`
- `RoleAssigned`

---

### 1.2 Organization Context

**Purpose:** Manage organizational structures and tenants.

**Core Concepts:**
- Organization (root)
- Tenant
- Branch
- Department
- Hierarchy

**Ubiquitous Language:**
- **Organization**: Legal entity (not "Company" or "Client")
- **Tenant**: Isolated instance (not "Account")
- **Branch**: Physical location (not "Site")

**Bounded By:**
- Organization hierarchy (max 3 levels)
- Tenant isolation rules
- Multi-tenancy boundaries

**Dependencies:**
- ← Identity Context (Organization has Identities)
- → All industry contexts (Tenant provides isolation)

**Events Published:**
- `OrganizationCreated`
- `TenantCreated`
- `TenantSuspended`
- `BranchAdded`

---

### 1.3 Registration Context

**Purpose:** Manage identity registration and approval workflows.

**Core Concepts:**
- Registration (root)
- Application
- Verification
- Approval
- Provisioning

**Ubiquitous Language:**
- **Registration**: Identity creation request (not "Sign-up")
- **Verification**: Proof of ownership (email, phone)
- **Provisioning**: Create tenant + identity + credentials

**Bounded By:**
- Registration lifecycle (draft → verified → approved → provisioned)
- Approval workflows
- Provisioning pipelines

**Dependencies:**
- → Identity Context (creates Identity)
- → Organization Context (creates Organization/Tenant)
- ← Policy Context (approval rules)
- ← AI Context (fraud detection)

**Events Published:**
- `RegistrationSubmitted`
- `RegistrationVerified`
- `RegistrationApproved`
- `RegistrationRejected`
- `RegistrationProvisioned`

---

### 1.4 Workflow Context

**Purpose:** Manage business process automation.

**Core Concepts:**
- Workflow Definition (root)
- Workflow Instance
- Step
- Task
- State Transition

**Ubiquitous Language:**
- **Workflow**: Multi-step process (not "Flow" or "Process")
- **Instance**: Execution of a workflow (not "Run")
- **Task**: Human action required (not "Step" - steps can be automated)

**Bounded By:**
- Workflow execution boundaries
- Step types (automated, human, decision)
- State machine rules

**Dependencies:**
- ← Policy Context (step conditions)
- → Notification Context (task notifications)
- Used by: All contexts needing approval/automation

**Events Published:**
- `WorkflowStarted`
- `WorkflowStepCompleted`
- `WorkflowCompleted`
- `WorkflowFailed`
- `TaskAssigned`

---

## 2. Supporting Contexts (Platform Services)

These contexts provide cross-cutting services.

### 2.1 Document Context

**Purpose:** Manage file storage and access control.

**Core Concepts:**
- Document (root)
- File
- Version
- Access Control
- Storage

**Ubiquitous Language:**
- **Document**: Uploaded file with metadata (not "Attachment")
- **Version**: Historical snapshot (not "Revision")
- **Visibility**: Access scope (not "Permission" - that's Identity Context)

**Bounded By:**
- Storage boundaries (Supabase Storage)
- Access control rules
- File lifecycle (upload → scan → store → archive)

**Dependencies:**
- ← Identity Context (uploaded_by)
- ← Organization Context (tenant_id)
- Used by: All contexts needing file storage

**Events Published:**
- `DocumentUploaded`
- `DocumentDeleted`
- `DocumentViewed`
- `DocumentShared`

---

### 2.2 Notification Context

**Purpose:** Send messages to users via multiple channels.

**Core Concepts:**
- Notification (root)
- Template
- Channel (email, SMS, push, in-app)
- Delivery
- Preference

**Ubiquitous Language:**
- **Notification**: Message to user (not "Alert" - that's monitoring)
- **Template**: Reusable message format (not "Email")
- **Delivery**: Actual send attempt (not "Status")

**Bounded By:**
- Notification channels
- Delivery guarantees
- Rate limiting rules

**Dependencies:**
- ← Identity Context (recipient)
- ← Workflow Context (task notifications)
- → External services (email provider, SMS gateway)

**Events Published:**
- `NotificationSent`
- `NotificationDelivered`
- `NotificationFailed`
- `NotificationRead`

---

### 2.3 Policy Context

**Purpose:** Configure business rules without code changes.

**Core Concepts:**
- Policy (root)
- Rule
- Condition
- Action
- Evaluation

**Ubiquitous Language:**
- **Policy**: Configured business rule (not "Rule" - that's a component)
- **Condition**: If-clause (not "Criteria")
- **Action**: Then-clause (not "Result")
- **Evaluation**: Policy execution (not "Check")

**Bounded By:**
- Policy types (validation, approval, pricing, etc.)
- Evaluation order (priority-based)
- Condition operators

**Dependencies:**
- Used by: All contexts needing configurable rules

**Events Published:**
- `PolicyEvaluated`
- `PolicyMatched`
- `PolicyAction Executed`

---

### 2.4 AI Context

**Purpose:** Provide AI-powered decision support.

**Core Concepts:**
- AI Review (root)
- Model
- Prediction
- Recommendation
- Feedback

**Ubiquitous Language:**
- **AI Review**: AI analysis of entity (not "AI Decision" - humans decide)
- **Recommendation**: AI suggestion (not "Decision")
- **Feedback**: Human correction (not "Override" - implies AI was wrong)

**Bounded By:**
- Review types (registration, expense, document)
- Model lifecycle (train → deploy → monitor)
- Explainability requirements

**Dependencies:**
- ← Identity Context (reviewed entities)
- ← Registration Context (fraud detection)
- → External AI services (OpenAI, custom models)

**Events Published:**
- `AIReviewCompleted`
- `AIRecommendationGenerated`
- `HumanDecisionRecorded`
- `ModelRetrained`

---

### 2.5 Package & License Context

**Purpose:** Manage subscriptions and quotas.

**Core Concepts:**
- Package (root)
- License
- Quota
- Feature Flag
- Billing

**Ubiquitous Language:**
- **Package**: Bundle of features (not "Plan" or "Subscription")
- **License**: Tenant's subscription (not "Subscription" - that's payment)
- **Quota**: Usage limit (not "Limit" - quotas can be exceeded with alerts)

**Bounded By:**
- Package tiers (starter, professional, enterprise)
- Billing cycles (monthly, annual)
- Quota enforcement boundaries

**Dependencies:**
- ← Organization Context (Tenant has License)
- → Billing system (external)

**Events Published:**
- `LicenseCreated`
- `LicenseRenewed`
- `LicenseCancelled`
- `QuotaExceeded`

---

## 3. Industry Contexts (Domain-Specific)

These contexts are specific to each industry vertical.

### 3.1 Real Estate Context

**Core Concepts:**
- Lead (root)
- Property
- Inventory
- Reservation
- Commission

**Ubiquitous Language:**
- **Lead**: Potential customer (not "Prospect")
- **Inventory**: Available units (not "Stock")
- **Reservation**: Hold with deposit (not "Booking")

**Bounded By:**
- Real estate business rules
- Commission calculation logic
- Lead rotation algorithms

**Dependencies:**
- ← Identity Context (Partner, Customer)
- ← CRM Context (Lead management)
- ← Document Context (contracts, deeds)

---

### 3.2 Beauty Spa Context

**Core Concepts:**
- Booking (root)
- Treatment
- Membership
- Session
- KTV (staff)

**Ubiquitous Language:**
- **Booking**: Appointment (not "Reservation")
- **Treatment**: Service performed (not "Service")
- **Session**: Service delivery instance (not "Appointment")
- **KTV**: Service staff (not "Employee" - specific role)

**Bounded By:**
- Spa operations
- Commission rules
- Membership packages

---

### 3.3 Baby Care Context

**Core Concepts:**
- Package (root)
- Session
- Home Visit
- Customer
- KTV

**Ubiquitous Language:**
- **Package**: Prepaid service bundle (not "Plan")
- **Session**: Single service delivery (not "Visit")
- **Home Visit**: Service at customer location (not "Session" - more specific)

**Bounded By:**
- Package types
- Session multipliers
- Home visit logistics

---

## Context Relationships

### Upstream/Downstream Patterns

**Core → Supporting**
- Core contexts are **upstream** (define concepts)
- Supporting contexts are **downstream** (use concepts)

**Example:**
- Identity Context (upstream) defines "Identity"
- Notification Context (downstream) sends notifications to "Identity"

---

**Platform → Industry**
- Platform contexts are **upstream**
- Industry contexts are **downstream**

**Example:**
- Identity Context (upstream) defines "Partner"
- Real Estate Context (downstream) uses "Partner" for lead assignment

---

### Anti-Corruption Layers (ACL)

**When to use ACL:**
- Integrating with external systems (different language)
- Protecting core from industry-specific concepts

**Example: Real Estate ACL**
```typescript
// Real Estate uses "Agent", Platform uses "Partner Identity"
class RealEstateACL {
  toPlatformIdentity(agent: Agent): Identity {
    return {
      id: agent.id,
      identity_type: 'human',
      identity_category: 'partner',
      display_name: agent.name,
      metadata: {
        industry: 'real_estate',
        license_number: agent.license_number
      }
    };
  }
  
  toAgent(identity: Identity): Agent {
    return {
      id: identity.id,
      name: identity.display_name,
      license_number: identity.metadata.license_number
    };
  }
}
```

---

## Context Integration Patterns

### 1. Shared Kernel (Avoid)

**Not Recommended:** Contexts sharing same database table.

❌ **Bad:**
```typescript
// Registration Context and Identity Context both directly modify `identities` table
```

✅ **Good:**
```typescript
// Registration Context publishes `IdentityProvisioned` event
// Identity Context subscribes and creates Identity
```

---

### 2. Published Language (Recommended)

**Use:** Events as integration contracts.

```typescript
// Registration Context publishes
interface RegistrationApprovedEvent {
  eventType: 'RegistrationApproved';
  registrationId: UUID;
  applicantEmail: string;
  applicantType: 'partner' | 'employee';
}

// Identity Context subscribes
async handleRegistrationApproved(event: RegistrationApprovedEvent) {
  await provisioningPipeline.execute(event.registrationId);
}
```

---

### 3. Conformist (For External Systems)

**Use:** Accept external system's model as-is.

**Example: Payment Gateway**
```typescript
// We conform to Stripe's model
interface StripePayment {
  id: string; // Stripe format
  amount: number; // Cents
  currency: string; // ISO 4217
  status: 'succeeded' | 'failed' | 'pending';
}

// Map to our domain
function toDomainPayment(stripe: StripePayment): Payment {
  return {
    id: generateUUID(),
    external_id: stripe.id,
    amount_vnd: stripe.amount * 100, // Stripe uses cents
    status: mapStripeStatus(stripe.status)
  };
}
```

---

## Context Testing Strategies

### Unit Tests (Within Context)
- Test domain logic in isolation
- Mock dependencies (other contexts)

### Integration Tests (Cross-Context)
- Test event publishing/subscribing
- Test ACL translations
- Test end-to-end flows

### Contract Tests
- Verify event schema compatibility
- Ensure API contracts not broken

---

## Related Documents

- [Domain Model](./DOMAIN_MODEL.md)
- [Ubiquitous Language](./UBIQUITOUS_LANGUAGE.md)
- [ADR-001: Identity Platform](../05-adr/ADR-001-identity-platform.md)
- [ADR-004: Event-Driven Architecture](../05-adr/ADR-004-event-driven-architecture.md)

---

**"Strong boundaries, loose coupling, high cohesion."**
