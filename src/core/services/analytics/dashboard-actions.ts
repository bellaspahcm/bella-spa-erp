'use server';
import type { Database } from '@/types/database.types';
import { resolvePackageName } from '@bella/shared';;
import { getCurrentUser } from '@/services/user-actions';

type KtvLeaderboardRow = Database['public']['Functions']['get_ktv_leaderboard']['Returns'][number];
const DASHBOARD_UPCOMING_SESSIONS_LIMIT = 20;

/**
 * Represents a stats card in the dashboard grid.
 * 
 * This interface defines the data structure for dashboard statistics cards
 * that display key performance indicators (KPIs) with trend indicators.
 * 
 * @property {string} label - Display label for the stats card (e.g., "Tổng khách hàng")
 * @property {string} value - Formatted value to display (e.g., "150", "1.5M", "4.85")
 * @property {number} trend - Percentage change compared to previous period (positive or negative)
 * @property {('Users' | 'Calendar' | 'DollarSign' | 'Star')} iconName - Icon to display on the card
 * @property {string} color - Tailwind text color class for the icon (e.g., "text-blue-600")
 * @property {string} bg - Tailwind background color class for the icon container (e.g., "bg-blue-50")
 */
export interface DashboardStatsViewModel {
  label: string;
  value: string;
  trend: number;
  iconName: 'Users' | 'Calendar' | 'DollarSign' | 'Star';
  color: string;
  bg: string;
}

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

/**
 * View Model representing inventory summary metrics for dashboard display.
 * 
 * Represents aggregated inventory statistics including total item count,
 * low stock alerts, and total inventory value.
 * 
 * @interface InventorySummaryViewModel
 * @property {number} totalItems - Total count of inventory items
 * @property {number} lowStockCount - Count of items at or below minimum stock level
 * @property {number} totalValue - Total value of all inventory (stock_level * price_per_unit)
 */
export interface InventorySummaryViewModel {
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
}

/**
 * Represents a single data point on the monthly performance chart.
 * Used to display revenue, expenses, customer acquisition, and service quality metrics over time.
 * 
 * @property {string} name - Month label (e.g., "T1", "T2" for Vietnamese month format)
 * @property {number} customers - Number of new customers acquired during this month
 * @property {number} revenue - Total confirmed revenue in millions of VND
 * @property {number} expense - Total expenses in millions of VND
 * @property {number | null} rating - Average service quality rating for the month (null when no rating data available)
 */
export interface PerformanceDataPointViewModel {
  name: string;
  customers: number;
  revenue: number;
  expense: number;
  rating: number | null;
}

/**
 * View Model interface representing a KTV (technician) in the performance leaderboard.
 * 
 * This interface defines the data structure for displaying top-performing technicians
 * in the dashboard KTV performance table. Each row represents one KTV's monthly performance
 * metrics including completed sessions, average rating, performance status, and earned bonuses.
 * 
 * @property {string} name - Full name of the KTV
 * @property {number} sessions - Total number of completed sessions (with package multipliers applied)
 * @property {number | string} rating - Average composite rating (60% customer + 40% discipline). Can be numeric or formatted string like "4.5"
 * @property {string} status - Performance status label (e.g., "Xuất Sắc", "Tốt")
 * @property {string} bonus - Formatted KPI bonus amount (e.g., "+1.2M", "+500k")
 */
export interface KtvPerformanceViewModel {
  name: string;
  sessions: number;
  rating: number | string;
  status: string;
  bonus: string;
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
    href?: string;
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
const DASHBOARD_TENANT_ACCESS_ERROR = 'Không xác định được đơn vị kinh doanh cho dashboard';

function requireDashboardTenant(currentUser: { tenant_id?: string | null } | null | undefined) {
  if (!currentUser?.tenant_id) {
    throw new Error(DASHBOARD_TENANT_ACCESS_ERROR);
  }
  return currentUser.tenant_id;
}

interface RevenueStatRow {
  amount: number | null;
}

interface DashboardInventoryItemRow {
  stock_level: number | null;
  min_stock_level: number | null;
  price_per_unit: number | null;
}

export async function getDashboardStats(
  startDate?: string, 
  endDate?: string, 
  todayDate?: string
): Promise<{
  totalCustomers: { value: string; trend: number };
  todayBookings: { value: string; trend: number };
  totalRevenue: { value: string; trend: number };
  avgRating: { value: string; trend: number };
}> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireDashboardTenant(currentUser);

