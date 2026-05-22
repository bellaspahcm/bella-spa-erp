'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { getLocalDateString } from '@/lib/utils';

export interface MappedTransaction {
  id: string;
  dbId: string;
  type: 'revenue' | 'expense';
  category: string;
  amountNum: number;
  amount: string;
  date: string;
  method: string;
  status: string;
  details: string;
  timestamp: number;
}

export interface RevenueDBRow {
  id: string;
  booking_id: string | null;
  amount: number | string;
  revenue_type: string;
  payment_method: string;
  received_date: string;
  status: string;
  notes: string | null;
  bookings: {
    package_name: string;
    customers: {
      name_mother: string;
      name_baby: string | null;
    } | null;
  } | null;
}

export interface ExpenseDBRow {
  id: string;
  category: string;
  amount: number | string;
  description: string | null;
  expense_date: string;
  status: string;
}

export interface KtvDBRow {
  id: string;
  base_salary?: number;
}

export interface SalaryRecordDBRow {
  id: string;
  ktv_id: string;
  base_salary?: number | null;
  kpi_bonus?: number | null;
  violations_deduction?: number | null;
  service_percentage_bonus?: number | null;
}

export interface SessionReviewDBRow {
  rating: number | null;
  status: string;
}

export interface SessionLogDBRow {
  id: string;
  completed_by_ktv_id: string | null;
  status: string;
  completed_date: string;
  rating: number | null;
  booking_id: string | null;
  bookings: {
    tenant_id: string;
    ktv_commission: number | null;
  } | null;
  session_reviews: SessionReviewDBRow[] | null;
}

export interface BookingDBRow {
  id: string;
  status: string;
  full_price?: number;
  completed_sessions?: number;
  total_sessions?: number;
  ktv_commission?: number;
}

export interface ServiceBookingDBRow {
  package_name: string;
  full_price: number;
  discount_percent: number;
  completed_sessions: number;
  total_sessions: number;
  ktv_commission: number;
  status: string;
}

// ─── Tenant Resolution (3-level fallback) ────────────────────────────────────
async function resolveTenantId(): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const { getCurrentUser } = await import('./user-actions');
    const currentUser = await getCurrentUser();
    if (currentUser?.tenant_id) return currentUser.tenant_id;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
        .limit(1)
        .single();
      if (profile?.tenant_id) return profile.tenant_id;
    }
  } catch (e) {
    console.warn('[finance] Tenant resolution error:', e);
  }
  throw new Error('Unauthorized: Không xác định được chi nhánh hoạt động hợp lệ.');
}

// ─── Schema reference (verified 2026-05-15) ──────────────────────────────────
// revenue:  id, booking_id, amount, revenue_type, payment_method,
//           received_date (date), recorded_by_id, status('confirmed'|'pending'),
//           notes, tenant_id
// expenses: id, category, amount, description, receipt_url,
//           expense_date (date), approved_by_id, status('approved'|'pending'),
//           submitted_by_id, tenant_id

