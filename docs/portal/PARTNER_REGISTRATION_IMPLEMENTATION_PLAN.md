# Partner Registration System - Implementation Plan

**Project:** Bella ERP Partner Registration & Approval System  
**Start Date:** 2026-08-02  
**Target Completion:** 2026-09-13 (6 weeks)  
**Status:** Planning  
**Priority:** High

---

## Overview

This document provides a detailed, week-by-week implementation plan for the Partner Registration System as specified in [PARTNER_REGISTRATION_SYSTEM_SPEC.md](./PARTNER_REGISTRATION_SYSTEM_SPEC.md).

### Success Criteria
- ✅ Partners can self-register with email verification
- ✅ Documents uploaded securely to Supabase Storage
- ✅ Admins can review and approve/reject applications
- ✅ Approved partners receive activation email
- ✅ Partners can set password and login to Partner Portal
- ✅ Full audit trail of all actions
- ✅ Zero downtime deployment
- ✅ All tests passing (unit + integration + E2E)

---

## Team Structure

| Role | Name | Responsibilities |
|------|------|------------------|
| Product Owner | [Name] | Requirements, prioritization, UAT |
| Tech Lead | [Name] | Architecture, code review, deployment |
| Backend Dev | [Name] | API, database, email, provisioning |
| Frontend Dev | [Name] | UI/UX, forms, document upload |
| QA Engineer | [Name] | Test plans, automation, bug tracking |
| DevOps | [Name] | CI/CD, monitoring, production support |



---

## Week 1: Foundation & Database (Aug 2-8)

### Day 1-2: Database Schema & Migration
**Owner:** Backend Dev  
**Estimated:** 12 hours

**Tasks:**
- [ ] Create `partner_applications` table migration
- [ ] Create `partner_application_logs` table migration
- [ ] Create ENUMs: `partner_application_status`, `partner_applicant_type`
- [ ] Create RLS policies for both tables
- [ ] Create indexes for performance
- [ ] Create `update_updated_at_column()` trigger
- [ ] Write migration rollback script
- [ ] Test migration on local Supabase
- [ ] Document schema in spec

**Deliverables:**
```
supabase/migrations/20260802130000_partner_registration_system.sql
```

**Verification:**
```sql
-- Run in Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('partner_applications', 'partner_application_logs');
```

---

### Day 3: TypeScript Types & API Scaffolding
**Owner:** Backend Dev  
**Estimated:** 6 hours

**Tasks:**
- [ ] Regenerate database types: `npx supabase gen types typescript`
- [ ] Create `src/types/partner-registration.types.ts`
- [ ] Create `src/services/partner-registration-actions.ts` skeleton
- [ ] Define all API function signatures
- [ ] Add JSDoc comments

**Deliverables:**
```typescript
// src/types/partner-registration.types.ts
export type PartnerApplicationStatus = 'draft' | 'pending_verification' | ...;
export type PartnerApplicantType = 'individual_broker' | 'agency' | ...;
export interface PartnerApplication { ... }

// src/services/partner-registration-actions.ts
export async function createDraftApplication(data: ...) { ... }
export async function submitApplication(id: string) { ... }
export async function uploadDocument(id: string, file: File) { ... }
```



---

### Day 4-5: Public Registration Page (Frontend)
**Owner:** Frontend Dev  
**Estimated:** 14 hours

**Tasks:**
- [ ] Create `/partner/register` route
- [ ] Build multi-step form wizard component
- [ ] Implement Step 1: Basic Information form
- [ ] Implement Step 2: Business Information form (conditional)
- [ ] Implement Step 3: Document Upload
- [ ] Implement Step 4: Review & Submit
- [ ] Add form validation (react-hook-form + zod)
- [ ] Add progress indicator
- [ ] Add "Save Draft" functionality
- [ ] Add loading states & error handling
- [ ] Mobile-responsive design
- [ ] Accessibility (WCAG AA compliance)

**Deliverables:**
```
src/app/partner/register/
  ├── page.tsx                    // Main registration page
  ├── components/
  │   ├── RegistrationWizard.tsx  // Multi-step wizard
  │   ├── Step1BasicInfo.tsx
  │   ├── Step2BusinessInfo.tsx
  │   ├── Step3DocumentUpload.tsx
  │   ├── Step4ReviewSubmit.tsx
  │   └── ProgressIndicator.tsx
  └── schemas/
      └── registration.schema.ts   // Zod validation schemas
```

**Design:**
- Use PremiumSelect for dropdowns
- Use existing Bella ERP design system
- Match Partner Portal styling (same components as dashboard/inventory)



---

## Week 2: Document Upload & Email Verification (Aug 9-15)

### Day 6-7: Document Upload System
**Owner:** Backend Dev + Frontend Dev  
**Estimated:** 12 hours

**Backend Tasks:**
- [ ] Setup Supabase Storage bucket: `partner-application-documents`
- [ ] Configure bucket policies (private, admin-only access)
- [ ] Create upload API: `POST /api/partner/register/upload`
- [ ] Implement file validation (type, size, virus scan)
- [ ] Generate signed URLs for document access
- [ ] Create document metadata storage in `partner_applications.documents`

