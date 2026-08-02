# Bella AI Platform - Domain Model

**Version:** 1.0  
**Last Updated:** 2026-08-02  
**Owner:** Chief Architect, Domain Experts

---

## Purpose

This document defines the **complete domain model** for Bella AI Platform, including:
- All entities and their attributes
- Relationships and cardinality
- Business rules and invariants
- State machines and lifecycles

**This is the single source of truth for domain structure.**

---

## 1. Identity Aggregate

### Identity (Root)

**Definition:** An entity that can authenticate and perform actions in the system.

**Attributes:**
```typescript
interface Identity {
  // Primary Key
  id: UUID;
  
  // Classification
  identity_type: 'human' | 'organization' | 'system';
  identity_category: 'partner' | 'employee' | 'customer' | 'supplier' | 'vendor' | 'affiliate' | 'franchise' | 'ai_employee' | 'service_account';
  
  // Basic Info
  display_name: string;
  legal_name: string | null;
  
  // Contact
  email: string | null;
  phone: string | null;
  
  // Organization
  organization_id: UUID | null;
  
  // Status
  status: 'draft' | 'pending_verification' | 'active' | 'suspended' | 'archived';
  
  // Extensibility
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
  created_by: UUID | null;
  updated_by: UUID | null;
}
```

**Business Rules:**
1. **Uniqueness:** Email must be unique across active identities
2. **Immutability:** `identity_type` cannot change after creation
3. **Soft Delete:** Use `deleted_at`, never hard delete
4. **Status Transition:** Must follow state machine (see below)

**State Machine:**
```
draft → pending_verification → active
  ↓           ↓                    ↓
archived   archived         suspended → active
                                 ↓
                             archived
```

---

### Credential (Value Object)

**Definition:** Authentication method for an Identity.

**Attributes:**
```typescript
interface Credential {
  // Keys
  id: UUID;
  identity_id: UUID; // FK → identities.id
  
  // Type
  credential_type: 'email_password' | 'phone_otp' | 'sso' | 'api_key' | 'ai_token';
  
  // Value (encrypted)
  credential_value: string; // bcrypt hash, encrypted token, etc.
  
  // Status
  verified_at: Timestamp | null;
  expires_at: Timestamp | null;
  last_used_at: Timestamp | null;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  revoked_at: Timestamp | null;
}
```

**Business Rules:**
1. Identity can have multiple credentials (email + phone)
2. At least one credential must be verified for status = 'active'
3. Expired credentials cannot authenticate
4. Revoked credentials are soft-deleted

---

### Role Assignment (Entity)

**Definition:** Maps Identity to Role with optional expiration.

**Attributes:**
```typescript
interface IdentityRole {
  // Keys
  id: UUID;
  identity_id: UUID; // FK → identities.id
  role_id: UUID; // FK → roles.id
  
  // Scope
  tenant_id: UUID | null; // Tenant-specific role
  
  // Lifecycle
  assigned_by: UUID; // FK → identities.id
  assigned_at: Timestamp;
  expires_at: Timestamp | null; // Temporary role
  revoked_at: Timestamp | null;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Business Rules:**
1. Identity can have multiple roles
2. Platform roles (admin, auditor) have `tenant_id = NULL`
3. Tenant roles (partner, employee) must have `tenant_id`
4. Expired roles are automatically revoked

---

## 2. Organization Aggregate

### Organization (Root)

**Definition:** A legal entity or group using Bella AI Platform.

**Attributes:**
```typescript
interface Organization {
  // Primary Key
  id: UUID;
  
  // Classification
  organization_type: 'enterprise' | 'sme' | 'agency';
  
  // Legal Info
  legal_name: string;
  tax_code: string; // Unique
  business_license: string | null;
  
  // Contact
  primary_contact_id: UUID | null; // FK → identities.id
  email: string;
  phone: string;
  address: string | null;
  
  // Hierarchy
  parent_organization_id: UUID | null; // For branches, franchises
  
  // Status
  status: 'active' | 'suspended' | 'archived';
  
  // Extensibility
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
```

**Business Rules:**
1. **Uniqueness:** Tax code must be unique
2. **Hierarchy:** Max 3 levels (HQ → Region → Branch)
3. **Status Cascade:** Suspending parent suspends all children
4. **Cannot Delete:** Organization with active tenants cannot be deleted

---

### Tenant (Entity)

**Definition:** An isolated instance of an industry module.

**Attributes:**
```typescript
interface Tenant {
  // Primary Key
  id: UUID;
  
  // Ownership
  organization_id: UUID; // FK → organizations.id
  
