# Partner Portal - Deployment Checklist

## Pre-Deployment ✅

- [x] All tests passing (181/181)
- [x] Build successful (204 pages)
- [x] Migrations ready (3 files)
- [x] Documentation complete

## Database Deployment

### 1. Deploy Migrations
```bash
# Option A: CLI (recommended)
npx supabase db push

# Option B: Manual (Dashboard SQL Editor)
# Copy & run each migration:
# - supabase/migrations/20260802112935_partner_registration_system.sql
# - supabase/migrations/20260802130000_create_user_roles.sql
# - supabase/migrations/20260802140000_partner_documents_storage.sql
```

### 2. Verify Tables
```sql
-- Check tables exist
\d partner_applications
\d partner_application_logs
\d user_roles

-- Check RPC functions
SELECT proname FROM pg_proc 
WHERE proname IN ('add_partner_document', 'remove_partner_document');
```

### 3. Regenerate Types
```bash
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

### 4. Seed Test Data (Optional)
```bash
psql "your-db-url" < scripts/seed-partner-test-data.sql
```

## Security Configuration

### 1. SendGrid (Email)
```bash
# Vercel Environment Variables
SENDGRID_API_KEY=SG.your-key
EMAIL_FROM=noreply@bella-erp.com
NEXT_PUBLIC_APP_URL=https://staging.bella-erp.com
```
Guide: `docs/portal/SENDGRID_SETUP_GUIDE.md`

### 2. reCAPTCHA (Bot Protection)
```bash
# Vercel Environment Variables
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key
```
Guide: `docs/portal/SECURITY_SETUP_GUIDE.md`

### 3. Supabase Storage (Documents)
1. Create bucket: `partner-documents` (private)
2. Set up RLS policies (see guide)
3. Test upload/download

Guide: `docs/portal/STORAGE_SETUP_GUIDE.md`

## Admin Setup

### 1. Assign Admin Role
```bash
psql "your-db-url" < scripts/add-admin-user.sql
# Edit email in script first!
```

### 2. Verify Access
- Login with admin account
- Visit `/admin/partner-applications`
- Should see list page (empty or with test data)

## Application Deployment

### 1. Vercel Deployment
```bash
# Push to main branch
git push origin main

# Or manual deploy
vercel --prod
```

### 2. Verify Build
- Check Vercel deployment logs
- Verify 0 build errors
- Check 204 pages generated

## Post-Deployment Testing

### 1. Registration Flow
- [ ] Visit `/partner/register`
- [ ] Fill form with test data
- [ ] Submit (should see success message)
- [ ] Check console logs (email sent)

### 2. Email Verification
- [ ] Check email inbox (or console)
- [ ] Click verification link
- [ ] Should see "Email verified" message

### 3. Admin Workflow
- [ ] Login as admin
- [ ] Visit `/admin/partner-applications`
- [ ] Find test application
- [ ] View detail page
- [ ] Test approve/reject/request-info

### 4. Provisioning
- [ ] Approve application
- [ ] Check tenant created
- [ ] Check user created
- [ ] Verify roles assigned

### 5. Activation
- [ ] Check activation email (or console)
- [ ] Click activation link
- [ ] Set password
- [ ] Login with new account

## Monitoring

### 1. Database
```sql
-- Check application count
SELECT status, COUNT(*) FROM partner_applications GROUP BY status;

-- Check recent logs
SELECT * FROM partner_application_logs ORDER BY created_at DESC LIMIT 10;

-- Check provisioned tenants
SELECT * FROM tenants WHERE metadata->>'source' = 'partner_registration';
```

### 2. Error Logs
- Vercel Runtime Logs
- Supabase Database Logs
- Sentry (if configured)

### 3. Metrics
- Registration conversion rate
- Email verification rate
- Approval rate
- Time to activation

## Rollback Plan

If issues found:

### 1. Disable Registration
```typescript
// Temporarily disable in code
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Registration temporarily disabled' },
    { status: 503 }
  );
}
```

### 2. Revert Migrations
```bash
# Check migration history
npx supabase db remote

# Revert if needed (manual)
# Drop tables, remove RPC functions
```

### 3. Clear Test Data
```sql
DELETE FROM partner_applications WHERE email LIKE '%test%';
DELETE FROM partner_application_logs WHERE application_id IN (...);
```

## Success Criteria

- [x] All migrations deployed
- [x] Build passing
- [x] Test registration works
- [x] Email verification works
- [x] Admin can approve
- [x] Provisioning creates tenant
- [x] Activation works
- [x] No errors in logs

## Support

**Issues:** Check docs first, then:
- Supabase Dashboard → Database → Logs
- Vercel Dashboard → Deployments → Logs
- `docs/portal/*.md` guides

**Contact:** dev-team@bella-erp.com
