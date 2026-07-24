/**
 * Waitlist Notification Logs API
 * 
 * GET /api/waitlist/:entryId/notifications
 * 
 * Returns notification history for a waitlist entry.
 * Used by detail page notification history component.
 * 
 * Response:
 * {
 *   notifications: NotificationLog[]
 * }
 * 
 * @module api/waitlist/notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationLogs } from '@/services/notifications/notification-logger';
import { getCurrentUser } from '@/services/user-actions';
import { getWaitlistEntry } from '@/services/waitlist/waitlist-service';

/**
 * GET /api/waitlist/:entryId/notifications
 * 
 * Fetch notification history for a waitlist entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    // 1. Authentication Check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { entryId } = await params;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Missing entryId parameter' },
        { status: 400 }
      );
    }

    // Fetch entry to verify tenant boundary
    const entry = await getWaitlistEntry(entryId);
    if (!entry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (entry.tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // Fetch notification logs from database
    const logs = await getNotificationLogs(entryId);

    return NextResponse.json({
      notifications: logs || [],
    });
  } catch (error) {
    console.error('[GET /api/waitlist/:entryId/notifications] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
