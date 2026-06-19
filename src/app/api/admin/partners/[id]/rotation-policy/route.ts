import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface RotationPolicy {
  autoRotationEnabled: boolean;
  rotationInterval: '30' | '60' | '90' | 'custom';
  customIntervalDays: number | null;
  gracePeriodDays: number;
  notifyBeforeExpiryDays: number;
  notificationEmail: string;
}

interface PartnerData {
  id: string;
  name: string;
  rotation_policy?: RotationPolicy | null;
  next_rotation_date?: string | null;
}

/**
 * POST /api/admin/partners/[id]/rotation-policy
 * Save rotation policy for a partner
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id: partnerId } = await context.params;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const policy: RotationPolicy = await request.json();

    // Validation
    if (policy.autoRotationEnabled && !policy.notificationEmail) {
      return NextResponse.json(
        { error: 'Notification email is required when auto-rotation is enabled' },
        { status: 400 }
      );
    }

    if (policy.rotationInterval === 'custom' && (!policy.customIntervalDays || policy.customIntervalDays < 1)) {
      return NextResponse.json(
        { error: 'Custom interval days must be at least 1' },
        { status: 400 }
      );
    }

    // Calculate next rotation date if auto-rotation is enabled
    let nextRotationDate: Date | null = null;
    if (policy.autoRotationEnabled) {
      const intervalDays =
        policy.rotationInterval === 'custom'
          ? policy.customIntervalDays!
          : parseInt(policy.rotationInterval, 10);

      const now = new Date();
      nextRotationDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    }

    // Check if partner exists
    const { data: partner, error: partnerError } = await supabase
      .from('api_partners' as never)
      .select('id, name')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Update or insert rotation policy
    // Note: In a real implementation, you would have a separate table for rotation policies
    // For now, we'll store it in the api_partners table or a metadata field
    const { data: updatedPartner, error: updateError } = await supabase
      .from('api_partners' as never)
      .update({
        rotation_policy: policy,
        next_rotation_date: nextRotationDate?.toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', partnerId)
      .select()
      .single();

    if (updateError) {
      console.error('Update rotation policy error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save rotation policy' },
        { status: 500 }
      );
    }

    // Log the policy change
    await supabase.from('api_request_logs' as never).insert({
      partner_id: partnerId,
      method: 'POST',
      endpoint: '/rotation-policy',
      status_code: 200,
      response_time_ms: 0,
      user_agent: request.headers.get('user-agent') || 'Unknown',
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown',
      metadata: {
        action: 'update_rotation_policy',
        policy: policy,
      },
      created_at: new Date().toISOString(),
    } as never);

    return NextResponse.json({
      success: true,
      message: 'Rotation policy saved successfully',
      data: {
        partnerId,
        policy,
        nextRotationDate: nextRotationDate?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Save rotation policy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/partners/[id]/rotation-policy
 * Get rotation policy for a partner
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id: partnerId } = await context.params;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch partner with rotation policy
    const { data: partner, error: partnerError } = await supabase
      .from('api_partners' as never)
      .select('id, name, rotation_policy, next_rotation_date')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partnerData = partner as PartnerData;

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partnerData.id,
        partnerName: partnerData.name,
        policy: partnerData.rotation_policy || null,
        nextRotationDate: partnerData.next_rotation_date,
      },
    });
  } catch (error) {
    console.error('Get rotation policy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