**Frontend Tasks:**
- [ ] Build drag-and-drop upload component
- [ ] Add file preview (image/PDF)
- [ ] Show upload progress
- [ ] Handle upload errors gracefully
- [ ] Allow document replacement
- [ ] Show uploaded documents list with delete option

**Deliverables:**
```typescript
// Backend
POST /api/partner/register/upload
{
  application_id: string,
  document_type: 'cccd_front' | 'cccd_back' | 'business_license' | ...,
  file: File
}
Response: { success: true, document: { type, url, uploaded_at } }

// Frontend
<DocumentUpload
  applicationId={id}
  documentType="cccd_front"
  onUploadSuccess={(doc) => { ... }}
  maxSize={5 * 1024 * 1024} // 5MB
  acceptedTypes={['image/jpeg', 'image/png', 'application/pdf']}
/>
```



---

### Day 8-9: Email Verification System
**Owner:** Backend Dev  
**Estimated:** 10 hours

**Tasks:**
- [ ] Create email verification token generator (crypto.randomBytes)
- [ ] Store token in `partner_applications.email_verification_token`
- [ ] Create `/partner/verify` page
- [ ] Implement token validation logic
- [ ] Add token expiration (24 hours)
- [ ] Create email template: `registration-verification.html`
- [ ] Setup Supabase Auth email sending
- [ ] Add resend verification endpoint
- [ ] Implement rate limiting (5 requests per email per day)
- [ ] Log verification events to audit table

**Deliverables:**
```typescript
// API
POST /api/partner/register/submit      // Sends verification email
GET  /api/partner/verify?token=xxx     // Validates token
POST /api/partner/resend-verification  // Resends email

// Email Template
src/email-templates/partner/registration-verification.html
```

**Email Content:**
```
Subject: Xác nhận email đăng ký đối tác Bella

Xin chào [Name],

Cảm ơn bạn đã đăng ký. Vui lòng xác nhận email:

[Xác Nhận Email] (button, 24h validity)

Link: https://bella-erp.com/partner/verify?token=[TOKEN]

Trân trọng,
Bella Team
```



---

### Day 10: Week 2 Integration & Testing
**Owner:** QA Engineer  
**Estimated:** 8 hours

**Tasks:**
- [ ] Test registration flow end-to-end
- [ ] Test document upload (valid files, invalid files, size limits)
- [ ] Test email verification (valid token, expired token, invalid token)
- [ ] Test resend verification
- [ ] Test draft save/resume
- [ ] Check mobile responsiveness
- [ ] Verify form validation errors
- [ ] Performance testing (upload large files)
- [ ] Security testing (SQL injection, XSS)

**Test Cases:**
- ✅ User can complete all 4 steps
- ✅ Draft is saved automatically
- ✅ Documents upload successfully
- ✅ Email verification link works
- ✅ Expired token shows error
- ✅ Invalid token shows error
- ✅ Can resend verification email
- ✅ Rate limiting blocks spam
- ✅ Form validates all required fields
- ✅ Mobile UI is usable

**Blockers/Issues:**
- Document in issue tracker with severity labels

---

## Week 3: Admin Approval Dashboard (Aug 16-22)

### Day 11-12: Admin Dashboard List View
**Owner:** Frontend Dev  
**Estimated:** 12 hours

**Tasks:**
- [ ] Create `/dashboard/admin/partner-approvals` route
- [ ] Build applications list table
- [ ] Add status badge component (color-coded)
- [ ] Implement filters: status, type, date range
- [ ] Implement search: name, email, company
- [ ] Add sorting by columns
- [ ] Implement pagination (20 items per page)
- [ ] Add "New Applications" counter badge
- [ ] Style with Bella ERP design system

**Deliverables:**
```
src/app/dashboard/admin/partner-approvals/
  ├── page.tsx                     // Main list page
  ├── components/
  │   ├── ApplicationsTable.tsx    // Table component
  │   ├── ApplicationRow.tsx       // Table row
  │   ├── StatusBadge.tsx          // Status indicator
  │   ├── FilterPanel.tsx          // Filter controls
  │   └── SearchBar.tsx            // Search input
```



---

### Day 13-14: Admin Detail Modal & Document Viewer
**Owner:** Frontend Dev  
**Estimated:** 14 hours

**Tasks:**
- [ ] Build detail modal component
- [ ] Display applicant information
- [ ] Display business details
- [ ] Build document viewer (image + PDF)
- [ ] Add zoom/rotate controls for images
- [ ] Add "Download All" button
- [ ] Show application timeline (submitted, verified, etc.)
- [ ] Add internal comments section
- [ ] Add review action buttons (Approve, Request Info, Reject)
- [ ] Add confirmation dialogs for actions

**Deliverables:**
```typescript
<ApplicationDetailModal
  application={app}
  onApprove={(notes) => { ... }}
  onRequestInfo={(message) => { ... }}
  onReject={(reason) => { ... }}
  onClose={() => { ... }}
/>

// Document Viewer Component
<DocumentViewer
  documents={[
    { type: 'cccd_front', url: '...', uploaded_at: '...' },
    { type: 'cccd_back', url: '...', uploaded_at: '...' }
  ]}
  onDownloadAll={() => { ... }}
/>
```

