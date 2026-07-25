'use server';

import { resolveTenantId } from './shared';
import type { RevenueDBRow, ExpenseDBRow, KtvDBRow, SalaryRecordDBRow, SessionLogDBRow, BookingDBRow } from './types';
import {
  DEFAULT_KTV_SESSION_COMMISSION,
  calculateSalaryTotal,
} from '@/lib/business-rules/salary';
import { calculateAttendanceWorkDays } from '@/lib/business-rules/attendance';
import {
  calculatePositionBonus,
  calculateSeniorityBonus,
  aggregateManualAdjustments,
  type CommissionConfig,
} from '@/lib/business-rules/commission';
import { BUSINESS_RULES } from '@bella/shared';

/**
 * Fetches the monthly profit & loss (P&L) report with dynamic KTV salary calculation.
 * 
 * Returns revenue, operating expenses, KTV salaries, and net profit for a specified month.
 * Calculates KTV salaries dynamically if no expense records exist yet, ensuring real-time
 * accuracy for financial reporting.
 * 
 * @param month - Target month in YYYY-MM-01 format (e.g., "2026-06-01"), defaults to current month
 * @returns Monthly P&L data object with revenue, expenses, and profit
 * 
 * @throws {Error} If database queries fail
 * @throws {Error} If tenant ID cannot be resolved
 * 
 * @remarks
 * **P&L Formula:**
 * ```
 * Net Profit = Total Revenue - (Operating Expenses + KTV Salaries)
 * ```
 * 
 * **Report Structure:**
 * ```typescript
 * {
 *   month_year: string,                // Period (YYYY-MM-01)
 *   total_revenue: number,             // Confirmed revenue only
 *   total_operating_expenses: number,  // Approved/paid non-salary expenses
 *   total_ktv_salaries: number,        // KTV salary fund
 *   net_profit: number,                // Revenue - all expenses
 *   total_bookings: number,            // Count of active bookings
 *   total_sessions_completed: number,  // Count of completed sessions
 *   is_locked: boolean                 // Whether month is locked
 * }
 * ```
 * 
 * **Critical Business Rules:**
 * 
 * **1. Revenue Recognition (Status Filter):**
 * - Only `status === 'confirmed'` revenue is counted
 * - Pending or unconfirmed deposits are excluded
 * - Prevents recognizing unearned/unreceived income
 * 
 * **2. Operating Expenses (Status & Category Filter):**
 * - Only `status === 'approved' || status === 'paid'` expenses counted
 * - Excludes `category === 'salary'` (handled separately)
 * - Submitted, draft, or rejected expenses are excluded
 * - Prevents artificially inflating business costs
 * 
 * **3. KTV Salary Fund (Dynamic Calculation):**
 * 
 * **3a. Static Mode (Preferred):**
 * If salary expenses exist in `expenses` table with `category === 'salary'`:
 * - Uses posted expense entries directly
 * - Salary fund = sum of approved/paid salary expenses
 * 
 * **3b. Dynamic Mode (Real-time Accrual):**
 * If NO salary expenses exist yet (draft salaries or mid-month report):
 * - For each KTV with saved `salary_records` row:
 *   - Uses `total_salary` from saved record (respects all calculations)
 * - For each KTV WITHOUT saved `salary_records` row:
 *   - Calculates pro-rata base salary: `(base_salary / 26) × actualDays`
 *   - `actualDays` from `attendance` table (status !== 'absent')
 *   - If 0 working days → base salary = 0
 *   - Adds session commissions for completed sessions
 * - Never uses full monthly base salary if KTV didn't work
 * 
 * **4. Pro-Rata Base Salary Rules:**
 * - Uses {@link BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH} (26 days)
 * - Formula: `Math.round((base_salary / 26) × actualDays)`
 * - `actualDays` = attendance records with `status !== 'absent'`
 * - If KTV has no attendance logs → pro-rata base = 0
 * - Still adds session commissions even with 0 attendance (edge case)
 * 
 * **5. Session Commissions:**
 * - Uses `bookings.ktv_commission` if available
 * - Falls back to {@link DEFAULT_KTV_SESSION_COMMISSION} (150,000đ)
 * - Only counts completed sessions (`status === 'completed'`)
 * 
 * **Data Integrity:**
 * This function must strictly enforce status filters to maintain accurate
 * financial reporting. Silent failures or incorrect filters can cause
 * discrepancies in profit/loss calculations.
 * 
 * @example
 * ```typescript
 * // Get current month P&L
 * const pnl = await getMonthlyPnL();
 * 
 * console.log(`Period: ${pnl.month_year}`);
 * console.log(`Revenue: ${pnl.total_revenue.toLocaleString('vi-VN')}đ`);
 * console.log(`Operating Expenses: ${pnl.total_operating_expenses.toLocaleString('vi-VN')}đ`);
 * console.log(`KTV Salaries: ${pnl.total_ktv_salaries.toLocaleString('vi-VN')}đ`);
 * console.log(`Net Profit: ${pnl.net_profit.toLocaleString('vi-VN')}đ`);
 * console.log(`Profit Margin: ${((pnl.net_profit / pnl.total_revenue) * 100).toFixed(2)}%`);
 * ```
 * 
 * @example
 * ```typescript
 * // Get P&L for specific month (June 2026)
 * const junePnl = await getMonthlyPnL('2026-06-01');
 * 
 * // Compare with previous month
 * const mayPnl = await getMonthlyPnL('2026-05-01');
 * 
 * const revenueGrowth = 
 *   ((junePnl.total_revenue - mayPnl.total_revenue) / mayPnl.total_revenue) * 100;
 * 
 * console.log(`Revenue growth: ${revenueGrowth.toFixed(2)}%`);
 * ```
 * 
 * @see {@link calculateSalaryTotal} for salary calculation formula
 * @see {@link calculateAttendanceWorkDays} for working days calculation
 * @see {@link BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH} for pro-rata constant
 */
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
        .select('id, base_salary, hire_date, position_tier')
        .eq('role', 'ktv')
        .eq('tenant_id', tenantId);
      if (ktvsError) throw new Error(`[getMonthlyPnL] ktv query failed: ${ktvsError.message}`);

      const typedKtvs = (ktvs as unknown as KtvDBRow[]) || [];

      // Fetch commission config from tenants
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('commission_config')
        .eq('id', tenantId)
        .maybeSingle();

      const commissionConfig = (tenantData?.commission_config as unknown as Partial<CommissionConfig>) || {};
      const positionMultipliers = commissionConfig.position_multipliers || { junior: 1.0, senior: 1.2, lead: 1.5 };
      const seniorityBonusRates = commissionConfig.seniority_bonus_rates || {
        '0_to_1_year': 0.00,
        '1_to_3_years': 0.05,
        '3_to_5_years': 0.10,
        '5_plus_years': 0.15,
      };

      // Fetch advanced commission data
      const [serviceItemsRes, productSalesRes, adjustmentsRes, kpiRecordsRes] = await Promise.all([
        supabase
          .from('booking_service_items')
          .select('ktv_id, calculated_commission')
          .eq('status', 'completed')
          .gte('completed_date', startDate)
          .lt('completed_date', endDate)
          .eq('tenant_id', tenantId),
        supabase
          .from('product_sales')
          .select('ktv_id, calculated_commission')
          .eq('status', 'completed')
          .gte('sale_date', startDate)
          .lt('sale_date', endDate)
          .eq('tenant_id', tenantId),
        supabase
          .from('salary_adjustments')
          .select('ktv_id, adjustment_type, amount, status')
          .eq('status', 'approved')
          .eq('month_year', startDate)
          .eq('tenant_id', tenantId),
        supabase
          .from('kpi_records')
          .select('ktv_id, bonus_amount')
          .eq('month_year', startDate)
          .eq('tenant_id', tenantId),
      ]);

      const serviceItemsCommissionByKtv = new Map<string, number>();
      ((serviceItemsRes.data || []) as { ktv_id: string; calculated_commission: number | null }[]).forEach((item) => {
        const current = serviceItemsCommissionByKtv.get(item.ktv_id) ?? 0;
        serviceItemsCommissionByKtv.set(item.ktv_id, current + Number(item.calculated_commission || 0));
      });

      const productSalesCommissionByKtv = new Map<string, number>();
      ((productSalesRes.data || []) as { ktv_id: string; calculated_commission: number | null }[]).forEach((sale) => {
        const current = productSalesCommissionByKtv.get(sale.ktv_id) ?? 0;
        productSalesCommissionByKtv.set(sale.ktv_id, current + Number(sale.calculated_commission || 0));
      });

      const manualAdjustmentsByKtv = new Map<string, Array<{ adjustment_type: 'bonus' | 'deduction'; amount: number; status: string }>>();
      ((adjustmentsRes.data || []) as Array<{ ktv_id: string; adjustment_type: 'bonus' | 'deduction'; amount: number; status: string } >).forEach((adj) => {
        const list = manualAdjustmentsByKtv.get(adj.ktv_id) ?? [];
        list.push(adj);
        manualAdjustmentsByKtv.set(adj.ktv_id, list);
      });

      const kpiBonusByKtv = new Map<string, number>();
      ((kpiRecordsRes.data || []) as { ktv_id: string; bonus_amount: number | null }[]).forEach((record) => {
        kpiBonusByKtv.set(record.ktv_id, (kpiBonusByKtv.get(record.ktv_id) ?? 0) + Number(record.bonus_amount || 0));
      });

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
              serviceCommission: record.service_commission,
              productSalesCommission: record.product_sales_commission,
              positionBonus: record.position_bonus,
              seniorityBonus: record.seniority_bonus,
              manualAdjustments: record.manual_adjustments,
            });
          return;
        }

        // RULE: No salary_record → calculate pro-rata from attendance
        const ktvAttendance = attendanceData.filter(
          (a) => a.ktv_id === ktv.id
        );
        const actualDays = calculateAttendanceWorkDays(ktvAttendance);

        const ktvSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
        const sessionCommissions = ktvSessions.reduce(
          (sum: number, s) => sum + (Number(s.bookings?.ktv_commission) || DEFAULT_KTV_SESSION_COMMISSION),
          0,
        );

        // If no attendance at all → no salary accrued (KTV hasn't worked this month)
        const positionTier0 = (ktv.position_tier || 'junior') as 'junior' | 'senior' | 'lead';
        const positionBonus0 = calculatePositionBonus({
          baseCommission: serviceItemsCommissionByKtv.get(ktv.id) ?? 0,
          positionTier: positionTier0,
          multipliers: positionMultipliers,
        });

        if (actualDays === 0) {
          // Still add session commissions if any (edge case: completed session without checkin)
          accruedSalaries += calculateSalaryTotal({
            baseSalary: 0,
            sessionBonus: sessionCommissions,
            serviceCommission: serviceItemsCommissionByKtv.get(ktv.id) ?? 0,
            productSalesCommission: productSalesCommissionByKtv.get(ktv.id) ?? 0,
            kpiBonus: kpiBonusByKtv.get(ktv.id) ?? 0,
            positionBonus: positionBonus0,
            seniorityBonus: 0,
            manualAdjustments: aggregateManualAdjustments({
              adjustments: manualAdjustmentsByKtv.get(ktv.id) ?? [],
            }),
          });
          return;
        }

        // Pro-rata base salary: (base_salary / WORKING_DAYS_PER_MONTH) × actual working days
        const baseSalary = Number(ktv.base_salary || 6000000);
        const proRataBase = Math.round((baseSalary / BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH) * actualDays);

        const serviceCommission = serviceItemsCommissionByKtv.get(ktv.id) ?? 0;
        const productSalesCommission = productSalesCommissionByKtv.get(ktv.id) ?? 0;
        const kpiBonus = kpiBonusByKtv.get(ktv.id) ?? 0;
        const manualAdjustments = aggregateManualAdjustments({
          adjustments: manualAdjustmentsByKtv.get(ktv.id) ?? [],
        });
        const positionTier = (ktv.position_tier || 'junior') as 'junior' | 'senior' | 'lead';
        const positionBonus = calculatePositionBonus({
          baseCommission: serviceCommission,
          positionTier,
          multipliers: positionMultipliers,
        });
        const seniorityBonus = calculateSeniorityBonus({
          baseSalary: proRataBase,
          hireDate: ktv.hire_date,
          bonusRates: seniorityBonusRates,
        });

        accruedSalaries += calculateSalaryTotal({
          baseSalary: proRataBase,
          sessionBonus: sessionCommissions,
          serviceCommission,
          productSalesCommission,
          kpiBonus,
          positionBonus,
          seniorityBonus,
          manualAdjustments,
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
