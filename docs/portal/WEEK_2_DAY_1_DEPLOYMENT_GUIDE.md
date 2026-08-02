# Week 2 Day 1: Partner Registration Deployment Guide

**Date:** August 2, 2026  
**Time Estimate:** 30 minutes  
**Prerequisites:** Supabase project access, admin credentials

---

## 📋 Deployment Checklist

### Step 1: Deploy Database Migration (5 min) ✅

#### Option A: Via Supabase Dashboard (Recommended)

1. **Navigate to SQL Editor:**
   ```
   https://supabase.com/dashboard/project/prbytsdxmgukikydbvoo/sql
   ```

2. **Copy Migration File:**
   - Open: `supabase/migrations/20260802112935_partner_registration_system.sql`
   - Copy ALL content (527 lines)

3. **Execute:**
   - Paste into SQL Editor
   - Click "Run" (▶️ button)
   - Wait for: "Success. No rows returned" or completion message

4. **Expected Output:**
   ```
   NOTICE:  Partner Registration System migration completed successfully
   Success. No rows returned
   Time: ~2-3 seconds
   ```

#### Option B: Via Supabase CLI (Alternative)

```bash
# Link project (if not already linked)
npx supabase link --project-ref prbytsdxmgukikydbvoo

# Push migration
npx supabase db push

# If that fails, try reset
npx supabase db reset --linked
```

**⚠️ Known Issues:**
- CLI may fail with "Not Found" error (project ref authentication)
- If CLI fails, use Dashboard method (Option A)

---

### Step 2: Verify Migration (2 min) ✅

Run verification queries in SQL Editor:

```sql
-- 1. Check tables exist
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE tablename IN ('partner_applications', 'partner_application_logs')
ORDER BY tablename;

-- Expected: 2 rows

-- 2. Check columns in partner_applications
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'partner_applications'
ORDER BY ordinal_position;

-- Expected: 50+ columns

-- 3. Check ENUMs exist
SELECT 
  typname,
  array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE 'partner_%'
GROUP BY typname
ORDER BY typname;

-- Expected: 3 ENUMs
-- partner_applicant_type: {individual_broker, agency, company}
-- partner_application_log_action: {created, submitted, email_verified, ...}
-- partner_application_status: {draft, pending_verification, need_more_info, ...}

-- 4. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('partner_applications', 'partner_application_logs')
ORDER BY tablename, policyname;

-- Expected: 6-7 policies

-- 5. Check functions exist
SELECT 
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname LIKE '%partner%application%'
ORDER BY proname;

-- Expected: 4 functions
-- generate_activation_token
-- generate_email_verification_token
-- get_partner_application_stats
-- verify_partner_application_email

-- 6. Check indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('partner_applications', 'partner_application_logs')
ORDER BY tablename, indexname;

-- Expected: 10+ indexes

-- 7. Test email verification function
SELECT generate_email_verification_token();
-- Expected: Base64 string (e.g., "aBc123XyZ...")

-- 8. Test stats function (should return empty stats)
SELECT get_partner_application_stats(NULL);
-- Expected: JSON object with all counters = 0
```

**✅ Success Criteria:**
- All queries return expected results
- No errors in output
- Functions return valid data

---

### Step 3: Create Storage Bucket (3 min) ✅

#### Via Supabase Dashboard:

1. **Navigate to Storage:**
   ```
   https://supabase.com/dashboard/project/prbytsdxmgukikydbvoo/storage/buckets
   ```

2. **Create New Bucket:**
   - Click "New bucket"
   - **Name:** `partner-application-documents`
   - **Public:** ❌ OFF (private bucket)
   - Click "Create bucket"

3. **Configure Bucket Settings:**
   - Click on bucket name
   - Go to "Policies" tab
   - Add policies:

**Policy 1: Authenticated users can upload documents**
```sql
CREATE POLICY "Authenticated users can upload partner documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-application-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 2: Users can view their own documents**
```sql
CREATE POLICY "Users can view own partner documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-application-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 3: Admins can view all documents**
```sql
CREATE POLICY "Admins can view all partner documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-application-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role_name IN ('admin', 'super_admin')
  )
);
```