**UI Sections:**
1. Header: Name, Status, Submitted Date
2. Applicant Info Card
3. Business Info Card (if applicable)
4. Documents Grid (2-3 columns)
5. Timeline (vertical)
6. Comments (admin-only, internal notes)
7. Action Buttons (bottom)



---

### Day 15: Admin Approval Actions (Backend)
**Owner:** Backend Dev  
**Estimated:** 10 hours

**Tasks:**
- [ ] Create approval API endpoints
- [ ] Implement `approveApplication()` logic
- [ ] Implement `requestMoreInfo()` logic
- [ ] Implement `rejectApplication()` logic
- [ ] Add audit logging for all actions
- [ ] Create notification emails for each action
- [ ] Add admin authorization checks
- [ ] Validate state transitions
- [ ] Handle concurrent approval (optimistic locking)

**Deliverables:**
```typescript
// API Endpoints
POST /api/admin/partner-approvals/:id/approve
{
  notes?: string,
  provisioning_config?: { tenant_name, permissions }
}

POST /api/admin/partner-approvals/:id/request-info
{
  message: string,  // What's needed
  fields: string[]  // Which fields to update
}

POST /api/admin/partner-approvals/:id/reject
{
  reason: string,
  rejection_category: 'invalid_docs' | 'duplicate' | 'policy_violation' | 'other'
}

POST /api/admin/partner-approvals/:id/comment
{
  comment: string  // Internal note
}
```

**Email Templates:**
- `application-approved.html`
- `request-more-info.html`
- `application-rejected.html`



---

## Week 4: Identity Provisioning & Activation (Aug 23-29)

### Day 16-17: Provisioning Engine
**Owner:** Backend Dev  
**Estimated:** 14 hours

**Tasks:**
- [ ] Create `provisionPartnerAccount()` function
- [ ] Implement tenant creation logic (if multi-tenant)
- [ ] Implement user account creation
- [ ] Assign default role: `partner`
- [ ] Assign permissions based on applicant type
- [ ] Link `partner_applications.tenant_id` & `user_id`
- [ ] Update application status to `approved`
- [ ] Generate activation token
- [ ] Send activation email
- [ ] Handle provisioning errors (rollback)
- [ ] Add retry logic for failed provisioning

**Deliverables:**
```typescript
// src/services/partner-provisioning.ts
export async function provisionPartnerAccount(
  application: PartnerApplication
): Promise<{
  success: boolean;
  tenant_id?: string;
  user_id?: string;
  activation_token?: string;
  error?: string;
}> {
  const transaction = await db.transaction();
  
  try {
    // 1. Create tenant (optional, depends on architecture)
    const tenant = await createTenant({
      name: application.company_name || application.full_name,
      industry_module: 'real_estate',
      status: 'active'
    });
    
    // 2. Create user
    const user = await createUser({
      email: application.email,
      full_name: application.full_name,
      phone: application.phone,
      role: 'partner',
      tenant_id: tenant.id,
      status: 'pending_activation'
    });
    
    // 3. Assign permissions
    await assignPermissions(user.id, getPartnerPermissions(application.applicant_type));
    
    // 4. Update application
    await updateApplication(application.id, {
      status: 'approved',
      tenant_id: tenant.id,
      user_id: user.id
    });
    
    // 5. Generate activation token
    const token = generateActivationToken(user.id);
    
    // 6. Send activation email
    await sendActivationEmail(application.email, {
      name: application.full_name,
      token,
      company: application.company_name
    });
    
    await transaction.commit();
    return { success: true, tenant_id: tenant.id, user_id: user.id, activation_token: token };
    
  } catch (error) {
    await transaction.rollback();
    return { success: false, error: error.message };
  }
}
```



---

### Day 18-19: Password Setup Page
**Owner:** Frontend Dev  
**Estimated:** 10 hours

**Tasks:**
- [ ] Create `/partner/activate` route
- [ ] Validate activation token on page load
- [ ] Build password setup form
- [ ] Add password strength meter
- [ ] Add password requirements checklist
- [ ] Add confirm password field
- [ ] Show account information preview
- [ ] Handle token expiration gracefully
- [ ] Handle invalid token error
- [ ] Redirect to login on success

**Deliverables:**
```typescript
// src/app/partner/activate/page.tsx
export default function ActivatePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  // Validate token
  const { data: application, error } = useQuery({
    queryKey: ['activation-token', token],
    queryFn: () => validateActivationToken(token)
  });
  
  if (error) return <InvalidTokenError />;
  if (!application) return <LoadingState />;
  
  return (
    <ActivationForm
      application={application}
      token={token}
      onSuccess={() => router.push('/login?activated=true')}
    />
  );
}

// Password Requirements Checklist
const requirements = [
  { label: 'Ít nhất 8 ký tự', test: (pw) => pw.length >= 8 },
  { label: 'Chữ hoa (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Chữ thường (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Số (0-9)', test: (pw) => /\d/.test(pw) },
  { label: 'Ký tự đặc biệt (!@#$%...)', test: (pw) => /[!@#$%^&*]/.test(pw) }
];
```

