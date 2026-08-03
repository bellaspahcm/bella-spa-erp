import { NextRequest, NextResponse } from 'next/server';
import { uploadDocument, validateFile, type DocumentCategory } from '@/lib/storage/partner-documents';

/**
 * POST /api/partner/documents/upload
 * 
 * Upload document for partner application
 * 
 * Content-Type: multipart/form-data
 * 
 * Form Fields:
 * - file: File (required)
 * - applicationId: string (required)
 * - category: DocumentCategory (required)
 * - description: string (optional)
 * 
 * Response:
 * {
 *   success: true;
 *   fileUrl: string;
 *   filePath: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    
    const file = formData.get('file') as File | null;
    const applicationId = formData.get('applicationId') as string | null;
    const category = formData.get('category') as DocumentCategory | null;
    const description = formData.get('description') as string | null;
    
    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File không được để trống' },
        { status: 400 }
      );
    }
    
    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: 'Application ID không được để trống' },
        { status: 400 }
      );
    }
    
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category không được để trống' },
        { status: 400 }
      );
    }
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    
    // Upload document
    const result = await uploadDocument({
      applicationId,
      file,
      category,
      description: description || undefined,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
      filePath: result.filePath,
      message: 'Upload thành công',
    });
    
  } catch (error) {
    console.error('[upload] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi upload file' },
      { status: 500 }
    );
  }
}

// Set max body size for file uploads (10MB)
export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
};
