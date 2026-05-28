'use server';

import { resolveTenantId } from './shared';
import type { RevenueDBRow, ExpenseDBRow, KtvDBRow, SalaryRecordDBRow, SessionLogDBRow, BookingDBRow, ServiceBookingDBRow } from './types';

export async function getMonthlyPnL(month?: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const tenantId = await resolveTenantId();

    const now = new Date();
    const targetMonthStr = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const [y, m] = targetMonthStr.split('-').map(Number);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const [revRes, expRes, bookingRes, sessionRes] = await Promise.all([
      supabase
        .from('revenue')
        .select('amount, status, revenue_type, received_date')
        .eq('tenant_id', tenantId)
        .gte('received_date', startDate)
        .lt('received_date', endDate),
      supabase
        .from('expenses')
        .select('amount, category, expense_date, status')
        .eq('tenant_id', tenantId)
        .gte('expense_date', startDate)
        .lt('expense_date', endDate),
      supabase
        .from('bookings')
        .select('id, status, full_price, completed_sessions, total_sessions, ktv_commission')
        .eq('tenant_id', tenantId),
      supabase
        .from('session_logs')
        .select('id, completed_by_ktv_id, status, completed_date, rating, booking_id, bookings!inner(tenant_id, ktv_commission), session_reviews(rating, status)')
        .eq('bookings.tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('completed_date', startDate)
        .lt('completed_date', endDate)
    ]);

    const revenues = (revRes.data as unknown as RevenueDBRow[]) || [];
    const expenses = (expRes.data as unknown as ExpenseDBRow[]) || [];
    const bookings = (bookingRes.data as unknown as BookingDBRow[]) || [];
    const sessions = (sessionRes.data as unknown as SessionLogDBRow[]) || [];

    // Revenue: confirmed only
    const totalRevenue = revenues
      .filter((r) => r.status === 'confirmed')
      .reduce((s: number, r) => s + Number(r.amount || 0), 0);

    // Operating expenses: exclude 'salary' category (that's KTV salary)
    const totalOperatingExpenses = expenses
      .filter((e) => e.category !== 'salary')
      .reduce((s: number, e) => s + Number(e.amount || 0), 0);

    // Salary expenses (dynamic real-time calculation if not locked / no salary expenses in DB yet)
    let totalKtvSalaries = expenses
      .filter((e) => e.category === 'salary')
      .reduce((s: number, e) => s + Number(e.amount || 0), 0);

    if (totalKtvSalaries === 0) {
      // 1. Fetch KTVs
      const { data: ktvs } = await supabase
        .from('users')
        .select('id, base_salary')
        .eq('role', 'ktv')
        .eq('tenant_id', tenantId);

      const typedKtvs = (ktvs as unknown as KtvDBRow[]) || [];

      // 2. Fetch salary records for adjustments (KPI, deductions, advances)
      const { data: salaryRecords } = await supabase
        .from('salary_records')
        .select('*')
        .eq('month_year', startDate)
        .eq('tenant_id', tenantId);

      const typedSalaryRecords = (salaryRecords as unknown as SalaryRecordDBRow[]) || [];

      // NOTE: Reviews are now nested in session_logs query above (no separate fetch by created_at)
      // This mirrors get_ktv_leaderboard RPC: reviews joined on sl.id, not created_at

      // 3. Calculate accrued salaries dynamically
      let accruedSalaries = 0;
      typedKtvs.forEach((ktv) => {
        const record = typedSalaryRecords.find((r) => r.ktv_id === ktv.id);
        
        // Sum commission for completed sessions by this KTV in target month
        const ktvSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
        const sessionCommissions = ktvSessions
          .reduce((sum: number, s) => sum + (Number(s.bookings?.ktv_commission) || 150000), 0);

        const baseVal = record?.base_salary ?? ktv.base_salary ?? 6000000;
        const sessionsCount = ktvSessions.length;

        // Rating bonus — COALESCE(approved_review.rating, session.rating, 5.0)
        const ratingValues: number[] = ktvSessions.map((s) => {
          const reviewsArray = Array.isArray(s.session_reviews) ? s.session_reviews : [];
          const approvedReview = reviewsArray.find((sr) => sr.status === 'approved');
          if (approvedReview?.rating) return approvedReview.rating as number;
          if (s.rating) return s.rating as number;
          return null;
        }).filter((v: number | null): v is number => v !== null);
        const avgRating = ratingValues.length > 0
          ? ratingValues.reduce((acc, v) => acc + v, 0) / ratingValues.length
          : 5.0;
        let bonusPerSession = 0;
        if (avgRating === 5.0) bonusPerSession = 50000;
        else if (avgRating >= 4.5) bonusPerSession = 30000;
        else if (avgRating >= 4.0) bonusPerSession = 10000;
        const ratingBonus = sessionsCount * bonusPerSession;

        const kpiBonus = record?.kpi_bonus ?? (sessionsCount > 30 ? 1000000 : 0);
        const deductions = record?.violations_deduction ?? 0;
        const advances = record?.service_percentage_bonus ?? 0;

        const ktvTotal = baseVal + sessionCommissions + kpiBonus + ratingBonus - deductions - advances;
        accruedSalaries += ktvTotal;
      });

      totalKtvSalaries = accruedSalaries;
    }

    // Net profit = revenue - all expenses
    const totalExpenses = totalOperatingExpenses + totalKtvSalaries;
    const netProfit = totalRevenue - totalExpenses;

    const totalBookings = bookings.filter((b) =>
      ['booked', 'in_progress', 'completed'].includes(b.status)
    ).length;

    const totalSessionsCompleted = sessions.length;

    return {
      month_year: targetMonthStr,                        // matches PnLData.month_year
      total_revenue: totalRevenue,                       // matches PnLData.total_revenue
      total_operating_expenses: totalOperatingExpenses,  // matches PnLData.total_operating_expenses
      total_ktv_salaries: totalKtvSalaries,              // matches PnLData.total_ktv_salaries
      net_profit: netProfit,                             // matches PnLData.net_profit
      total_bookings: totalBookings,                     // matches PnLData.total_bookings
      total_sessions_completed: totalSessionsCompleted,  // matches PnLData.total_sessions_completed
      is_locked: false                                   // matches PnLData.is_locked
    };
  } catch (e) {
    console.error('[getMonthlyPnL] error:', e);
    return null;
  }
}

