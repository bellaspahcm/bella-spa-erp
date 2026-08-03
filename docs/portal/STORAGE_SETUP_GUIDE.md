# Supabase Storage Setup Guide - Partner Documents

## Overview
Setup guide for document upload and storage for Partner Registration system.

**Storage Solution:** Supabase Storage  
**Bucket:** `partner-documents` (private)  
**Max File Size:** 10MB  
**Allowed Types:** PDF, Images (JPG/PNG/WebP), Office Docs (DOC/DOCX/XLS/XLSX)

**Time Required:** 15 minutes  
**Difficulty:** Easy

---

## Step 1: Create Storage Bucket

### Via Supabase Dashboard
1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Fill in:
   - **Name:** `partner-documents`
   - **Public:** ❌ Unchecked (private bucket)
   - **File size limit:** 10 MB
   - **Allowed MIME types:** Leave empty (all types allowed, we validate in code)
4. Click **Create bucket**

### Via SQL (Alternative)
```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partner-documents',
  'partner-documents',
  false, -- Private bucket
  10485760, -- 10MB in bytes
  NULL -- All MIME types
);
```

---

## Step 2: Configure Storage Policies

### Allow Authenticated Uploads
```sql
-- Policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload partner documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-documents'
);
```

### Allow Admin Read Access
```sql
-- Policy: Allow admins to read all documents
CREATE POLICY "Admins can read all partner documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_name IN ('admin', 'super_admin')
  )
);
```

### Allow Admin Delete
```sql
-- Policy: Allow admins to delete documents
CREATE POLICY "Admins can delete partner documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'partner-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_name IN ('admin', 'super_admin')
  )
);
```

### Allow Service Role Full Access
```sql
-- Policy: Service role has full access (for server-side operations)
CREATE POLICY "Service role has full access to partner documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'partner-documents')
WITH CHECK (bucket_id = 'partner-documents');
```

---

## Step 3: Deploy Database Functions

Run the migration:
```bash
# Via Supabase CLI
npx supabase db push --db-url "postgresql://..."

# Or via SQL Editor in Dashboard
# Copy and run: supabase/migrations/20260802140000_partner_documents_storage.sql
```

This creates:
- `add_partner_document(...)` - Add document reference to application
- `remove_partner_document(...)` - Remove document reference

---

## Step 4: Test Upload Functionality

### Test via API
```bash
# Upload a document
curl -X POST http://localhost:3000/api/partner/documents/upload \
  -F "file=@/path/to/test.pdf" \
  -F "applicationId=<uuid>" \
  -F "category=business_license" \
  -F "description=Test upload"

# Expected response:
# {
#   "success": true,
#   "fileUrl": "https://...supabase.co/storage/v1/object/public/partner-documents/...",
#   "filePath": "<applicationId>/business_license/1234567890_test.pdf",
#   "message": "Upload thành công"
# }
```

### Test via UI Component
```tsx
import DocumentUploader from '@/components/partner/DocumentUploader';

<DocumentUploader
  applicationId="<uuid>"
  category="business_license"
  onUploadSuccess={(url, path) => {
    console.log('Uploaded:', url, path);
    // Refresh document list
  }}
  onUploadError={(error) => {
    console.error('Upload error:', error);
  }}
/>
```

---

## Step 5: Integrate into Admin Detail Page

Update `src/app/admin/partner-applications/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import DocumentUploader from '@/components/partner/DocumentUploader';
import DocumentList from '@/components/partner/DocumentList';

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  return (
    <div className="space-y-8">
      {/* Existing application details... */}
      
      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Tài liệu đính kèm</h2>
        
        {/* Document List */}
        <div className="mb-6">
          <DocumentList
            applicationId={params.id}
            refreshTrigger={refreshTrigger}
            onDelete={() => {
              // Optional: Log deletion or show notification
            }}
          />
        </div>
        
        {/* Upload Forms */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-gray-900">Upload tài liệu mới</h3>
          
          <DocumentUploader
            applicationId={params.id}
            category="business_license"
            onUploadSuccess={() => {
              setRefreshTrigger(prev => prev + 1); // Trigger refresh
            }}
          />
          
          <DocumentUploader
            applicationId={params.id}
            category="tax_certificate"
            onUploadSuccess={() => {
              setRefreshTrigger(prev => prev + 1);
            }}
          />
          
          <DocumentUploader
            applicationId={params.id}
            category="id_card"
            onUploadSuccess={() => {
              setRefreshTrigger(prev => prev + 1);
            }}
          />
          
          <DocumentUploader
            applicationId={params.id}
            category="other"
            onUploadSuccess={() => {
              setRefreshTrigger(prev => prev + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Step 6: Configure CORS (if needed)

If uploading from different domain:

```sql
-- Update bucket CORS settings
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
WHERE id = 'partner-documents';
```

---

## Security Considerations

### File Validation
✅ **Client-side:**
- File type validation (extension + MIME type)
- File size limit (10MB)
- UI feedback for invalid files

✅ **Server-side:**
- Double-check file type and size
- Sanitize file names (remove special characters)
- Validate application ID exists

### Access Control
✅ **Upload:**
- Only authenticated users can upload
- Must provide valid application ID

✅ **View:**
- Admins can view all documents
- Partners can view only their own (future feature)
- Signed URLs with 1-hour expiry

✅ **Delete:**
- Only admins can delete
- Check admin role before deletion

### Storage
✅ **Private bucket:**
- No public access
- All access via signed URLs
- URLs expire after 1 hour

✅ **File organization:**
- Organized by application ID
- Categorized by document type
- Timestamped filenames (prevent overwrites)

---

## Monitoring & Maintenance

### Storage Usage
Check storage usage in Supabase Dashboard:
1. Go to **Settings → Billing**
2. View **Storage** usage
3. Monitor:
   - Total size (free tier: 1GB)
   - Number of files
   - API requests

### Cleanup Old Files
```sql
-- Find orphaned files (no matching application)
SELECT *
FROM storage.objects
WHERE bucket_id = 'partner-documents'
  AND NOT EXISTS (
    SELECT 1 FROM partner_applications
    WHERE documents::TEXT LIKE '%' || storage.objects.name || '%'
  );