    const today = todayDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    // Compute yesterday Date in Asia/Ho_Chi_Minh context
    const todayD = new Date(today + 'T00:00:00');
    todayD.setDate(todayD.getDate() - 1);
    const yesterday = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;

    const monthStart = startDate || (today.substring(0, 7) + '-01');
    const { end: monthEnd, prevStart } = monthRange(monthStart);

    const custQ = supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    const prevCustQ = supabase.from('customers').select('id', { count: 'exact', head: true }).lt('created_at', monthStart).eq('tenant_id', tenantId);
    const revQ = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', monthStart).lt('received_date', monthEnd).eq('tenant_id', tenantId);
    const prevRevQ = supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', prevStart).lt('received_date', monthStart).eq('tenant_id', tenantId);
    const todayBookingsQ = supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('assigned_date', today).eq('tenant_id', tenantId);
    const yesterdayBookingsQ = supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('assigned_date', yesterday).eq('tenant_id', tenantId);

    // Composite blended rating via RPC (60% customer + 40% discipline).
    // Run alongside other queries so we don't add round-trip latency.
    const curMonthRpc = supabase.rpc('get_ktv_leaderboard', { p_tenant_id: tenantId, p_month: monthStart });
    const prevMonthRpc = supabase.rpc('get_ktv_leaderboard', { p_tenant_id: tenantId, p_month: prevStart });

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
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];

type UpcomingSession = SessionLogRow & {
  bookings?: {
    id: string;
    package_name?: string | null;
    preferred_time?: string | null;
    completed_sessions?: number;
    total_sessions?: number;
    packages?: {
      name?: string | null;
      module_key?: string | null;
      service_category?: string | null;
    } | null;
    customers?: {
      id: string;
      name_mother: string;
      name_baby?: string | null;
    } | null;
    assigned_ktv?: {
      id: string;
      full_name: string;
    } | null;
  } | null;
};

/**
 * View model representing a session card in the "Sắp tới trong hôm nay" (Today's Schedule) widget.
 * 
 * This interface represents the data shape returned by `getUpcomingSessions()` and is used to render
 * individual session cards in the dashboard. Each session includes full booking context with nested
 * customer, package, and KTV assignment details.
 * 
 * The interface includes all fields from the `session_logs` table (via `select *`) plus nested
 * booking relationships. Fields marked as optional may be null depending on the session state.
 * 
 * @property {string} id - Unique session log ID
 * @property {string} booking_id - Foreign key to bookings table
 * @property {string} status - Session status (e.g., 'scheduled', 'completed', 'cancelled')
 * @property {string | null} assigned_time - Scheduled time slot for the session (HH:MM format)
 * @property {object | null} bookings - Nested booking details including customer, package, and KTV data
 * 
 * @see Requirements 2.2 - Define Explicit View Models for Dashboard Data
 * @see Requirements 10.2 - Type Dashboard State Variables with View Models
 */
export interface DashboardSessionViewModel {
  // Primary fields from session_logs table
  id: string;
  booking_id: string;
  session_number: number;
  assigned_date: string | null;
  assigned_time: string | null;
  completed_date: string | null;
  completed_by_ktv_id: string | null;
  status: string | null;
  address: string | null;
  notes: string | null;
  ktv_checkout_note: string | null;
  rating: number | null;
  rating_comment: string | null;
  tenant_id: string;
  created_at: string | null;
  
  // Timing and duration fields
  start_time: string | null;
  end_time: string | null;
  standard_duration: number | null;
  actual_duration: number | null;
  time_deviation: number | null;
  duration_warning_type: string | null;
  
