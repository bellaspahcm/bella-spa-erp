'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CapacityManagementProvider } from '@/lib/decision-engine/providers/booking/capacity-management-provider';


interface KTVAvailability {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  conflictType?: 'overlap' | 'break_time_violation' | 'daily_limit';
  conflictDetails?: {
    existingBookingTime?: string;
    existingBookingEndTime?: string;
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
      .select('metadata')
      .eq('id', tenantId)
      .single();

    type TenantMetadata = {
      capacity_config?: {
        minBreakMinutes?: number;
        enforceBreakTimes?: boolean;
      };
    };

    const capacityConfig = (tenantData?.metadata as TenantMetadata)?.capacity_config;
    const minBreakMinutes = capacityConfig?.minBreakMinutes ?? 15;
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
          // Fetch existing session logs for this date
          const { data: existingSessions, error: sessionFetchError } = await supabase
            .from('session_logs')
            .select(`
              id,
              status,
              assigned_time,
              completed_by_ktv_id,
              bookings!inner (
                id,
                assigned_ktv_id,
                status,
                packages (
                  duration_minutes:default_duration_minutes
                )
              )
            `)
            .eq('assigned_date', date)
            .eq('tenant_id', tenantId)
            .in('status', ['scheduled', 'in_progress', 'completed']);

          if (sessionFetchError) {
            console.error('[CheckAvailability] Failed to fetch session logs:', sessionFetchError);
            throw new Error(sessionFetchError.message);
          }

          const filteredSessions = (existingSessions || []).filter(session => {
            const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
            if (!booking) return false;
            if (booking.status === 'cancelled') return false;

            // Exclude current booking if editing
            if (excludeBookingId && booking.id === excludeBookingId) return false;

            const activeKtvId = session.completed_by_ktv_id || booking.assigned_ktv_id;
            return activeKtvId === ktv.id;
          });

          const existingBookingsFormatted = filteredSessions.map(session => {
            const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
            const durationMinutes = (booking?.packages as unknown as Record<string, unknown>)?.duration_minutes as number || 60;
            const statusMap: Record<string, 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'> = {
              scheduled: 'confirmed',
              in_progress: 'in_progress',
              completed: 'completed',
            };
            const status = statusMap[session.status || ''] || 'pending';
            return {
              id: booking?.id || session.id,
              startTime: session.assigned_time || '08:00',
              endTime: calculateEndTime(
                session.assigned_time || '08:00',
                durationMinutes
              ),
              durationMinutes,
              status,
            };
          });

          // Check capacity
          const capacityResult = await capacityProvider.checkCapacity({
            ktvId: ktv.id,
            tenantId: tenantId,
            booking: {
              requestedStartTime: time,
              requestedEndTime: endTime,
              requestedDate: date,
              durationMinutes: duration,
              serviceType: 'spa_session',
              customerTier: 'new',
            },
            existingBookings: existingBookingsFormatted,
            tenantCapacity: capacityConfig ? {
              bufferPercentage: (capacityConfig.bufferPercentage as number) || 0,
              enablePeakHourManagement: (capacityConfig.enablePeakHourManagement as boolean) || false,
              enforceBreakTimes: enforceBreakTimes,
            } : undefined,
            ktvCapacity: {
              maxDailyBookings: 10,
              maxConcurrentSessions: 5,
              minBreakMinutes: minBreakMinutes,
              workingHours: { start: '08:00', end: '22:00' },
            },
          });

          if (capacityResult.available) {
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
                const existingTime = formatTime(conflict.conflictingBooking?.startTime || '');
                const existingEnd = formatTime(conflict.conflictingBooking?.endTime || calculateEndTime(existingTime, duration));
                reason = `Ca kết thúc lúc ${existingEnd}, cần thêm ${minBreakMinutes} phút nghỉ`;
                const nextAvail = formatTime(calculateNextAvailable(existingEnd, 0, minBreakMinutes));
                conflictDetails = {
                  existingBookingTime: existingTime,
                  existingBookingEndTime: existingEnd,
                  requiredBreakMinutes: minBreakMinutes,
                  nextAvailableTime: nextAvail,
                };
              } else if (conflict.type === 'time_overlap') {
                conflictType = 'overlap';
                const existingTime = formatTime(conflict.conflictingBooking?.startTime || '');
                const existingEnd = formatTime(conflict.conflictingBooking?.endTime || calculateEndTime(existingTime, duration));
                const nextAvail = formatTime(calculateNextAvailable(existingEnd, 0, minBreakMinutes));
                reason = `Trùng ca đang có lúc ${existingTime}–${existingEnd}`;
                conflictDetails = {
                  existingBookingTime: existingTime,
                  existingBookingEndTime: existingEnd,
                  requiredBreakMinutes: minBreakMinutes,
                  nextAvailableTime: nextAvail,
                };
              } else if (conflict.type === 'daily_limit' || conflict.type === 'outside_working_hours') {
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
 * Pass existingDurationMinutes = 0 when existingEnd is already calculated
 */
function calculateNextAvailable(
  existingEndOrStart: string,
  existingDurationOrZero: number,
  minBreakMinutes: number
): string {
  if (existingDurationOrZero === 0) {
    return calculateEndTime(existingEndOrStart, minBreakMinutes);
  }
  const existingEnd = calculateEndTime(existingEndOrStart, existingDurationOrZero);
  return calculateEndTime(existingEnd, minBreakMinutes);
}

/**
 * Format time to HH:mm, stripping seconds if present
 */
function formatTime(t: string): string {
  if (!t) return '';
  return t.split(':').slice(0, 2).join(':');
}
