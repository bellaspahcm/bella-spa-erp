# Partner Registration & Approval System - Technical Specification

**Document Version:** 1.0  
**Created:** 2026-08-02  
**Status:** Draft for Review  
**Architecture:** Enterprise B2B Hybrid Approval Model

---

## Executive Summary

This specification defines a **hybrid partner registration and approval system** for Bella ERP's multi-industry platform. The system balances **self-service registration** with **enterprise-grade verification**, preventing spam while enabling scalability.

### Business Context

- **Industry:** Real Estate, Baby Care, Beauty Spa, Clean Pro, and future verticals
- **User Type:** Brokers, Agencies, Distributors, Freelancers, Affiliates, Resellers
- **Scale:** Designed for 1,000+ partners per tenant
- **Security:** Enterprise-grade approval workflow with document verification

### Why Hybrid Model?

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Public Registration (Option A)** | Easy onboarding | Spam, fake accounts, no control | ❌ Not enterprise-grade |
| **Admin-Only Creation (Option B)** | Secure, controlled | Doesn't scale, manual overhead | ❌ Bottleneck |
| **Hybrid Approval (Option C)** | Self-service + verification | Requires workflow engine | ✅ **SELECTED** |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PARTNER REGISTRATION FLOW                 │
└─────────────────────────────────────────────────────────────┘

    Public User → /partner/register
           ↓
    Fill Registration Form
           ↓
    Email Verification Link
           ↓
    Upload Documents (CCCD, License, Company)
           ↓
    Status: PENDING_VERIFICATION
           ↓
    Admin Notification (Email + Dashboard)
           ↓
    Admin Review (/dashboard/admin/partner-approvals)
           ↓
    ┌─────────────┬──────────────────┐
    ↓             ↓                  ↓
  APPROVE    REQUEST_INFO        REJECT
    ↓             ↓                  ↓
  Create      Partner fixes     Archive
  Tenant      & resubmits
  + User
  + Role
    ↓
  Send Activation Email
    ↓
  Partner Sets Password
    ↓
  Login to Partner Portal
    ↓
  Status: ACTIVE
```



---

## Core Components

### 1. Database Schema

#### Table: `partner_applications`

```sql
CREATE TABLE partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Application Status
  status TEXT NOT NULL DEFAULT 'draft',
    -- Values: draft, pending_verification, need_more_info, 
    --         approved, active, suspended, rejected, archived
  
  -- Applicant Information
  applicant_type TEXT NOT NULL,
    -- Values: individual_broker, agency, distributor, 
    --         freelancer, affiliate, reseller
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  
  -- Business Information
  company_name TEXT,
  business_license_number TEXT,
  tax_code TEXT,
  address TEXT,
  city TEXT,
  district TEXT,
  ward TEXT,
  
  -- Document Uploads
  documents JSONB DEFAULT '[]'::jsonb,
    -- [{ type: 'cccd_front', url: '...', uploaded_at: '...' }]
  
  -- Verification
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token TEXT,
  email_verified_at TIMESTAMPTZ,

  
  -- Approval Workflow
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- Provisioned Resources (after approval)
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_phone CHECK (phone ~* '^\+?[0-9]{10,15}$')
);

