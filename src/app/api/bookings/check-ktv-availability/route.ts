import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CapacityManagementProvider } from '@/lib/decision-engine/providers/booking/capacity-management-provider';
import { getCache, setCache, deleteCache } from '@/lib/redis-cache';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  _cache?: 'HIT' | 'MISS';
}

// ─── Cache Key & TTL ──────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from all inputs that affect availability.
 *
 * IMPORTANT: Every query parameter that influences the availability result
 * MUST be included here. If the route gains new discriminating params
 * (e.g. branchId, serviceId), add them to this function AND bump CACHE_VERSION.
 */
function buildAvailabilityCacheKey(params: {
  tenantId: string;
  date: string;
  time: string;
  duration: number;
  excludeBookingId: string | null;
}): string {
  const CACHE_VERSION = 'v1';
  const parts = [
    'ktv:availability',
    CACHE_VERSION,
    params.tenantId,
    params.date,
    params.time,
    String(params.duration),
    params.excludeBookingId ?? 'none',
  ];
  return parts.join(':');
}

/**
 * Starting TTL for availability cache.
 *
 * NOTE: This is a starting point — not a fixed value.
 * After K6-3v4 results, benchmark TTL at 5s / 10s / 15s / 30s
 * and choose the longest TTL that still preserves business correctness.
 *
 * Trade-off: shorter TTL = fresher data, more DB hits.
 *            longer TTL = better DB pressure reduction, higher stale risk.
 */
const AVAILABILITY_CACHE_TTL_SECONDS = 15;

// ─── Cache Invalidation (called after booking commit) ─────────────────────────

/**
 * Invalidate availability cache entries that may be affected by a new booking.
 *
 * Call this AFTER a booking has been successfully committed to the database,
 * NOT before. The database transaction is the source of truth for booking validity.
 *
 * @param tenantId - Tenant whose availability data changed
 * @param date     - Date of the new/modified booking
 * @param time     - Start time slot to invalidate
 * @param duration - Duration to invalidate
 */
