import { NextRequest, NextResponse } from 'next/server';
import { listDocuments, deleteDocument, getSignedDocumentUrl } from '@/lib/storage/partner-documents';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/partner/documents/:applicationId
 * 
 * List all documents for an application with signed URLs
 * 
 * Response:
 * {
 *   success: true;
 *   documents: Array<{
 *     ...metadata,
 *     signedUrl: string; // 1-hour expiry
 *   }>;
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { applicationId: string } }
) {
  try {
    const { applicationId } = params;
    
    // Get documents list
    const { documents, error } = await listDocuments(applicationId);
    
    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }
    
    // Generate signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc: any) => {
        const { url, error: urlError } = await getSignedDocumentUrl(doc.metadata.filePath || doc.filePath);
        
        return {
          ...doc,
          signedUrl: url,
          signedUrlError: urlError,
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      documents: documentsWithUrls,
    });
    
  } catch (error) {
    console.error('[GET documents] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi lấy danh sách documents' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/documents/:applicationId?filePath=...
 * 
 * Delete a document
 * 
 * Query Params:
 * - filePath: string (required)
 * 
 * Response:
 * {
 *   success: true;
 *   message: string;
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { applicationId: string } }
) {
  try {
    const { applicationId } = params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');
    
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'File path không được để trống' },
        { status: 400 }
      );
    }
    
    // Check admin permission (only admins can delete)
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify admin role
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', user.id)
      .in('role_name', ['admin', 'super_admin']);
    
    if (roleError || !userRoles || userRoles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }
    
    // Delete document
    const result = await deleteDocument(applicationId, filePath);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Xóa document thành công',
    });
    
  } catch (error) {
    console.error('[DELETE document] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi xóa document' },
      { status: 500 }
    );
  }
}
