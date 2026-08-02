# Bella AI Platform - Ubiquitous Language

**Version:** 1.0  
**Last Updated:** 2026-08-02  
**Owner:** Chief Architect, Domain Experts

---

## Purpose

This document defines the **ubiquitous language** for Bella AI Platform - a shared vocabulary used consistently across:
- Code (variable names, function names, class names)
- Documentation (specs, ADRs, README)
- Conversations (meetings, Slack, emails)
- UI (labels, messages, tooltips)

**Rule:** Everyone uses these terms exactly as defined. No synonyms, no variations.

---

## Core Terms (Platform)

### Identity
**Definition:** An entity that can authenticate and perform actions in the system.

**Types:** Human, Organization, System

**NOT:** User, Account, Profile

**Usage:**
```typescript
// ✅ Correct
const identity = await identityRepository.findById(id);
if (identity.status === 'active') { ... }

// ❌ Wrong
const user = await userRepository.getUser(id);
if (user.isActive) { ... }
```

---

### Organization
**Definition:** A legal entity or group using Bella AI Platform.

**Types:** Enterprise, SME, Agency

**NOT:** Company, Business, Client

**Usage:**
```typescript
// ✅ Correct
const organization = await createOrganization({
  legal_name: 'Sunshine Realty Co., Ltd.',
  tax_code: '0123456789'
});

// ❌ Wrong
const company = await createCompany({ name: '...', taxId: '...' });
```

---

### Tenant
**Definition:** An isolated instance of an industry module.

**NOT:** Client, Account, Customer, Subscription

**Usage:**
```typescript
// ✅ Correct
const tenant = await tenantRepository.findById(tenantId);
await enforceMultiTenancy(tenant.id);

// ❌ Wrong
const client = await getClient(clientId);
const account = getAccountFromContext();
```

---

### Registration
**Definition:** A request to create a new Identity with provisioning.

**NOT:** Application, Sign-up, Onboarding

**Usage:**
```typescript
// ✅ Correct
const registration = await createRegistration({
  registration_type: 'partner',
  applicant_type: 'agency',
  full_name: '...',
  email: '...'
});

// ❌ Wrong
const application = await submitApplication({ ... });
const signup = handleSignup({ ... });
```

---

### Workflow
**Definition:** A multi-step business process with state transitions.

**NOT:** Flow, Process, Pipeline (Pipeline is for provisioning specifically)

**Usage:**
```typescript
// ✅ Correct
const workflow = await workflowEngine.start({
  workflow_type: 'approval',
  subject_id: registrationId
});

// ❌ Wrong
const flow = startFlow(registrationId);
const process = executeProcess({ ... });
```

---

### Policy
**Definition:** A configurable business rule that governs system behavior.

**NOT:** Rule (Rule is a component of Policy), Config, Setting

**Usage:**
```typescript
// ✅ Correct
const policy = await policyEngine.evaluate({
  policy_type: 'approval',
  context: { registration }
});

// ❌ Wrong
const rule = getApprovalRule(registration);
const config = loadConfig('approval');
```

---

### Package
**Definition:** A bundle of features, quotas, and pricing.

**NOT:** Plan, Subscription, Tier (Tier is a component: starter, professional, enterprise)

**Usage:**
```typescript
// ✅ Correct
const package = await packageRepository.findByKey('real_estate_professional');
const license = await assignPackage(tenantId, package.id);

// ❌ Wrong
const plan = getSubscriptionPlan('professional');
const tier = selectTier('enterprise');
```

---

### License
**Definition:** A tenant's subscription to a package.

**NOT:** Subscription, Plan, Billing (Billing is separate)

**Usage:**
```typescript
// ✅ Correct
const license = await licenseRepository.findActive(tenantId);
if (license.status === 'past_due') { ... }

// ❌ Wrong
const subscription = getActiveSubscription(tenantId);
const billing = checkBillingStatus(tenantId);
```

---

### Document
**Definition:** An uploaded file with metadata and access control.

**NOT:** File, Attachment, Upload