// ─── getFinancialOverview ─────────────────────────────────────────────────────
export async function getFinancialOverview() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();

  if (currentUser?.role?.toLowerCase() === 'ktv') {
    return { totalBalance: 0, totalRevenueMonth: 0, totalExpenseMonth: 0, transactions: [] };
  }

  const [revenueResponse, expensesResponse] = await Promise.all([
    supabase
      .from('revenue')
      .select(`id, booking_id, amount, revenue_type, payment_method, received_date, status, notes,
               bookings(package_name, customers(name_mother, name_baby))`)
      .order('received_date', { ascending: false }),  // ✓ received_date exists
    supabase
      .from('expenses')
      .select('id, category, amount, description, expense_date, status')
      .order('expense_date', { ascending: false })    // ✓ expense_date exists
  ]);

  if (revenueResponse.error) {
    console.error('[getFinancialOverview] revenue error:', revenueResponse.error);
  }
  if (expensesResponse.error) {
    console.error('[getFinancialOverview] expenses error:', expensesResponse.error);
  }

  const revenueData = (revenueResponse.data as unknown as RevenueDBRow[]) || [];
  const expensesData = (expensesResponse.data as unknown as ExpenseDBRow[]) || [];

  // revenue.status === 'confirmed' (verified from DB)
  const dbRevenue = revenueData
    .filter((r) => r.status === 'confirmed')
    .reduce((acc: number, curr) => acc + (Number(curr.amount) || 0), 0);

  // expenses.status === 'approved' (verified from DB)
  const dbExpense = expensesData
    .filter((e) => e.status === 'approved' || e.status === 'paid')
    .reduce((acc: number, curr) => acc + (Number(curr.amount) || 0), 0);

  const totalBalance = dbRevenue - dbExpense;

  const mappedRevenues: MappedTransaction[] = revenueData.map((r) => {
    const customer = r.bookings?.customers;
    const customerName = customer
      ? `Mẹ ${customer.name_mother}${customer.name_baby ? ` & Bé ${customer.name_baby}` : ''}`
      : 'Khách hàng';
    const packageName = r.bookings?.package_name || 'Dịch vụ';

    return {
      id: `rev-${r.id}`,
      dbId: r.id,
      type: 'revenue',
      category: r.revenue_type === 'additional' ? 'Phát sinh' : (r.notes || 'Dịch vụ'),
      amountNum: Number(r.amount) || 0,
      amount: '+' + Number(r.amount).toLocaleString() + 'đ',
      date: new Date(r.received_date || new Date()).toLocaleDateString('vi-VN'),
      method: r.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản',
      status: r.status || 'pending',
      details: r.revenue_type === 'additional'
        ? (r.notes || customerName)
        : `${packageName} - ${customerName}`,
      timestamp: new Date(r.received_date || new Date()).getTime()
    };
  });

  const categoryMap: Record<string, string> = {
    'salary': 'Lương nhân viên',
    'other': 'Chi phí khác',
    'marketing': 'Marketing',
    'rent': 'Tiền thuê mặt bằng',
    'utilities': 'Điện nước',
    'operating': 'Phí vận hành',
    'materials': 'Nguyên vật liệu',
    'maintenance': 'Bảo trì'
  };

  const mappedExpenses: MappedTransaction[] = expensesData.map((e) => ({
    id: `exp-${e.id}`,
    dbId: e.id,
    type: 'expense',
    category: categoryMap[e.category] || e.category || 'Chi phí',
    amountNum: Number(e.amount) || 0,
    amount: '-' + Number(e.amount).toLocaleString() + 'đ',
    date: new Date(e.expense_date || new Date()).toLocaleDateString('vi-VN'),
    method: 'Chuyển khoản',
    status: (e.status === 'approved' || e.status === 'paid') ? 'confirmed' : 'pending',
    details: e.description || 'Chi phí vận hành',
    timestamp: new Date(e.expense_date || new Date()).getTime()
  }));

  const allTransactions: MappedTransaction[] = [...mappedRevenues, ...mappedExpenses]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return {
    totalBalance,
    totalRevenueMonth: dbRevenue,
    totalExpenseMonth: dbExpense,
    transactions: allTransactions
  };
}