export async function getServicePerformance() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const tenantId = await resolveTenantId();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('package_name, full_price, discount_percent, completed_sessions, total_sessions, ktv_commission, status')
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'cancelled');

    if (error) {
      console.error('[getServicePerformance] error:', error);
      return [];
    }

    const typedBookings = (bookings as unknown as ServiceBookingDBRow[]) || [];

    // Aggregate by package_name
    const byPackage: Record<string, {
      package_name: string;
      total_bookings: number;
      total_revenue: number;
      total_ktv_cost: number;
      completedSessions: number;
      totalSessions: number;
    }> = {};

    typedBookings.forEach((b) => {
      const key = b.package_name || 'Dịch vụ lẻ';
      if (!byPackage[key]) {
        byPackage[key] = {
          package_name: key,          // matches ServicePerformance.package_name
          total_bookings: 0,          // matches ServicePerformance.total_bookings
          total_revenue: 0,
          total_ktv_cost: 0,          // matches ServicePerformance.total_ktv_cost
          completedSessions: 0,
          totalSessions: 0
        };
      }
      byPackage[key].total_bookings += 1;
      const actualPrice = Number(b.full_price || 0) * (1 - (b.discount_percent || 0)/100);
      byPackage[key].total_revenue += actualPrice;
      // KTV cost = commission per session × completed sessions
      const commission = Number(b.ktv_commission || 150000);
      byPackage[key].total_ktv_cost += commission * Number(b.completed_sessions || 0);
      byPackage[key].completedSessions += Number(b.completed_sessions || 0);
      byPackage[key].totalSessions += Number(b.total_sessions || 0);
    });

    return Object.values(byPackage)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .map(p => {
        const netServiceProfit = p.total_revenue - p.total_ktv_cost;
        const profitMargin = p.total_revenue > 0
          ? (netServiceProfit / p.total_revenue) * 100
          : 0;
        return {
          package_name: p.package_name,                              // ✓
          total_bookings: p.total_bookings,                          // ✓
          total_revenue: p.total_revenue,                            // ✓
          total_ktv_cost: p.total_ktv_cost,                         // ✓
          net_service_profit: netServiceProfit,                      // ✓
          profit_margin_percent: Math.round(profitMargin * 10) / 10  // ✓
        };
      });
  } catch (e) {
    console.error('[getServicePerformance] error:', e);
    return [];
  }
}
