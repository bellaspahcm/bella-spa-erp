import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/partner/activate
 * 
 * Activate partner account by setting password
 * 
 * Body:
 * {
 *   token: string,
 *   password: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // 1. Find application by activation token
    const { data: application, error: fetchError } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('activation_token', token)
      .eq('status', 'provisioned')
      .is('deleted_at', null)
      .single();

    if (fetchError || !application) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired activation token' },
        { status: 400 }
      );
    }

    // 2. Check token expiration
    if (!application.activation_token_expires_at) {
      return NextResponse.json(
        { success: false, error: 'Token missing expiration' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(application.activation_token_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Activation token expired' },
        { status: 400 }
      );
    }

    // 3. Check if identity_id exists
    if (!application.identity_id) {
      return NextResponse.json(
        { success: false, error: 'User account not provisioned yet' },
        { status: 400 }
      );
    }

    // 4. Update user password (requires service_role)
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      application.identity_id,
      { password }
    );

    if (passwordError) {
      console.error('[activate] Password update failed:', passwordError);
      return NextResponse.json(
        { success: false, error: 'Failed to set password' },
        { status: 500 }
      );
    }

    // 5. Mark application as activated
    const { error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: 'activated',
        activated_at: new Date().toISOString(),
        activation_token: null, // Clear token after use
        activation_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id);

    if (updateError) {
      console.error('[activate] Application update failed:', updateError);
      // Continue anyway - password is set
    }

    // 6. Log activation action
    await supabase
      .from('partner_application_logs')
      .insert({
        application_id: application.id,
        action: 'activated',
        action_description: 'Account activated by partner',
        performed_by_role: 'partner',
        performed_by_user_id: application.identity_id,
      });

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully',
    });

  } catch (error) {
    console.error('[activate] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