// ─── confirmTransaction ───────────────────────────────────────────────────────
export async function confirmTransaction(id: string, type: 'revenue' | 'expense') {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  const today = getLocalDateString();

  if (type === 'revenue') {
    const { error } = await supabase.from('revenue').update({ status: 'confirmed', received_date: today }).eq('id', id);
    if (error) {
      console.error(`Error confirming revenue:`, error);
      throw new Error(`Failed to confirm revenue: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from('expenses').update({ status: 'approved', expense_date: today }).eq('id', id);
    if (error) {
      console.error(`Error confirming expense:`, error);
      throw new Error(`Failed to confirm expense: ${error.message}`);
    }
  }

  revalidatePath('/dashboard/finance');
  return { success: true };
}

// ─── recordTransaction ────────────────────────────────────────────────────────
export async function recordTransaction(data: {
  amount: number;
  type: 'revenue' | 'expense';
  category: string;
  notes: string;
  status?: string;
  booking_id?: string;
}) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const tenantId = await resolveTenantId();

  try {
    if (data.type === 'expense') {
      // Map frontend categories to valid DB values
      const catMap: Record<string, string> = {
        'office_rent': 'rent',
        'other_admin': 'other',
        'materials': 'materials',
        'maintenance': 'maintenance'
      };
      const dbCategory = catMap[data.category] || data.category || 'other';

      // expenses.status: 'approved' | 'submitted' | 'rejected'
      const dbStatus = data.status === 'confirmed' ? 'approved' : 'submitted';

      const { data: result, error } = await supabase
        .from('expenses')
        .insert({
          amount: Math.abs(data.amount),
          category: dbCategory,
          description: data.notes,
          status: dbStatus,                           // ✓ 'approved' | 'pending'
          expense_date: getLocalDateString(),
          tenant_id: tenantId
          // No: expense_number, payment_status (don't exist in schema)
        })
        .select()
        .single();

      if (error) {
        console.error('[recordTransaction] expense error:', error);
        throw error;
      }

      revalidatePath('/dashboard/finance');
      return result;
    } else {
      // revenue.status: 'confirmed' | 'pending'
      const dbStatus = data.status === 'confirmed' ? 'confirmed' : 'pending';

      // Map frontend categories to valid DB revenue_type values
      const validRevenueTypes = ['deposit', 'session_completed', 'additional', 'package_payment', 'remaining_payment'];
      const dbRevenueType = validRevenueTypes.includes(data.category) ? data.category : 'additional';

      const { data: result, error } = await supabase
        .from('revenue')
        .insert({
          amount: Math.abs(data.amount),
          notes: data.notes,
          booking_id: data.booking_id || null,
          revenue_type: dbRevenueType,
          payment_method: 'bank_transfer',
          status: dbStatus,
          received_date: getLocalDateString(),
          tenant_id: tenantId
        })
        .select()
        .single();

      if (error) {
        console.error('[recordTransaction] revenue error:', error);
        throw error;
      }

      revalidatePath('/dashboard/finance');
      return result;
    }
  } catch (error: any) {
    console.error('[recordTransaction] failure:', error);
    throw new Error(error.message || 'Lỗi hệ thống khi ghi nhận giao dịch');
  }
}

// ─── getMonthlyPnL ────────────────────────────────────────────────────────────
// Returns fields matching FinancePnLSummary's PnLData interface
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

// ─── getServicePerformance ────────────────────────────────────────────────────
// Returns fields matching FinancePnLSummary's ServicePerformance interface
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

// ─── lockMonth (stub) ─────────────────────────────────────────────────────────
export async function lockMonth(month: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    
    const { getCurrentUser } = await import('./user-actions');
    const user = await getCurrentUser();
    
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    if (user.role !== 'admin') {
      return { success: false, error: 'Chỉ Admin mới có thể khóa sổ tháng' };
    }
    
    if (!user.tenant_id) return { success: false, error: 'Không tìm thấy tenant_id' };

    const { error } = await supabase.rpc('lock_monthly_records', {
      p_tenant_id: user.tenant_id,
      p_month: month
    });

    if (error) {
      console.error('[lockMonth] RPC error:', error);
      return { success: false, error: 'Lỗi khóa sổ: ' + error.message };
    }

    // ─── Franchise Royalty Auto-Billing System Integration ──────────────────
    try {
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('name, royalty_type, royalty_rate, royalty_fixed_amount')
        .eq('id', user.tenant_id)
        .single();

      if (tenantErr || !tenant) {
        console.warn('[lockMonth] Failed to retrieve tenant config for royalty calculations:', tenantErr);
      } else {
        const startDate = new Date(month);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
        const endDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: revenues, error: revError } = await supabase
          .from('revenue')
          .select('amount')
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'confirmed')
          .gte('received_date', startDateStr)
          .lte('received_date', endDateStr);

        if (revError) {
          console.error('[lockMonth] Failed to fetch revenues for royalty calculation:', revError);
        } else {
          const grossRevenue = (revenues || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          
          const royaltyType = tenant.royalty_type || 'percentage';
          let calculatedAmount = 0;
          if (royaltyType === 'percentage') {
            calculatedAmount = (grossRevenue * (Number(tenant.royalty_rate) || 0)) / 100;
          } else {
            calculatedAmount = Number(tenant.royalty_fixed_amount) || 0;
          }

          // Generate a premium distinct invoice number
          const nameParts = (tenant.name || 'BRANCH').split(' ');
          const abbreviation = nameParts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 5);
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const yearMonth = month.substring(0, 7).replace('-', '');
          const invoiceNumber = `ROY-${yearMonth}-${abbreviation}-${randomSuffix}`;

          const { data: existingInvoice } = await supabase
            .from('franchise_royalty_invoices')
            .select('id, status')
            .eq('tenant_id', user.tenant_id)
            .eq('month_year', startDateStr)
            .maybeSingle();

          if (existingInvoice) {
            if (existingInvoice.status !== 'paid') {
              await supabase
                .from('franchise_royalty_invoices')
                .update({
                  gross_revenue: grossRevenue,
                  royalty_type: royaltyType,
                  royalty_rate: tenant.royalty_rate,
                  royalty_fixed_amount: tenant.royalty_fixed_amount,
                  calculated_amount: calculatedAmount,
                  status: 'pending'
                })
                .eq('id', existingInvoice.id);
            }
          } else {
            await supabase
              .from('franchise_royalty_invoices')
              .insert({
                tenant_id: user.tenant_id,
                invoice_number: invoiceNumber,
                month_year: startDateStr,
                gross_revenue: grossRevenue,
                royalty_type: royaltyType,
                royalty_rate: tenant.royalty_rate,
                royalty_fixed_amount: tenant.royalty_fixed_amount,
                calculated_amount: calculatedAmount,
                status: 'pending'
              });
          }
        }
      }
    } catch (royaltyErr) {
      console.error('[lockMonth] Royalty system error:', royaltyErr);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ─── Inter-branch Redemption Clearing Integration ────────────────────────
    try {
      const startDate = new Date(month);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
      const endDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data: sessionLogs, error: sessionErr } = await supabase
        .from('session_logs')
        .select(`
          id,
          tenant_id,
          bookings (
            tenant_id
          )
        `)
        .eq('status', 'completed')
        .gte('completed_date', startDateStr)
        .lte('completed_date', endDateStr);

      if (sessionErr) {
        console.error('[lockMonth] Failed to fetch session logs for clearing:', sessionErr);
      } else {
        const interBranchSessions = (sessionLogs || []).filter((s: any) => {
          const sessionTenantId = s.tenant_id;
          const bookingTenantId = s.bookings?.tenant_id;
          return sessionTenantId && bookingTenantId && sessionTenantId !== bookingTenantId &&
            (sessionTenantId === user.tenant_id || bookingTenantId === user.tenant_id);
        });

        const pairs: Record<string, { debtor_tenant_id: string; creditor_tenant_id: string; session_count: number }> = {};
        for (const session of interBranchSessions) {
          const debtor = session.bookings.tenant_id;
          const creditor = session.tenant_id;
          const key = `${debtor}_${creditor}`;
          if (!pairs[key]) {
            pairs[key] = {
              debtor_tenant_id: debtor,
              creditor_tenant_id: creditor,
              session_count: 0
            };
          }
          pairs[key].session_count += 1;
        }

        const allInvolvedTenantIds = Array.from(new Set(
          Object.values(pairs).flatMap(p => [p.debtor_tenant_id, p.creditor_tenant_id])
        ));

        if (allInvolvedTenantIds.length > 0) {
          const { data: tenants, error: tenantsErr } = await supabase
            .from('tenants')
            .select('id, name, internal_clearing_rate')
            .in('id', allInvolvedTenantIds);

          if (tenantsErr) {
            console.error('[lockMonth] Failed to fetch tenants for clearing:', tenantsErr);
          } else {
            const tenantMap: Record<string, { name: string; internal_clearing_rate: number }> = {};
            (tenants || []).forEach((t: any) => {
              tenantMap[t.id] = {
                name: t.name || 'Branch',
                internal_clearing_rate: Number(t.internal_clearing_rate) || 150000.00
              };
            });

            for (const key of Object.keys(pairs)) {
              const pair = pairs[key];
              const debtorName = tenantMap[pair.debtor_tenant_id]?.name || 'DEBTOR';
              const creditorName = tenantMap[pair.creditor_tenant_id]?.name || 'CREDITOR';
              const clearingRate = tenantMap[pair.creditor_tenant_id]?.internal_clearing_rate || 150000.00;
              const calculatedAmount = pair.session_count * clearingRate;

              const debtorAbbr = debtorName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 5);
              const creditorAbbr = creditorName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 5);
              const yearMonth = month.substring(0, 7).replace('-', '');
              const randomSuffix = Math.floor(1000 + Math.random() * 9000);
              const clearingNumber = `CLR-${yearMonth}-${debtorAbbr}-${creditorAbbr}-${randomSuffix}`;

              const { data: existingRecord } = await supabase
                .from('inter_branch_clearing_records')
                .select('id, status')
                .eq('month_year', startDateStr)
                .eq('debtor_tenant_id', pair.debtor_tenant_id)
                .eq('creditor_tenant_id', pair.creditor_tenant_id)
                .maybeSingle();

              if (existingRecord) {
                if (existingRecord.status !== 'cleared') {
                  await supabase
                    .from('inter_branch_clearing_records')
                    .update({
                      session_count: pair.session_count,
                      clearing_rate: clearingRate,
                      calculated_amount: calculatedAmount,
                      status: 'pending'
                    })
                    .eq('id', existingRecord.id);
                }
              } else {
                await supabase
                  .from('inter_branch_clearing_records')
                  .insert({
                    clearing_number: clearingNumber,
                    month_year: startDateStr,
                    debtor_tenant_id: pair.debtor_tenant_id,
                    creditor_tenant_id: pair.creditor_tenant_id,
                    session_count: pair.session_count,
                    clearing_rate: clearingRate,
                    calculated_amount: calculatedAmount,
                    status: 'pending'
                  });
              }
            }
          }
        }
      }
    } catch (clearingErr) {
      console.error('[lockMonth] Inter-branch clearing error:', clearingErr);
    }
    // ─────────────────────────────────────────────────────────────────────────

    revalidatePath('/dashboard/finance');
    return { success: true, month };
  } catch (e: any) {
    console.error('[lockMonth]', e);
    Sentry.captureException(e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

// ─── unlockMonth ────────────────────────────────────────────────────────────────
export async function unlockMonth(month: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    
    const { getCurrentUser } = await import('./user-actions');
    const user = await getCurrentUser();
    
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    if (user.role !== 'admin') {
      return { success: false, error: 'Chỉ Admin mới có thể mở khóa sổ tháng' };
    }
    
    if (!user.tenant_id) return { success: false, error: 'Không tìm thấy tenant_id' };

    // Update manually to unlock
    const startDate = new Date(month);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0] + 'T23:59:59';

    await Promise.all([
      supabase.from('revenue').update({ is_locked: false })
        .eq('tenant_id', user.tenant_id).gte('received_date', startDateStr).lte('received_date', endDateStr),
      supabase.from('expenses').update({ is_locked: false })
        .eq('tenant_id', user.tenant_id).gte('expense_date', startDateStr).lte('expense_date', endDateStr),
      supabase.from('salary_records').update({ is_locked: false })
        .eq('tenant_id', user.tenant_id).eq('month_year', startDateStr)
    ]);

    revalidatePath('/dashboard/finance');
    return { success: true, month };
  } catch (e: any) {
    console.error('[unlockMonth]', e);
    Sentry.captureException(e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}