4. **Configure File Restrictions:**
   - Max file size: `5 MB`
   - Allowed MIME types:
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `application/pdf`

---

### Step 4: Update Environment Variables (1 min) ✅

Add to `.env.local` (if not already present):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://prbytsdxmgukikydbvoo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...

# Storage
NEXT_PUBLIC_STORAGE_BUCKET=partner-application-documents

# Email (TODO: Configure in Week 2 Day 4)
# EMAIL_SERVICE=sendgrid
# SENDGRID_API_KEY=SG.xxx
# EMAIL_FROM=noreply@bella.ai
```

---

### Step 5: Regenerate TypeScript Types (2 min) ✅

```bash
cd "d:\Antigravity\Projects\BELLA SPA ERP"

# Regenerate database types
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts

# Expected output:
# ✓ Generating types...
# ✓ Types written to src/types/database.types.ts
```

**Verify types generated:**
```bash
# Check file size (should be 50KB+)
ls -lh src/types/database.types.ts

# Check partner types exist
grep -n "partner_applications" src/types/database.types.ts
grep -n "partner_application_status" src/types/database.types.ts
```

---

### Step 6: Test Registration Flow (15 min) ✅

#### 6.1 Test Draft Creation (via Supabase)

```sql
-- Insert test draft
INSERT INTO partner_applications (
  applicant_type,
  full_name,
  email,
  phone,
  status
) VALUES (
  'individual_broker',
  'Test User',
  'test@example.com',
  '+84901234567',
  'draft'
) RETURNING id, status, created_at;

-- Expected: Returns UUID + 'draft' status

-- Verify log created
SELECT 
  action,
  action_description,
  created_at
FROM partner_application_logs
WHERE application_id = '<paste-uuid-here>'
ORDER BY created_at DESC;

-- Expected: 1 row with 'created' action
```

#### 6.2 Test Email Verification

```sql
-- 1. Generate verification token
UPDATE partner_applications
SET 
  email_verification_token = generate_email_verification_token(),
  email_verification_token_expires_at = NOW() + INTERVAL '24 hours',
  status = 'pending_verification'
WHERE email = 'test@example.com'
RETURNING email_verification_token;

-- Copy the token output

-- 2. Verify email (use copied token)
SELECT verify_partner_application_email('paste-token-here');

-- Expected: {"success": true, "application_id": "...", "status": "pending_verification"}

-- 3. Check email_verified_at populated
SELECT 
  email,
  email_verified_at,
  status
FROM partner_applications
WHERE email = 'test@example.com';

-- Expected: email_verified_at NOT NULL
```

#### 6.3 Test Frontend Registration (Manual)

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/partner/register
   ```

3. **Test Step 1:**
   - Fill name: "John Doe"
   - Fill email: "john.doe@test.com"
   - Fill phone: "0901234567"
   - Select type: "Individual Broker"
   - Click "Tiếp tục"
   - **Expected:** No errors, proceeds to Step 2

4. **Test Step 2:**
   - (Skip address fields - optional)
   - Click "Tiếp tục"
   - **Expected:** Proceeds to Step 3

5. **Test Step 3:**
   - **Skip for now** (document upload requires storage bucket)
   - Click "Tiếp tục"
   - **Expected:** Proceeds to Step 4

6. **Test Step 4:**
   - Review information
   - Click "Gửi đơn đăng ký"
   - **Expected:** 
     - Success message
     - Redirects to `/partner/verify?application_id=...`
     - (Email not sent yet - TODO Week 2 Day 4)

7. **Verify in Database:**
   ```sql
   SELECT 
     id,
     full_name,
     email,
     status,
     submitted_at
   FROM partner_applications
   WHERE email = 'john.doe@test.com';
   
   -- Expected: 1 row, status = 'pending_verification'
   ```

#### 6.4 Test Error Handling

1. **Test duplicate email (should fail):**
   - Navigate back to `/partner/register`
   - Use same email: "john.doe@test.com"
   - **Expected:** Error message (if duplicate check implemented)

