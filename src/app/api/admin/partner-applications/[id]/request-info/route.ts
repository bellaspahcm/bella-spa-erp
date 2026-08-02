import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/admin/partner-applications/:id/request-info
 * 
 * Request additional information from applicant
 * 
 * Request Body:
 * {
 *   message: string; (required)
 *   fields?: string[]; // Fields that need to be updated
 * }
 * 
 * Response:
 * {
 *   success: true;
 *   application: PartnerApplication;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { message, fields } = body;

    // Validate required fields
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Info request message is required' },
        { status: 400 }
      );
    }

    // 1. Get current user (admin)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Verify admin role (TODO: Re-enable when user_roles table exists)
    // const { data: userRoles, error: roleError } = await supabase
    //   .from('user_roles')
    //   .select('role_name')
    //   .eq('user_id', user.id)
    //   .in('role_name', ['admin', 'super_admin']);

    // if (roleError || !userRoles || userRoles.length === 0) {
    //   return NextResponse.json(
    //     { success: false, error: 'Forbidden: Admin role required' },
    //     { status: 403 }
    //   );
    // }

    // 3. Get application
    const { data: application, error: fetchError } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    // 4. Validate state
    if (application.status === 'approved' || 
        application.status === 'provisioned' || 
        application.status === 'activated') {
      return NextResponse.json(
        { success: false, error: 'Cannot request info for approved/provisioned/activated application' },
        { status: 400 }
      );
    }

    if (application.status === 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Cannot request info for rejected application' },
        { status: 400 }
      );
    }

    // 5. Update application status to need_more_info
    const { data: updatedApp, error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: 'need_more_info',
        info_request_message: message.trim(),
        info_request_fields: fields || null,
        info_requested_at: new Date().toISOString(),
        info_requested_by: user.id,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      } as any)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update application:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to request additional info' },
        { status: 500 }
      );
    }

    // 6. Log info request action
    const { error: logError } = await supabase
      .from('partner_application_logs')
      .insert({
        application_id: params.id,
        action: 'info_requested',
        action_description: `Additional info requested: ${message}`,
        performed_by: user.id,
        performed_by_role: 'admin',
        old_status: application.status,
        new_status: 'need_more_info',
        metadata: { message, fields },
      } as any);

    if (logError) {
      console.error('Failed to log info request:', logError);
      // Don't fail the request if logging fails
    }

    // 7. TODO: Send notification email to applicant
    // For now, just return success
    // In production, this would call sendInfoRequestEmail() function
    
    return NextResponse.json({
      success: true,
      application: updatedApp,
      message: 'Info request sent successfully. Applicant will be notified via email.',
    });

  } catch (error) {
    console.error('Request info error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
