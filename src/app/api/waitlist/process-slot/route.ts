/**
 * Waitlist Slot Processing API
 * 
 * POST /api/waitlist/process-slot - Process slot availability
 * 
 * Called when:
 * - Booking cancelled
 * - New slot created
 * - Booking rescheduled
 * 
 * @module api/waitlist/process-slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { processSlotAvailable } from '@/services/waitlist/waitlist-service';
import { getCurrentUser } from '@/services/user-actions';
import type { AvailableSlot } from '@/types/waitlist';

/**
 * POST /api/waitlist/process-slot
 * 
 * Process available slot and notify top waitlist customers
 * 
 * Body (JSON):
 * {
 *   tenant_id: string (required)
 *   package_id: string (required)
 *   date: string (required, YYYY-MM-DD)
 *   start_time: string (required, HH:MM)
 *   duration_minutes: number (default: 90)
 *   ktv_id?: string
 *   resource_id?: string
 *   reason: 'cancellation' | 'new_slot' | 'reschedule' (required)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   slot: AvailableSlot
 *   notified_customers: Array<{
 *     entry_id: string
 *     customer_id: string
 *     customer_name: string
 *     notification_sent: boolean
 *     notification_channel: string
 *     match_score: number
 *   }>
 *   total_notified: number
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

    // Validate required fields
    const requiredFields = ['tenant_id', 'package_id', 'date', 'start_time', 'reason'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const tenant_id = body.tenant_id;

    // Tenant boundary check: standard users cannot process slots for other tenants
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (tenant_id !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(body.start_time)) {
      return NextResponse.json(
        { error: 'start_time must be in HH:MM format' },
        { status: 400 }
      );
    }

    // Validate reason
    const validReasons = ['cancellation', 'new_slot', 'reschedule'];
    if (!validReasons.includes(body.reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Build slot
    const slot: AvailableSlot = {
      tenant_id: body.tenant_id,
      package_id: body.package_id,
      date: body.date,
      start_time: body.start_time,
      duration_minutes: body.duration_minutes || 90,
      ktv_id: body.ktv_id,
      resource_id: body.resource_id,
      reason: body.reason,
    };

    // Process slot (notify top customers)
    const result = await processSlotAvailable(slot);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[API /waitlist/process-slot POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
