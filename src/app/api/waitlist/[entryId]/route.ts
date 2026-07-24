/**
 * Waitlist Entry API Routes
 * 
 * GET /api/waitlist/[entryId] - Get single entry
 * PATCH /api/waitlist/[entryId] - Update entry
 * DELETE /api/waitlist/[entryId] - Remove from waitlist
 * 
 * @module api/waitlist/[entryId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { 
  getWaitlistEntry, 
  updateWaitlistEntry, 
  removeFromWaitlist 
} from '@/services/waitlist/waitlist-service';
import { getCurrentUser } from '@/services/user-actions';

/**
 * GET /api/waitlist/[entryId]
 * 
 * Get single waitlist entry by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    // Authentication check
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

    // Fetch entry
    const entry = await getWaitlistEntry(entryId);

    if (!entry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    // Verify tenant boundary
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (entry.tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[API /waitlist/[entryId] GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/waitlist/[entryId]
 * 
 * Update waitlist entry
 * 
 * Body (JSON):
 * {
 *   status?: 'active' | 'notified' | 'reserved' | 'converted' | 'expired' | 'cancelled'
 *   notes?: string
 *   internal_notes?: string
 *   position?: number
 *   removal_reason?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    // Authentication check
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

    // Fetch entry to verify tenant ownership before updating
    const entry = await getWaitlistEntry(entryId);
    if (!entry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    // Verify tenant boundary
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (entry.tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate status if provided
    if (body.status) {
      const validStatuses = ['active', 'notified', 'reserved', 'converted', 'expired', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Build updates
    const updates: any = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.internal_notes !== undefined) updates.internal_notes = body.internal_notes;
    if (body.position !== undefined) updates.position = body.position;
    if (body.removal_reason !== undefined) updates.removal_reason = body.removal_reason;

    // If status = cancelled, add removed_by_user_id
    if (body.status === 'cancelled') {
      updates.removed_by_user_id = currentUser.id;
    }

    // Update entry
    const result = await updateWaitlistEntry(entryId, updates);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      entry: result.entry 
    });
  } catch (error) {
    console.error('[API /waitlist/[entryId] PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/waitlist/[entryId]
 * 
 * Remove customer from waitlist (soft delete)
 * 
 * Query params:
 * - reason (optional) - Removal reason
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    // Authentication check
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

    // Fetch entry to verify tenant ownership before deleting
    const entry = await getWaitlistEntry(entryId);
    if (!entry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    // Verify tenant boundary
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (entry.tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // Get reason from query params
    const searchParams = request.nextUrl.searchParams;
    const reason = searchParams.get('reason') || 'Removed by admin';

    // Remove from waitlist (soft delete)
    const result = await removeFromWaitlist(entryId, reason, currentUser.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Successfully removed from waitlist' 
    });
  } catch (error) {
    console.error('[API /waitlist/[entryId] DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
