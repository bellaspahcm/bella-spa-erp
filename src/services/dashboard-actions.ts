'use server';
import { getCurrentUser } from './user-actions';

// ─── Schema notes (verified 2026-05-15) ──────────────────────────────────────
// session_logs.completed_by_ktv_id → users   (FK: session_logs_completed_by_ktv_id_fkey)
// session_reviews.ktv_id           → users   (FK: session_reviews_ktv_id_fkey)
// session_reviews.reviewer_id      → customers (FK: session_reviews_reviewer_id_fkey)
// bookings.customer_id             → customers (FK: bookings_customer_id_fkey)
// No RPCs: get_dashboard_summary, get_monthly_performance_v2, get_important_alerts
// ─────────────────────────────────────────────────────────────────────────────

function calcTrend(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function monthRange(monthStart: string) {
  const [y, m] = monthStart.split('-').map(Number);
  const end = m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const prevStart = m === 1
    ? `${y - 1}-12-01`
    : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  return { end, prevStart };
}

// ─── getDashboardStats ────────────────────────────────────────────────────────
// Replaces missing RPC: get_dashboard_summary
export async function getDashboardStats(startDate?: string, endDate?: string, todayDate?: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;

    // Warn but do NOT throw — fall back to unfiltered query if tenantId missing
    if (!tenantId) {
      console.warn('[getDashboardStats] No tenantId — querying without tenant filter');
    }

    const now = new Date();
    const today = todayDate
      || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthStart = startDate || (today.substring(0, 7) + '-01');
    const { end: monthEnd, prevStart } = monthRange(monthStart);

    // Build queries — add tenant filter only when available (Supabase builder is immutable)
    let custQ    = supabase.from('customers').select('id', { count: 'exact', head: true });
    let prevCustQ = supabase.from('customers').select('id', { count: 'exact', head: true }).lt('created_at', monthStart);
    let revQ     = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', monthStart).lt('received_date', monthEnd);
    let prevRevQ = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', prevStart).lt('received_date', monthStart);
    let ratQ     = supabase.from('session_reviews').select('rating');

    if (tenantId) {
      custQ    = custQ.eq('tenant_id', tenantId);
      prevCustQ = prevCustQ.eq('tenant_id', tenantId);
      revQ     = revQ.eq('tenant_id', tenantId);
      prevRevQ = prevRevQ.eq('tenant_id', tenantId);
      ratQ     = ratQ.eq('tenant_id', tenantId);
    }

    const [custRes, prevCustRes, revRes, prevRevRes, ratingRes] = await Promise.all([
      custQ, prevCustQ, revQ, prevRevQ, ratQ
    ]);

    const totalCustomers = custRes.count ?? 0;
    const prevCustomers = prevCustRes.count ?? 0;
    const totalRevenue = (revRes.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const prevRevenue = (prevRevRes.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const ratings = ratingRes.data || [];
    const avgRating = ratings.length
      ? ratings.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / ratings.length
      : 5.0;

    return {
      totalCustomers: { value: totalCustomers.toLocaleString(), trend: calcTrend(totalCustomers, prevCustomers) },
      todayBookings:  { value: '0', trend: 0 }, // overridden below in getFullDashboardData
      totalRevenue:   { value: totalRevenue > 0 ? (totalRevenue / 1_000_000).toFixed(1) + 'M' : '0M', trend: calcTrend(totalRevenue, prevRevenue) },
      avgRating:      { value: avgRating.toFixed(1), trend: 0 }
    };
  } catch (e) {
    console.error('[getDashboardStats]', e);
    return {
      totalCustomers: { value: '0', trend: 0 },
      todayBookings:  { value: '0', trend: 0 },
      totalRevenue:   { value: '0M', trend: 0 },
      avgRating:      { value: '5.0', trend: 0 }
    };
  }
}

// ─── getUpcomingSessions ──────────────────────────────────────────────────────
export async function getUpcomingSessions(date?: string) {
  try {
    const { getCalendarSessions } = await import('./booking-actions');
    const allSessions = await getCalendarSessions();

    let todayStr = date;
    if (!todayStr) {
      const now = new Date();
      todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const todaySessions = allSessions.filter((s: any) =>
      s.assigned_date === todayStr && s.status !== 'completed'
    );
    return todaySessions.sort((a: any, b: any) => (a.assigned_time || '').localeCompare(b.assigned_time || ''));
  } catch (e) {
    console.error('[getUpcomingSessions]', e);
    return [];
  }
}

// ─── getTopTechnicians ────────────────────────────────────────────────────────
// Uses separate queries then aggregates (avoids ambiguous FK join)
export async function getTopTechnicians() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) return [];

    const [ktvRes, sessionRes, reviewRes] = await Promise.all([
      // KTV users
      supabase.from('users').select('id, full_name')
        .eq('role', 'ktv').eq('tenant_id', tenantId),
      // Completed sessions per KTV (via completed_by_ktv_id)
      supabase.from('session_logs').select('completed_by_ktv_id')
        .eq('tenant_id', tenantId).eq('status', 'completed'),
      // Reviews per KTV
      supabase.from('session_reviews').select('ktv_id, rating')
        .eq('tenant_id', tenantId)
    ]);

    // Aggregate session counts
    const sessionCount: Record<string, number> = {};
    for (const sl of (sessionRes.data || [])) {
      if (sl.completed_by_ktv_id) {
        sessionCount[sl.completed_by_ktv_id] = (sessionCount[sl.completed_by_ktv_id] || 0) + 1;
      }
    }

    // Aggregate ratings
    const ratingMap: Record<string, number[]> = {};
    for (const rv of (reviewRes.data || [])) {
      if (rv.ktv_id) {
        if (!ratingMap[rv.ktv_id]) ratingMap[rv.ktv_id] = [];
        ratingMap[rv.ktv_id].push(Number(rv.rating));
      }
    }

    return (ktvRes.data || [])
      .map((u: any) => {
        const sessions = sessionCount[u.id] || 0;
        const userRatings = ratingMap[u.id] || [];
        const avgRating = userRatings.length
          ? userRatings.reduce((s, r) => s + r, 0) / userRatings.length
          : 5.0;
        return {
          name: u.full_name,
          sessions,
          rating: avgRating.toFixed(1),
          status: avgRating >= 4.8 ? 'Xuất Sắc' : 'Tốt',
          bonus: avgRating >= 4.8 ? '+2,000k' : '+1,500k'
        };
      })
      .sort((a: any, b: any) => b.sessions - a.sessions)
      .slice(0, 3);
  } catch (e) {
    console.error('[getTopTechnicians]', e);
    return [];
  }
}

