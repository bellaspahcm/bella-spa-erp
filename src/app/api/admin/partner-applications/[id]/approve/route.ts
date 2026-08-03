import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/admin/partner-applications/:id/approve
 * 
 * Approve a partner application and trigger provisioning
 * 
 * Request Body:
 * {
 *   notes?: string;
 *   provisioning_config?: {
 *     tenant_name?: string;
 *     permissions?: string[];
 *   }
 * }
 * 
 * Response:
 * {
 *   success: true;
 *   application: PartnerApplication;
 *   provisioned: boolean;
 *   tenant_id?: string;
 *   user_id?: string;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { notes, provisioning_config } = body;

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
    if (application.status === 'approved') {
      return NextResponse.json(
        { success: false, error: 'Application already approved' },
        { status: 400 }
      );
    }

    if (application.status === 'provisioned' || application.status === 'activated') {
      return NextResponse.json(
        { success: false, error: 'Application already provisioned/activated' },
        { status: 400 }
      );
    }

    if (!application.email_verified_at) {
      return NextResponse.json(
        { success: false, error: 'Email not verified' },
        { status: 400 }
      );
    }

    // 5. Update application status to approved
    const { data: updatedApp, error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        approval_notes: notes || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      } as any)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update application:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to approve application' },
        { status: 500 }
      );
    }

    // 6. Log approval action
    const { error: logError } = await supabase
      .from('partner_application_logs')
      .insert({
        application_id: params.id,
        action: 'approved',
        action_description: notes || 'Application approved by admin',
        performed_by: user.id,
        performed_by_role: 'admin',
        old_status: application.status,
        new_status: 'approved',
        metadata: { notes, provisioning_config },
      } as any);

    if (logError) {
      console.error('Failed to log approval:', logError);
      // Don't fail the request if logging fails
    }

    // 7. Trigger provisioning
    let provisioningResult = null;
    
    try {
      const { provisionPartnerAccount } = await import('@/lib/provisioning/partner-provisioning-engine');
      
      provisioningResult = await provisionPartnerAccount({
        application_id: params.id,
        full_name: application.full_name,
        email: application.email,
        phone: application.phone,
        company_name: application.company_name || undefined,
        tax_code: application.tax_code || undefined,
      });
      
      if (!provisioningResult.success) {
        console.error('[approve] Provisioning failed:', provisioningResult.error);
        // Don't fail the approval, provisioning can be retried manually
      }
    } catch (provError) {
      console.error('[approve] Provisioning exception:', provError);
      // Don't fail the approval
    }

    // 8. Send approval email with activation link
    try {
      const { sendPartnerApprovalEmail } = await import('@/lib/email/email-service');
      
      const emailResult = await sendPartnerApprovalEmail(
        application.email,
        application.full_name,
        application.company_name || 'Your Business',
        provisioningResult?.activation_token || 'no-token',
        provisioningResult?.tenant_subdomain
      );
      
      if (!emailResult.success) {
        console.error('[approve] Failed to send approval email:', emailResult.error);
        // Don't fail the approval if email fails
      } else {
        console.log('[approve] Approval email sent successfully to:', application.email);
      }
    } catch (emailError) {
      console.error('[approve] Email sending exception:', emailError);
      // Don't fail the approval
    }
    
    return NextResponse.json({
      success: true,
      application: updatedApp,
      provisioned: provisioningResult?.success || false,
      tenant_id: provisioningResult?.tenant_id,
      user_id: provisioningResult?.user_id,
      message: provisioningResult?.success 
        ? 'Application approved and account provisioned successfully.'
        : 'Application approved. Provisioning will be completed shortly.',
    });

  } catch (error) {
    console.error('Approve application error:', error);
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
