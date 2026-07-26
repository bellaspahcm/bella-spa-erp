/**
 * Waitlist Entry Conversion API Route
 * 
 * POST /api/waitlist/[entryId]/convert - Convert waitlist entry to a booking
 * 
 * @module api/waitlist/[entryId]/convert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWaitlistEntry, convertToBooking } from '@/services/waitlist/waitlist-service';
import { getCurrentUser } from '@/services/user-actions';

/**
 * POST /api/waitlist/[entryId]/convert
 * 
 * Convert a waitlist entry to an active booking
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    // 1. Authentication check
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
        { error: 'entryId is required' },
        { status: 400 }
      );
    }

    // 2. Fetch entry to verify tenant ownership before converting
    const entry = await getWaitlistEntry(entryId);
    if (!entry) {
      return NextResponse.json(
        { error: 'Không tìm thấy thông tin khách hàng trong danh sách chờ' },
        { status: 404 }
      );
    }

    // 3. Verify tenant boundary
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (entry.tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // 4. Perform conversion
    const result = await convertToBooking(entryId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      booking: result.booking 
    });
  } catch (error) {
    console.error('[API /waitlist/[entryId]/convert POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
