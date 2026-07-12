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

/**
 * GET /api/waitlist/[entryId]
 * 
 * Get single waitlist entry by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { entryId: string } }
) {
  try {
    // Authentication check
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const entryId = params.entryId;

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
  { params }: { params: { entryId: string } }
) {
  try {
    // Authentication check
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const entryId = params.entryId;

    if (!entryId) {
      return NextResponse.json(
        { error: 'entryId is required' },
        { status: 400 }
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
      updates.removed_by_user_id = user.id;
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
  { params }: { params: { entryId: string } }
) {
  try {
    // Authentication check
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const entryId = params.entryId;

    if (!entryId) {
      return NextResponse.json(
        { error: 'entryId is required' },
        { status: 400 }
      );
    }

    // Get reason from query params
    const searchParams = request.nextUrl.searchParams;
    const reason = searchParams.get('reason') || 'Removed by admin';

    // Remove from waitlist (soft delete)
    const result = await removeFromWaitlist(entryId, reason, user.id);

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
