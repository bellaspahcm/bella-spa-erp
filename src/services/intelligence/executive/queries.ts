/**
 * Executive Intelligence - Data Queries
 * 
 * Core SQL query builders for CEO Dashboard metrics.
 * Reuses existing finance/session/booking logic where possible.
 * 
 * All queries follow these principles:
 * 1. Read-only operations (no business transactions)
 * 2. Strict status filters (only count confirmed/approved/paid records)
 * 3. Tenant isolation (always filter by tenant_id)
 * 4. Date range filtering (for period comparisons)
 */

import type { Database } from '@/types/database.types';
import { QueryError } from '../shared/types';
import type { DateRange } from '../shared/types';
import { formatDate, calculatePercentageChange, roundNumber } from '../shared/helpers';
import { DEFAULT_KTV_SESSION_COMMISSION } from '@/lib/business-rules/salary';
import { BUSINESS_RULES } from '@bella/shared';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create server-side Supabase client with service role key (bypasses RLS).
 * 
 * Intelligence Layer MUST use service role client to bypass RLS policies
 * and access cross-tenant aggregated data for CEO dashboard.
 * 
 * @throws {Error} If SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error(
      'Intelligence Layer requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to be configured. ' +
      'This is a server-side environment variable that grants admin access to bypass RLS policies.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RevenueRow = Database['public']['Tables']['revenue']['Row'];
type ExpenseRow = Database['public']['Tables']['expenses']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type SessionRow = Database['public']['Tables']['session_logs']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

/**
 * Monthly Revenue Summary Response
 */
export interface MonthlyRevenueSummary {
  period: string; // YYYY-MM-01
  totalRevenue: number;
  revenueGrowth: number; // Percentage change vs previous period
  topRevenueSources: Array<{
    source: string;
    revenue: number;
    percentage: number;
  }>;
  revenueByPaymentMethod: Array<{
    method: string;
    revenue: number;
    percentage: number;
  }>;
}

/**
 * Operational Efficiency Response
 */
export interface OperationalEfficiency {
  period: string;
  ktvUtilizationRate: number; // Percentage (0-100)
  averageSessionRating: number; // 1-5 stars
  serviceCompletionRate: number; // Percentage (0-100)
  revenuePerKtv: number; // VND per active KTV
}

/**
 * Customer Metrics Response
 */
export interface CustomerMetrics {
  period: string;
  newCustomers: number; // First-time bookings
  retentionRate: number; // Percentage (0-100)
  averageBookingValue: number; // VND
  customerLifetimeValue: number; // CLV estimate (VND)
}

/**
 * Financial Health Response
 */
export interface FinancialHealth {
  period: string;
  profitMargin: number; // Percentage (0-100)
  cashFlow: number; // VND (deposits - payouts)
  outstandingReceivables: number; // VND (deposits not yet recognized as revenue)
  expenseBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

/**
 * Growth Indicators Response
 */
export interface GrowthIndicators {
  period: string;
  monthOverMonthGrowth: number; // Percentage
  yearOverYearGrowth: number; // Percentage
  projectedRevenue: number; // Trend extrapolation (VND)
  topGrowingServices: Array<{
    service: string;
    growthRate: number; // Percentage
    currentRevenue: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 1: Monthly Revenue Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get monthly revenue summary with growth indicators and top sources.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze
 * @returns Monthly revenue summary with comparisons
 */
export async function getMonthlyRevenueSummary(
  tenantId: string,
  dateRange: DateRange
): Promise<MonthlyRevenueSummary> {
  try {
    const supabase = await createServiceRoleClient();
    const startDate = formatDate(dateRange.startDate);
    const endDate = formatDate(dateRange.endDate);

    console.log(`[Intelligence] Revenue query - Tenant: ${tenantId}, Range: ${startDate} → ${endDate}`);

    // Fetch current period revenue
    const { data: revenues, error: revenueError } = await supabase
      .from('revenue')
      .select('amount, status, revenue_type, received_date, payment_method')
      .eq('tenant_id', tenantId)
      .gte('received_date', startDate)
      .lte('received_date', endDate);

    if (revenueError) {
      throw new QueryError(`Failed to fetch revenue data: ${revenueError.message}`, revenueError);
    }

    console.log(`[Intelligence] Found ${revenues?.length || 0} revenue records`);

    // Filter only confirmed revenue (business rule)
    const confirmedRevenues = (revenues || [])
      .filter(r => r.status === 'confirmed')
      .map(r => r as RevenueRow);

    console.log(`[Intelligence] Confirmed: ${confirmedRevenues.length} records`);

    // Calculate total revenue
    const totalRevenue = confirmedRevenues.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    console.log(`[Intelligence] Total revenue: ${totalRevenue}`);

    // Calculate previous period revenue for growth comparison
    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    const { data: prevRevenues, error: prevRevenueError } = await supabase
      .from('revenue')
      .select('amount, status')
      .eq('tenant_id', tenantId)
      .gte('received_date', formatDate(prevStartDate))
      .lte('received_date', formatDate(prevEndDate))
      .eq('status', 'confirmed');

    if (prevRevenueError) {
      throw new QueryError(`Failed to fetch previous period revenue: ${prevRevenueError.message}`, prevRevenueError);
    }

    const prevTotalRevenue = (prevRevenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const revenueGrowth = calculatePercentageChange(totalRevenue, prevTotalRevenue);

    // Group by revenue type (top sources)
    const revenueByType = confirmedRevenues.reduce((acc, r) => {
      const type = r.revenue_type || 'other';
      acc[type] = (acc[type] || 0) + Number(r.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    const topRevenueSources = Object.entries(revenueByType)
      .map(([source, revenue]) => ({
        source,
        revenue,
        percentage: roundNumber((revenue / totalRevenue) * 100, 2),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // Top 5 sources

    // Group by payment method
    const revenueByPayment = confirmedRevenues.reduce((acc, r) => {
      const method = r.payment_method || 'unknown';
      acc[method] = (acc[method] || 0) + Number(r.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    const revenueByPaymentMethod = Object.entries(revenueByPayment)
      .map(([method, revenue]) => ({
        method,
        revenue,
        percentage: roundNumber((revenue / totalRevenue) * 100, 2),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      period: startDate,
      totalRevenue: roundNumber(totalRevenue, 0),
      revenueGrowth: roundNumber(revenueGrowth, 2),
      topRevenueSources,
      revenueByPaymentMethod,
    };
  } catch (error) {
    if (error instanceof QueryError) throw error;
    throw new QueryError('Failed to get monthly revenue summary', error as Error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 2: Operational Efficiency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get operational efficiency metrics (KTV utilization, ratings, completion rate).
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze
 * @returns Operational efficiency metrics
 */
export async function getOperationalEfficiency(
  tenantId: string,
  dateRange: DateRange
): Promise<OperationalEfficiency> {
  try {
    const supabase = await createServiceRoleClient();
    const startDate = formatDate(dateRange.startDate);
    const endDate = formatDate(dateRange.endDate);

    // Fetch completed sessions with ratings
    const { data: sessions, error: sessionError } = await supabase
      .from('session_logs')
      .select(`
        id,
        status,
        completed_date,
        rating,
        completed_by_ktv_id,
        bookings!inner(tenant_id)
      `)
      .eq('bookings.tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_date', startDate)
      .lte('completed_date', endDate);

    if (sessionError) {
      throw new QueryError(`Failed to fetch session data: ${sessionError.message}`, sessionError);
    }

    // Fetch active KTVs
    const { data: ktvs, error: ktvError } = await supabase
      .from('users')
      .select('id, base_salary')
      .eq('tenant_id', tenantId)
      .eq('role', 'ktv');

    if (ktvError) {
      throw new QueryError(`Failed to fetch KTV data: ${ktvError.message}`, ktvError);
    }

    // Fetch all bookings for completion rate
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, total_sessions, completed_sessions')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingError) {
      throw new QueryError(`Failed to fetch booking data: ${bookingError.message}`, bookingError);
    }

    const completedSessions = (sessions || []).length;
    const activeKtvs = (ktvs || []).length;

    // KTV Utilization Rate: completed sessions per KTV
    // Assume each KTV can handle 4 sessions/day × days in period
    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const maxPossibleSessions = activeKtvs * 4 * periodDays; // 4 sessions/day/KTV
    const ktvUtilizationRate = maxPossibleSessions > 0
      ? roundNumber((completedSessions / maxPossibleSessions) * 100, 2)
      : 0;

    // Average Session Rating
    const ratingsSum = (sessions || []).reduce((sum, s) => {
      const rating = Number(s.rating || 0);
      return sum + rating;
    }, 0);
    const averageSessionRating = completedSessions > 0
      ? roundNumber(ratingsSum / completedSessions, 2)
      : 0;

    // Service Completion Rate: completed_sessions / total_sessions
    const totalSessionsBooked = (bookings || []).reduce((sum, b) => sum + Number(b.total_sessions || 0), 0);
    const totalSessionsCompleted = (bookings || []).reduce((sum, b) => sum + Number(b.completed_sessions || 0), 0);
    const serviceCompletionRate = totalSessionsBooked > 0
      ? roundNumber((totalSessionsCompleted / totalSessionsBooked) * 100, 2)
      : 0;

    // Revenue Per KTV (from completed sessions)
    const revenuePerKtv = activeKtvs > 0
      ? roundNumber(completedSessions * DEFAULT_KTV_SESSION_COMMISSION / activeKtvs, 0)
      : 0;

    return {
      period: startDate,
      ktvUtilizationRate,
      averageSessionRating,
      serviceCompletionRate,
      revenuePerKtv,
    };
  } catch (error) {
    if (error instanceof QueryError) throw error;
    throw new QueryError('Failed to get operational efficiency', error as Error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 3: Customer Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get customer acquisition and retention metrics.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze
 * @returns Customer metrics
 */
export async function getCustomerMetrics(
  tenantId: string,
  dateRange: DateRange
): Promise<CustomerMetrics> {
  try {
    const supabase = await createServiceRoleClient();
    const startDate = formatDate(dateRange.startDate);
    const endDate = formatDate(dateRange.endDate);

    // Fetch all bookings in period
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, customer_id, full_price, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingError) {
      throw new QueryError(`Failed to fetch booking data: ${bookingError.message}`, bookingError);
    }

    // Get unique customers in this period
    const customerIds = [...new Set((bookings || []).map(b => b.customer_id))];

    // Fetch first booking date for each customer (to identify new customers)
    const { data: allCustomerBookings, error: allBookingsError } = await supabase
      .from('bookings')
      .select('customer_id, created_at')
      .eq('tenant_id', tenantId)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: true });

    if (allBookingsError) {
      throw new QueryError(`Failed to fetch customer booking history: ${allBookingsError.message}`, allBookingsError);
    }

    // Group by customer to find first booking
    const firstBookingByCustomer: Record<string, string> = {};
    (allCustomerBookings || []).forEach(b => {
      if (!firstBookingByCustomer[b.customer_id] && b.created_at) {
        firstBookingByCustomer[b.customer_id] = b.created_at;
      }
    });

    // New customers: first booking in this period
    const newCustomers = customerIds.filter(customerId => {
      const firstBooking = firstBookingByCustomer[customerId];
      return firstBooking >= startDate && firstBooking <= endDate;
    }).length;

    // Retention rate: customers with 2+ bookings
    const bookingsByCustomer: Record<string, number> = {};
    (bookings || []).forEach(b => {
      bookingsByCustomer[b.customer_id] = (bookingsByCustomer[b.customer_id] || 0) + 1;
    });
    const repeatCustomers = Object.values(bookingsByCustomer).filter(count => count >= 2).length;
    const retentionRate = customerIds.length > 0
      ? roundNumber((repeatCustomers / customerIds.length) * 100, 2)
      : 0;

    // Average booking value
    const totalBookingValue = (bookings || []).reduce((sum, b) => sum + Number(b.full_price || 0), 0);
    const averageBookingValue = (bookings || []).length > 0
      ? roundNumber(totalBookingValue / (bookings || []).length, 0)
      : 0;

    // Customer Lifetime Value (CLV) estimate: average booking value × average bookings per customer
    const avgBookingsPerCustomer = customerIds.length > 0
      ? (bookings || []).length / customerIds.length
      : 0;
    const customerLifetimeValue = roundNumber(averageBookingValue * avgBookingsPerCustomer * 3, 0); // 3x multiplier for CLV estimate

    return {
      period: startDate,
      newCustomers,
      retentionRate,
      averageBookingValue,
      customerLifetimeValue,
    };
  } catch (error) {
    if (error instanceof QueryError) throw error;
    throw new QueryError('Failed to get customer metrics', error as Error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 4: Financial Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get financial health indicators (profit margin, cash flow, expenses).
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze
 * @returns Financial health metrics
 */
export async function getFinancialHealth(
  tenantId: string,
  dateRange: DateRange
): Promise<FinancialHealth> {
  try {
    const supabase = await createServiceRoleClient();
    const startDate = formatDate(dateRange.startDate);
    const endDate = formatDate(dateRange.endDate);

    // Fetch revenue
    const { data: revenues, error: revenueError } = await supabase
      .from('revenue')
      .select('amount, status')
      .eq('tenant_id', tenantId)
      .gte('received_date', startDate)
      .lte('received_date', endDate);

    if (revenueError) {
      throw new QueryError(`Failed to fetch revenue data: ${revenueError.message}`, revenueError);
    }

    const totalRevenue = (revenues || [])
      .filter(r => r.status === 'confirmed')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Fetch expenses
    const { data: expenses, error: expenseError } = await supabase
      .from('expenses')
      .select('amount, category, status')
      .eq('tenant_id', tenantId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (expenseError) {
      throw new QueryError(`Failed to fetch expense data: ${expenseError.message}`, expenseError);
    }

    const totalExpenses = (expenses || [])
      .filter(e => e.status === 'approved' || e.status === 'paid')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Profit margin: (revenue - expenses) / revenue
    const profitMargin = totalRevenue > 0
      ? roundNumber(((totalRevenue - totalExpenses) / totalRevenue) * 100, 2)
      : 0;

    // Cash flow: deposits (revenue) - payouts (expenses)
    const cashFlow = roundNumber(totalRevenue - totalExpenses, 0);

    // Outstanding receivables: deposits not yet confirmed as revenue
    const { data: pendingRevenues, error: pendingError } = await supabase
      .from('revenue')
      .select('amount, status')
      .eq('tenant_id', tenantId)
      .neq('status', 'confirmed')
      .lte('received_date', endDate);

    if (pendingError) {
      throw new QueryError(`Failed to fetch pending revenue: ${pendingError.message}`, pendingError);
    }

    const outstandingReceivables = (pendingRevenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Expense breakdown by category
    const expenseByCategory = (expenses || [])
      .filter(e => e.status === 'approved' || e.status === 'paid')
      .reduce((acc, e) => {
        const category = e.category || 'other';
        acc[category] = (acc[category] || 0) + Number(e.amount || 0);
        return acc;
      }, {} as Record<string, number>);

    const expenseBreakdown = Object.entries(expenseByCategory)
      .map(([category, amount]) => ({
        category,
        amount: roundNumber(amount, 0),
        percentage: roundNumber((amount / totalExpenses) * 100, 2),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      period: startDate,
      profitMargin,
      cashFlow,
      outstandingReceivables: roundNumber(outstandingReceivables, 0),
      expenseBreakdown,
    };
  } catch (error) {
    if (error instanceof QueryError) throw error;
    throw new QueryError('Failed to get financial health', error as Error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 5: Growth Indicators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get growth indicators (MoM, YoY, projections, top growing services).
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze
 * @returns Growth indicators
 */
export async function getGrowthIndicators(
  tenantId: string,
  dateRange: DateRange
): Promise<GrowthIndicators> {
  try {
    const supabase = await createServiceRoleClient();
    const startDate = formatDate(dateRange.startDate);
    const endDate = formatDate(dateRange.endDate);

    // Fetch current period revenue
    const { data: revenues, error: revenueError } = await supabase
      .from('revenue')
      .select('amount, status, revenue_type')
      .eq('tenant_id', tenantId)
      .gte('received_date', startDate)
      .lte('received_date', endDate)
      .eq('status', 'confirmed');

    if (revenueError) {
      throw new QueryError(`Failed to fetch revenue data: ${revenueError.message}`, revenueError);
    }

    const currentRevenue = (revenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Month-over-month growth (previous month)
    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const prevMonthStart = new Date(startDate);
    prevMonthStart.setDate(prevMonthStart.getDate() - periodDays);
    const prevMonthEnd = new Date(startDate);
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);

    const { data: prevMonthRevenues, error: prevMonthError } = await supabase
      .from('revenue')
      .select('amount, status')
      .eq('tenant_id', tenantId)
      .gte('received_date', formatDate(prevMonthStart))
      .lte('received_date', formatDate(prevMonthEnd))
      .eq('status', 'confirmed');

    if (prevMonthError) {
      throw new QueryError(`Failed to fetch previous month revenue: ${prevMonthError.message}`, prevMonthError);
    }

    const prevMonthRevenue = (prevMonthRevenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const monthOverMonthGrowth = calculatePercentageChange(currentRevenue, prevMonthRevenue);

    // Year-over-year growth (same period last year)
    const prevYearStart = new Date(startDate);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
    const prevYearEnd = new Date(endDate);
    prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

    const { data: prevYearRevenues, error: prevYearError } = await supabase
      .from('revenue')
      .select('amount, status')
      .eq('tenant_id', tenantId)
      .gte('received_date', formatDate(prevYearStart))
      .lte('received_date', formatDate(prevYearEnd))
      .eq('status', 'confirmed');

    if (prevYearError) {
      throw new QueryError(`Failed to fetch previous year revenue: ${prevYearError.message}`, prevYearError);
    }

    const prevYearRevenue = (prevYearRevenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const yearOverYearGrowth = calculatePercentageChange(currentRevenue, prevYearRevenue);

    // Projected revenue: current × (1 + growth rate)
    const projectedRevenue = roundNumber(currentRevenue * (1 + monthOverMonthGrowth / 100), 0);

    // Top growing services: compare revenue_type growth
    const revenueByType: Record<string, number> = {};
    (revenues || []).forEach(r => {
      const type = r.revenue_type || 'other';
      revenueByType[type] = (revenueByType[type] || 0) + Number(r.amount || 0);
    });

    const prevMonthRevenueByType: Record<string, number> = {};
    (prevMonthRevenues || []).forEach(r => {
      const type = (r as any).revenue_type || 'other';
      prevMonthRevenueByType[type] = (prevMonthRevenueByType[type] || 0) + Number(r.amount || 0);
    });

    const topGrowingServices = Object.keys(revenueByType)
      .map(type => ({
        service: type,
        currentRevenue: revenueByType[type],
        growthRate: calculatePercentageChange(
          revenueByType[type],
          prevMonthRevenueByType[type] || 0
        ),
      }))
      .sort((a, b) => b.growthRate - a.growthRate)
      .slice(0, 5) // Top 5 growing services
      .map(s => ({
        service: s.service,
        growthRate: roundNumber(s.growthRate, 2),
        currentRevenue: roundNumber(s.currentRevenue, 0),
      }));

    return {
      period: startDate,
      monthOverMonthGrowth: roundNumber(monthOverMonthGrowth, 2),
      yearOverYearGrowth: roundNumber(yearOverYearGrowth, 2),
      projectedRevenue,
      topGrowingServices,
    };
  } catch (error) {
    if (error instanceof QueryError) throw error;
    throw new QueryError('Failed to get growth indicators', error as Error);
  }
}
