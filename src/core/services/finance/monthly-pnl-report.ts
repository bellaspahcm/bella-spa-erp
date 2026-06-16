'use server';

import { resolveTenantId } from './shared';
import type { RevenueDBRow, ExpenseDBRow, KtvDBRow, SalaryRecordDBRow, SessionLogDBRow, BookingDBRow } from './types';
import {
  DEFAULT_KTV_SESSION_COMMISSION,
  calculateSalaryTotal,
} from '@/lib/business-rules/salary';
import { calculateAttendanceWorkDays } from '@/lib/business-rules/attendance';

export async function getMonthlyPnL(month?: string) {
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

  if (revRes.error) throw new Error(`[getMonthlyPnL] revenue query failed: ${revRes.error.message}`);
  if (expRes.error) throw new Error(`[getMonthlyPnL] expenses query failed: ${expRes.error.message}`);
  if (bookingRes.error) throw new Error(`[getMonthlyPnL] bookings query failed: ${bookingRes.error.message}`);
  if (sessionRes.error) throw new Error(`[getMonthlyPnL] session_logs query failed: ${sessionRes.error.message}`);

    const revenues = (revRes.data as unknown as RevenueDBRow[]) || [];
    const expenses = (expRes.data as unknown as ExpenseDBRow[]) || [];
    const bookings = (bookingRes.data as unknown as BookingDBRow[]) || [];
    const sessions = (sessionRes.data as unknown as SessionLogDBRow[]) || [];

    // Revenue: confirmed only
    const totalRevenue = revenues
      .filter((r) => r.status === 'confirmed')
      .reduce((s: number, r) => s + Number(r.amount || 0), 0);

    // Operating expenses: exclude 'salary' category (that's KTV salary) and only count approved or paid expenses
    const totalOperatingExpenses = expenses
      .filter((e) => e.category !== 'salary' && (e.status === 'approved' || e.status === 'paid'))
      .reduce((s: number, e) => s + Number(e.amount || 0), 0);

    // Salary expenses (dynamic real-time calculation if not locked / no salary expenses in DB yet)
    let totalKtvSalaries = expenses
      .filter((e) => e.category === 'salary' && (e.status === 'approved' || e.status === 'paid'))
      .reduce((s: number, e) => s + Number(e.amount || 0), 0);

    if (totalKtvSalaries === 0) {
      // 1. Fetch KTVs
      const { data: ktvs, error: ktvsError } = await supabase
        .from('users')
        .select('id, base_salary')
        .eq('role', 'ktv')
        .eq('tenant_id', tenantId);
      if (ktvsError) throw new Error(`[getMonthlyPnL] ktv query failed: ${ktvsError.message}`);

      const typedKtvs = (ktvs as unknown as KtvDBRow[]) || [];

      // 2. Fetch salary records
      const { data: salaryRecords, error: salaryRecordsError } = await supabase
        .from('salary_records')
        .select('*')
        .eq('month_year', startDate)
        .eq('tenant_id', tenantId);
      if (salaryRecordsError) throw new Error(`[getMonthlyPnL] salary_records query failed: ${salaryRecordsError.message}`);

      const typedSalaryRecords = (salaryRecords as unknown as SalaryRecordDBRow[]) || [];

      // 3. Fetch attendance for pro-rata calculation (for KTVs without salary records)
      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendance')
        .select('ktv_id, status')
        .eq('tenant_id', tenantId)
        .gte('date', startDate)
        .lt('date', endDate);
      if (attendanceError) throw new Error(`[getMonthlyPnL] attendance query failed: ${attendanceError.message}`);

      const attendanceData = (attendanceRows || []) as { ktv_id: string; status: string }[];

      // 4. Calculate accrued salaries
      let accruedSalaries = 0;
      typedKtvs.forEach((ktv) => {
        const record = typedSalaryRecords.find((r) => r.ktv_id === ktv.id);

        // RULE: If KTV already has a salary_record → use total_salary directly
        // This respects the saved calculation (including pro-rata, deductions, KPI, etc.)
        if (record) {
          accruedSalaries += record.total_salary !== null && record.total_salary !== undefined
            ? Number(record.total_salary || 0)
            : calculateSalaryTotal({
              baseSalary: record.base_salary,
              sessionBonus: record.session_bonus,
              ratingBonus: record.rating_bonus,
              kpiBonus: record.kpi_bonus,
              deductions: record.violations_deduction,
              advances: record.service_percentage_bonus,
            });
          return;
        }

        // RULE: No salary_record → calculate pro-rata from attendance
        const ktvAttendance = attendanceData.filter(
          (a) => a.ktv_id === ktv.id
        );
        const actualDays = calculateAttendanceWorkDays(ktvAttendance);

        // If no attendance at all → no salary accrued (KTV hasn't worked this month)
        if (actualDays === 0) {
          // Still add session commissions if any (edge case: completed session without checkin)
          const ktvSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
          const sessionCommissions = ktvSessions.reduce(
            (sum: number, s) => sum + (Number(s.bookings?.ktv_commission) || DEFAULT_KTV_SESSION_COMMISSION),
            0,
          );
          accruedSalaries += calculateSalaryTotal({
            baseSalary: 0,
            sessionBonus: sessionCommissions,
          });
          return;
        }

        // Pro-rata base salary: (base_salary / 26) × actual working days
        const baseSalary = Number(ktv.base_salary || 6000000);
        const proRataBase = Math.round((baseSalary / 26) * actualDays);

        // Session commissions for this KTV
        const ktvSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
        const sessionCommissions = ktvSessions.reduce(
          (sum: number, s) => sum + (Number(s.bookings?.ktv_commission) || DEFAULT_KTV_SESSION_COMMISSION),
          0,
        );

        accruedSalaries += calculateSalaryTotal({
          baseSalary: proRataBase,
          sessionBonus: sessionCommissions,
        });
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
}