-- Delete orphaned files (manual review first!)
DELETE FROM storage.objects
WHERE bucket_id = 'partner-documents'
  AND NOT EXISTS (
    SELECT 1 FROM partner_applications
    WHERE documents::TEXT LIKE '%' || storage.objects.name || '%'
  );
```

### Set up Alerts
- Alert when storage > 800MB (80% of 1GB free tier)
- Alert when upload fails > 10 times/hour
- Alert when delete fails

---

## Troubleshooting

### Upload Fails with "Permission Denied"
**Cause:** Missing storage policies
**Solution:**
1. Check policies exist: `SELECT * FROM storage.policies WHERE bucket_id = 'partner-documents';`
2. Re-run policy SQL from Step 2
3. Verify user is authenticated

### File Not Visible in Admin UI
**Cause:** Signed URL generation failed
**Solution:**
1. Check file exists: `SELECT * FROM storage.objects WHERE bucket_id = 'partner-documents' AND name = '<path>';`
2. Verify admin has read policy
3. Check service role key is configured

### "File Too Large" Error
**Cause:** File exceeds 10MB limit
**Solution:**
1. Ask user to compress/resize file
2. Or increase limit in bucket settings
3. Update MAX_FILE_SIZE in code

### CORS Errors
**Cause:** Cross-origin upload blocked
**Solution:**
1. Add allowed origins in Supabase Dashboard → API → CORS
2. Or use same-origin uploads only

---

## Production Checklist

Before going live:

### Storage Configuration
- [ ] Bucket created with correct name
- [ ] Bucket is private (not public)
- [ ] File size limit set (10MB)
- [ ] CORS configured (if needed)

### Security Policies
- [ ] Upload policy active (authenticated)
- [ ] Read policy active (admins only)
- [ ] Delete policy active (admins only)
- [ ] Service role policy active

### Database Functions
- [ ] Migration deployed successfully
- [ ] RPC functions callable
- [ ] Test add/remove document

### API Endpoints
- [ ] Upload endpoint tested
- [ ] List endpoint tested
- [ ] Delete endpoint tested
- [ ] Error handling verified

### UI Components
- [ ] Upload component integrated
- [ ] Document list component integrated
- [ ] Progress indicator works
- [ ] Error messages clear

### Monitoring
- [ ] Storage usage tracking enabled
- [ ] Upload success/failure logged
- [ ] Alert thresholds configured

---

## Upgrade Path

### Increase Storage (Paid Plan)
- **Pro Plan:** $25/mo → 100GB storage
- **Pay-as-you-go:** $0.021/GB/month

### Add Features
1. **Partner Self-Upload:** Allow partners to upload documents during registration
2. **Document Verification:** Admin workflow to approve/reject documents
3. **OCR Integration:** Extract data from ID cards, business licenses
4. **Virus Scanning:** Integrate ClamAV or similar
5. **Compression:** Auto-compress large images
6. **Thumbnail Generation:** Generate previews for images/PDFs

---

## Support Resources

- **Supabase Storage Docs:** https://supabase.com/docs/guides/storage
- **Storage API Reference:** https://supabase.com/docs/reference/javascript/storage
- **Storage Limits:** https://supabase.com/docs/guides/platform/quotas
- **Community:** https://github.com/supabase/supabase/discussions

---

**Last Updated:** 2026-08-02  
**Maintained By:** Bella ERP Dev Team
