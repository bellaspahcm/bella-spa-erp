'use server';
import { getCurrentUser } from './user-actions';
import type { Database } from '@/types/database.types';

type KtvLeaderboardRow = Database['public']['Functions']['get_ktv_leaderboard']['Returns'][number];

export interface DashboardAlert {
  id?: string;
  isAppNotification?: boolean;
  type: 'warning' | 'info' | 'success' | 'danger';
  icon: string;
  title: string;
  message: string;
  severity: string;
  link: string;
  timestamp: number;
}

export interface CompletedSessionDBRow {
  id: string;
  end_time: string | null;
  completed_date: string | null;
  assigned_date: string | null;
  session_number: number;
  completed_by_ktv_id: string | null;
  booking_id: string | null;
  users: {
    full_name: string;
  } | null;
  bookings: {
    package_name: string;
    customer_id: string;
    customers: {
      name_mother: string;
    } | null;
  } | null;
}

export interface OverdueSessionDBRow {
  id: string;
  assigned_date: string;
  booking_id: string | null;
  bookings: {
    package_name: string;
    customer_id: string;
    customers: {
      name_mother: string;
    } | null;
  } | null;
}

export interface NearEndBookingDBRow {
  id: string;
  package_name: string;
  completed_sessions: number;
  total_sessions: number;
  customers: {
    name_mother: string;
  } | null;
}

export interface PendingLeaveRequest {
  id: string;
  leave_date: string;
  leave_type: string;
  created_at: string;
  users: {
    full_name: string;
  } | null;
}

export interface AppNotificationDBRow {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string | null;
  data: {
    customer_id?: string;
  } | null;
}


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
interface RevenueStatRow {
  amount: number | null;
}

interface RatingItem {
  rating: number | null;
  completed_date: string | null;
}

