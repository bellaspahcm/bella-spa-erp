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
    const { entryId } = await params;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Missing entryId parameter' },
        { status: 400 }
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