**Usage:**
```typescript
// ✅ Correct
const document = await documentService.upload({
  owner_type: 'registration',
  owner_id: registrationId,
  document_category: 'identification',
  file
});

// ❌ Wrong
const attachment = uploadFile(registrationId, file);
const upload = handleUpload({ ... });
```

---

### Notification
**Definition:** A message sent to an Identity via email, SMS, push, or in-app.

**NOT:** Alert (Alert is for system monitoring), Message, Email

**Usage:**
```typescript
// ✅ Correct
const notification = await notificationService.send({
  recipient_id: identityId,
  notification_type: 'email',
  template_name: 'registration_approved'
});

// ❌ Wrong
const alert = sendAlert(userId, 'approved');
const message = sendMessage({ to: email, body: '...' });
```

---

### Capability
**Definition:** A reusable platform building block.

**NOT:** Feature, Module (Module is industry-specific)

**Usage:**
```typescript
// ✅ Correct
const capabilities = ['identity', 'workflow', 'notification', 'document'];
if (hasCapability(tenantId, 'lead_rotation')) { ... }

// ❌ Wrong
const features = getEnabledFeatures(tenantId);
const modules = listModules();
```

---

### Event
**Definition:** A domain state change that has already happened.

**NOT:** Message, Notification, Action

**Usage:**
```typescript
// ✅ Correct
await eventBus.publish({
  eventType: 'IdentityApproved', // Past tense
  aggregateId: identityId,
  payload: { ... }
});

// ❌ Wrong
await messageBus.send({ type: 'ApproveIdentity' }); // Command, not event
await notify('IdentityApproval', { ... }); // Notification, not event
```

---

### Aggregate (Root)
**Definition:** A cluster of entities treated as a single unit for data changes.

**Examples:** Identity, Registration, Workflow, Package

**NOT:** Entity, Object, Model

**Usage:**
```typescript
// ✅ Correct
class Identity { // Aggregate Root
  private credentials: Credential[]; // Child entities
  private roles: Role[];
  
  addCredential(credential: Credential) {
    // Aggregate root controls access to children
    this.credentials.push(credential);
    this.publishEvent('CredentialAdded', { ... });
  }
}

// ❌ Wrong
class User {
  credentials: any[]; // Direct access, no encapsulation
}
```

---

## Identity & Access Terms

### Credential
**Definition:** An authentication method for an Identity.

**Types:** email_password, phone_otp, sso, api_key, ai_token

**NOT:** Login, Password, Auth

---

### Role
**Definition:** A collection of permissions assigned to an Identity.

**Types:** Platform roles (admin, auditor), Tenant roles (partner, employee, customer)

**NOT:** Group, Access Level, Permission Set

---

### Permission
**Definition:** Authorization to perform a specific action on a resource.

**Format:** `{resource}:{action}:{scope}`

**Example:** `booking:create:own`, `finance:approve:team`

**NOT:** Right, Access, Privilege

---

### Provisioning
**Definition:** The automated process of creating Tenant + Identity + Credentials after registration approval.

**NOT:** Setup, Creation, Onboarding

---

## Registration Terms

### Applicant
**Definition:** The person or organization applying for an Identity.

**Types:** individual, agency, company

**NOT:** User, Registrant, Candidate

---

### Verification
**Definition:** Proof of ownership of email/phone/document.

**Types:** email_verification, phone_verification, document_verification

**NOT:** Validation, Confirmation, Check

---

### Approval
**Definition:** Admin decision to accept or reject a registration.

**Outcomes:** approved, rejected, need_more_info

**NOT:** Review, Decision, Acceptance

---

### Activation
**Definition:** The final step where the applicant sets their password and logs in for the first time.

**NOT:** Initialization, First Login, Setup

---

## Workflow Terms

### Workflow Definition
**Definition:** A template for a workflow with defined steps.

**NOT:** Workflow Template, Process Template

---

### Workflow Instance
**Definition:** A running execution of a workflow for a specific entity.

