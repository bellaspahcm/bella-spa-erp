import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/partner/verify?token=xxx
 * 
 * Verify partner registration email
 * 
 * Response:
 * - 200: { success: true, application_id: string }
 * - 400: { success: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // 1. Find application by token
    const { data: application, error: fetchError } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('email_verification_token', token)
      .is('deleted_at', null)
      .single();

    if (fetchError || !application) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // 2. Check if already verified
    if (application.email_verified_at) {
      return NextResponse.json(
        { success: false, error: 'Email already verified' },
        { status: 400 }
      );
    }

    // 3. Check if token expired (24 hours)
    if (!application.email_verification_token_expires_at) {
      return NextResponse.json(
        { success: false, error: 'Verification token missing expiration' },
        { status: 400 }
      );
    }
    
    const expiresAt = new Date(application.email_verification_token_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Verification token expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // 4. Mark email as verified
    const { error: updateError } = await supabase
      .from('partner_applications')
      .update({
        email_verified_at: new Date().toISOString(),
        status: 'pending_verification', // Move to next stage
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', application.id);

    if (updateError) {
      console.error('[verify] Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    // 5. Log verification action
    await supabase
      .from('partner_application_logs')
      .insert({
        application_id: application.id,
        action: 'email_verified',
        action_description: 'Email verified successfully',
        performed_by_role: 'system',
      } as any);

    return NextResponse.json({
      success: true,
      application_id: application.id,
      message: 'Email verified successfully',
    });

  } catch (error) {
    console.error('[verify] Exception:', error);
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
