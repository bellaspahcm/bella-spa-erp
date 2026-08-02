-- ============================================================================
-- Setup Storage Bucket for Partner Application Documents
-- Run this AFTER the main migration is deployed
-- ============================================================================

-- Check if bucket already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'partner-application-documents') THEN
    -- Create bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'partner-application-documents',
      'partner-application-documents',
      false, -- Private bucket
      10485760, -- 10 MB limit
      NULL -- All MIME types allowed
    );
    
    RAISE NOTICE '✅ Storage bucket created: partner-application-documents';
  ELSE
    RAISE NOTICE '⚠️  Bucket already exists: partner-application-documents';
  END IF;
END $$;

-- ============================================================================
-- RLS Policies for Storage
-- ============================================================================

-- Drop existing policies if they exist (for re-run safety)
DROP POLICY IF EXISTS "Authenticated can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own or admins view all" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- Policy 1: Authenticated users can upload documents
CREATE POLICY "Authenticated can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-application-documents'
  AND auth.role() = 'authenticated'
);

-- Policy 2: Users can view their own documents OR admins can view all
CREATE POLICY "Users can view own or admins view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-application-documents'
  AND (
    -- Owner can see their documents (folder name = user_id)
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

-- Policy 3: Only admins can delete documents
CREATE POLICY "Admins can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'partner-application-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role_name IN ('admin', 'super_admin')
  )
);

-- ============================================================================
-- Verification
-- ============================================================================

-- Check bucket created
DO $$
DECLARE
  v_bucket_count INT;
  v_policy_count INT;
BEGIN
  -- Count bucket
  SELECT COUNT(*) INTO v_bucket_count
  FROM storage.buckets
  WHERE name = 'partner-application-documents';
  
  IF v_bucket_count = 0 THEN
    RAISE EXCEPTION '❌ Bucket not created!';
  END IF;
  
  -- Count policies (should be 3)
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'Authenticated can upload documents',
      'Users can view own or admins view all',
      'Admins can delete documents'
    );
  
  IF v_policy_count != 3 THEN
    RAISE EXCEPTION '❌ Expected 3 policies, found %', v_policy_count;
  END IF;
  
  RAISE NOTICE '✅ Storage bucket setup complete!';
  RAISE NOTICE '   - Bucket: partner-application-documents';
  RAISE NOTICE '   - Policies: % active', v_policy_count;
END $$;
