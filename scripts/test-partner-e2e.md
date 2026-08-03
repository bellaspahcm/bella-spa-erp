# Partner Registration E2E Test

## Prerequisites
- ✅ Migrations deployed
- ✅ Types regenerated
- ✅ Admin role assigned
- ✅ Test data seeded
- ✅ Build passing

## Test Flow

### 1. Registration (Public)
```
URL: http://localhost:3000/partner/register

Steps:
1. Fill 4-step wizard
2. Submit form
3. Check console for email verification link
4. Copy verification token
```

### 2. Email Verification
```
URL: http://localhost:3000/partner/verify?token=TOKEN

Expected:
- ✅ Token valid message
- ✅ Redirect to "Wait for admin approval" page
- ✅ Status: pending_verification → pending_review
```

### 3. Admin Review
```
URL: http://localhost:3000/admin/partner-applications

Steps:
1. Login as admin
2. See test application in list
3. Click to view details
4. Click "Approve" button
5. Check console for provisioning logs
```

### 4. Auto-Provisioning (Backend)
```
Expected logs:
- ✅ Tenant created
- ✅ Auth user created
- ✅ User ID: xxx
- ✅ Activation token: xxx
- ✅ Activation link: http://localhost:3000/partner/activate?token=xxx
```

### 5. Account Activation
```
URL: http://localhost:3000/partner/activate?token=TOKEN

Steps:
1. Open activation link from logs
2. See welcome message with partner name
3. Enter new password (min 8 chars)
4. Click "Activate Account"
5. Expected: Success message
```

### 6. First Login
```
URL: http://localhost:3000/login

Steps:
1. Login with email + new password
2. Expected: Redirect to partner dashboard
3. Check tenant_id in session
```

## Validation Queries

### Check application status
```sql
SELECT 
  email,
  full_name,
  status,
  email_verified_at,
  reviewed_at,
  provisioned_at,
  activated_at,
  tenant_id,
  identity_id
FROM partner_applications
WHERE email = 'test@example.com';
```

### Check logs
```sql
SELECT 
  action,
  action_description,
  performed_by_role,
  created_at
FROM partner_application_logs
WHERE application_id IN (
  SELECT id FROM partner_applications WHERE email = 'test@example.com'
)
ORDER BY created_at DESC;
```

### Check provisioned tenant
```sql
SELECT * FROM tenants 
WHERE id IN (
  SELECT tenant_id FROM partner_applications WHERE email = 'test@example.com'
);
```

### Check provisioned user
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE id IN (
  SELECT identity_id FROM partner_applications WHERE email = 'test@example.com'
);
```

## Expected Results

### Status Progression
```
draft → pending_verification → pending_review → approved 
→ provisioned → activated ✅
```

### Database Records Created
- ✅ partner_applications (1 row)
- ✅ partner_application_logs (6+ rows)
- ✅ tenants (1 row)
- ✅ auth.users (1 row)
- ✅ user_roles (1 row - if uncommented)

### Emails Sent (Console)
1. Verification email (on registration)
2. Activation email (on approve)

## Troubleshooting

### Token expired
- Verification: 24 hours
- Activation: 72 hours
- Re-run seed script to get fresh tokens

### No activation link in logs
- Check approve API logs in terminal
- Check provisioning engine logs
- Verify email service is console.log

### Cannot login
- Check auth.users table for user
- Verify password was set (not in logs)
- Check RLS policies

### 404 on admin pages
- Verify admin role in user_roles table
- Check RLS policies
- Clear browser cache

## Success Criteria
✅ All 6 steps complete without errors  
✅ Status reaches 'activated'  
✅ Can login with new credentials  
✅ Tenant and user exist in database  
✅ Audit logs complete