CREATE INDEX idx_partner_applications_status ON partner_applications(status);
CREATE INDEX idx_partner_applications_email ON partner_applications(email);
CREATE INDEX idx_partner_applications_created_at ON partner_applications(created_at DESC);
```

#### ENUM: `partner_application_status`

```sql
CREATE TYPE partner_application_status AS ENUM (
  'draft',               -- Initial state, incomplete form
  'pending_verification',-- Submitted, awaiting admin review
  'need_more_info',      -- Admin requested additional documents
  'approved',            -- Admin approved, provisioning in progress
  'active',              -- Fully provisioned, partner can login
  'suspended',           -- Temporarily disabled
  'rejected',            -- Application denied
  'archived'             -- Soft-deleted
);
```



---

### 2. Public Registration Page

**Route:** `/partner/register`

**Features:**
- ✅ Public access (no login required)
- ✅ Multi-step form wizard
- ✅ Real-time validation
- ✅ Email verification required
- ✅ Document upload (CCCD, Business License, Company Registration)
- ✅ Terms & Conditions acceptance
- ✅ CAPTCHA (optional, for spam prevention)

**Form Steps:**

#### Step 1: Basic Information
```typescript
{
  applicant_type: 'individual_broker' | 'agency' | 'distributor' | 'freelancer',
  full_name: string,
  email: string,
  phone: string,
}
```

#### Step 2: Business Information (if applicable)
```typescript
{
  company_name: string,
  business_license_number: string,
  tax_code: string,
  address: string,
  city: string,
  district: string,
  ward: string,
}
```

#### Step 3: Document Upload
```typescript
{
  documents: [
    { type: 'cccd_front', file: File },
    { type: 'cccd_back', file: File },
    { type: 'business_license', file: File },      // For agencies
    { type: 'company_registration', file: File },  // For agencies
  ]
}
```



#### Step 4: Review & Submit
- Show summary of all information
- Terms & Conditions checkbox
- Submit button → Status: `pending_verification`
- Send email verification link

**UI Design:**
- Mobile-first responsive
- Progress indicator (1/4, 2/4, 3/4, 4/4)
- Save draft functionality (comeback later)
- Clear error messages
- Success animation on submit

**API Endpoints:**
```typescript
POST /api/partner/register/draft        // Save draft
POST /api/partner/register/submit       // Submit for review
POST /api/partner/register/upload       // Upload document
GET  /api/partner/register/verify       // Verify email
```

---

### 3. Email Verification

**Flow:**
1. User submits registration
2. System generates unique token
3. Send email with verification link: `/partner/verify?token=xxx`
4. User clicks link
5. System validates token & marks `email_verified = true`
6. Redirect to "Thank You" page with status message

**Email Template:**
```
Subject: Xác nhận email đăng ký đối tác Bella

Xin chào [Name],

Cảm ơn bạn đã đăng ký trở thành đối tác của Bella.

Vui lòng xác nhận địa chỉ email của bạn bằng cách nhấp vào link bên dưới:

[Xác nhận Email]

Link có hiệu lực trong 24 giờ.

Sau khi xác nhận, hồ sơ của bạn sẽ được chuyển đến bộ phận phê duyệt.

Trân trọng,
Bella Team
```



---

### 4. Admin Approval Dashboard

**Route:** `/dashboard/admin/partner-approvals`

**Features:**
- ✅ List all pending applications
- ✅ Filter by status, type, date
- ✅ Search by name, email, company
- ✅ Batch actions (approve multiple)
- ✅ Detail modal with document viewer
- ✅ Comment system (internal notes)
- ✅ Approval actions: Approve / Request More Info / Reject

**List View Columns:**
| Column | Description |
|--------|-------------|
| Applicant Name | Full name |
| Type | Broker / Agency / Distributor |
| Email | Contact email |
| Phone | Contact phone |
| Status | Badge with color coding |
| Submitted Date | Created timestamp |
| Actions | Quick action buttons |

**Detail View Sections:**
1. **Applicant Information**
   - Name, Email, Phone
   - Type, Company (if applicable)

2. **Business Details**
   - Company Name, Tax Code, License Number
   - Address (City, District, Ward)

3. **Documents**
   - CCCD Front/Back (image viewer)
   - Business License (PDF viewer)
   - Company Registration (PDF viewer)
   - Download all button

4. **Review Actions**
   - Approve Button (green) → Opens provisioning modal
   - Request More Info Button (yellow) → Opens comment modal
   - Reject Button (red) → Opens rejection reason modal



**API Endpoints:**
```typescript
GET    /api/admin/partner-approvals           // List applications
GET    /api/admin/partner-approvals/:id       // Get detail
POST   /api/admin/partner-approvals/:id/approve      // Approve
POST   /api/admin/partner-approvals/:id/request-info // Request more info
POST   /api/admin/partner-approvals/:id/reject       // Reject
POST   /api/admin/partner-approvals/:id/comment      // Add internal note
```

---

### 5. Identity & Access Provisioning

**Triggered:** When admin clicks "Approve"

**Process:**
1. **Create Tenant** (if multi-tenant architecture)
   ```sql
   INSERT INTO tenants (name, industry_module, status)
   VALUES ('[Company Name]', 'real_estate', 'active');
   ```

2. **Create User**
   ```sql
   INSERT INTO users (email, full_name, role, tenant_id, status)
   VALUES ('[email]', '[name]', 'partner', '[tenant_id]', 'pending_activation');
   ```

3. **Assign Permissions**
   ```sql
   INSERT INTO user_permissions (user_id, permission)
   VALUES 
     ('[user_id]', 'partner.inventory.view'),
     ('[user_id]', 'partner.leads.manage'),
     ('[user_id]', 'partner.commission.view'),
     ('[user_id]', 'partner.documents.view');
   ```

4. **Update Application**
   ```sql
   UPDATE partner_applications
   SET status = 'approved',
       tenant_id = '[tenant_id]',
       user_id = '[user_id]',
       reviewed_by = '[admin_user_id]',
       reviewed_at = NOW()
   WHERE id = '[application_id]';
   ```



5. **Send Activation Email**
   - Generate password setup token
   - Send email with activation link
   - Link: `/partner/activate?token=xxx`

**Email Template:**
```
Subject: Chúc mừng! Tài khoản đối tác đã được phê duyệt

