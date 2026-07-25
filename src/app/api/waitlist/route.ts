/**
 * Waitlist API Routes
 * 
 * GET /api/waitlist - List waitlist entries (with filters)
 * POST /api/waitlist - Add customer to waitlist
 * 
 * @module api/waitlist
 */

import { NextRequest, NextResponse } from 'next/server';
import { addToWaitlist, getWaitlistEntries } from '@/services/waitlist/waitlist-service';
import { getCurrentUser } from '@/services/user-actions';
import type { WaitlistFilters, AddToWaitlistInput } from '@/types/waitlist';

/**
 * GET /api/waitlist
 * 
 * List waitlist entries with filters and pagination
 * 
 * Query params:
 * - tenant_id (required)
 * - package_id (optional)
 * - customer_id (optional)
 * - status (optional) - can be comma-separated
 * - preferred_date (optional)
 * - date_from (optional)
 * - date_to (optional)
 * - page (optional, default: 1)
 * - limit (optional, default: 20)
 * - sort_by (optional: priority|position|created_at|wait_time)
 * - sort_order (optional: asc|desc)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const tenant_id = searchParams.get('tenant_id');

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // Tenant boundary check: standard users cannot query other tenants
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // Build filters
    const filters: WaitlistFilters = {
      tenant_id,
      package_id: searchParams.get('package_id') || undefined,
      customer_id: searchParams.get('customer_id') || undefined,
      status: searchParams.get('status')?.split(',') as any || undefined,
      preferred_date: searchParams.get('preferred_date') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sort_by: (searchParams.get('sort_by') as any) || 'priority',
      sort_order: (searchParams.get('sort_order') as any) || 'desc',
    };

    // Fetch waitlist entries
    const result = await getWaitlistEntries(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /waitlist GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/waitlist
 * 
 * Add customer to waitlist
 * 
 * Body (JSON):
 * {
 *   tenant_id: string (required)
 *   customer_id: string (required)
 *   package_id: string (required)
 *   preferred_date: string (required, YYYY-MM-DD)
 *   preferred_start_time: string (required, HH:MM)
 *   booking_value: number (required)
 *   booking_id?: string
 *   duration_minutes?: number
 *   preferred_ktv_id?: string
 *   preferred_resource_id?: string
 *   is_flexible?: boolean
 *   notes?: string
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   entry?: WaitlistEntry
 *   position?: number
 *   estimated_wait_minutes?: number
 *   error?: string
 *   error_code?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // Tenant boundary check: standard users cannot insert into other tenants
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // Validate required fields
    const requiredFields = ['tenant_id', 'customer_id', 'package_id', 'preferred_date', 'preferred_start_time', 'booking_value'];
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

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(body.preferred_start_time)) {
      return NextResponse.json(
        { error: 'preferred_start_time must be in HH:MM format' },
        { status: 400 }
      );
    }

    // Validate booking_value
    if (typeof body.booking_value !== 'number' || body.booking_value < 0) {
      return NextResponse.json(
        { error: 'booking_value must be a non-negative number' },
        { status: 400 }
      );
    }

    // Build input
    const input: AddToWaitlistInput = {
      tenant_id: body.tenant_id,
      customer_id: body.customer_id,
      package_id: body.package_id,
      preferred_date: body.preferred_date,
      preferred_start_time: body.preferred_start_time,
      booking_value: body.booking_value,
      booking_id: body.booking_id,
      duration_minutes: body.duration_minutes || 90,
      preferred_ktv_id: body.preferred_ktv_id,
      preferred_resource_id: body.preferred_resource_id,
      is_flexible: body.is_flexible || false,
      notes: body.notes,
      created_by_user_id: currentUser.id, // Current user
    };

    // Add to waitlist
    const result = await addToWaitlist(input);

    if (!result.success) {
      const statusCode = result.error_code === 'CAPACITY_FULL' ? 422 :
                         result.error_code === 'DUPLICATE_ENTRY' ? 409 :
                         result.error_code === 'VALIDATION_ERROR' ? 400 : 500;

      return NextResponse.json(
        { 
          error: result.error,
          error_code: result.error_code 
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /waitlist POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