**API:**
```typescript
GET  /api/partner/activate/validate?token=xxx  // Validate token
POST /api/partner/activate
{
  token: string,
  password: string,
  password_confirmation: string
}
Response: { success: true, redirect: '/login' }
```



---

### Day 20: Week 4 Integration Testing
**Owner:** QA Engineer  
**Estimated:** 8 hours

**Tasks:**
- [ ] Test admin approval flow end-to-end
- [ ] Test provisioning (tenant + user creation)
- [ ] Test activation email sending
- [ ] Test password setup flow
- [ ] Test login after activation
- [ ] Verify permissions assigned correctly
- [ ] Test concurrent approval (2 admins approve same app)
- [ ] Test provisioning rollback on error
- [ ] Test expired activation token
- [ ] Verify audit logs captured

**Test Scenarios:**
1. **Happy Path:** Register → Verify Email → Admin Approves → Activate → Login
2. **Request More Info:** Register → Admin Requests Info → Partner Uploads → Admin Approves
3. **Rejection:** Register → Admin Rejects → Partner receives rejection email
4. **Token Expiry:** Activation token expires after 72 hours
5. **Duplicate Email:** Cannot register with same email twice
6. **Concurrent Approval:** Lock prevents double provisioning

**Acceptance Criteria:**
- ✅ Approved partner can login to `/partner/dashboard`
- ✅ Partner has correct permissions
- ✅ Partner sees correct tenant data
- ✅ All emails delivered successfully
- ✅ All actions logged in audit table
- ✅ No orphaned records (tenant without user, etc.)

---

## Week 5: Advanced Features & Polish (Aug 30 - Sep 5)

### Day 21-22: Notification System Integration
**Owner:** Backend Dev  
**Estimated:** 10 hours

**Tasks:**
- [ ] Setup email templates in Supabase Auth
- [ ] Create notification queue table (optional, for retry)
- [ ] Implement email delivery tracking
- [ ] Add Slack webhook integration (admin notifications)
- [ ] Create in-app notification for admins
- [ ] Add notification preferences
- [ ] Implement notification retry logic
- [ ] Monitor email delivery rate

**Deliverables:**
```typescript
// Notification Events
export enum PartnerNotificationEvent {
  APPLICATION_SUBMITTED = 'partner.application.submitted',
  APPLICATION_APPROVED = 'partner.application.approved',
  APPLICATION_REJECTED = 'partner.application.rejected',
  INFO_REQUESTED = 'partner.application.info_requested',
  ACCOUNT_ACTIVATED = 'partner.account.activated',
}

// Slack Webhook
async function notifyAdminTeam(event: PartnerNotificationEvent, data: any) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `🔔 New Partner Application`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${data.full_name}* submitted a partner application` }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Email:*\n${data.email}` },
            { type: 'mrkdwn', text: `*Type:*\n${data.applicant_type}` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Review Application' },
              url: `${process.env.NEXT_PUBLIC_URL}/dashboard/admin/partner-approvals/${data.id}`
            }
          ]
        }
      ]
    })
  });
}
```



---

### Day 23: Batch Approval & Bulk Actions
**Owner:** Frontend Dev + Backend Dev  
**Estimated:** 8 hours

**Tasks:**
- [ ] Add checkbox column to applications table
- [ ] Add "Select All" checkbox
- [ ] Add batch action buttons (Approve All, Archive)
- [ ] Implement batch approval API
- [ ] Add progress indicator for batch operations
- [ ] Handle partial failures gracefully
- [ ] Show success/error summary

**Deliverables:**
```typescript
// Frontend
<ApplicationsTable>
  <SelectAllCheckbox />
  {selectedIds.length > 0 && (
    <BatchActionsBar>
      <button onClick={handleBatchApprove}>
        Approve {selectedIds.length} applications
      </button>
      <button onClick={handleBatchArchive}>
        Archive {selectedIds.length} applications
      </button>
    </BatchActionsBar>
  )}
</ApplicationsTable>

// Backend API
POST /api/admin/partner-approvals/batch
{
  action: 'approve' | 'archive',
  application_ids: string[],
  notes?: string
}
Response: {
  success: true,
  results: [
    { id: 'xxx', status: 'success', user_id: 'yyy' },
    { id: 'zzz', status: 'error', error: 'Provisioning failed' }
  ],
  summary: { total: 10, succeeded: 9, failed: 1 }
}
```

---

### Day 24: Partner Self-Service Status Page
**Owner:** Frontend Dev  
**Estimated:** 6 hours

**Tasks:**
- [ ] Create `/partner/application-status` route
- [ ] Allow partner to view their application status
- [ ] Show timeline of events (submitted, verified, under review)
- [ ] Show requested documents (if info requested)
- [ ] Allow document re-upload
- [ ] Show rejection reason (if rejected)
- [ ] Add "Contact Support" button

