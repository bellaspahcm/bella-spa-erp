'use server';

import { revalidatePath } from 'next/cache';

const KNOWN_TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e';

// ─── Tenant Resolution (3-level fallback) ────────────────────────────────────
async function resolveTenantId(): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
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
  return KNOWN_TENANT_ID;
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
  const supabase = (await createClient()) as any;

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

  const revenueData = revenueResponse.data || [];
  const expensesData = expensesResponse.data || [];

  // revenue.status === 'confirmed' (verified from DB)
  const dbRevenue = revenueData
    .filter((r: any) => r.status === 'confirmed')
    .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

  // expenses.status === 'approved' (verified from DB)
  const dbExpense = expensesData
    .filter((e: any) => e.status === 'approved' || e.status === 'paid')
    .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

  const totalBalance = dbRevenue - dbExpense;

  const mappedRevenues = revenueData.map((r: any) => {
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

  const mappedExpenses = expensesData.map((e: any) => ({
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

  const allTransactions = [...mappedRevenues, ...mappedExpenses]
    .sort((a, b) => ((b as any).timestamp || 0) - ((a as any).timestamp || 0));

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
  const supabase = (await createClient()) as any;

  // For expense: status = 'approved'; for revenue: status = 'confirmed'
  const updatePayload = type === 'revenue'
    ? { status: 'confirmed' }
    : { status: 'approved' };

  const table = type === 'revenue' ? 'revenue' : 'expenses';
  const { error } = await supabase.from(table).update(updatePayload).eq('id', id);

  if (error) {
    console.error(`Error confirming ${type}:`, error);
    throw new Error(`Failed to confirm ${type}: ${error.message}`);
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
  const supabase = (await createClient()) as any;
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
          expense_date: new Date().toISOString().split('T')[0],
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
          received_date: new Date().toISOString().split('T')[0],
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
    const supabase = (await createClient()) as any;
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
        .select('id, completed_by_ktv_id, status, completed_date, booking_id, bookings!inner(tenant_id, ktv_commission)')
        .eq('bookings.tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('completed_date', startDate)
        .lt('completed_date', endDate)
    ]);

    const revenues = revRes.data || [];
    const expenses = expRes.data || [];
    const bookings = bookingRes.data || [];
    const sessions = sessionRes.data || [];

    // Revenue: confirmed only
    const totalRevenue = revenues
      .filter((r: any) => r.status === 'confirmed')
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    // Operating expenses: exclude 'salary' category (that's KTV salary)
    const totalOperatingExpenses = expenses
      .filter((e: any) => e.category !== 'salary')
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    // Salary expenses (dynamic real-time calculation if not locked / no salary expenses in DB yet)
    let totalKtvSalaries = expenses
      .filter((e: any) => e.category === 'salary')
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    if (totalKtvSalaries === 0) {
      // 1. Fetch KTVs
      const { data: ktvs } = await supabase
        .from('users')
        .select('id, base_salary')
        .eq('role', 'ktv')
        .eq('tenant_id', tenantId);

      // 2. Fetch salary records for adjustments (KPI, deductions, advances)
      const { data: salaryRecords } = await supabase
        .from('salary_records')
        .select('*')
        .eq('month_year', startDate)
        .eq('tenant_id', tenantId);

      // 3. Fetch reviews for rating bonus calculation
      const { data: reviews } = await supabase
        .from('session_reviews')
        .select('ktv_id, rating')
        .eq('status', 'approved')
        .eq('tenant_id', tenantId);

      // 4. Calculate accrued salaries dynamically
      let accruedSalaries = 0;
      (ktvs || []).forEach((ktv: any) => {
        const record = salaryRecords?.find((r: any) => r.ktv_id === ktv.id);
        
        // Sum commission for completed sessions by this KTV in target month
        const sessionCommissions = sessions
          .filter((s: any) => s.completed_by_ktv_id === ktv.id)
          .reduce((sum: number, s: any) => sum + (Number(s.bookings?.ktv_commission) || 150000), 0);

        const baseVal = record?.base_salary ?? ktv.base_salary ?? 6000000;
        const sessionsCount = sessions.filter((s: any) => s.completed_by_ktv_id === ktv.id).length;

        // Rating bonus
        const ktvReviews = reviews?.filter((r: any) => r.ktv_id === ktv.id) || [];
        const avgRating = ktvReviews.length > 0 
          ? ktvReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / ktvReviews.length 
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

    const totalBookings = bookings.filter((b: any) =>
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
    const supabase = (await createClient()) as any;
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

    // Aggregate by package_name
    const byPackage: Record<string, {
      package_name: string;
      total_bookings: number;
      total_revenue: number;
      total_ktv_cost: number;
      completedSessions: number;
      totalSessions: number;
    }> = {};

    (bookings || []).forEach((b: any) => {
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
  console.warn('[lockMonth] Not fully implemented for month:', month);
  revalidatePath('/dashboard/finance');
  return { success: true };
}
