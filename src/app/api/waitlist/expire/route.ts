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
import { getCurrentUser } from '@/services/user-actions';

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
    const cronSecret = process.env.CRON_SECRET || 'mock-cron-secret'; // TODO: Set in production

    const isCronJob = authHeader === `Bearer ${cronSecret}`;

    const currentUser = await getCurrentUser();

    if (!isCronJob) {
      // Regular user authentication
      if (!currentUser) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is admin (only admins can manually trigger expiry)
      const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
      const isAdmin = currentUser.role === 'admin' || isSuperAdmin;
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Requires admin role' },
          { status: 403 }
        );
      }
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

    // Tenant boundary check for non-cron requests
    if (!isCronJob) {
      const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'hq_super_admin';
      if (tenant_id !== currentUser?.tenant_id && !isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Tenant mismatch' },
          { status: 403 }
        );
      }
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
