/**
 * Waitlist Expiry Cleanup API
 * 
 * POST /api/waitlist/expire - Expire old waitlist entries
 * 
 * Scheduled cron job: Runs every hour
 * Marks entries as expired if > 24 hours old
 * 
 * @module api/waitlist/expire
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { expireOldEntries } from '@/services/waitlist/waitlist-service';

/**
 * POST /api/waitlist/expire
 * 
 * Expire old waitlist entries (cleanup cron job)
 * 
 * Body (JSON):
 * {
 *   tenant_id: string (required)
 * }
 * 
 * OR set header:
 * Authorization: Bearer <CRON_SECRET>
 * 
 * Response:
 * {
 *   success: boolean
 *   expired_count: number
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Cron authentication (check secret from header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'; // TODO: Set in production

    const isCronJob = authHeader === `Bearer ${cronSecret}`;

    if (!isCronJob) {
      // Regular user authentication
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is admin (only admins can manually trigger expiry)
      // TODO: Check user role
    }

    // Parse request body
    const body = await request.json();
    const tenant_id = body.tenant_id;

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // Expire old entries
    const result = await expireOldEntries(tenant_id);

    return NextResponse.json({
      success: true,
      expired_count: result.expired_count,
      message: `Successfully expired ${result.expired_count} entries`,
    });
  } catch (error) {
    console.error('[API /waitlist/expire POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