  // GPS verification fields
  checkin_lat: number | null;
  checkin_lon: number | null;
  checkout_lat: number | null;
  checkout_lon: number | null;
  
  // Accounting and business event fields
  business_event_type: string | null;
  accounting_template_id: string | null;
  accounting_review_status: string;
  accounting_metadata: Record<string, unknown> | null; // JSON field
  
  // Resource management
  booking_resource_id: string | null;
  
  // Other fields
  is_confirmed: boolean | null;
  zalo_reminder_sent: boolean | null;
  zalo_reminder_time: string | null;
  
  // Nested booking relationship with customer, package, and KTV details
  bookings: {
    id: string;
    package_name: string;
    preferred_time?: string | null;
    completed_sessions?: number;
    total_sessions?: number;
    packages?: {
      name?: string | null;
      module_key?: string | null;
      service_category?: string | null;
    } | null;
    customers?: {
      id: string;
      name_mother: string;
      name_baby?: string | null;
    } | null;
    assigned_ktv?: {
      id: string;
      full_name: string;
    } | null;
  } | null;
}

export async function getUpcomingSessions(date?: string): Promise<DashboardSessionViewModel[]> {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = requireDashboardTenant(currentUser);
  const todayStr = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  let query = supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        id,
        package_name,
        preferred_time,
        completed_sessions,
        total_sessions,
        packages!bookings_package_id_fkey (name, module_key, service_category),
        customers (
          id,
          name_mother,
          name_baby
        ),
        assigned_ktv:users!bookings_assigned_ktv_id_fkey (
          id,
          full_name
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('assigned_date', todayStr)
    .not('status', 'eq', 'completed')
    .order('assigned_time', { ascending: true, nullsFirst: false })
    .order('session_number', { ascending: true })
    .limit(DASHBOARD_UPCOMING_SESSIONS_LIMIT);

  if (currentUser?.role?.toLowerCase() === 'ktv') {
    query = query.eq('bookings.assigned_ktv_id', currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch dashboard upcoming sessions: ${error.message}`);
  }

  return ((data || []) as UpcomingSession[]).map((session): DashboardSessionViewModel => ({
    ...session,
    accounting_metadata: (typeof session.accounting_metadata === 'object' && session.accounting_metadata !== null && !Array.isArray(session.accounting_metadata))
      ? session.accounting_metadata as Record<string, unknown>
      : null,
    bookings: session.bookings
      ? {
          ...session.bookings,
          package_name: resolvePackageName(session.bookings),
        }
      : null,
  }));
}

export async function getDashboardInventorySummary(): Promise<InventorySummaryViewModel> {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = requireDashboardTenant(currentUser);

  const { data, error } = await supabase
    .from('inventory_items')
    .select('stock_level, min_stock_level, price_per_unit')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to fetch dashboard inventory summary: ${error.message}`);
  }

  const items = (data as DashboardInventoryItemRow[] | null) || [];
  return {
    totalItems: items.length,
    lowStockCount: items.filter((item) => Number(item.stock_level) <= Number(item.min_stock_level)).length,
    totalValue: items.reduce(
      (sum, item) => sum + Number(item.stock_level || 0) * Number(item.price_per_unit || 0),
      0
    ),
  };
}

// ─── getTopTechnicians ────────────────────────────────────────────────────────
export async function getTopTechnicians(): Promise<KtvPerformanceViewModel[]> {
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

interface CustomerPerformanceRow {
  id: string;
  created_at: string | null;
}

export async function getMonthlyPerformance(): Promise<PerformanceDataPointViewModel[]> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireDashboardTenant(currentUser);

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
    const monthlyRpcCalls = months.map((mo) => (
      supabase.rpc('get_ktv_leaderboard', { p_tenant_id: tenantId, p_month: mo.start })
    ));

    const [revData, expData, customerData, ...monthlyRpcResults] = await Promise.all([
      supabase.from('revenue').select('amount, received_date')
        .eq('status', 'confirmed').gte('received_date', rangeStart).lt('received_date', rangeEnd).eq('tenant_id', tenantId),
      supabase.from('expenses').select('amount, expense_date')
        .gte('expense_date', rangeStart).lt('expense_date', rangeEnd).eq('tenant_id', tenantId),
      supabase.from('customers').select('id, created_at')
        .gte('created_at', rangeStart).lt('created_at', rangeEnd).eq('tenant_id', tenantId),
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
export async function getImportantAlerts(): Promise<DashboardAlert[]> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const { getPendingLeaveRequests } = await import('@/services/attendance-actions');
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireDashboardTenant(currentUser);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    const alerts: DashboardAlert[] = [];

    // 1. Fetch completed sessions (KTV checkout) - sorted by date then end_time DESC with nulls last
    const completedQ = supabase.from('session_logs')
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
      .eq('tenant_id', tenantId)
      .order('completed_date', { ascending: false })
      .order('end_time', { ascending: false, nullsFirst: false })
      .limit(30);
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
    const overdueQ = supabase.from('session_logs')
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
      .eq('tenant_id', tenantId)
      .lt('assigned_date', today)
      .not('status', 'eq', 'completed')
      .limit(20);
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
    const bookingQ = supabase.from('bookings')
      .select('id, package_name, completed_sessions, total_sessions, customers!bookings_customer_id_fkey(name_mother)')
      .eq('status', 'in_progress')
      .eq('tenant_id', tenantId)
      .limit(20);
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
        const notifQ = supabase.from('app_notifications')
          .select('*')
          .eq('is_read', false)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(20);
        
        const { data: appNotifs, error: appNotifsError } = await notifQ;
        if (appNotifsError) {
          throw new Error(`Failed to fetch app notification alerts: ${appNotifsError.message}`);
        }
        const appNotifsData = (appNotifs as unknown as AppNotificationDBRow[]) || [];
        
        for (const notif of appNotifsData) {
          let link = '/dashboard';
          if (notif.data?.href) {
            link = notif.data.href;
          } else if (notif.type === 'new_booking' && notif.data?.customer_id) {
            link = `/dashboard/customers/${notif.data.customer_id}`;
          }
          
          let finalTimestamp = Date.now();
          if (notif.created_at) {
            try {
              finalTimestamp = parsePostgresTimestamp(notif.created_at).getTime();
            } catch {
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

// ─── Dashboard Data Bundles ───────────────────────────────────────────────────
export async function getDashboardPrimaryData(
  startDate?: string, 
  endDate?: string, 
  todayDate?: string
): Promise<{
  statsData: Awaited<ReturnType<typeof getDashboardStats>>;
  sessionsData: DashboardSessionViewModel[];
  inventorySummary: InventorySummaryViewModel;
}> {
  const [statsData, sessionsData, inventorySummary] = await Promise.all([
    getDashboardStats(startDate, endDate, todayDate),
    getUpcomingSessions(todayDate),
    getDashboardInventorySummary(),
  ]);

  return { statsData, sessionsData, inventorySummary };
}

export async function getDashboardSecondaryData(): Promise<{
  ktvsData: KtvPerformanceViewModel[];
  alertsData: DashboardAlert[];
  perfData: PerformanceDataPointViewModel[];
}> {
  const [ktvsData, alertsData, perfData] = await Promise.all([
    getTopTechnicians(),
    getImportantAlerts(),
    getMonthlyPerformance(),
  ]);

  return { ktvsData, alertsData, perfData };
}

// ─── getFullDashboardData ─────────────────────────────────────────────────────
export async function getFullDashboardData(startDate?: string, endDate?: string, todayDate?: string) {
  const [{ statsData, sessionsData }, { ktvsData, alertsData, perfData }] = await Promise.all([
    getDashboardPrimaryData(startDate, endDate, todayDate),
    getDashboardSecondaryData(),
  ]);

  return { statsData, sessionsData, ktvsData, alertsData, perfData };
}