export async function invalidateAvailabilityCache(params: {
  tenantId: string;
  date: string;
  time: string;
  duration: number;
}): Promise<void> {
  // Invalidate both with and without excludeBookingId variants
  // (both are commonly cached from UI polling)
  const keyWithoutExclude = buildAvailabilityCacheKey({ ...params, excludeBookingId: null });
  await deleteCache(keyWithoutExclude);

  // Note: keys with specific excludeBookingId will expire via TTL naturally.
  // If stronger consistency is required, store and invalidate those keys too.
  console.info('[KTV Availability Cache] Invalidated:', keyWithoutExclude);
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

/**
 * API Route: Check KTV Availability for Booking Time
 *
 * Purpose: Real-time availability check when editing booking time.
 * Returns which KTVs are available/unavailable with detailed reasons.
 *
 * Performance Strategy:
 *   1. Redis read cache (L1 in-memory → L2 Upstash) with 15s TTL
 *   2. N+1 fix: one batch query for ALL session_logs on the requested date,
 *      then per-KTV filtering happens in memory (zero extra DB round-trips)
 *   3. Server-Timing headers for sub-step measurement in K6-3v4
 *
 * Cache Architecture:
 *   Redis = Acceleration layer only.
 *   Redis HIT answers "KTV appeared available when cache was created."
 *   Database transaction = authority for whether booking can actually be committed.
 *   → Always call invalidateAvailabilityCache() after booking COMMIT.
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
  const serverTimingParts: string[] = [];
  const t0 = Date.now();

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
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

    // ── Input Parsing & Validation ────────────────────────────────────────────
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Expected: YYYY-MM-DD' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: 'Invalid time format. Expected: HH:mm' }, { status: 400 });
    }

    // ── Redis Cache Lookup ────────────────────────────────────────────────────
    const cacheKey = buildAvailabilityCacheKey({ tenantId, date, time, duration, excludeBookingId });
    const tCacheStart = Date.now();

    const cached = await getCache<CheckAvailabilityResponse>(cacheKey);
    serverTimingParts.push(`redis;dur=${Date.now() - tCacheStart}`);

    if (cached) {
      const totalDur = Date.now() - t0;
      serverTimingParts.push(`total;dur=${totalDur}`);
      return NextResponse.json(
        { ...cached, _cache: 'HIT' },
        {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'Server-Timing': serverTimingParts.join(', '),
          },
        }
      );
    }

    // ── DB: Tenant Capacity Config ────────────────────────────────────────────
    const tDbStart = Date.now();

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .single();

    type TenantMetadata = {
      capacity_config?: {
        minBreakMinutes?: number;
        enforceBreakTimes?: boolean;
        bufferPercentage?: number;
        enablePeakHourManagement?: boolean;
      };
    };

    const capacityConfig = (tenantData?.metadata as TenantMetadata)?.capacity_config;
    const minBreakMinutes = capacityConfig?.minBreakMinutes ?? 15;
    const enforceBreakTimes = capacityConfig?.enforceBreakTimes !== false;

    // ── DB: Fetch All Active KTVs ─────────────────────────────────────────────
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
      return NextResponse.json({ available: [], unavailable: [] });
    }

    // ── DB: Batch Session Query (N+1 Fix) ─────────────────────────────────────
    //
    // BEFORE (N+1 pattern): one DB query per KTV → e.g. 20 KTVs = 20 queries
    // AFTER  (batch):       one DB query for ALL session_logs on this date,
    //                       then filter per-KTV in memory (zero extra round-trips)
    //
    const { data: allSessionsForDate, error: sessionError } = await supabase
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

    serverTimingParts.push(`db;dur=${Date.now() - tDbStart}`);

    if (sessionError) {
      console.error('[CheckAvailability] Failed to fetch session logs:', sessionError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // ── Compute: Filter + Capacity Check per KTV (in memory) ─────────────────
    const tComputeStart = Date.now();

    const allSessions = allSessionsForDate ?? [];

    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

    const capacityProvider = new CapacityManagementProvider({ debug: false });

    const availabilityChecks = await Promise.all(
      allKtvs.map(async (ktv) => {
        try {
          // Filter the batch result for this KTV — in-memory, no DB call
          const filteredSessions = allSessions.filter(session => {
            const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
            if (!booking) return false;
            if (booking.status === 'cancelled') return false;
            if (excludeBookingId && booking.id === excludeBookingId) return false;

            const activeKtvId = session.completed_by_ktv_id || booking.assigned_ktv_id;
            return activeKtvId === ktv.id;
          });

          const existingBookingsFormatted = filteredSessions.map(session => {
            const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
            const durationMinutes =
              (booking?.packages as unknown as Record<string, unknown>)?.duration_minutes as number || 60;
            const statusMap: Record<string, 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'> = {
              scheduled: 'confirmed',
              in_progress: 'in_progress',
              completed: 'completed',
            };
            const status = statusMap[session.status || ''] || 'pending';
            return {
              id: booking?.id || session.id,
              startTime: session.assigned_time || '08:00',
              endTime: calculateEndTime(session.assigned_time || '08:00', durationMinutes),
              durationMinutes,
              status,
            };
          });

          const capacityResult = await capacityProvider.checkCapacity({
            ktvId: ktv.id,
            tenantId,
            booking: {
              requestedStartTime: time,
              requestedEndTime: endTime,
              requestedDate: date,
              durationMinutes: duration,
              serviceType: 'spa_session',
              customerTier: 'new',
            },
            existingBookings: existingBookingsFormatted,
            tenantCapacity: capacityConfig
              ? {
                  bufferPercentage: (capacityConfig.bufferPercentage as number) || 0,
                  enablePeakHourManagement: (capacityConfig.enablePeakHourManagement as boolean) || false,
                  enforceBreakTimes,
                }
              : undefined,
            ktvCapacity: {
              maxDailyBookings: 10,
              maxConcurrentSessions: 5,
              minBreakMinutes,
              workingHours: { start: '08:00', end: '22:00' },
            },
          });

          if (capacityResult.available) {
            return { id: ktv.id, name: ktv.full_name, available: true } as KTVAvailability;
          }

          const conflict = capacityResult.conflicts?.[0];
          let reason = 'Không khả dụng';
          let conflictType: 'overlap' | 'break_time_violation' | 'daily_limit' = 'overlap';
          let conflictDetails: KTVAvailability['conflictDetails'] = {};

          if (conflict) {
            if (conflict.type === 'break_time_violation') {
              conflictType = 'break_time_violation';
              const existingTime = formatTime(conflict.conflictingBooking?.startTime || '');
              const existingEnd = formatTime(
                conflict.conflictingBooking?.endTime || calculateEndTime(existingTime, duration)
              );
              reason = `Ca kết thúc lúc ${existingEnd}, cần thêm ${minBreakMinutes} phút nghỉ`;
              conflictDetails = {
                existingBookingTime: existingTime,
                existingBookingEndTime: existingEnd,
                requiredBreakMinutes: minBreakMinutes,
                nextAvailableTime: formatTime(calculateNextAvailable(existingEnd, 0, minBreakMinutes)),
              };
            } else if (conflict.type === 'time_overlap') {
              conflictType = 'overlap';
              const existingTime = formatTime(conflict.conflictingBooking?.startTime || '');
              const existingEnd = formatTime(
                conflict.conflictingBooking?.endTime || calculateEndTime(existingTime, duration)
              );
              reason = `Trùng ca đang có lúc ${existingTime}–${existingEnd}`;
              conflictDetails = {
                existingBookingTime: existingTime,
                existingBookingEndTime: existingEnd,
                requiredBreakMinutes: minBreakMinutes,
                nextAvailableTime: formatTime(calculateNextAvailable(existingEnd, 0, minBreakMinutes)),
              };
            } else if (conflict.type === 'daily_limit' || conflict.type === 'outside_working_hours') {
              conflictType = 'daily_limit';
              reason = 'Đã đạt giới hạn ca trong ngày';
            }
          }

          return { id: ktv.id, name: ktv.full_name, available: false, reason, conflictType, conflictDetails };
        } catch (error) {
          console.error(`[CheckAvailability] Error checking KTV ${ktv.id}:`, error);
          return { id: ktv.id, name: ktv.full_name, available: false, reason: 'Không thể kiểm tra lịch' };
        }
      })
    );

    serverTimingParts.push(`compute;dur=${Date.now() - tComputeStart}`);

    // ── Build Response & Cache ────────────────────────────────────────────────
    const available = availabilityChecks.filter(k => k.available);
    const unavailable = availabilityChecks.filter(k => !k.available);
    const responseBody: CheckAvailabilityResponse = { available, unavailable };

    // Write to cache (fire-and-forget, do not await to avoid adding latency)
    setCache(cacheKey, responseBody, AVAILABILITY_CACHE_TTL_SECONDS).catch(err =>
      console.error('[KTV Availability Cache] Failed to write cache:', err)
    );

    const totalDur = Date.now() - t0;
    serverTimingParts.push(`total;dur=${totalDur}`);

    return NextResponse.json(
      { ...responseBody, _cache: 'MISS' },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Server-Timing': serverTimingParts.join(', '),
        },
      }
    );

  } catch (error) {
    console.error('[CheckAvailability] Unhandled error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

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

function formatTime(t: string): string {
  if (!t) return '';
  return t.split(':').slice(0, 2).join(':');
}