// ─── getMonthlyPerformance ────────────────────────────────────────────────────
// Replaces missing RPC: get_monthly_performance_v2
export async function getMonthlyPerformance() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) return [];

    // Build last 6 months
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear();
      const mo = d.getMonth() + 1;
      const start = `${y}-${String(mo).padStart(2, '0')}-01`;
      const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
      return { label: `T${mo}`, start, end };
    });

    const rangeStart = months[0].start;
    const rangeEnd = months[months.length - 1].end;

    const [revData, expData, reviewData, customerData] = await Promise.all([
      supabase.from('revenue').select('amount, received_date')
        .eq('tenant_id', tenantId).eq('status', 'confirmed')
        .gte('received_date', rangeStart).lt('received_date', rangeEnd),
      supabase.from('expenses').select('amount, expense_date')
        .eq('tenant_id', tenantId)
        .gte('expense_date', rangeStart).lt('expense_date', rangeEnd),
      supabase.from('session_reviews').select('rating, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', rangeStart).lt('created_at', rangeEnd),
      supabase.from('customers').select('id, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', rangeStart).lt('created_at', rangeEnd)
    ]);

    return months.map(mo => {
      const rev = (revData.data || [])
        .filter((r: any) => r.received_date >= mo.start && r.received_date < mo.end)
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const exp = (expData.data || [])
        .filter((e: any) => e.expense_date >= mo.start && e.expense_date < mo.end)
        .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const monthRatings = (reviewData.data || []).filter((r: any) => r.created_at >= mo.start && r.created_at < mo.end);
      const avg = monthRatings.length
        ? monthRatings.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / monthRatings.length
        : 5.0;
      const newCustomers = (customerData.data || [])
        .filter((c: any) => c.created_at >= mo.start && c.created_at < mo.end).length;

      return {
        name: mo.label,
        customers: newCustomers,
        revenue: Number((rev / 1_000_000).toFixed(1)),
        expense: Number((exp / 1_000_000).toFixed(1)),
        rating: Number(avg.toFixed(1))
      };
    });
  } catch (e) {
    console.error('[getMonthlyPerformance]', e);
    return [];
  }
}

