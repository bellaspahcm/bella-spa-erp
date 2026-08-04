import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/admin/partner-applications/:id/reject
 * 
 * Reject a partner application
 * 
 * Request Body:
 * {
 *   reason: string; (required)
 *   category?: 'invalid_docs' | 'duplicate' | 'policy_violation' | 'fraud' | 'other';
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
    const { reason, category } = body;

    // Validate required fields
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
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

    // 2. Verify admin role
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
    if (application.status === 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Application already rejected' },
        { status: 400 }
      );
    }

    if (application.status === 'provisioned' || application.status === 'activated') {
      return NextResponse.json(
        { success: false, error: 'Cannot reject provisioned/activated application' },
        { status: 400 }
      );
    }

    // 5. Update application status to rejected
    const { data: updatedApp, error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: 'rejected' as const,
        rejected_at: new Date().toISOString(),
        rejected_by: user.id,
        rejection_reason: reason.trim(),
        rejection_category: category || 'other',
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update application:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to reject application' },
        { status: 500 }
      );
    }

    // 6. Log rejection action
    const { error: logError } = await supabase
      .from('partner_application_logs')
      .insert({
        application_id: params.id,
        action: 'rejected' as const,
        action_description: `Application rejected: ${reason}`,
        performed_by: user.id,
        performed_by_role: 'admin',
        old_status: application.status,
        new_status: 'rejected' as const,
        metadata: { reason, category },
      });

    if (logError) {
      console.error('Failed to log rejection:', logError);
      // Don't fail the request if logging fails
    }

    // 7. Send rejection email to applicant
    try {
      const { sendPartnerRejectionEmail } = await import('@/lib/email/email-service');
      
      const emailResult = await sendPartnerRejectionEmail(
        application.email,
        application.full_name,
        application.company_name || 'Your Business',
        reason.trim(),
        true // canReapply
      );
      
      if (!emailResult.success) {
        console.error('[reject] Failed to send rejection email:', emailResult.error);
        // Don't fail the rejection if email fails
      } else {
        console.log('[reject] Rejection email sent successfully to:', application.email);
      }
    } catch (emailError: unknown) {
      console.error('[reject] Email sending exception:', emailError);
      // Don't fail the rejection
    }
    
    return NextResponse.json({
      success: true,
      application: updatedApp,
      message: 'Application rejected successfully. Rejection notification email will be sent.',
    });

  } catch (error: unknown) {
    console.error('Reject application error:', error);
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
