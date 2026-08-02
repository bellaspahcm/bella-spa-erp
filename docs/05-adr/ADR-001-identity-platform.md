# ADR-001: Identity Platform Architecture

**Status:** APPROVED  
**Date:** 2026-08-02  
**Decision Makers:** Chief Architect, Platform Team Lead  
**Consulted:** Security Team, Product Team  
**Informed:** All Engineering Teams

---

## Context

Bella AI Platform aims to serve multiple industries (Real Estate, Baby Care, Beauty Spa, Healthcare, Retail, etc.) and multiple user types (Partners, Employees, Customers, Suppliers, Vendors, Affiliates, Franchises, AI Employees).

Currently, each module (Baby Care, Beauty Spa) has its own user management:
- `baby_care_employees`
- `spa_staff`
- `spa_customers`

This creates:
- **Data duplication** - Same person exists in multiple tables
- **Inconsistent auth** - Different login flows per module
- **Permission chaos** - No unified access control
- **Integration hell** - Cross-module features require complex joins

**Question:** How do we unify identity management across all industries and user types?

---

## Decision

We will build an **Identity Platform** as the **root aggregate** for all personas in Bella AI Platform.

### Core Concept: Identity ≠ User

**Identity** is an abstract entity that can represent:
- Human (Partner, Employee, Customer, Supplier, Vendor, Consultant, Freelancer)
- Organization (Agency, Company, Branch, Franchise)
- System (AI Employee, Service Account, API Client, Integration)

**User** is a specific implementation of Identity with authentication credentials.

---

## Architecture

### Entity Model

```
Identity (Root Aggregate)
  ├── id: uuid (PK)
  ├── identity_type: enum ('human', 'organization', 'system')
  ├── identity_category: enum ('partner', 'employee', 'customer', 'supplier', 'vendor', 'affiliate', 'franchise', 'ai_employee', 'service_account')
  ├── display_name: string
  ├── legal_name: string (nullable, for organizations)
  ├── metadata: jsonb (extensible attributes)
  ├── status: enum ('draft', 'pending_verification', 'active', 'suspended', 'archived')
  ├── created_at: timestamp
  ├── updated_at: timestamp
  └── deleted_at: timestamp (soft delete)

Credential (Value Object)
  ├── identity_id: uuid (FK)
  ├── credential_type: enum ('email_password', 'phone_otp', 'sso', 'api_key', 'ai_token')
  ├── credential_value: encrypted
  ├── verified_at: timestamp
  ├── expires_at: timestamp
  └── last_used_at: timestamp

Role (Entity)
  ├── id: uuid
  ├── role_type: enum ('platform', 'tenant', 'custom')
  ├── role_name: string ('admin', 'partner', 'employee', 'ktv', 'accountant', ...)
  ├── tenant_id: uuid (nullable, for tenant-specific roles)
  └── permissions: jsonb

Permission (Value Object)
  ├── resource: string ('identity', 'booking', 'finance', 'inventory')
  ├── action: string ('create', 'read', 'update', 'delete', 'approve')
  ├── scope: string ('own', 'team', 'tenant', 'all')
  └── conditions: jsonb (optional, e.g., "amount < 1000000")

IdentityRole (Join Table)
  ├── identity_id: uuid
  ├── role_id: uuid
  ├── assigned_by: uuid
  ├── assigned_at: timestamp
  └── expires_at: timestamp (nullable, for temporary roles)
```

---

## Usage Examples

### Example 1: Real Estate Partner (Agency)

```typescript
// Create Identity
const agencyIdentity = await createIdentity({
  identity_type: 'organization',
  identity_category: 'partner',
  display_name: 'Sunshine Realty',
  legal_name: 'Công ty TNHH Sunshine Realty',
  metadata: {
    industry: 'real_estate',
    tax_code: '0123456789',
    business_license: 'BL-2024-001',
    contact_person: 'Nguyễn Văn A',
    phone: '+84901234567',
    email: 'contact@sunshine-realty.com'
  },
  status: 'pending_verification'
});

// Create Credential (after verification)
await createCredential({
  identity_id: agencyIdentity.id,
  credential_type: 'email_password',
  credential_value: {
    email: 'contact@sunshine-realty.com',
    password_hash: '...'
  }
});

// Assign Role
await assignRole({
  identity_id: agencyIdentity.id,
  role_name: 'real_estate_partner',
  tenant_id: realEstateTenantId
});
```