**NOT:** Workflow Run, Process Instance

---

### Step
**Definition:** A unit of work in a workflow (automated or human).

**Types:** automated, human_task, decision, notification

**NOT:** Stage, Phase, Activity

---

### Task
**Definition:** A step that requires human action.

**NOT:** Action, To-Do, Assignment

---

## Document Terms

### Owner
**Definition:** The entity that owns a document (polymorphic relationship).

**Types:** identity, registration, booking, invoice, contract, organization

**NOT:** Parent, Holder, Creator

---

### Visibility
**Definition:** Who can access a document.

**Values:** private (owner only), tenant (all in tenant), public (everyone)

**NOT:** Access, Permission, Scope

---

## AI Terms

### AI Review
**Definition:** AI analysis of an entity to provide recommendations.

**NOT:** AI Decision, AI Approval, AI Scan

---

### Recommendation
**Definition:** AI's suggested action (humans make final decision).

**Values:** AUTO_APPROVE, REQUEST_MORE_INFO, MANUAL_REVIEW, AUTO_REJECT

**NOT:** Decision, Prediction, Output

---

### Feedback
**Definition:** Human correction of AI recommendation for model improvement.

**NOT:** Override, Correction, Rejection

---

### Explainability
**Definition:** The requirement that every AI decision must have human-understandable reasoning.

**NOT:** Explanation, Reason, Justification

---

## Status & State Terms

### Status
**Definition:** Current lifecycle state of an entity.

**Common Values:** draft, pending, active, suspended, archived

**NOT:** State (State is broader), Stage, Phase

---

### Lifecycle
**Definition:** The set of allowed status transitions for an entity.

**NOT:** Flow, Process, Journey

---

### State Machine
**Definition:** A formal definition of status transitions with rules.

**NOT:** Workflow, Status Flow

---

## Financial Terms

### Revenue
**Definition:** Income from confirmed sales or services.

**NOT:** Income, Sales, Earnings (use specific terms)

---

### Expense
**Definition:** Cost incurred by the business.

**NOT:** Cost (Cost is component), Spending, Outgoing

---

### Commission
**Definition:** Percentage or fixed amount paid to sales person/partner.

**NOT:** Fee, Bonus (Bonus is for performance), Incentive

---

### Salary
**Definition:** Fixed or variable compensation for employees.

**NOT:** Pay, Wage, Compensation (Compensation is broader)

---

## Industry-Specific Terms

### Real Estate

**Lead:** Potential customer (not Prospect, Inquiry)  
**Inventory:** Available units (not Stock, Listing)  
**Reservation:** Hold with deposit (not Booking, Hold)  
**Commission:** Partner earnings (not Fee, Incentive)  

---

### Beauty Spa

**Booking:** Appointment (not Reservation, Schedule)  
**Treatment:** Service performed (not Service, Procedure)  
**Session:** Service delivery instance (not Appointment, Visit)  
**KTV:** Service staff (Vietnamese term, keep as-is)  
**Membership:** Prepaid package (not Subscription, Plan)  

---

### Baby Care

**Package:** Prepaid service bundle (not Plan, Subscription)  
**Session:** Single service delivery (not Visit, Appointment)  
**Home Visit:** Service at customer location (not Session - more specific)  

---

## Anti-Patterns (Don't Use These)

| ❌ Don't Use | ✅ Use Instead | Why |
|--------------|----------------|-----|
| User | Identity | "User" is overloaded (UI user, database user, etc.) |
| Account | Tenant or Identity | Ambiguous (bank account, user account?) |
| Customer | Identity (category: customer) | Customer is a type of Identity |
| Profile | Identity.metadata | Profile is presentation, not domain |
| Login | Credential | Login is action, Credential is entity |
| Password | Credential (type: email_password) | Password is value, not entity |
| Config | Policy or Settings | Config is too generic |
| Setting | Tenant.settings (JSONB) | Use specific field or metadata |
| Data | Specific term (e.g., metadata, context, payload) | "Data" is meaningless |
| Info | Specific term | "Info" is too vague |
| Item | Specific entity name | "Item" is placeholder, not domain term |
| Record | Entity or Row | "Record" is database term, not domain |
| Object | Entity, Value Object, or specific name | OOP term, not domain |
| Model | Entity, Aggregate, or Domain Model | Too generic |
| Entity | Specific name (Identity, Registration, etc.) | Use actual name |
| Thing | Specific name | Never use "Thing" |