**Deliverables:**
```typescript
// src/app/partner/application-status/page.tsx
export default function ApplicationStatusPage() {
  const { data: application } = useQuery({
    queryKey: ['my-application'],
    queryFn: () => fetchMyApplication()
  });
  
  return (
    <div>
      <StatusBadge status={application.status} />
      <Timeline events={application.events} />
      
      {application.status === 'need_more_info' && (
        <RequestedDocuments
          message={application.info_request_message}
          fields={application.info_request_fields}
          onUpload={handleReupload}
        />
      )}
      
      {application.status === 'rejected' && (
        <RejectionNotice reason={application.rejection_reason} />
      )}
    </div>
  );
}
```



---

### Day 25: Security Enhancements
**Owner:** Backend Dev  
**Estimated:** 8 hours

**Tasks:**
- [ ] Implement rate limiting (Redis-based)
- [ ] Add CAPTCHA to registration form (reCAPTCHA v3)
- [ ] Add IP-based spam detection
- [ ] Implement account lockout after failed activations
- [ ] Add CSP headers
- [ ] Add CORS configuration
- [ ] Security audit of all endpoints
- [ ] Add SQL injection tests
- [ ] Add XSS tests

**Rate Limits:**
```typescript
const rateLimits = {
  registration: { max: 3, window: '1h', by: 'ip' },
  emailVerification: { max: 5, window: '1d', by: 'email' },
  documentUpload: { max: 20, window: '1h', by: 'application_id' },
  passwordActivation: { max: 5, window: '1h', by: 'token' }
};
```

**CAPTCHA Integration:**
```typescript
// Frontend
import { GoogleReCaptcha } from 'react-google-recaptcha-v3';

<GoogleReCaptcha
  onVerify={(token) => setCaptchaToken(token)}
/>

// Backend
import { verifyCaptcha } from '@/lib/captcha';

const isHuman = await verifyCaptcha(captchaToken);
if (!isHuman) {
  return res.status(403).json({ error: 'Captcha verification failed' });
}
```

---

## Week 6: Testing, Deployment & Documentation (Sep 6-13)

### Day 26-27: Comprehensive Testing
**Owner:** QA Engineer + Full Team  
**Estimated:** 16 hours

**Test Suite:**
- [ ] **Unit Tests** (80%+ coverage)
  - Database functions
  - Validation schemas
  - Email generation
  - Provisioning logic

- [ ] **Integration Tests**
  - API endpoints
  - Database transactions
  - Email sending
  - File uploads

- [ ] **E2E Tests** (Playwright)
  - Full registration flow
  - Admin approval flow
  - Password activation flow
  - Error scenarios

- [ ] **Performance Tests**
  - 100 concurrent registrations
  - Batch approval of 50 applications
  - Large file uploads (5MB PDF)

- [ ] **Security Tests**
  - SQL injection attempts
  - XSS attempts
  - CSRF protection
  - Authentication bypass
  - Authorization bypass

- [ ] **Accessibility Tests** (WCAG AA)
  - Keyboard navigation
  - Screen reader compatibility
  - Color contrast
  - Form labels



**Test Commands:**
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all

# Coverage report
npm run test:coverage
```

**Acceptance Criteria:**
- ✅ All tests passing
- ✅ Code coverage > 80%
- ✅ No critical security vulnerabilities
- ✅ Performance benchmarks met
- ✅ Accessibility score > 90

---

### Day 28: Staging Deployment
**Owner:** DevOps  
**Estimated:** 6 hours

**Tasks:**
- [ ] Deploy database migration to staging
- [ ] Deploy application to staging
- [ ] Configure environment variables
- [ ] Setup email templates in staging Supabase
- [ ] Configure Slack webhook (staging channel)
- [ ] Setup monitoring dashboards
- [ ] Run smoke tests
- [ ] Invite team for UAT

**Deployment Checklist:**
```bash
# 1. Database migration
npx supabase db push --project-ref staging-xxx

# 2. Verify migration
npx supabase db query --linked "SELECT * FROM partner_applications LIMIT 1;"

# 3. Deploy to Vercel
git push origin main  # Auto-deploy to staging

# 4. Verify deployment
curl https://staging.bella-erp.com/api/health

# 5. Run smoke tests
npm run test:smoke -- --env=staging
```

**Monitoring Setup:**
- [ ] Setup Sentry error tracking
- [ ] Setup DataDog APM
- [ ] Setup Uptime monitoring
- [ ] Setup Log aggregation
- [ ] Create alert rules



---

### Day 29: User Acceptance Testing (UAT)
**Owner:** Product Owner + QA  
**Estimated:** 8 hours

**Test Participants:**
- Product Owner
- 2 Internal Admins
- 2 Beta Partners (external)

**UAT Scenarios:**
1. **Scenario 1: Broker Registration**
   - Individual broker registers
   - Uploads CCCD
   - Receives verification email
   - Admin approves
   - Partner activates account
   - Partner logs in and accesses inventory

2. **Scenario 2: Agency Registration**
   - Agency registers
   - Uploads CCCD, Business License, Company Registration
   - Admin requests additional document (tax certificate)
   - Agency uploads tax certificate
   - Admin approves
   - Agency activates account

3. **Scenario 3: Rejection Flow**
   - Fraudulent application submitted
   - Admin reviews and rejects
   - Partner receives rejection email with reason

**Feedback Collection:**
- [ ] Survey form for all participants
- [ ] Bug reports in issue tracker
- [ ] Feature requests documented
- [ ] UX improvements noted

**UAT Sign-Off Required:**
- [ ] Product Owner approval
- [ ] Admin team approval
- [ ] At least 1 successful beta partner registration

---

### Day 30: Production Deployment
**Owner:** DevOps + Tech Lead  
**Estimated:** 6 hours

**Pre-Deployment Checklist:**
- [ ] All UAT issues resolved
- [ ] All tests passing
- [ ] Code review completed
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Rollback plan prepared
- [ ] Stakeholder sign-off obtained

**Deployment Steps:**
```bash
# 1. Create production database backup
npx supabase db dump --linked > backup-$(date +%Y%m%d).sql