// ─── getImportantAlerts ───────────────────────────────────────────────────────
// Replaces missing RPC: get_important_alerts
export async function getImportantAlerts() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) return [];

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Overdue sessions (assigned in past, not completed)
    const { data: overdue } = await supabase
      .from('session_logs')
      .select('id, assigned_date, booking_id')
      .eq('tenant_id', tenantId)
      .lt('assigned_date', today)
      .not('status', 'eq', 'completed')
      .limit(5);

    const alerts: any[] = [];

    for (const s of (overdue || [])) {
      alerts.push({
        type: 'warning',                    // UI: alert.type === 'warning' → amber styling
        icon: 'alert',                      // UI: alert.icon === 'alert' → AlertTriangle icon
        title: 'Buổi chưa hoàn thành',
        message: `Buổi ngày ${new Date(s.assigned_date + 'T00:00:00').toLocaleDateString('vi-VN')} còn ở trạng thái chưa hoàn thành`,
        severity: 'warning',
        link: `/dashboard/sessions`
      });
    }

    // Bookings nearing completion (< 3 sessions left)
    const { data: nearEnd } = await supabase
      .from('bookings')
      .select('id, package_name, completed_sessions, total_sessions, customers!bookings_customer_id_fkey(name_mother)')
      .eq('tenant_id', tenantId)
      .eq('status', 'in_progress')
      .limit(10);

    for (const b of (nearEnd || [])) {
      const remaining = Number(b.total_sessions || 0) - Number(b.completed_sessions || 0);
      if (remaining <= 3 && remaining >= 0) {
        alerts.push({
          type: 'info',                     // UI: else → blue styling
          icon: 'lightbulb',               // UI: else → Lightbulb icon
          title: 'Gói sắp kết thúc',
          message: `KH ${b.customers?.name_mother || 'Không rõ'} còn ${remaining} buổi trong gói ${b.package_name || 'liệu trình'}`,
          severity: 'info',
          link: `/dashboard/sessions`
        });
      }
    }

    return alerts.slice(0, 5);
  } catch (e) {
    console.error('[getImportantAlerts]', e);
    return [];
  }
}

// ─── getFullDashboardData ─────────────────────────────────────────────────────
export async function getFullDashboardData(startDate?: string, endDate?: string, todayDate?: string) {
  const [statsData, sessionsData, ktvsData, alertsData, perfData] = await Promise.all([
    getDashboardStats(startDate, endDate, todayDate),
    getUpcomingSessions(todayDate),
    getTopTechnicians(),
    getImportantAlerts(),
    getMonthlyPerformance()
  ]);

  // Sync today's booking count with actual sessions fetched
  if (statsData && statsData.todayBookings && sessionsData) {
    statsData.todayBookings.value = sessionsData.length.toString();
  }

  return { statsData, sessionsData, ktvsData, alertsData, perfData };
}
