import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/partner/activate/validate?token=xxx
 * 
 * Validate activation token before showing password form
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

    // Find application by activation token
    const { data: application, error } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('activation_token', token)
      .eq('status', 'provisioned')
      .is('deleted_at', null)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired activation token' },
        { status: 400 }
      );
    }

    // Check if token expired (72 hours)
    if (!application.activation_token_expires_at) {
      return NextResponse.json(
        { success: false, error: 'Token missing expiration' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(application.activation_token_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Activation token expired. Please contact support.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      email: application.email,
      full_name: application.full_name,
    });

  } catch (error) {
    console.error('[activate/validate] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
