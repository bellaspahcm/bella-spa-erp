'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CapacityManagementProvider } from '@/lib/decision-engine/providers/booking/capacity-management-provider';
import type { Database } from '@/types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

interface KTVAvailability {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  conflictType?: 'overlap' | 'break_time_violation' | 'daily_limit';
  conflictDetails?: {
    existingBookingTime?: string;
    requiredBreakMinutes?: number;
    nextAvailableTime?: string;
  };
}

interface CheckAvailabilityResponse {
  available: KTVAvailability[];
  unavailable: KTVAvailability[];
}

/**
 * API Route: Check KTV Availability for Booking Time
 * 
 * Purpose: Real-time availability check when editing booking time.
 * Returns which KTVs are available/unavailable with detailed reasons.
 * 
 * Query Parameters:
 * - date: YYYY-MM-DD (required)
 * - time: HH:mm (required)
 * - duration: number in minutes (optional, default: 60)
 * - excludeBookingId: UUID (optional) - exclude this booking from conflict check
 * 
 * @example
 * GET /api/bookings/check-ktv-availability?date=2026-07-15&time=14:32&duration=60&excludeBookingId=abc-123
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user and tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!currentUser?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 403 });
    }

    const tenantId = currentUser.tenant_id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const duration = parseInt(searchParams.get('duration') || '60', 10);
    const excludeBookingId = searchParams.get('excludeBookingId');

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Missing required parameters: date, time' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Expected: YYYY-MM-DD' }, { status: 400 });
    }

    // Validate time format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: 'Invalid time format. Expected: HH:mm' }, { status: 400 });
    }

    // Fetch tenant capacity config
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('capacity_config')
      .eq('id', tenantId)
      .single();

    const capacityConfig = tenantData?.capacity_config as Record<string, any> | null;
    const minBreakMinutes = capacityConfig?.minBreakMinutes || 15;
    const enforceBreakTimes = capacityConfig?.enforceBreakTimes !== false; // Default true

    // Fetch all active KTVs
    const { data: allKtvs, error: ktvsError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('role', 'ktv')
      .eq('status', 'active')
      .order('full_name');

    if (ktvsError) {
      console.error('[CheckAvailability] Failed to fetch KTVs:', ktvsError);
      return NextResponse.json({ error: 'Failed to fetch KTVs' }, { status: 500 });
    }

    if (!allKtvs || allKtvs.length === 0) {
      return NextResponse.json({
        available: [],
        unavailable: [],
      });
    }

    // Initialize capacity provider
    const capacityProvider = new CapacityManagementProvider({ debug: false });

    // Calculate end time
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

    // Check availability for each KTV
    const availabilityChecks = await Promise.all(
      allKtvs.map(async (ktv) => {
        try {
          // Fetch existing bookings for this KTV on same date
          let query = supabase
            .from('bookings')
            .select('id, start_date, preferred_time, total_sessions, status, packages(duration_minutes)')
            .eq('assigned_ktv_id', ktv.id)
            .eq('tenant_id', tenantId)
            .gte('start_date', date)
            .lte('start_date', date)
            .in('status', ['booked', 'deposit_pending', 'active', 'in_progress']);

          // Exclude current booking if editing
          if (excludeBookingId) {
            query = query.neq('id', excludeBookingId);
          }

          const { data: existingBookings } = await query;

          // Transform bookings for capacity provider
          const existingBookingsFormatted = (existingBookings || []).map((booking: any) => ({
            id: booking.id,
            startTime: booking.preferred_time || '08:00',
            endTime: calculateEndTime(
              booking.preferred_time || '08:00',
              booking.packages?.duration_minutes || 60
            ),
            status: booking.status,
          }));

          // Check capacity
          const capacityResult = await capacityProvider.checkCapacity({
            booking: {
              requestedStartTime: time,
              requestedEndTime: endTime,
              requestedDate: date,
              serviceType: 'spa_session',
              ktvId: ktv.id,
            },
            existingBookings: existingBookingsFormatted,
            tenantCapacity: capacityConfig ? {
              dailyCapacityLimit: capacityConfig.dailyCapacityLimit || 10,
              concurrentSessionLimit: capacityConfig.concurrentSessionLimit || 5,
              enforceBreakTimes: enforceBreakTimes,
              workingHours: capacityConfig.workingHours || { start: '08:00', end: '22:00' },
            } : undefined,
            ktvCapacity: {
              maxDailySessions: 10,
              minBreakMinutes: minBreakMinutes,
              workingHours: { start: '08:00', end: '22:00' },
            },
            tenantId: tenantId,
          });

          if (capacityResult.isAvailable) {
            return {
              id: ktv.id,
              name: ktv.full_name,
              available: true,
            };
          } else {
            // Parse conflict details
            const conflict = capacityResult.conflicts?.[0];
            let reason = 'Không khả dụng';
            let conflictType: 'overlap' | 'break_time_violation' | 'daily_limit' = 'overlap';
            let conflictDetails: KTVAvailability['conflictDetails'] = {};

            if (conflict) {
              if (conflict.type === 'break_time_violation') {
                conflictType = 'break_time_violation';
                const existingTime = conflict.conflictingBooking?.preferredTime || '';
                reason = `Đang có ca lúc ${existingTime} (cần ${minBreakMinutes} phút nghỉ)`;
                conflictDetails = {
                  existingBookingTime: existingTime,
                  requiredBreakMinutes: minBreakMinutes,
                  nextAvailableTime: calculateNextAvailable(existingTime, duration, minBreakMinutes),
                };
              } else if (conflict.type === 'time_overlap') {
                conflictType = 'overlap';
                const existingTime = conflict.conflictingBooking?.preferredTime || '';
                reason = `Đang có ca trùng giờ lúc ${existingTime}`;
                conflictDetails = {
                  existingBookingTime: existingTime,
                };
              } else if (conflict.type === 'daily_capacity_exceeded') {
                conflictType = 'daily_limit';
                reason = 'Đã đạt giới hạn ca trong ngày';
              }
            }

            return {
              id: ktv.id,
              name: ktv.full_name,
              available: false,
              reason,
              conflictType,
              conflictDetails,
            };
          }
        } catch (error) {
          console.error(`[CheckAvailability] Error checking KTV ${ktv.id}:`, error);
          // If error, mark as unavailable to be safe
          return {
            id: ktv.id,
            name: ktv.full_name,
            available: false,
            reason: 'Không thể kiểm tra lịch',
          };
        }
      })
    );

    // Split into available and unavailable
    const available = availabilityChecks.filter(k => k.available);
    const unavailable = availabilityChecks.filter(k => !k.available);

    return NextResponse.json({
      available,
      unavailable,
    } as CheckAvailabilityResponse);

  } catch (error) {
    console.error('[CheckAvailability] Unhandled error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate end time given start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

/**
 * Calculate next available time considering break time buffer
 */
function calculateNextAvailable(
  existingTime: string,
  existingDuration: number,
  minBreakMinutes: number
): string {
  const existingEnd = calculateEndTime(existingTime, existingDuration);
  return calculateEndTime(existingEnd, minBreakMinutes);
}
