/**
 * Partner Documents Storage Manager
 * 
 * Manages document uploads for partner applications:
 * - Business license
 * - Tax registration certificate
 * - ID cards
 * - Bank account documents
 * - Other supporting documents
 * 
 * Storage: Supabase Storage bucket "partner-documents"
 * Access: Private (admin only, service role for upload)
 */

import { createClient } from '@/lib/supabase-server';

export const PARTNER_DOCUMENTS_BUCKET = 'partner-documents';

// Allowed file types
export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
] as const;

export const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
] as const;

// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Document categories
export type DocumentCategory =
  | 'business_license'
  | 'tax_certificate'
  | 'id_card'
  | 'bank_document'
  | 'other';

export interface UploadDocumentParams {
  applicationId: string;
  file: File;
  category: DocumentCategory;
  description?: string;
}

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  filePath?: string;
  error?: string;
}

export interface DocumentMetadata {
  applicationId: string;
  category: DocumentCategory;
  description?: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy?: string;
}

type PartnerDocumentRpc = (
  functionName: 'add_partner_document' | 'remove_partner_document',
  params: Record<string, unknown>
) => Promise<{ error: { message: string } | null }>;

function isAllowedFileType(value: string): value is typeof ALLOWED_FILE_TYPES[number] {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(value);
}

function isAllowedExtension(value: string): value is typeof ALLOWED_EXTENSIONS[number] {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(value);
}

function isDocumentMetadata(value: unknown): value is DocumentMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const doc = value as Record<string, unknown>;
  return typeof doc.applicationId === 'string'
    && typeof doc.category === 'string'
    && typeof doc.originalName === 'string'
    && typeof doc.fileSize === 'number'
    && typeof doc.mimeType === 'string'
    && typeof doc.uploadedAt === 'string';
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File quá lớn. Kích thước tối đa: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  
  // Check file type
  if (!isAllowedFileType(file.type)) {
    return {
      valid: false,
      error: `Loại file không hợp lệ. Chỉ chấp nhận: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }
  
  // Check file name extension
  const ext = file.name.toLowerCase().match(/\.\w+$/)?.[0];
  if (!ext || !isAllowedExtension(ext)) {
    return {
      valid: false,
      error: `Phần mở rộng file không hợp lệ`,
    };
  }
  
  return { valid: true };
}

/**
 * Generate safe file path for storage
 */
export function generateFilePath(
  applicationId: string,
  category: DocumentCategory,
  originalName: string
): string {
  const timestamp = Date.now();
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars
    .replace(/_{2,}/g, '_'); // Remove multiple underscores
  
  return `${applicationId}/${category}/${timestamp}_${sanitizedName}`;
}

/**
 * Upload document to Supabase Storage
 */
export async function uploadDocument(
  params: UploadDocumentParams
): Promise<UploadResult> {
  try {
    const { applicationId, file, category, description } = params;
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }
    
    const supabase = createClient();
    
    // Generate file path
    const filePath = generateFilePath(applicationId, category, file.name);
    
    // Prepare metadata
    const metadata: DocumentMetadata = {
      applicationId,
      category,
      description,
      originalName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
        duplex: 'half',
      });
    
    if (uploadError) {
      console.error('[uploadDocument] Upload error:', uploadError);
      return {
        success: false,
        error: uploadError.message,
      };
    }
    
    // Get public URL (for signed URLs later)
    const { data: urlData } = supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .getPublicUrl(filePath);
    
    // Update application with document reference
    const partnerDocumentRpc = supabase.rpc as unknown as PartnerDocumentRpc;
    const { error: dbError } = await partnerDocumentRpc('add_partner_document', {
      p_application_id: applicationId,
      p_file_path: filePath,
      p_file_url: urlData.publicUrl,
      p_category: category,
      p_metadata: metadata,
    });
    
    if (dbError) {
      console.error('[uploadDocument] DB error:', dbError);
      // Delete uploaded file if DB update fails
      await supabase.storage
        .from(PARTNER_DOCUMENTS_BUCKET)
        .remove([filePath]);
      
      return {
        success: false,
        error: 'Lỗi lưu thông tin file',
      };
    }
    
    return {
      success: true,
      fileUrl: urlData.publicUrl,
      filePath,
    };
    
  } catch (error) {
    console.error('[uploadDocument] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete document from storage
 */
export async function deleteDocument(
  applicationId: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .remove([filePath]);
    
    if (storageError) {
      console.error('[deleteDocument] Storage error:', storageError);
      return {
        success: false,
        error: storageError.message,
      };
    }
    
    // Remove from application documents array
    const partnerDocumentRpc = supabase.rpc as unknown as PartnerDocumentRpc;
    const { error: dbError } = await partnerDocumentRpc('remove_partner_document', {
      p_application_id: applicationId,
      p_file_path: filePath,
    });
    
    if (dbError) {
      console.error('[deleteDocument] DB error:', dbError);
      return {
        success: false,
        error: 'Lỗi cập nhật database',
      };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('[deleteDocument] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get signed URL for private document access (1 hour expiry)
 */
export async function getSignedDocumentUrl(
  filePath: string,
  expiresIn: number = 3600 // 1 hour
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('[getSignedDocumentUrl] Error:', error);
      return { error: error.message };
    }
    
    return { url: data.signedUrl };
    
  } catch (error) {
    console.error('[getSignedDocumentUrl] Exception:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List all documents for an application
 */
export async function listDocuments(
  applicationId: string
): Promise<{ documents: DocumentMetadata[]; error?: string }> {
  try {
    const supabase = createClient();
    
    const { data: application, error } = await supabase
      .from('partner_applications')
      .select('documents')
      .eq('id', applicationId)
      .single();
    
    if (error) {
      console.error('[listDocuments] Error:', error);
      return { documents: [], error: error.message };
    }
    
    const documents = Array.isArray(application?.documents)
      ? (application.documents as unknown[]).filter(isDocumentMetadata)
      : [];
    
    return { documents };
    
  } catch (error) {
    console.error('[listDocuments] Exception:', error);
    return {
      documents: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download document (returns blob)
 */
export async function downloadDocument(
  filePath: string
): Promise<{ blob?: Blob; error?: string }> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .download(filePath);
    
    if (error) {
      console.error('[downloadDocument] Error:', error);
      return { error: error.message };
    }
    
    return { blob: data };
    
  } catch (error) {
    console.error('[downloadDocument] Exception:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