### Example 2: Beauty Spa Employee (KTV)

```typescript
const ktvIdentity = await createIdentity({
  identity_type: 'human',
  identity_category: 'employee',
  display_name: 'Trần Thị B',
  metadata: {
    industry: 'beauty_spa',
    employee_code: 'KTV-001',
    cccd: '001234567890',
    phone: '+84987654321',
    hire_date: '2024-01-15',
    position: 'senior_ktv'
  },
  status: 'active'
});

await assignRole({
  identity_id: ktvIdentity.id,
  role_name: 'ktv',
  tenant_id: spaТенantId
});
```

### Example 3: AI Employee

```typescript
const aiIdentity = await createIdentity({
  identity_type: 'system',
  identity_category: 'ai_employee',
  display_name: 'AI Accountant',
  metadata: {
    model: 'gpt-4',
    capabilities: ['invoice_processing', 'expense_categorization', 'reconciliation'],
    version: '2.1.0'
  },
  status: 'active'
});

await createCredential({
  identity_id: aiIdentity.id,
  credential_type: 'ai_token',
  credential_value: { api_key: '...' }
});

await assignRole({
  identity_id: aiIdentity.id,
  role_name: 'ai_accountant',
  tenant_id: tenantId
});
```

---

## Benefits

### ✅ Unified Identity Management
- Single source of truth for all personas
- Consistent authentication & authorization
- Simplified user management across industries

### ✅ Cross-Industry Reusability
- Same Identity platform for Real Estate, Spa, Baby Care, Healthcare, Retail
- No need to build separate user systems per industry
- Faster time-to-market for new industries

### ✅ Flexible Role System
- Platform roles (admin, auditor)
- Tenant roles (partner, employee, customer)
- Custom roles (defined by industry modules)

### ✅ Extensible Metadata
- Industry-specific attributes in JSONB
- No schema changes needed for new industries
- Supports complex organizational hierarchies

### ✅ Future-Proof
- Ready for AI Employees
- Ready for Service Accounts (API integrations)
- Ready for Federated Identity (SSO)

---

## Trade-offs

### ⚠️ Higher Initial Complexity
- More abstract than simple `users` table
- Requires understanding of Identity concepts
- Steeper learning curve for developers

**Mitigation:** Comprehensive documentation, code examples, helper functions.

### ⚠️ Performance Overhead
- Joins between `identities`, `credentials`, `roles`, `permissions`
- Potentially slower than denormalized user tables

**Mitigation:** Indexed foreign keys, caching, materialized views for common queries.

### ⚠️ Migration Effort
- Existing `spa_staff`, `baby_care_employees` must be migrated
- Legacy code must be refactored

**Mitigation:** Phased migration, run old and new systems in parallel, gradual cutover.

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Create `identities`, `credentials`, `roles`, `permissions`, `identity_roles` tables
- [ ] Implement RLS policies
- [ ] Create TypeScript types
- [ ] Build helper functions (`createIdentity`, `assignRole`, `checkPermission`)

### Phase 2: Registration Integration (Week 3-4)
- [ ] Refactor Partner Registration to use Identity Platform
- [ ] Migrate `partner_applications` to `identity_registrations`
- [ ] Update Provisioning Pipeline to create Identity first

### Phase 3: Migration (Week 5-8)
- [ ] Migrate `spa_staff` to `identities` (category: 'employee', industry: 'beauty_spa')
- [ ] Migrate `baby_care_employees` to `identities`
- [ ] Migrate `spa_customers` to `identities` (category: 'customer')
- [ ] Update all foreign keys to reference `identities.id` instead of legacy tables