  // Module
  industry_module: 'real_estate' | 'beauty_spa' | 'baby_care' | 'healthcare' | 'retail' | 'education' | 'logistics' | 'hospitality' | 'professional_services' | 'manufacturing';
  tenant_name: string;
  
  // Configuration
  settings: JSONB;
  
  // Status
  status: 'active' | 'trial' | 'suspended' | 'archived';
  trial_ends_at: Timestamp | null;
  
  // Extensibility
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
```

**Business Rules:**
1. **One tenant per organization per industry** (e.g., one Real Estate tenant)
2. **Multi-tenant isolation:** RLS enforced on all tenant data
3. **Trial Period:** 30 days default, then requires paid license
4. **Status Transition:** `trial` → `active` (payment) or `archived` (expired)

---

## 3. Registration Aggregate

### Registration (Root)

**Definition:** A request to create a new Identity with provisioning.

**Attributes:**
```typescript
interface Registration {
  // Primary Key
  id: UUID;
  
  // Type
  registration_type: 'partner' | 'employee' | 'customer' | 'supplier' | 'vendor';
  applicant_type: 'individual' | 'agency' | 'company';
  
  // Applicant Info
  full_name: string;
  email: string;
  phone: string;
  company_name: string | null; // For organization
  tax_code: string | null;
  
  // Documents
  documents: JSONB; // Array of {type, url, uploaded_at}
  
  // Verification
  email_verified_at: Timestamp | null;
  email_verification_token: string | null;
  phone_verified_at: Timestamp | null;
  
  // Status
  status: 'draft' | 'pending_verification' | 'need_more_info' | 'approved' | 'rejected' | 'provisioned' | 'activated';
  
  // Review
  submitted_at: Timestamp | null;
  approved_at: Timestamp | null;
  approved_by: UUID | null; // FK → identities.id
  approval_notes: string | null;
  rejected_at: Timestamp | null;
  rejection_reason: string | null;
  
  // Provisioning Result
  organization_id: UUID | null; // FK → organizations.id
  tenant_id: UUID | null; // FK → tenants.id
  identity_id: UUID | null; // FK → identities.id
  
  // Activation
  activation_token: string | null;
  activation_token_expires_at: Timestamp | null;
  activated_at: Timestamp | null;
  
  // Extensibility
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  ip_address: string | null;
  user_agent: string | null;
}
```

**Status Lifecycle:**
```
draft
  ↓ (submit)
pending_verification
  ↓ (verify email)
  ├─→ need_more_info (admin requests more)
  │     ↓ (resubmit)
  │   pending_verification
  ↓ (admin reviews)
  ├─→ approved
  │     ↓ (provisioning)
  │   provisioned
  │     ↓ (password setup)
  │   activated ✅
  │
  └─→ rejected ❌
```

**Business Rules:**
1. **Email Verification Required:** Cannot approve without `email_verified_at`
2. **Document Requirements:** Based on applicant_type (policy-driven)
3. **Approval Authority:** Only admin role can approve
4. **Activation Token TTL:** 72 hours, one-time use
5. **Immutable After Activation:** Cannot modify after `activated_at` set

---

## 4. Workflow Aggregate

### Workflow Definition (Root)

**Definition:** Template for a multi-step process.

**Attributes:**
```typescript
interface WorkflowDefinition {
  // Primary Key
  id: UUID;
  
  // Identification
  workflow_type: 'approval' | 'operational' | 'notification';
  workflow_name: string;
  workflow_key: string; // Unique, e.g., 'partner_registration_approval'
  
  // Version
  version: number;
  is_active: boolean;
  
  // Definition
  steps: JSONB; // Array of {step_name, order, type, config}
  
  // Metadata
  description: string | null;
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: UUID | null;
}
```

**Example Steps:**
```json
{
  "steps": [
    {
      "step_name": "ai_review",
      "order": 1,
      "type": "automated",
      "config": {
        "model": "fraud-detection-v2.1",
        "threshold": 0.8
      }
    },
    {
      "step_name": "admin_review",
      "order": 2,
      "type": "human_task",
      "config": {
        "assignee_role": "admin",
        "sla_hours": 24
      }
    },
    {
      "step_name": "notify_result",
      "order": 3,
      "type": "notification",
      "config": {
        "template": "registration_approved"
      }
    }
  ]
}
```

---

### Workflow Instance (Entity)

**Definition:** Execution of a workflow for a specific entity.

**Attributes:**
```typescript
interface WorkflowInstance {
  // Primary Key
  id: UUID;
  