---

## Naming Conventions

### Database Tables
**Format:** `snake_case`, plural

**Examples:**
- `identities` (not `users`)
- `registrations` (not `applications`)
- `workflow_definitions` (not `workflows`)
- `workflow_instances` (not `workflow_runs`)

---

### TypeScript Types
**Format:** `PascalCase`, singular

**Examples:**
```typescript
interface Identity { ... }
interface Registration { ... }
interface WorkflowDefinition { ... }
```

---

### Events
**Format:** `PascalCase`, past tense

**Examples:**
- `IdentityCreated` (not `CreateIdentity`, `IdentityCreate`)
- `RegistrationApproved` (not `ApproveRegistration`)
- `WorkflowCompleted` (not `CompleteWorkflow`)

---

### API Endpoints
**Format:** `kebab-case`, REST-ful

**Examples:**
- `GET /api/v1/identities`
- `POST /api/v1/registrations`
- `GET /api/v1/workflow-instances/:id`

---

### Functions/Methods
**Format:** `camelCase`, verb + noun

**Examples:**
```typescript
// ✅ Correct
createIdentity()
approveRegistration()
provisionTenant()

// ❌ Wrong
identityCreate()
doApproval()
tenantProvisioning()
```

---

## Glossary Summary

### A
- **Activation:** Final step of registration (password setup)
- **Aggregate:** Cluster of entities with single root
- **AI Review:** AI analysis with recommendation
- **Applicant:** Person/org applying for Identity
- **Approval:** Admin decision on registration
- **Approval:** Admin decision on registration

### C
- **Capability:** Reusable platform building block
- **Commission:** Earnings for sales/partner
- **Credential:** Authentication method

### D
- **Document:** Uploaded file with metadata

### E
- **Event:** Domain state change (past tense)
- **Explainability:** AI reasoning requirement

### I
- **Identity:** Entity that can authenticate
- **Instance:** Running workflow execution

### L
- **License:** Tenant's package subscription
- **Lifecycle:** Allowed status transitions

### N
- **Notification:** Message to Identity

### O
- **Organization:** Legal entity using platform
- **Owner:** Entity owning a document

### P
- **Package:** Bundle of features + pricing
- **Permission:** Authorization to act on resource
- **Policy:** Configurable business rule
- **Provisioning:** Automated tenant + identity creation

### R
- **Recommendation:** AI's suggested action
- **Registration:** Identity creation request
- **Role:** Collection of permissions

### S
- **Status:** Current entity state
- **Step:** Unit of work in workflow

### T
- **Task:** Human-required workflow step
- **Tenant:** Isolated industry instance

### V
- **Verification:** Proof of ownership
- **Visibility:** Document access scope

### W
- **Workflow:** Multi-step business process

---

## Enforcement

### Code Review Checklist
- [ ] All variables use ubiquitous language
- [ ] No synonyms or variations used
- [ ] Events are past tense
- [ ] Database tables match naming conventions
- [ ] API endpoints are REST-ful
- [ ] Functions are verb + noun

### Automated Linting (Future)
```javascript
// ESLint rule example
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Identifier[name=/^(user|account|customer|profile)$/i]",
        "message": "Use 'Identity' instead of user/account/customer/profile"
      }
    ]
  }
}
```

---

## Related Documents

- [Domain Model](./DOMAIN_MODEL.md)
- [Bounded Contexts](./BOUNDED_CONTEXTS.md)
- [Architecture Constitution](../01-architecture/ARCHITECTURE_CONSTITUTION.md)

---

**"One language, one platform, one truth."**
