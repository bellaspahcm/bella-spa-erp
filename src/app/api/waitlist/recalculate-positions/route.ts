/**
 * Waitlist Position Recalculation API
 * 
 * POST /api/waitlist/recalculate-positions - Recalculate queue positions
 * 
 * Called when:
 * - New entry added
 * - Entry removed
 * - Priority score changes
 * 
 * @module api/waitlist/recalculate-positions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { recalculatePositions } from '@/services/waitlist/waitlist-service';

/**
 * POST /api/waitlist/recalculate-positions
 * 
 * Recalculate waitlist positions for a specific slot
 * 
 * Body (JSON):
 * {
 *   tenant_id: string (required)
 *   package_id: string (required)
 *   preferred_date: string (required, YYYY-MM-DD)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   updated_count: number
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['tenant_id', 'package_id', 'preferred_date'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.preferred_date)) {
      return NextResponse.json(
        { error: 'preferred_date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Recalculate positions
    const result = await recalculatePositions(
      body.tenant_id,
      body.package_id,
      body.preferred_date
    );

    return NextResponse.json({
      success: true,
      updated_count: result.updated_count,
      message: `Successfully recalculated ${result.updated_count} positions`,
    });
  } catch (error) {
    console.error('[API /waitlist/recalculate-positions POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
