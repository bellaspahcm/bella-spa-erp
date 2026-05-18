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

    const today = todayDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const monthStart = startDate || (today.substring(0, 7) + '-01');
    const { end: monthEnd, prevStart } = monthRange(monthStart);

    // Build queries — add tenant filter only when available (Supabase builder is immutable)
    let custQ    = supabase.from('customers').select('id', { count: 'exact', head: true });
    let prevCustQ = supabase.from('customers').select('id', { count: 'exact', head: true }).lt('created_at', monthStart);
    let revQ     = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', monthStart).lt('received_date', monthEnd);
    let prevRevQ = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', prevStart).lt('received_date', monthStart);
    let ratQ     = supabase.from('session_logs').select('rating').not('rating', 'is', null); 

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

    const todayStr = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

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

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase.rpc('get_ktv_leaderboard', {
      p_tenant_id: tenantId,
      p_month: month
    });

    if (error) {
      console.error('[getTopTechnicians] RPC error:', error);
      return [];
    }

    return (data || []).slice(0, 3).map((u: any) => ({
      name: u.full_name,
      sessions: Number(u.sessions || 0),
      rating: Number(u.average_rating || 0).toFixed(1),
      status: Number(u.average_rating || 0) >= 4.8 ? 'Xuất Sắc' : 'Tốt',
      bonus: formatCurrency(Number(u.total_kpi_bonus || 0))
    }));
  } catch (e) {
    console.error('[getTopTechnicians]', e);
    return [];
  }
}