  // Definition
  workflow_definition_id: UUID; // FK → workflow_definitions.id
  workflow_version: number;
  
  // Subject
  subject_type: string; // 'registration', 'expense', 'leave'
  subject_id: UUID;
  
  // State
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  current_step: string | null;
  
  // Context
  context: JSONB; // Data passed between steps
  
  // Timing
  started_at: Timestamp;
  completed_at: Timestamp | null;
  failed_at: Timestamp | null;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  tenant_id: UUID; // FK → tenants.id
}
```

**Business Rules:**
1. **Version Lock:** Use workflow version at start, ignore later changes
2. **Context Immutability:** Context grows (append-only), never modified
3. **Idempotency:** Can retry failed instances safely

---

## 5. Package Aggregate

### Package (Root)

**Definition:** A bundle of features, quotas, and pricing.

**Attributes:**
```typescript
interface Package {
  // Primary Key
  id: UUID;
  
  // Identification
  package_name: string;
  package_tier: 'starter' | 'professional' | 'enterprise';
  package_key: string; // Unique, e.g., 'real_estate_professional'
  
  // Module
  industry_module: string | null; // NULL = cross-industry
  
  // Pricing
  pricing: JSONB; // {monthly: 2000000, annual: 20000000, currency: 'VND'}
  
  // Quotas
  quotas: JSONB; // {max_users: 20, max_locations: 5, max_storage_gb: 100}
  
  // Features
  features: string[]; // Array of feature flags
  enabled_modules: string[]; // Array of module keys
  
  // Status
  is_active: boolean;
  is_public: boolean; // Shown in pricing page
  
  // Metadata
  description: string | null;
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Example Package:**
```json
{
  "package_name": "Real Estate Professional",
  "package_tier": "professional",
  "package_key": "real_estate_professional",
  "industry_module": "real_estate",
  "pricing": {
    "monthly": 2000000,
    "annual": 20000000,
    "currency": "VND"
  },
  "quotas": {
    "max_users": 20,
    "max_locations": 5,
    "max_storage_gb": 100,
    "max_leads_per_month": 500
  },
  "features": [
    "lead_rotation",
    "ai_review",
    "commission_calculation",
    "inventory_management",
    "document_management"
  ],
  "enabled_modules": [
    "lead",
    "inventory",
    "commission",
    "document",
    "analytics"
  ]
}
```

---

### License (Entity)

**Definition:** Tenant's subscription to a package.

**Attributes:**
```typescript
interface License {
  // Primary Key
  id: UUID;
  
  // Ownership
  tenant_id: UUID; // FK → tenants.id
  package_id: UUID; // FK → packages.id
  
  // Billing
  billing_cycle: 'monthly' | 'annual';
  billing_amount: number;
  billing_currency: string;
  
  // Period
  starts_at: Timestamp;
  ends_at: Timestamp | null; // NULL = ongoing
  trial_ends_at: Timestamp | null;
  
  // Status
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  
  // Usage
  current_usage: JSONB; // {users: 15, locations: 3, storage_gb: 45}
  
  // Auto-Renewal
  auto_renew: boolean;
  cancelled_at: Timestamp | null;
  cancellation_reason: string | null;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Business Rules:**
1. **Quota Enforcement:** Check usage before allowing actions
2. **Grace Period:** 7 days past_due before suspension
3. **Cancellation:** End of current billing period, not immediate
4. **Upgrade:** Immediate, prorated credit
5. **Downgrade:** End of current billing period

---

## 6. Policy Aggregate

### Policy (Root)

**Definition:** Configurable business rule.

**Attributes:**
```typescript
interface Policy {
  // Primary Key
  id: UUID;
  
  // Identification
  policy_type: 'validation' | 'approval' | 'pricing' | 'rotation' | 'notification';
  policy_name: string;
  policy_key: string; // Unique
  
  // Scope
  tenant_id: UUID | null; // NULL = platform-level
  industry_module: string | null;
  
  // Definition
  conditions: JSONB; // Array of {field, operator, value}
  actions: JSONB; // Array of {action, params}
  priority: number; // Lower = higher priority
  
  // Status
  is_active: boolean;
  
  // Version
  version: number;
  
