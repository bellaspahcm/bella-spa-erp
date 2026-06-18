import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface RotateKeyRequest {
  gracePeriodDays?: number;
  reason?: string;
  notifyPartner?: boolean;
}

/**
 * Generate a new API key
 */
function generateApiKey(): string {
  const prefix = 'bella';
  const randomPart = randomBytes(32).toString('hex');
  return `${prefix}_${randomPart}`;
}

/**
 * POST /api/admin/partners/[id]/rotate-key-scheduled
 * Manually rotate API key with optional grace period
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
    const { gracePeriodDays = 7, reason, notifyPartner = true }: RotateKeyRequest = await request.json();

    // Validation
    if (gracePeriodDays < 0 || gracePeriodDays > 30) {
      return NextResponse.json(
        { error: 'Grace period must be between 0 and 30 days' },
        { status: 400 }
      );
    }

    // Fetch partner
    const { data: partner, error: partnerError } = await supabase
      .from('api_partners' as any)
      .select('*')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partnerData = partner as any;

    // Generate new API key
    const newApiKey = generateApiKey();
    const newKeyPrefix = newApiKey.substring(0, 12);

    // Calculate grace period end date
    const now = new Date();
    const gracePeriodEndDate = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

    // Store old key info for rotation history
    const oldKeyPrefix = partnerData.api_key.substring(0, 12);

    // Update partner with new key
    const { data: updatedPartner, error: updateError } = await supabase
      .from('api_partners' as any)
      .update({
        api_key: newApiKey,
        previous_api_key: partnerData.api_key,
        previous_key_expires_at: gracePeriodEndDate.toISOString(),
        last_rotated_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', partnerId)
      .select()
      .single();

    if (updateError) {
      console.error('Rotate key error:', updateError);
      return NextResponse.json(
        { error: 'Failed to rotate API key' },
        { status: 500 }
      );
    }

    // Create rotation history event
    // In a real implementation, store this in a separate rotation_history table
    const rotationEvent = {
      id: `rot_${randomBytes(8).toString('hex')}`,
      eventType: 'rotated',
      timestamp: now.toISOString(),
      oldKeyPrefix,
      newKeyPrefix,
      triggeredBy: 'manual',
      reason: reason || 'Manual rotation by admin',
      gracePeriodEnded: gracePeriodEndDate.toISOString(),
    };

    // Log the rotation
    await supabase.from('api_request_logs' as any).insert({
      partner_id: partnerId,
      method: 'POST',
      endpoint: '/rotate-key-scheduled',
      status_code: 200,
      response_time_ms: 0,
      user_agent: request.headers.get('user-agent') || 'Unknown',
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown',
      metadata: {
        action: 'manual_key_rotation',
        oldKeyPrefix,
        newKeyPrefix,
        gracePeriodDays,
        gracePeriodEndDate: gracePeriodEndDate.toISOString(),
        reason,
      },
      created_at: now.toISOString(),
    });

    // TODO: Send notification email to partner if notifyPartner is true
    if (notifyPartner && partnerData.contact_email) {
      console.log(`[TODO] Send rotation notification email to ${partnerData.contact_email}`);
      // In production: send email with new key, grace period info, and migration guide
    }

    return NextResponse.json({
      success: true,
      message: 'API key rotated successfully',
      data: {
        partnerId,
        partnerName: partnerData.name,
        newApiKey,
        oldApiKey: partnerData.api_key,
        gracePeriodDays,
        gracePeriodEndDate: gracePeriodEndDate.toISOString(),
        rotationEvent,
        note: gracePeriodDays > 0
          ? `Both old and new keys will be valid until ${gracePeriodEndDate.toLocaleDateString()}`
          : 'Old key is immediately invalidated',
      },
    });
  } catch (error) {
    console.error('Rotate key scheduled error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
