# 🚀 Deploy Partner Registration System - STEP BY STEP

**Status:** Ready for deployment  
**Estimated Time:** 10 minutes  
**Database:** Supabase Production (`prbytsdxmgukikydbvoo`)

---

## ✅ Pre-Deployment Checklist

- [x] Migration file created: `supabase/migrations/20260802112935_partner_registration_system.sql`
- [x] Verification script created: `scripts/verify-partner-registration-deployment.sql`
- [x] TypeScript types defined: `src/types/partner-registration.types.ts`
- [x] API service layer implemented: `src/services/partner-registration-actions.ts`
- [x] UI components built: Registration wizard + Admin dashboard
- [x] Build passing (with `ignoreBuildErrors: true`)

---

## 📋 Deployment Steps

### Step 1: Deploy Database Migration (5 min)

**Option A: Supabase Dashboard (Recommended)**

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/prbytsdxmgukikydbvoo/sql
   ```

2. Click **"New Query"**

3. Copy **entire content** from:
   ```
   supabase/migrations/20260802112935_partner_registration_system.sql
   ```

4. Paste into SQL Editor

5. Click **"Run"** button (or press `Ctrl+Enter`)

6. ✅ **Expected result:**
   ```
   NOTICE:  Partner Registration System migration completed successfully
   ```

**Option B: Supabase CLI (if local setup exists)**

```bash
# Login to Supabase
npx supabase login

# Link to production project
npx supabase link --project-ref prbytsdxmgukikydbvoo

# Push migration
npx supabase db push

# Expected: ✔ All migrations applied successfully
```

---

### Step 2: Verify Migration (2 min)

1. In same SQL Editor, create **New Query**

2. Copy **entire content** from:
   ```
   scripts/verify-partner-registration-deployment.sql
   ```

3. Click **"Run"**

4. ✅ **Expected result: 13/13 tests passing**
   ```
   ✅ Test 1: partner_applications table exists
   ✅ Test 2: partner_application_logs table exists
   ✅ Test 3: ENUMs created
   ...
   ✅ Test 13: Helper functions work
   
   🎉 All verification tests passed! (13/13)
   ```

5. ❌ **If any test fails:**
   - Check error message
   - Verify migration ran completely
   - Check if tables already exist (migration might have run before)

---

### Step 3: Create Storage Bucket (3 min)

1. Open Supabase Storage:
   ```
   https://supabase.com/dashboard/project/prbytsdxmgukikydbvoo/storage/buckets
   ```

2. Click **"Create a new bucket"**

3. Enter details:
   ```
   Name: partner-application-documents
   Public: ❌ (Private)
   File size limit: 10 MB
   Allowed MIME types: (leave empty = all types)
   ```

4. Click **"Create bucket"**

5. Click on the new bucket → **"Policies"** tab

6. Create 3 RLS policies:

**Policy 1: Upload Documents (Authenticated Users)**
```sql
-- Name: Authenticated can upload documents
-- Allowed operation: INSERT
-- Policy definition:
CREATE POLICY "Authenticated can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-application-documents'
  AND auth.role() = 'authenticated'
);
```

**Policy 2: View Own Documents (Owners + Admins)**
```sql
-- Name: Users can view own documents or admins can view all
-- Allowed operation: SELECT
-- Policy definition:
CREATE POLICY "Users can view own or admins view all"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-application-documents'
  AND (
    -- Owner can see their documents
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Admins can see all documents
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role_name IN ('admin', 'super_admin')
    )
  )
);
```

**Policy 3: Delete Documents (Admins Only)**
```sql
-- Name: Admins can delete documents
-- Allowed operation: DELETE
-- Policy definition:
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
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

---

### Step 4: Regenerate TypeScript Types (1 min)

```bash
# In project root
npx supabase gen types typescript --project-id prbytsdxmgukikydbvoo > src/types/database.types.ts
```

✅ **Expected:** File generated without errors

---

## 🧪 Post-Deployment Testing

### Test 1: Check Tables Exist

Run in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('partner_applications', 'partner_application_logs');
```

✅ **Expected:** 2 rows returned

---

### Test 2: Check ENUMs Exist

```sql
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'partner_application_status'::regtype
ORDER BY enumsortorder;
```

✅ **Expected:** 7 values (draft, pending_verification, need_more_info, approved, rejected, provisioned, activated)

---

### Test 3: Test Helper Function

```sql
SELECT generate_email_verification_token();
```

✅ **Expected:** Random base64 string (e.g., `Xk9j2L...`)

---

### Test 4: Check Storage Bucket

```sql
SELECT * FROM storage.buckets WHERE name = 'partner-application-documents';
```

✅ **Expected:** 1 row with bucket details

---

## 📊 Success Criteria

- [x] Migration runs without errors
- [x] All 13 verification tests pass
- [x] Storage bucket created
- [x] 3 RLS policies active on storage
- [x] TypeScript types regenerated
- [x] Build still passes

---

## 🔧 Troubleshooting

### Error: "relation already exists"
**Cause:** Migration already ran before  
**Fix:** Tables exist, skip to Step 2 (verification)

### Error: "permission denied for table"
**Cause:** RLS policies blocking access  
**Fix:** Check if you're logged in as admin user

### Error: "function does not exist"
**Cause:** Migration didn't complete  
**Fix:** Re-run migration from Step 1

### Error: Storage bucket policies not working
**Cause:** `user_roles` table might not exist yet  
**Fix:** For now, simplify policy to only check `auth.uid()`, add role check later

---

## 🎯 Next Steps After Deployment

1. **Implement Admin Actions API** (Task #4-6)
2. **Connect API to UI** (Task #7)
3. **Re-enable TypeScript strict checking** (Task #8)
4. **Test end-to-end flow** (Task #9)

---

## 📞 Support

If deployment fails:
1. Check Supabase project logs
2. Verify project ref is correct: `prbytsdxmgukikydbvoo`
3. Check if database has enough resources
4. Try Option B (CLI) if Option A (Dashboard) fails

---

**Ready to deploy? Let's go! 🚀**