### Phase 4: Deprecation (Week 9-12)
- [ ] Mark legacy tables as deprecated
- [ ] Add database views for backward compatibility
- [ ] Update all queries to use Identity Platform
- [ ] Remove legacy tables (after 3 months deprecation period)

---

## Security Considerations

### ✅ Credential Encryption
- Passwords: bcrypt with cost factor 12
- API keys: AES-256 encryption at rest
- AI tokens: Vault storage with rotation policy

### ✅ Multi-Factor Authentication (MFA)
- Support for TOTP (Time-based One-Time Password)
- Support for SMS OTP
- Support for Email OTP

### ✅ Session Management
- JWT tokens with 1-hour expiry
- Refresh tokens with 30-day expiry
- Device fingerprinting for suspicious activity detection

### ✅ Audit Logging
- Log all authentication attempts (success & failure)
- Log all credential changes (password reset, API key rotation)
- Log all role assignments & permission changes

---

## Testing Strategy

### Unit Tests
- Identity creation with various types
- Credential validation
- Permission checking logic
- Role assignment rules

### Integration Tests
- End-to-end registration → provisioning → login flow
- Multi-tenant isolation (Identity A cannot access Tenant B data)
- Role-based access control enforcement

### Performance Tests
- 10,000 concurrent authentication requests
- Permission check latency < 50ms (p95)
- Identity search query < 100ms (p95)

---

## Alternatives Considered

### Alternative 1: Separate User Tables Per Industry
**Rejected Reason:** Leads to data duplication, inconsistent auth, integration hell.

### Alternative 2: Single `users` Table with `user_type` Column
**Rejected Reason:** Not extensible enough. Cannot handle organizations, AI employees, complex hierarchies.

### Alternative 3: Third-Party Identity Provider (Auth0, Okta)
**Rejected Reason:** 
- High cost at scale (thousands of partners, employees, customers)
- Limited customization for industry-specific needs
- Vendor lock-in

**Note:** We can integrate third-party IdP via SSO later, but core Identity Platform remains internal.

---

## Compliance & Standards

### ✅ GDPR Compliance
- Soft delete (retain data for compliance period)
- Data export API (user can request their data)
- Data deletion API (right to be forgotten)

### ✅ ISO 27001
- Access control based on principle of least privilege
- Audit logging of all identity operations
- Encryption at rest and in transit

### ✅ OAuth 2.0 / OpenID Connect
- Identity Platform can act as OAuth provider
- Support authorization code flow, client credentials flow
- Issue JWT access tokens

---

## Metrics & Monitoring

### KPIs
- Identity creation rate (per day)
- Authentication success rate (> 99.9%)
- Permission check latency (< 50ms p95)
- Account lockout rate (< 0.1%)

### Alerts
- ⚠️ High failed login rate (> 5% in 5 min)
- ⚠️ Unusual identity creation spike (> 100 in 1 hour)
- ⚠️ Permission check latency > 100ms
- ⚠️ Credential leak detected (password in logs, API key exposed)

---

## Related ADRs

- [ADR-002: Registration Type Abstraction](./ADR-002-registration-abstraction.md)
- [ADR-004: Event-Driven Architecture](./ADR-004-event-driven-architecture.md)
- [ADR-005: Provisioning Architecture](./ADR-005-provisioning-architecture.md)
- [ADR-010: Domain Model](./ADR-010-domain-model.md)

---

## Approval

- [x] **Chief Architect:** Approved - 2026-08-02
- [x] **Platform Team Lead:** Approved - 2026-08-02
- [x] **Security Team:** Approved - 2026-08-02
- [x] **Product Team:** Approved - 2026-08-02

---

**Decision:** APPROVED  
**Effective Date:** 2026-08-02  
**Review Date:** 2026-11-02 (Quarterly)

---

**"Identity is not User. Identity is the root of all personas."**