# 2. Deploy migration to production
npx supabase db push --project-ref prod-xxx

# 3. Verify migration
npx supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_name = 'partner_applications';"

# 4. Deploy application (blue-green deployment)
vercel --prod

# 5. Monitor for 15 minutes
# - Watch error rates in Sentry
# - Watch API latency in DataDog
# - Check email delivery logs

# 6. Run production smoke tests
npm run test:smoke -- --env=production

# 7. Enable feature flag
# Update feature_flags table: partner_registration = true

# 8. Announce to team
# Post in Slack #engineering channel
```

**Rollback Procedure (if needed):**
```bash
# 1. Revert Vercel deployment
vercel rollback

# 2. Disable feature flag
# Update feature_flags table: partner_registration = false

# 3. Restore database (if migration issue)
psql $DATABASE_URL < backup-YYYYMMDD.sql

# 4. Notify stakeholders
```



---

## Post-Launch (Week 7+)

### Monitoring & Observability
**Owner:** DevOps  
**Ongoing**

**Metrics to Track:**
- Registration conversion rate
- Email delivery rate
- Approval turnaround time
- Activation rate
- Partner retention (30/60/90 days)
- API error rates
- API latency (p50, p95, p99)
- Document upload success rate

**Dashboards:**
- [ ] Business metrics dashboard (for Product Owner)
- [ ] Technical metrics dashboard (for Engineering)
- [ ] Error tracking dashboard (for Support)

**Alerts:**
- ⚠️ Email delivery failure rate > 5%
- ⚠️ API error rate > 2%
- ⚠️ API latency p95 > 500ms
- ⚠️ Applications pending > 7 days count > 10
- ⚠️ Provisioning failure rate > 1%

---

### Documentation Updates
**Owner:** Tech Lead  
**Day 31-32**

**Documents to Update:**
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Admin user guide (how to review applications)
- [ ] Partner user guide (how to register)
- [ ] Developer onboarding docs
- [ ] Deployment runbook
- [ ] Troubleshooting guide
- [ ] Architecture decision records (ADR)

**Knowledge Base Articles:**
- How to register as a partner
- How to upload documents
- How to activate your account
- How to reset your password
- Admin: How to approve applications
- Admin: How to handle fraud cases
- Troubleshooting: Email not received
- Troubleshooting: Activation link expired

---

### Continuous Improvement Backlog
**Owner:** Product Owner  
**Prioritized for Future Sprints**

**Phase 2 Features (Future):**
- [ ] SMS verification (optional)
- [ ] Real-time admin notifications (WebSocket)
- [ ] Partner application analytics dashboard
- [ ] Automated document verification (OCR, AI)
- [ ] Multi-language support (EN, VN)
- [ ] Partner onboarding wizard (after activation)
- [ ] Referral system (partners invite other partners)
- [ ] Partner tier system (bronze, silver, gold)

**Technical Debt:**
- [ ] Refactor provisioning engine for better error handling
- [ ] Add comprehensive logging for troubleshooting
- [ ] Optimize document upload performance
- [ ] Improve email template rendering
- [ ] Add more granular permissions

**Bugs/Issues:**
- Track in GitHub Issues with labels:
  - `bug` - Functional issues
  - `enhancement` - Feature improvements
  - `tech-debt` - Code quality issues
  - `documentation` - Doc updates needed



---

## Risk Management

### High-Risk Items
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Email delivery failures | Medium | High | Use Supabase Auth + add retry queue |
| Provisioning errors (orphaned records) | Medium | High | Implement atomic transactions + rollback |
| Security vulnerability (data leak) | Low | Critical | Security audit + penetration testing |
| Spam registrations | High | Medium | Add CAPTCHA + rate limiting + IP blocking |
| Token expiration UX issues | Medium | Medium | Clear error messages + resend functionality |
| Database migration failure | Low | Critical | Test thoroughly on staging + backup before prod |
| Concurrent approval (race condition) | Low | Medium | Optimistic locking + retry logic |

### Contingency Plans
**If Email Service Fails:**
- Fallback to SendGrid/Mailgun
- Manual notification to partners
- Admin-triggered email resend

**If Provisioning Fails:**
- Manual provisioning by admin
- Automated rollback + retry
- Alert engineering team

**If Database Migration Fails:**
- Restore from backup
- Delay deployment
- Fix migration + redeploy

---

## Success Criteria & KPIs

### Launch Success Criteria
- [ ] At least 10 successful partner registrations in first week
- [ ] Zero critical bugs in production
- [ ] Email delivery rate > 98%
- [ ] Average approval turnaround time < 48 hours
- [ ] Partner activation rate > 80%
- [ ] Zero data breaches
- [ ] System uptime > 99.5%

### 30-Day Success Metrics
- 50+ partners registered
- 40+ partners approved
- 35+ partners activated
- Approval turnaround time < 36 hours
- Partner satisfaction score > 4.5/5

### 90-Day Success Metrics
- 200+ partners registered
- 150+ partners active
- Approval turnaround time < 24 hours
- Partner retention rate > 70%
- Zero security incidents



---

## Team Communication Plan

### Daily Standups (15 min)
**Time:** 9:00 AM  
**Format:** Async (Slack) or Sync (Video)

**Questions:**
1. What did you complete yesterday?
2. What will you work on today?
3. Any blockers?

### Weekly Planning (1 hour)
**Time:** Monday 10:00 AM  
**Attendees:** Full Team

**Agenda:**
1. Review previous week progress
2. Plan current week tasks
3. Identify dependencies
4. Adjust timeline if needed

### Sprint Review (1 hour)
**Time:** End of each week (Friday 4:00 PM)  
**Attendees:** Full Team + Stakeholders

**Agenda:**
1. Demo completed features
2. Review metrics
3. Collect feedback
4. Discuss next sprint priorities

### Communication Channels
- **Slack #partner-registration-dev** - Development updates
- **Slack #engineering** - General engineering announcements
- **GitHub Issues** - Bug tracking & feature requests
- **Notion** - Documentation & specs
- **Google Meet** - Video calls

---

## Tools & Technologies

### Development
- **Framework:** Next.js 16 (React Server Components, Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Supabase)
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **Email:** Supabase Auth Email Templates
- **Forms:** react-hook-form + zod
- **UI:** Tailwind CSS + shadcn/ui
- **State:** TanStack Query (React Query)

### Testing
- **Unit:** Jest + Testing Library
- **E2E:** Playwright
- **API:** Supertest
- **Coverage:** Istanbul/nyc

### DevOps
- **Hosting:** Vercel
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry (errors), DataDog (APM)
- **Logs:** Supabase Logs + DataDog
- **Feature Flags:** Database-based

### Collaboration
- **Version Control:** GitHub
- **Project Management:** Linear/Jira
- **Documentation:** Notion + Markdown (in repo)
- **Design:** Figma
- **Communication:** Slack



---

## Appendix

### A. File Structure
```
bella-spa-erp/
├── docs/
│   └── portal/
│       ├── PARTNER_REGISTRATION_SYSTEM_SPEC.md
│       └── PARTNER_REGISTRATION_IMPLEMENTATION_PLAN.md (this file)
├── supabase/
│   └── migrations/
│       └── 20260802130000_partner_registration_system.sql
├── src/
│   ├── app/
│   │   ├── partner/
│   │   │   ├── register/                      # Public registration
│   │   │   ├── verify/                        # Email verification
│   │   │   ├── activate/                      # Password setup
│   │   │   └── application-status/            # Self-service status
│   │   └── dashboard/
│   │       └── admin/
│   │           └── partner-approvals/         # Admin dashboard
│   ├── services/
│   │   ├── partner-registration-actions.ts    # Registration APIs
│   │   └── partner-provisioning.ts            # Provisioning engine
│   ├── types/
│   │   └── partner-registration.types.ts      # TypeScript types
│   ├── email-templates/
│   │   └── partner/                           # Email templates
│   └── lib/
│       ├── captcha.ts                         # CAPTCHA helpers
│       └── rate-limit.ts                      # Rate limiting
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### B. Environment Variables
```env
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Storage
SUPABASE_STORAGE_BUCKET=partner-application-documents

# Email
SUPABASE_SMTP_HOST=smtp.supabase.net
SUPABASE_SMTP_PORT=587

# Security
CAPTCHA_SECRET_KEY=6Lf...
RATE_LIMIT_REDIS_URL=redis://...

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Feature Flags
ENABLE_PARTNER_REGISTRATION=true
```