export async function getDashboardStats(startDate?: string, endDate?: string, todayDate?: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;

    // Warn but do NOT throw — fall back to unfiltered query if tenantId missing
    if (!tenantId) {
      console.warn('[getDashboardStats] No tenantId — querying without tenant filter');
    }

    const today = todayDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    // Compute yesterday Date in Asia/Ho_Chi_Minh context
    const todayD = new Date(today + 'T00:00:00');
    todayD.setDate(todayD.getDate() - 1);
    const yesterday = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;

    const monthStart = startDate || (today.substring(0, 7) + '-01');
    const { end: monthEnd, prevStart } = monthRange(monthStart);

    // Build queries — add tenant filter only when available (Supabase builder is immutable)
    let custQ    = supabase.from('customers').select('id', { count: 'exact', head: true });
    let prevCustQ = supabase.from('customers').select('id', { count: 'exact', head: true }).lt('created_at', monthStart);
    let revQ     = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', monthStart).lt('received_date', monthEnd);
    let prevRevQ = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', prevStart).lt('received_date', monthStart);
    let todayBookingsQ = supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('assigned_date', today);
    let yesterdayBookingsQ = supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('assigned_date', yesterday);

    if (tenantId) {
      custQ    = custQ.eq('tenant_id', tenantId);
      prevCustQ = prevCustQ.eq('tenant_id', tenantId);
      revQ     = revQ.eq('tenant_id', tenantId);
      prevRevQ = prevRevQ.eq('tenant_id', tenantId);
      todayBookingsQ = todayBookingsQ.eq('tenant_id', tenantId);
      yesterdayBookingsQ = yesterdayBookingsQ.eq('tenant_id', tenantId);
    }

    // Composite blended rating via RPC (60% customer + 40% discipline).
    // Run alongside other queries so we don't add round-trip latency.
    const curMonthRpc  = tenantId ? supabase.rpc('get_ktv_leaderboard', { p_tenant_id: tenantId, p_month: monthStart }) : Promise.resolve({ data: [] as KtvLeaderboardRow[] });
    const prevMonthRpc = tenantId ? supabase.rpc('get_ktv_leaderboard', { p_tenant_id: tenantId, p_month: prevStart })  : Promise.resolve({ data: [] as KtvLeaderboardRow[] });

    const [custRes, prevCustRes, revRes, prevRevRes, todayBookingsRes, yesterdayBookingsRes, curRpcRes, prevRpcRes] = await Promise.all([
      custQ, prevCustQ, revQ, prevRevQ, todayBookingsQ, yesterdayBookingsQ, curMonthRpc, prevMonthRpc
    ]);

    if (custRes.error) throw new Error(`Failed to fetch dashboard customer count: ${custRes.error.message}`);
    if (prevCustRes.error) throw new Error(`Failed to fetch previous dashboard customer count: ${prevCustRes.error.message}`);
    if (revRes.error) throw new Error(`Failed to fetch dashboard revenue: ${revRes.error.message}`);
    if (prevRevRes.error) throw new Error(`Failed to fetch previous dashboard revenue: ${prevRevRes.error.message}`);
    if (todayBookingsRes.error) throw new Error(`Failed to fetch today's dashboard bookings: ${todayBookingsRes.error.message}`);
    if (yesterdayBookingsRes.error) throw new Error(`Failed to fetch yesterday's dashboard bookings: ${yesterdayBookingsRes.error.message}`);
    if ('error' in curRpcRes && curRpcRes.error) throw new Error(`Failed to fetch current KTV leaderboard for dashboard stats: ${curRpcRes.error.message}`);
    if ('error' in prevRpcRes && prevRpcRes.error) throw new Error(`Failed to fetch previous KTV leaderboard for dashboard stats: ${prevRpcRes.error.message}`);

    const totalCustomers = custRes.count ?? 0;
    const prevCustomers = prevCustRes.count ?? 0;

    const revenueData = (revRes.data as unknown as RevenueStatRow[]) || [];
    const totalRevenue = revenueData.reduce((sum: number, r) => sum + Number(r.amount || 0), 0);

    const prevRevenueData = (prevRevRes.data as unknown as RevenueStatRow[]) || [];
    const prevRevenue = prevRevenueData.reduce((sum: number, r) => sum + Number(r.amount || 0), 0);

    // Average the composite blended rating across all KTVs in the month.
    // KTVs with NULL composite (no activity) are excluded so they don't
    // skew the average toward 0.
    const composites = (xs: KtvLeaderboardRow[] | null | undefined): number[] =>
      (xs || []).map((k) => k?.average_rating).filter((r) => r !== null && r !== undefined).map(Number);

    const curList  = composites(curRpcRes.data);
    const prevList = composites(prevRpcRes.data);

    const curAvgRating  = curList.length  ? curList.reduce((s, r) => s + r, 0)  / curList.length  : null;
    const prevAvgRating = prevList.length ? prevList.reduce((s, r) => s + r, 0) / prevList.length : null;

    const ratingTrend = (curAvgRating !== null && prevAvgRating !== null)
      ? calcTrend(curAvgRating, prevAvgRating)
      : 0;

    const todayBookingsCount = todayBookingsRes.count ?? 0;
    const yesterdayBookingsCount = yesterdayBookingsRes.count ?? 0;
    const todayBookingsTrend = calcTrend(todayBookingsCount, yesterdayBookingsCount);

    return {
      totalCustomers: { value: totalCustomers.toLocaleString(), trend: calcTrend(totalCustomers, prevCustomers) },
      todayBookings:  { value: todayBookingsCount.toString(), trend: todayBookingsTrend },
      totalRevenue:   { value: totalRevenue > 0 ? (totalRevenue / 1_000_000).toFixed(1) + 'M' : '0M', trend: calcTrend(totalRevenue, prevRevenue) },
      avgRating:      { value: curAvgRating !== null ? curAvgRating.toFixed(2) : '—', trend: ratingTrend }
    };
  } catch (e) {
    throw e instanceof Error ? e : new Error('Failed to fetch dashboard stats');
  }
}

// ─── getUpcomingSessions ──────────────────────────────────────────────────────
interface UpcomingSession {
  assigned_date: string | null;
  status: string | null;
  assigned_time: string | null;
}

export async function getUpcomingSessions(date?: string) {
  const { getCalendarSessions } = await import('@/modules/booking/actions/session-actions');
  const allSessions = await getCalendarSessions();

  const todayStr = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  const typedSessions = allSessions as unknown as UpcomingSession[];

  const todaySessions = typedSessions.filter((s) =>
    s.assigned_date === todayStr && s.status !== 'completed'
  );
  return todaySessions.sort((a, b) => (a.assigned_time || '').localeCompare(b.assigned_time || ''));
}

// ─── getTopTechnicians ────────────────────────────────────────────────────────
export async function getTopTechnicians() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
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
      throw new Error(`Failed to fetch top technicians: ${error.message}`);
    }

    const leaderData = (data as unknown as KtvLeaderboardRow[]) || [];

    return leaderData.slice(0, 3).map((u) => ({
      name: u.full_name,
      sessions: Number(u.sessions || 0),
      rating: Number(u.average_rating || 0).toFixed(1),
      status: Number(u.average_rating || 0) >= 4.8 ? 'Xuất Sắc' : 'Tốt',
      bonus: formatCurrency(Number(u.total_kpi_bonus || 0))
    }));
  } catch (e) {
    throw e instanceof Error ? e : new Error('Failed to fetch top technicians');
  }
}