// Helper for formatting in dashboard-actions
function formatCurrency(val: number) {
  if (val >= 1000000) return `+${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `+${(val / 1000).toFixed(0)}k`;
  return `+${val}`;
}

// ─── getMonthlyPerformance ────────────────────────────────────────────────────
// Replaces missing RPC: get_monthly_performance_v2
export async function getMonthlyPerformance() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;

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
    const rangeEnd   = months[months.length - 1].end;

    const [revData, expData, reviewData, customerData] = await Promise.all([
      (() => {
        let q = supabase.from('revenue').select('amount, received_date')
          .eq('status', 'confirmed').gte('received_date', rangeStart).lt('received_date', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })(),
      (() => {
        let q = supabase.from('expenses').select('amount, expense_date')
          .gte('expense_date', rangeStart).lt('expense_date', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })(),
      (() => {
        let q = supabase.from('session_logs').select('rating, completed_date')
          .not('rating', 'is', null).gte('completed_date', rangeStart).lt('completed_date', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })(),
      (() => {
        let q = supabase.from('customers').select('id, created_at')
          .gte('created_at', rangeStart).lt('created_at', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })()
    ]);

    return months.map(mo => {
      const rev = (revData.data || [])
        .filter((r: any) => r.received_date >= mo.start && r.received_date < mo.end)
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const exp = (expData.data || [])
        .filter((e: any) => e.expense_date >= mo.start && e.expense_date < mo.end)
        .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const monthRatings = (reviewData.data || []).filter((r: any) => r.completed_date >= mo.start && r.completed_date < mo.end);
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

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    const alerts: any[] = [];

    // 1. Fetch completed sessions (KTV checkout) - sorted by date then end_time DESC with nulls last
    let completedQ = supabase.from('session_logs')
      .select(`
        id, 
        end_time, 
        completed_date,
        session_number,
        completed_by_ktv_id,
        booking_id,
        users!session_logs_completed_by_ktv_id_fkey(
          full_name
        ),
        bookings(
          package_name,
          customer_id,
          customers!bookings_customer_id_fkey(
            name_mother
          )
        )
      `)
      .eq('status', 'completed')
      .order('completed_date', { ascending: false })
      .order('end_time', { ascending: false, nullsFirst: false })
      .limit(30);
    if (tenantId) completedQ = completedQ.eq('tenant_id', tenantId);
    const { data: completedSessions } = await completedQ;

    for (const s of (completedSessions || [])) {
      const ktvName = (s.users as any)?.full_name || 'KTV';
      const motherName = (s.bookings as any)?.customers?.name_mother || 'Khách hàng';
      const endTimeVal = s.end_time;
      let msgStr = '';

      if (endTimeVal) {
        const normalized = endTimeVal.replace(' ', 'T');
        const d = new Date(normalized);
        const isValidDate = !isNaN(d.getTime());
        
        if (isValidDate) {
          const diffMs = Date.now() - d.getTime();
          const diffMinutes = Math.floor(Math.max(0, diffMs) / 60000);
          
          const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const timePart = timeFormatter.format(d);
          
          const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          const datePart = dateFormatter.format(d);
          
          if (diffMinutes < 5) {
            msgStr = `Ca KH ${motherName} do KTV ${ktvName} đã checkout hoàn thành lúc ${timePart} ngày ${datePart} (vừa xong)`;
          } else {
            msgStr = `Ca KH ${motherName} do KTV ${ktvName} đã checkout hoàn thành lúc ${timePart} ngày ${datePart}`;
          }
        } else {
          if (s.completed_date) {
            const [y, m, dVal] = s.completed_date.split('-');
            msgStr = `Ca KH ${motherName} do KTV ${ktvName} đã hoàn thành ngày ${dVal}/${m}/${y}`;
          } else {
            msgStr = `Ca KH ${motherName} do KTV ${ktvName} đã checkout hoàn thành vừa xong`;
          }
        }
      } else if (s.completed_date) {
        const [y, m, dVal] = s.completed_date.split('-');
        msgStr = `Ca KH ${motherName} do KTV ${ktvName} đã hoàn thành ngày ${dVal}/${m}/${y}`;
      } else {
        msgStr = `Ca KH ${motherName} do KTV ${ktvName} đã checkout hoàn thành vừa xong`;
      }

      const dObj = endTimeVal ? new Date(endTimeVal.replace(' ', 'T')) : null;
      const isValid = dObj && !isNaN(dObj.getTime());

      alerts.push({
        type: 'success',
        icon: 'checkCircle',
        title: 'KTV hoàn thành ca',
        message: msgStr,
        severity: 'success',
        link: `/dashboard/sessions?bookingId=${s.booking_id}`,
        timestamp: isValid ? dObj.getTime() : Date.now()
      });
    }

    // 2. Overdue sessions (past date, not completed)
    let overdueQ = supabase.from('session_logs')
      .select(`
        id, 
        assigned_date, 
        booking_id,
        bookings(
          package_name,
          customer_id,
          customers!bookings_customer_id_fkey(
            name_mother
          )
        )
      `)
      .lt('assigned_date', today)
      .not('status', 'eq', 'completed')
      .limit(20);
    if (tenantId) overdueQ = overdueQ.eq('tenant_id', tenantId);
    const { data: overdue } = await overdueQ;

    for (const s of (overdue || [])) {
      const motherName = (s.bookings as any)?.customers?.name_mother || 'Khách hàng';
      alerts.push({
        type: 'warning',
        icon: 'alert',
        title: 'Buổi chưa hoàn thành',
        message: `Buổi ngày ${new Date(s.assigned_date + 'T00:00:00').toLocaleDateString('vi-VN')} của KH ${motherName} còn ở trạng thái chưa hoàn thành`,
        severity: 'warning',
        link: `/dashboard/sessions?bookingId=${s.booking_id}`,
        timestamp: new Date(s.assigned_date + 'T00:00:00').getTime()
      });
    }

    // 3. Bookings nearing completion (< 3 sessions left)
    let bookingQ = supabase.from('bookings')
      .select('id, package_name, completed_sessions, total_sessions, customers!bookings_customer_id_fkey(name_mother)')
      .eq('status', 'in_progress')
      .limit(20);
    if (tenantId) bookingQ = bookingQ.eq('tenant_id', tenantId);
    const { data: nearEnd } = await bookingQ;

    for (const b of (nearEnd || [])) {
      const remaining = Number(b.total_sessions || 0) - Number(b.completed_sessions || 0);
      if (remaining <= 3 && remaining >= 0) {
        alerts.push({
          type: 'info',
          icon: 'lightbulb',
          title: 'Gói sắp kết thúc',
          message: `KH ${b.customers?.name_mother || 'Không rõ'} còn ${remaining} buổi trong gói ${b.package_name || 'liệu trình'}`,
          severity: 'info',
          link: `/dashboard/sessions?bookingId=${b.id}`,
          timestamp: 0
        });
      }
    }

    // Sort by timestamp descending so newer alerts/completed sessions are at the top
    alerts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return alerts;
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