Xin chào [Name],

Hồ sơ đăng ký đối tác của bạn đã được phê duyệt thành công!

Vui lòng thiết lập mật khẩu để kích hoạt tài khoản:

[Thiết Lập Mật Khẩu]

Link có hiệu lực trong 72 giờ.

Sau khi thiết lập mật khẩu, bạn có thể:
✅ Truy cập bảng hàng căn hộ
✅ Quản lý khách hàng
✅ Theo dõi hoa hồng
✅ Tải tài liệu dự án

Portal: https://bella-erp.com/partner

Trân trọng,
Bella Team
```

---

### 6. Password Setup Page

**Route:** `/partner/activate?token=xxx`

**Features:**
- Validate token
- Password strength meter
- Confirm password field
- Show account information (email, name, company)
- Submit → Create password → Redirect to login

**API:**
```typescript
POST /api/partner/activate
{
  token: string,
  password: string,
  password_confirmation: string
}
```

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character



---

## Status Transitions

```
┌──────────────────────────────────────────────────────────────┐
│                 PARTNER APPLICATION LIFECYCLE                 │
└──────────────────────────────────────────────────────────────┘

  DRAFT
    ↓ (user submits)
  PENDING_VERIFICATION
    ↓
    ├─→ NEED_MORE_INFO (admin requests docs)
    │     ↓ (user uploads)
    │   PENDING_VERIFICATION (resubmit)
    │
    ├─→ APPROVED (admin approves)
    │     ↓ (provisioning complete)
    │   ACTIVE (partner can login)
    │     ↓
    │     ├─→ SUSPENDED (admin suspends)
    │     │     ↓ (admin reactivates)
    │     │   ACTIVE
    │     │
    │     └─→ ARCHIVED (soft delete)
    │
    └─→ REJECTED (admin denies)
          ↓
        ARCHIVED (cannot reapply with same email)
```

**Status Rules:**
- `draft` → `pending_verification`: User submits + email verified
- `pending_verification` → `need_more_info`: Admin requests documents
- `need_more_info` → `pending_verification`: User uploads new docs
- `pending_verification` → `approved`: Admin approves
- `approved` → `active`: System provisions tenant + user
- `active` → `suspended`: Admin action
- `suspended` → `active`: Admin action
- `pending_verification` → `rejected`: Admin denies
- `rejected` / `suspended` → `archived`: Admin archives



---

## Security Considerations

### 1. Email Verification
- ✅ Required before submission
- ✅ Token expires after 24 hours
- ✅ One-time use token
- ✅ Rate limiting on verification requests

### 2. Document Upload
- ✅ File type validation (jpg, png, pdf only)
- ✅ File size limit (5MB per file)
- ✅ Virus scanning (optional, via ClamAV)
- ✅ Secure storage (Supabase Storage with signed URLs)
- ✅ Access control (only admin can view)

### 3. Password Security
- ✅ Bcrypt hashing
- ✅ Minimum strength requirements
- ✅ Token expires after 72 hours
- ✅ One-time use activation token

### 4. Rate Limiting
- ✅ Registration: 3 submissions per IP per hour
- ✅ Email verification: 5 requests per email per day
- ✅ Password reset: 3 requests per email per hour

### 5. CAPTCHA
- ✅ Google reCAPTCHA v3 on registration form
- ✅ Prevents bot submissions

### 6. Row-Level Security (RLS)
```sql
-- Only admins can view all applications
CREATE POLICY admin_view_all_applications
  ON partner_applications FOR SELECT
  USING (auth.jwt()->>'role' = 'admin');