// Helper for formatting in dashboard-actions
function formatCurrency(val: number) {
  if (val >= 1000000) return `+${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `+${(val / 1000).toFixed(0)}k`;
  return `+${val}`;
}

// ─── getMonthlyPerformance ────────────────────────────────────────────────────
interface RevenuePerformanceRow {
  amount: number | null;
  received_date: string | null;
}

interface ExpensePerformanceRow {
  amount: number | null;
  expense_date: string | null;
}

interface LogPerformanceRow {
  rating: number | null;
  completed_date: string | null;
}

interface CustomerPerformanceRow {
  id: string;
  created_at: string | null;
}

export async function getMonthlyPerformance() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
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

    // Run finance/customer queries in parallel with one RPC call per month.
    // The RPC returns the blended composite rating (60% customer + 40%
    // discipline) per KTV. We average across KTVs (excluding NULL =
    // KTVs with no activity) to get the month's headline rating.
    const monthlyRpcCalls = months.map(mo =>
      tenantId
        ? supabase.rpc('get_ktv_leaderboard', { p_tenant_id: tenantId, p_month: mo.start })
        : Promise.resolve({ data: [] as KtvLeaderboardRow[] })
    );

    const [revData, expData, customerData, ...monthlyRpcResults] = await Promise.all([
      (() => {
        const q = supabase.from('revenue').select('amount, received_date')
          .eq('status', 'confirmed').gte('received_date', rangeStart).lt('received_date', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })(),
      (() => {
        const q = supabase.from('expenses').select('amount, expense_date')
          .gte('expense_date', rangeStart).lt('expense_date', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })(),
      (() => {
        const q = supabase.from('customers').select('id, created_at')
          .gte('created_at', rangeStart).lt('created_at', rangeEnd);
        return tenantId ? q.eq('tenant_id', tenantId) : q;
      })(),
      ...monthlyRpcCalls
    ]);

    if (revData.error) throw new Error(`Failed to fetch monthly dashboard revenue: ${revData.error.message}`);
    if (expData.error) throw new Error(`Failed to fetch monthly dashboard expenses: ${expData.error.message}`);
    if (customerData.error) throw new Error(`Failed to fetch monthly dashboard customers: ${customerData.error.message}`);
    monthlyRpcResults.forEach((result, idx) => {
      if ('error' in result && result.error) {
        throw new Error(`Failed to fetch monthly KTV leaderboard for ${months[idx].start}: ${result.error.message}`);
      }
    });

    const revTyped = (revData.data as unknown as RevenuePerformanceRow[]) || [];
    const expTyped = (expData.data as unknown as ExpensePerformanceRow[]) || [];
    const customerTyped = (customerData.data as unknown as CustomerPerformanceRow[]) || [];

    return months.map((mo, idx) => {
      const rev = revTyped
        .filter((r) => r.received_date && r.received_date >= mo.start && r.received_date < mo.end)
        .reduce((sum: number, r) => sum + Number(r.amount || 0), 0);
      const exp = expTyped
        .filter((e) => e.expense_date && e.expense_date >= mo.start && e.expense_date < mo.end)
        .reduce((sum: number, e) => sum + Number(e.amount || 0), 0);

      // Average composite rating across KTVs for this month.
      // Null when no KTV has activity → chart shows '—'.
      const rpcRow = monthlyRpcResults[idx] as { data: KtvLeaderboardRow[] | null } | undefined;
      const composites = (rpcRow?.data || [])
        .map((k) => k?.average_rating)
        .filter((r): r is number => r !== null && r !== undefined)
        .map(Number);
      const avg = composites.length
        ? composites.reduce((s, r) => s + r, 0) / composites.length
        : null;

      const newCustomers = customerTyped
        .filter((c) => c.created_at && c.created_at >= mo.start && c.created_at < mo.end).length;
      return {
        name: mo.label,
        customers: newCustomers,
        revenue: Number((rev / 1_000_000).toFixed(1)),
        expense: Number((exp / 1_000_000).toFixed(1)),
        rating: avg !== null ? Number(avg.toFixed(2)) : null
      };
    });
  } catch (e) {
    throw e instanceof Error ? e : new Error('Failed to fetch monthly performance');
  }
}

// Helper function to robustly parse PostgreSQL timestamp strings, handling 2-digit offsets like "+00" or "+07"
function parsePostgresTimestamp(tsStr: string): Date {
  let normalized = tsStr.replace(' ', 'T');
  if (normalized.match(/([+-]\d{2})$/)) {
    normalized += ':00';
  }
  return new Date(normalized);
}

// ─── getImportantAlerts ───────────────────────────────────────────────────────
// Replaces missing RPC: get_important_alerts
export async function getImportantAlerts() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const { getPendingLeaveRequests } = await import('@/services/attendance-actions');
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    const alerts: DashboardAlert[] = [];

    // 1. Fetch completed sessions (KTV checkout) - sorted by date then end_time DESC with nulls last
    let completedQ = supabase.from('session_logs')
      .select(`
        id, 
        end_time, 
        completed_date,
        assigned_date,
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
    const { data: completedSessions, error: completedSessionsError } = await completedQ;
    if (completedSessionsError) {
      throw new Error(`Failed to fetch completed session alerts: ${completedSessionsError.message}`);
    }

    const completedSessionsData = (completedSessions as unknown as CompletedSessionDBRow[]) || [];

    for (const s of completedSessionsData) {
      const ktvName = s.users?.full_name || 'KTV';
      const motherName = s.bookings?.customers?.name_mother || 'Khách hàng';
      const endTimeVal = s.end_time;
      let msgStr = '';

      if (endTimeVal) {
        const d = parsePostgresTimestamp(endTimeVal);
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

      const dObj = endTimeVal ? parsePostgresTimestamp(endTimeVal) : null;
      const isValid = dObj && !isNaN(dObj.getTime());

      let finalTimestamp = 0;
      if (isValid && dObj) {
        finalTimestamp = dObj.getTime();
      } else if (s.completed_date) {
        finalTimestamp = new Date(s.completed_date + 'T00:00:00').getTime();
      } else if (s.assigned_date) {
        finalTimestamp = new Date(s.assigned_date + 'T00:00:00').getTime();
      }

      alerts.push({
        type: 'success',
        icon: 'checkCircle',
        title: 'KTV hoàn thành ca',
        message: msgStr,
        severity: 'success',
        link: `/dashboard/sessions?bookingId=${s.booking_id}`,
        timestamp: finalTimestamp
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
    const { data: overdue, error: overdueError } = await overdueQ;
    if (overdueError) {
      throw new Error(`Failed to fetch overdue session alerts: ${overdueError.message}`);
    }

    const overdueData = (overdue as unknown as OverdueSessionDBRow[]) || [];

    for (const s of overdueData) {
      const motherName = s.bookings?.customers?.name_mother || 'Khách hàng';
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
    const { data: nearEnd, error: nearEndError } = await bookingQ;
    if (nearEndError) {
      throw new Error(`Failed to fetch near-end booking alerts: ${nearEndError.message}`);
    }

    const nearEndData = (nearEnd as unknown as NearEndBookingDBRow[]) || [];

    for (const b of nearEndData) {
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

    // 4. Pending Leave Requests
    try {
      // Only admins should see pending leave alerts in their dashboard
      if (currentUser?.role === 'admin') {
        const pendingLeaves = (await getPendingLeaveRequests() as unknown as PendingLeaveRequest[]) || [];
        for (const leave of pendingLeaves) {
          alerts.push({
            type: 'warning',
            icon: 'alert',
            title: 'Xin nghỉ phép chờ duyệt',
            message: `KTV ${leave.users?.full_name || 'Không rõ'} xin nghỉ ngày ${new Date(leave.leave_date).toLocaleDateString('vi-VN')} (${leave.leave_type === 'full' ? 'Cả ngày' : leave.leave_type === 'morning' ? 'Ca sáng' : 'Ca chiều'})`,
            severity: 'warning',
            link: `/dashboard/sessions`, // Leads to approval UI
            timestamp: new Date(leave.created_at).getTime()
          });
        }
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to fetch pending leave alerts');
    }

    // 5. App Notifications (e.g. online bookings)
    try {
      if (currentUser?.role === 'admin' || currentUser?.role === 'admin_staff') {
        let notifQ = supabase.from('app_notifications')
          .select('*')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(20);
        if (tenantId) notifQ = notifQ.eq('tenant_id', tenantId);
        
        const { data: appNotifs, error: appNotifsError } = await notifQ;
        if (appNotifsError) {
          throw new Error(`Failed to fetch app notification alerts: ${appNotifsError.message}`);
        }
        const appNotifsData = (appNotifs as unknown as AppNotificationDBRow[]) || [];
        
        for (const notif of appNotifsData) {
          let link = '/dashboard';
          if (notif.type === 'new_booking' && notif.data?.customer_id) {
            link = `/dashboard/customers/${notif.data.customer_id}`;
          }
          
          let finalTimestamp = Date.now();
          if (notif.created_at) {
            try {
              finalTimestamp = parsePostgresTimestamp(notif.created_at).getTime();
            } catch (e) {
              // fallback
            }
          }

          alerts.push({
            id: notif.id,
            isAppNotification: true,
            type: 'info',
            icon: 'bell',
            title: notif.title,
            message: notif.message,
            severity: 'info',
            link: link,
            timestamp: finalTimestamp
          });
        }
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to fetch app notification alerts');
    }

    // Sort by timestamp descending so newer alerts/completed sessions are at the top
    alerts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return alerts;
  } catch (e) {
    throw e instanceof Error ? e : new Error('Failed to fetch important alerts');
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

  return { statsData, sessionsData, ktvsData, alertsData, perfData };
}
