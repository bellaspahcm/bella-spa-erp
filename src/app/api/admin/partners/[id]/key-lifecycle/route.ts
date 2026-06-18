import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface KeyRotationEvent {
  id: string;
  eventType: 'created' | 'rotated' | 'expired' | 'revoked' | 'scheduled';
  timestamp: string;
  oldKeyPrefix?: string;
  newKeyPrefix?: string;
  triggeredBy: 'system' | 'manual' | 'scheduled';
  reason?: string;
  gracePeriodEnded?: string;
}

/**
 * GET /api/admin/partners/[id]/key-lifecycle
 * Get API key lifecycle data including rotation history
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

    // Fetch rotation history from logs
    // In a real implementation, query from a dedicated rotation_history table
    const { data: logs, error: logsError } = await supabase
      .from('api_request_logs' as any)
      .select('*')
      .eq('partner_id', partnerId)
      .in('endpoint', ['/rotate-key-scheduled', '/regenerate-key', '/rotation-policy'])
      .order('created_at', { ascending: false })
      .limit(50);

    // Build rotation history from logs
    const rotationHistory: KeyRotationEvent[] = [];

    // Add creation event
    rotationHistory.push({
      id: `evt_created_${partnerData.id}`,
      eventType: 'created',
      timestamp: partnerData.created_at,
      newKeyPrefix: partnerData.api_key.substring(0, 12),
      triggeredBy: 'system',
      reason: 'Initial API key creation',
    });

    // Add rotation events from logs
    if (logs && logs.length > 0) {
      logs.forEach((log: any) => {
        if (log.endpoint === '/rotate-key-scheduled' || log.endpoint === '/regenerate-key') {
          const metadata = log.metadata || {};
          
          rotationHistory.push({
            id: `evt_${log.id}`,
            eventType: 'rotated',
            timestamp: log.created_at,
            oldKeyPrefix: metadata.oldKeyPrefix,
            newKeyPrefix: metadata.newKeyPrefix,
            triggeredBy: log.endpoint === '/rotate-key-scheduled' ? 'manual' : 'manual',
            reason: metadata.reason || 'API key rotation',
            gracePeriodEnded: metadata.gracePeriodEndDate,
          });
        }

        if (log.endpoint === '/rotation-policy' && log.metadata?.action === 'update_rotation_policy') {
          const policy = log.metadata.policy;
          if (policy?.autoRotationEnabled) {
            // This is a scheduled rotation setup
            rotationHistory.push({
              id: `evt_scheduled_${log.id}`,
              eventType: 'scheduled',
              timestamp: log.created_at,
              triggeredBy: 'system',
              reason: `Auto-rotation scheduled every ${policy.rotationInterval === 'custom' ? policy.customIntervalDays : policy.rotationInterval} days`,
            });
          }
        }
      });
    }

    // Add last rotated event if exists
    if (partnerData.last_rotated_at) {
      const existingRotateEvent = rotationHistory.find(
        (evt) => evt.eventType === 'rotated' && evt.timestamp === partnerData.last_rotated_at
      );

      if (!existingRotateEvent) {
        rotationHistory.push({
          id: `evt_rotated_${partnerData.id}`,
          eventType: 'rotated',
          timestamp: partnerData.last_rotated_at,
          triggeredBy: 'system',
          reason: 'Key rotation',
        });
      }
    }

    // Sort history by timestamp (newest first)
    rotationHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Current key info
    const currentKeyCreatedAt = partnerData.last_rotated_at || partnerData.created_at;
    const currentKeyPrefix = partnerData.api_key.substring(0, 12);

    // Next rotation date
    const nextRotationDate = partnerData.next_rotation_date;
    const autoRotationEnabled = partnerData.rotation_policy?.autoRotationEnabled || false;

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partnerData.id,
        partnerName: partnerData.name,
        currentKeyCreatedAt,
        currentKeyPrefix,
        lastRotatedAt: partnerData.last_rotated_at,
        nextRotationDate,
        autoRotationEnabled,
        rotationHistory,
        stats: {
          totalRotations: rotationHistory.filter((evt) => evt.eventType === 'rotated').length,
          keyAge: Math.floor(
            (new Date().getTime() - new Date(currentKeyCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
          ),
          daysUntilRotation: nextRotationDate
            ? Math.floor(
                (new Date(nextRotationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              )
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Get key lifecycle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