-- Users can only view their own application
CREATE POLICY user_view_own_application
  ON partner_applications FOR SELECT
  USING (email = auth.jwt()->>'email');

-- Only admins can update applications
CREATE POLICY admin_update_applications
  ON partner_applications FOR UPDATE
  USING (auth.jwt()->>'role' = 'admin');
```



---

## Integration Points

### 1. Notification System
**Events:**
- `partner.application.submitted` → Email to admin team
- `partner.application.approved` → Email to partner + activation link
- `partner.application.rejected` → Email to partner with reason
- `partner.application.need_info` → Email to partner with request details
- `partner.activated` → Welcome email + onboarding guide

**Channels:**
- Email (Supabase Auth Email Templates)
- In-app notification (for admins)
- Slack webhook (optional, for admin team channel)

### 2. Approval Workflow Engine
**Use Existing Bella ERP Workflow:**
- Reuse `/api/workflows` engine
- Create workflow template: `partner_application_approval`
- Workflow steps:
  1. Document verification
  2. Business verification
  3. Admin approval
  4. Provisioning
  5. Activation

**Benefits:**
- Consistent approval logic across all modules
- Audit trail built-in
- Configurable approval rules
- SLA tracking

### 3. Audit Log
**Log All Actions:**
```sql
CREATE TABLE partner_application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES partner_applications(id),
  action TEXT NOT NULL,
    -- Values: created, submitted, verified, reviewed, approved, rejected, etc.
  actor_id UUID REFERENCES users(id),
  actor_type TEXT,  -- 'applicant' | 'admin' | 'system'
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```



---

## Multi-Industry Extensibility

### Current: Real Estate Brokers
```typescript
{
  applicant_type: 'individual_broker' | 'agency',
  required_documents: ['cccd', 'business_license'],
  permissions: [
    'partner.inventory.view',
    'partner.leads.manage',
    'partner.commission.view'
  ]
}
```

### Future: Baby Care Distributors
```typescript
{
  applicant_type: 'distributor' | 'retailer',
  required_documents: ['cccd', 'business_license', 'warehouse_certificate'],
  permissions: [
    'partner.products.order',
    'partner.inventory.manage',
    'partner.commission.view'
  ]
}
```

### Future: Beauty Spa Affiliates
```typescript
{
  applicant_type: 'affiliate' | 'influencer',
  required_documents: ['cccd', 'social_media_verification'],
  permissions: [
    'partner.referrals.manage',
    'partner.commission.view',
    'partner.marketing.view'
  ]
}
```

### Future: Clean Pro Contractors
```typescript
{
  applicant_type: 'contractor' | 'freelancer',
  required_documents: ['cccd', 'certification'],
  permissions: [
    'partner.jobs.view',
    'partner.schedule.manage',
    'partner.earnings.view'
  ]
}
```

**Configuration-Driven Approach:**
```typescript
// config/partner-types.ts
export const PARTNER_TYPES = {
  real_estate: {
    broker: {
      label: 'Môi giới cá nhân',
      documents: ['cccd'],
      permissions: ['inventory.view', 'leads.manage', 'commission.view']
    },
    agency: {
      label: 'Sàn giao dịch',
      documents: ['cccd', 'business_license', 'company_registration'],
      permissions: ['inventory.view', 'leads.manage', 'commission.view', 'team.manage']
    }
  },
  // Add more industries...
};
```



---

## Implementation Phases

### Phase 1: Core Registration (Week 1-2)
**Database:**
- ✅ Create `partner_applications` table
- ✅ Create status ENUM
- ✅ Setup RLS policies
- ✅ Create audit log table

**Frontend:**
- ✅ Public registration page (`/partner/register`)
- ✅ Multi-step form wizard
- ✅ Document upload component
- ✅ Email verification page

**Backend:**
- ✅ Registration API endpoints
- ✅ Email verification logic
- ✅ File upload to Supabase Storage

**Deliverables:**
- Partners can self-register
- Email verification working
- Documents uploaded securely
- Status: `pending_verification`

---

### Phase 2: Admin Approval Workflow (Week 3-4)
**Frontend:**
- ✅ Admin dashboard (`/dashboard/admin/partner-approvals`)
- ✅ Application list view with filters
- ✅ Detail modal with document viewer
- ✅ Approval action buttons

**Backend:**
- ✅ Admin API endpoints
- ✅ Approval workflow integration
- ✅ Notification system (email)
- ✅ Audit logging

**Deliverables:**
- Admins can review applications
- Approve / Request Info / Reject actions
- Notifications sent to partners
- Full audit trail



---

### Phase 3: Identity Provisioning (Week 5)
**Backend:**
- ✅ Tenant creation logic
- ✅ User account creation
- ✅ Role & permission assignment
- ✅ Activation email with token

**Frontend:**
- ✅ Password setup page (`/partner/activate`)
- ✅ Password strength meter
- ✅ Account activation flow

**Deliverables:**
- Approved partners get tenant + user
- Activation email sent with password setup link
- Partners can set password and login
- Status: `active`

---

### Phase 4: Advanced Features (Week 6+)
**Features:**
- ✅ Batch approval (select multiple, approve all)
- ✅ Comment system (internal admin notes)
- ✅ Document version history
- ✅ Partner self-service (view application status)
- ✅ Admin analytics dashboard (approval rate, turnaround time)
- ✅ SLA tracking (applications older than 7 days)

**Integrations:**
- ✅ Slack notifications for admins
- ✅ SMS verification (optional)
- ✅ CAPTCHA v3 (spam prevention)

---

## Testing Strategy

### Unit Tests
```typescript
describe('Partner Registration', () => {
  it('should create draft application', async () => {
    const app = await createApplication({
      email: 'test@example.com',
      full_name: 'Test User',
      applicant_type: 'individual_broker'
    });
    expect(app.status).toBe('draft');
  });

  it('should send verification email', async () => {
    const app = await submitApplication(draftApp.id);
    expect(mockEmailService).toHaveBeenCalledWith({
      to: app.email,
      subject: expect.stringContaining('Xác nhận email')
    });
  });

  it('should verify email with valid token', async () => {
    const result = await verifyEmail(validToken);
    expect(result.email_verified).toBe(true);
  });
});
```



### Integration Tests
```typescript
describe('Approval Workflow', () => {
  it('should approve application and create tenant', async () => {
    const app = await createPendingApplication();
    const result = await approveApplication(app.id, adminUser.id);
    
    expect(result.status).toBe('approved');
    expect(result.tenant_id).toBeDefined();
    expect(result.user_id).toBeDefined();
  });

  it('should send activation email after approval', async () => {
    const result = await approveApplication(app.id, adminUser.id);
    expect(mockEmailService).toHaveBeenCalledWith({
      to: app.email,
      subject: expect.stringContaining('được phê duyệt')
    });
  });
});
```

### E2E Tests
```typescript
test('Full registration flow', async ({ page }) => {
  // Step 1: Register
  await page.goto('/partner/register');
  await page.fill('[name="email"]', 'broker@test.com');
  await page.fill('[name="full_name"]', 'Test Broker');
  await page.click('button[type="submit"]');
  
  // Step 2: Verify email
  const verificationLink = await getLatestEmail();
  await page.goto(verificationLink);
  expect(page.url()).toContain('/partner/verify');
  
  // Step 3: Admin approves
  await loginAsAdmin(page);
  await page.goto('/dashboard/admin/partner-approvals');
  await page.click('button:has-text("Phê duyệt")');
  
  // Step 4: Partner activates
  const activationLink = await getLatestEmail();
  await page.goto(activationLink);
  await page.fill('[name="password"]', 'SecureP@ss123');
  await page.click('button[type="submit"]');
  
  // Step 5: Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'broker@test.com');
  await page.fill('[name="password"]', 'SecureP@ss123');
  await page.click('button[type="submit"]');
  
  expect(page.url()).toContain('/partner/dashboard');
});
```



---

## Success Metrics

### Business Metrics
- **Registration Conversion Rate:** % of visitors who complete registration
- **Approval Rate:** % of applications approved vs rejected
- **Time to Approval:** Average days from submission to approval
- **Activation Rate:** % of approved partners who activate their account
- **Partner Retention:** % of partners still active after 30/60/90 days

### Technical Metrics
- **API Response Time:** < 200ms for all endpoints
- **Email Delivery Rate:** > 99%
- **Document Upload Success Rate:** > 98%
- **System Uptime:** > 99.9%

### Security Metrics
- **Spam Applications:** < 2% of total submissions
- **Fraudulent Applications:** < 0.5% detected post-approval
- **Data Breach Incidents:** 0

---

## Maintenance & Operations

### Database Maintenance
```sql
-- Archive old rejected applications (older than 90 days)
UPDATE partner_applications
SET status = 'archived'
WHERE status = 'rejected'
  AND reviewed_at < NOW() - INTERVAL '90 days';