### C. Database Schema Reference

```sql
-- Core Tables
partner_applications
  ├── id (uuid, PK)
  ├── applicant_type (enum)
  ├── status (enum)
  ├── full_name (text)
  ├── email (text, unique)
  ├── phone (text)
  ├── company_name (text, nullable)
  ├── tax_code (text, nullable)
  ├── documents (jsonb)
  ├── email_verified_at (timestamptz, nullable)
  ├── approved_by (uuid, FK → users.id, nullable)
  ├── approved_at (timestamptz, nullable)
  ├── rejected_at (timestamptz, nullable)
  ├── rejection_reason (text, nullable)
  ├── tenant_id (uuid, FK → tenants.id, nullable)
  ├── user_id (uuid, FK → users.id, nullable)
  ├── created_at (timestamptz)
  └── updated_at (timestamptz)

partner_application_logs
  ├── id (uuid, PK)
  ├── application_id (uuid, FK → partner_applications.id)
  ├── action (text)
  ├── performed_by (uuid, FK → users.id, nullable)
  ├── metadata (jsonb)
  └── created_at (timestamptz)
```

### D. API Endpoints Summary

**Public Endpoints:**
```
POST   /api/partner/register/draft           # Create draft application
POST   /api/partner/register/submit          # Submit for review
POST   /api/partner/register/upload          # Upload document
GET    /api/partner/verify?token=xxx         # Verify email
POST   /api/partner/resend-verification      # Resend email
GET    /api/partner/activate/validate        # Validate activation token
POST   /api/partner/activate                 # Set password
GET    /api/partner/application-status       # Check status
```