  // Metadata
  description: string | null;
  metadata: JSONB;
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: UUID | null;
}
```

**Example Policy: Auto-Approve Low-Risk Partners**
```json
{
  "policy_type": "approval",
  "policy_name": "Auto-Approve Low-Risk Partners",
  "policy_key": "partner_auto_approve_low_risk",
  "conditions": [
    {"field": "fraud_score", "operator": "lte", "value": 0.2},
    {"field": "risk_score", "operator": "lte", "value": 0.3},
    {"field": "documents_complete", "operator": "eq", "value": true},
    {"field": "email_verified", "operator": "eq", "value": true}
  ],
  "actions": [
    {"action": "approve", "params": {"auto": true}},
    {"action": "notify", "params": {"recipients": ["admin@company.com"]}}
  ],
  "priority": 10
}
```

**Business Rules:**
1. **Evaluation Order:** Sort by priority, first match wins
2. **Versioning:** New version creates new record, old stays active for running workflows
3. **Tenant Override:** Tenant policy overrides platform policy

---

## 7. Document Aggregate

### Document (Root)

**Definition:** A file uploaded to the system.

**Attributes:**
```typescript
interface Document {
  // Primary Key
  id: UUID;
  
  // Owner (Polymorphic)
  owner_type: 'identity' | 'registration' | 'booking' | 'invoice' | 'contract' | 'organization';
  owner_id: UUID;
  
  // Classification
  document_category: 'identification' | 'business_license' | 'contract' | 'invoice' | 'receipt' | 'report' | 'other';
  document_subcategory: string | null; // e.g., 'cccd_front', 'cccd_back'
  
  // File Info
  file_name: string;
  file_size: bigint; // bytes
  file_type: string; // MIME type
  storage_path: string; // Supabase Storage path
  
  // Access Control
  visibility: 'private' | 'tenant' | 'public';
  
  // Metadata
  description: string | null;
  tags: string[];
  metadata: JSONB;
  
  // AI Analysis
  ai_extracted_data: JSONB | null; // OCR, classification results
  ai_authenticity_score: number | null; // 0-1
  
  // Audit
  uploaded_by: UUID; // FK → identities.id
  uploaded_at: Timestamp;
  deleted_at: Timestamp | null; // Soft delete
  tenant_id: UUID; // FK → tenants.id
}
```

**Business Rules:**
1. **Access Control:** RLS based on `visibility` and `tenant_id`
2. **Virus Scan:** All uploads scanned before storage
3. **Retention:** Cannot delete documents for 7 years (compliance)
4. **Versioning:** Create new document record, link via `metadata.previous_version_id`

---

## 8. Notification Aggregate

### Notification (Root)

**Definition:** A message sent to an Identity.

**Attributes:**
```typescript
interface Notification {
  // Primary Key
  id: UUID;
  
  // Recipient
  recipient_id: UUID; // FK → identities.id
  
  // Channel
  notification_type: 'email' | 'sms' | 'push' | 'in_app';
  
  // Content
  template_name: string | null;
  subject: string | null; // For email
  body: string;
  data: JSONB; // Template variables
  
  // Delivery
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  sent_at: Timestamp | null;
  delivered_at: Timestamp | null;
  read_at: Timestamp | null;
  
  // Error
  error_message: string | null;
  retry_count: number;
  
  // Priority
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Audit
  created_at: Timestamp;
  updated_at: Timestamp;
  tenant_id: UUID; // FK → tenants.id
}
```

**Business Rules:**
1. **Retry Policy:** Max 3 retries with exponential backoff
2. **Rate Limiting:** Max 10 emails/hour per recipient
3. **Preference:** Respect user notification preferences
4. **Dead Letter Queue:** Failed after 3 retries → DLQ

---

## Relationships Summary

```
Organization (1) ──┬── (M) Tenant
                   └── (M) Identity

Identity (1) ──┬── (M) Credential
               ├── (M) IdentityRole
               └── (M) Registration

Tenant (1) ──┬── (M) License
             ├── (M) Policy (tenant-specific)
             └── (M) Document

Registration (1) ──┬── (M) Document
                   ├── (1) Organization (created)
                   ├── (1) Tenant (created)
                   └── (1) Identity (created)

WorkflowDefinition (1) ──── (M) WorkflowInstance

Package (1) ──── (M) License

Policy (evaluated for) ──── (M) Registration, Workflow, etc.

Document (owned by) ──── (1) Identity | Registration | Booking | etc.

Notification (sent to) ──── (1) Identity
```

---

## Related Documents

- [ADR-010: Domain Model](../05-adr/ADR-010-domain-model.md)
- [Bounded Contexts](./BOUNDED_CONTEXTS.md)
- [Ubiquitous Language](./UBIQUITOUS_LANGUAGE.md)
- [Capability Map](../02-capabilities/CAPABILITY_MAP.md)

---

**"One domain model, one platform, one truth."**