-- Expire old verification tokens
UPDATE partner_applications
SET email_verification_token = NULL
WHERE email_verified = FALSE
  AND created_at < NOW() - INTERVAL '48 hours';
```

### Monitoring Alerts
- ⚠️ Applications pending > 7 days
- ⚠️ Email delivery failures
- ⚠️ Document upload failures
- ⚠️ High rejection rate (> 30%)
- ⚠️ API error rate > 1%

### Backup Strategy
- **Database:** Daily automated backups
- **Documents:** Replicated across 3 regions (Supabase Storage)
- **Audit Logs:** Retained for 2 years



---

## Frequently Asked Questions (FAQ)

### For Partners

**Q: How long does approval take?**  
A: Typically 3-5 business days. You'll receive an email once your application is reviewed.

**Q: What documents do I need?**  
A: Individual brokers need CCCD (front & back). Agencies also need Business License and Company Registration.

**Q: Can I edit my application after submission?**  
A: No, but if additional info is needed, admin will contact you and you can upload new documents.

**Q: My email verification link expired. What should I do?**  
A: Go back to the registration page and click "Resend Verification Email."

**Q: I forgot my activation link. Can I get a new one?**  
A: Contact support@bella.vn with your registered email.

---

### For Admins

**Q: How do I bulk approve multiple applications?**  
A: Select checkboxes for multiple applications and click "Batch Approve" button.

**Q: Can I revert an approval?**  
A: No. Once approved, you can only suspend the partner account. Contact engineering for rollback.

**Q: What if I accidentally reject a valid application?**  
A: The partner can reapply with a different email, or you can manually create their account.

**Q: Where are uploaded documents stored?**  
A: Supabase Storage with signed URLs. Only admins with proper permissions can access.

**Q: Can I delegate approval to another admin?**  
A: Yes, all users with role='admin' can approve applications. Use comments to coordinate.



---

## Appendix

### A. Database Migration SQL

**File:** `supabase/migrations/20260802130000_partner_registration_system.sql`

```sql
-- See full migration in separate file
-- Key tables: partner_applications, partner_application_logs
-- Key ENUMs: partner_application_status, partner_applicant_type
```

### B. API Specifications

**OpenAPI Spec:** `docs/api/partner-registration.yaml`

### C. UI Mockups

**Figma:** `https://figma.com/bella-erp/partner-registration-flow`

### D. Email Templates

**Location:** `src/email-templates/partner/`
- `registration-verification.html`
- `application-approved.html`
- `application-rejected.html`
- `request-more-info.html`
- `account-activated.html`

### E. Related Documents

- [Partner Portal Implementation Status](./PARTNER_PORTAL_IMPLEMENTATION_STATUS.md)
- [Real Estate Module Development Playbook](../INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md)
- [Bella ERP Architecture Overview](../architecture/OVERVIEW.md)
- [Security & Compliance Guide](../security/COMPLIANCE.md)

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-02 | Kiro AI | Initial draft - Full specification created |

---

## Approval Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [Name] | _________ | ____ |
| Technical Lead | [Name] | _________ | ____ |
| Security Officer | [Name] | _________ | ____ |
| Engineering Manager | [Name] | _________ | ____ |

---

**END OF DOCUMENT**