**Admin Endpoints (Authenticated):**
```
GET    /api/admin/partner-approvals          # List applications
GET    /api/admin/partner-approvals/:id      # Get details
POST   /api/admin/partner-approvals/:id/approve      # Approve
POST   /api/admin/partner-approvals/:id/request-info # Request info
POST   /api/admin/partner-approvals/:id/reject       # Reject
POST   /api/admin/partner-approvals/:id/comment      # Add note
POST   /api/admin/partner-approvals/batch            # Batch actions
```

### E. Email Templates Checklist

- [ ] `registration-verification.html` - Email verification
- [ ] `application-submitted.html` - Confirmation to partner
- [ ] `admin-new-application.html` - Notification to admin
- [ ] `application-approved.html` - Approval notification
- [ ] `account-activation.html` - Account activation link
- [ ] `request-more-info.html` - Info request notification
- [ ] `application-rejected.html` - Rejection notification
- [ ] `account-activated.html` - Welcome email after activation

### F. Testing Checklist

**Unit Tests:**
- [ ] Validation schemas (zod)
- [ ] Database functions (CRUD operations)
- [ ] Email generation logic
- [ ] Token generation/validation
- [ ] Provisioning logic (mocked)

**Integration Tests:**
- [ ] Registration API endpoints
- [ ] Document upload flow
- [ ] Email verification flow
- [ ] Admin approval actions
- [ ] Provisioning with database

**E2E Tests (Playwright):**
- [ ] Complete registration → approval → activation flow
- [ ] Document upload & validation
- [ ] Email verification
- [ ] Admin dashboard operations
- [ ] Error scenarios (expired token, duplicate email)

**Performance Tests:**
- [ ] 100 concurrent registrations
- [ ] Batch approval of 50 apps
- [ ] Large file upload (5MB)
- [ ] Database query performance

**Security Tests:**
- [ ] SQL injection
- [ ] XSS attacks
- [ ] CSRF protection
- [ ] Authentication bypass
- [ ] Authorization bypass
- [ ] File upload vulnerabilities



### G. Troubleshooting Guide

**Issue: Email not delivered**
- Check Supabase email logs
- Verify SMTP configuration
- Check spam folder
- Verify email address is valid
- Check rate limiting (5 emails per day)

**Issue: Document upload fails**
- Check file size (max 5MB)
- Check file type (JPEG, PNG, PDF only)
- Verify Supabase Storage bucket exists
- Check RLS policies on bucket
- Verify network connectivity

**Issue: Provisioning fails**
- Check database transaction logs
- Verify tenant creation logic
- Verify user creation logic
- Check for duplicate email
- Review error in Sentry

**Issue: Activation link expired**
- Token valid for 72 hours
- Partner can request new activation email
- Admin can regenerate activation link

**Issue: Concurrent approval conflict**
- Use optimistic locking
- Retry with exponential backoff
- Show error to second admin

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-02 | [Tech Lead] | Initial implementation plan |
| 1.1 | 2026-08-03 | [Product Owner] | Added UAT scenarios |
| 1.2 | 2026-08-05 | [QA Engineer] | Added testing checklist |

---

## Sign-Off

This implementation plan requires approval from the following stakeholders:

- [ ] **Product Owner:** _________________ Date: _______
- [ ] **Tech Lead:** _________________ Date: _______
- [ ] **Engineering Manager:** _________________ Date: _______
- [ ] **QA Lead:** _________________ Date: _______
- [ ] **DevOps Lead:** _________________ Date: _______

---

## Next Steps

1. **Review this plan** with the entire team
2. **Get stakeholder sign-off** from all required parties
3. **Create tasks** in project management tool (Linear/Jira)
4. **Assign owners** to each task
5. **Kick off Week 1** - Foundation & Database Schema
6. **Setup monitoring** and dashboards before launch

---

**Questions or concerns?** Contact Tech Lead or post in #partner-registration-dev

**Document Location:** `docs/portal/PARTNER_REGISTRATION_IMPLEMENTATION_PLAN.md`

**Related Documents:**
- [PARTNER_REGISTRATION_SYSTEM_SPEC.md](./PARTNER_REGISTRATION_SYSTEM_SPEC.md) - Technical specification
- [PARTNER_PORTAL_IMPLEMENTATION_STATUS.md](./PARTNER_PORTAL_IMPLEMENTATION_STATUS.md) - Portal status

---

**End of Implementation Plan**