2. **Test invalid email:**
   - Email: "invalid-email"
   - **Expected:** Validation error

3. **Test invalid phone:**
   - Phone: "123"
   - **Expected:** Validation error

---

### Step 7: Monitor Logs (Ongoing) ✅

#### Check Supabase Logs:

```
https://supabase.com/dashboard/project/prbytsdxmgukikydbvoo/logs/explorer
```

**Filters:**
- Database errors
- API errors
- Storage errors

**Watch for:**
- RLS policy violations
- Missing table errors
- Permission errors

#### Check Application Logs:

```sql
-- View recent application logs
SELECT 
  pa.email,
  pal.action,
  pal.action_description,
  pal.created_at
FROM partner_application_logs pal
JOIN partner_applications pa ON pa.id = pal.application_id
ORDER BY pal.created_at DESC
LIMIT 20;
```

---

## ✅ Deployment Complete Checklist

- [ ] Migration executed successfully
- [ ] All tables exist (partner_applications, partner_application_logs)
- [ ] All ENUMs created (3 types)
- [ ] RLS policies active (6 policies)
- [ ] Functions work (4 functions tested)
- [ ] Storage bucket created (partner-application-documents)
- [ ] Storage policies configured (3 policies)
- [ ] TypeScript types regenerated
- [ ] Draft creation works (SQL test passed)
- [ ] Email verification works (SQL test passed)
- [ ] Frontend registration loads (http://localhost:3000/partner/register)
- [ ] Form validation works (tested invalid inputs)
- [ ] Status page loads (http://localhost:3000/partner/application-status)

---

## 🚨 Troubleshooting

### Issue: Migration fails with "table already exists"

**Solution:**
```sql
-- Drop tables if exist (CAUTION: This deletes data)
DROP TABLE IF EXISTS partner_application_logs CASCADE;
DROP TABLE IF EXISTS partner_applications CASCADE;
DROP TYPE IF EXISTS partner_application_log_action CASCADE;
DROP TYPE IF EXISTS partner_applicant_type CASCADE;
DROP TYPE IF EXISTS partner_application_status CASCADE;

-- Re-run migration
```

### Issue: RLS policy violation

**Solution:**
```sql
-- Check current user
SELECT current_user, current_setting('request.jwt.claims', true);

-- Temporarily disable RLS for testing (development only!)
ALTER TABLE partner_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE partner_application_logs DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_application_logs ENABLE ROW LEVEL SECURITY;
```

### Issue: Function not found

**Solution:**
```sql
-- List all functions
SELECT proname FROM pg_proc WHERE proname LIKE '%partner%';

-- Re-create missing function (copy from migration file)
```

### Issue: Storage upload fails

**Solution:**
1. Check bucket exists: Storage > Buckets
2. Check policies exist: Bucket > Policies tab
3. Check file size < 5MB
4. Check MIME type allowed
5. Check user authenticated

---

## 📊 Post-Deployment Metrics

### Expected Performance:
- Draft creation: <200ms
- Email verification: <100ms (RPC)
- Status query: <50ms
- Document upload: <2s (5MB)

### Database Size:
- partner_applications: ~2KB per row
- partner_application_logs: ~500 bytes per row
- Indexes: ~5KB per 1000 rows

### Monitor:
- Query performance (pg_stat_statements)
- Storage usage (Storage dashboard)
- Error rate (Logs explorer)

---

## 🎯 Next Steps (Week 2 Day 2-5)

### Day 2: Admin Dashboard
- List all applications (table view)
- Filter by status
- Search by name/email
- View details modal

### Day 3: Admin Actions
- Approve application
- Reject application
- Request more info
- View audit logs

### Day 4: Email Integration
- SendGrid setup
- Email templates (verification, approval, rejection)
- Test email delivery

### Day 5: Phone & AI Integration
- SMS verification (Twilio)
- AI fraud detection scoring
- Automated risk assessment

---

**Deployment Status:** ✅ Ready for Testing  
**Next:** Manual testing + bug fixes  
**ETA:** Week 2 Day 1 complete (~30 minutes)

---

*Updated: August 2, 2026*
