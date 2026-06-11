'use server';

import type { MappedTransaction, RevenueDBRow, ExpenseDBRow } from './types';

const MAX_INITIAL_FINANCE_ROWS_PER_TYPE = 80;

export async function getFinancialOverview() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  const { getCurrentUser } = await import('../user-actions');
  const currentUser = await getCurrentUser();

  if (currentUser?.role?.toLowerCase() === 'ktv') {
    return { totalBalance: 0, totalRevenueMonth: 0, totalExpenseMonth: 0, transactions: [] };
  }
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    throw new Error('[getFinancialOverview] Missing tenantId for current user');
  }

  const [revenueTotalsResponse, expensesTotalsResponse, revenueResponse, expensesResponse] = await Promise.all([
    supabase
      .from('revenue')
      .select('amount, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('expenses')
      .select('amount, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('revenue')
      .select(`id, booking_id, amount, revenue_type, payment_method, received_date, status, notes,
               bookings(package_name, customers(name_mother, name_baby))`)
      .eq('tenant_id', tenantId)
      .order('received_date', { ascending: false })
      .limit(MAX_INITIAL_FINANCE_ROWS_PER_TYPE),
    supabase
      .from('expenses')
      .select('id, category, amount, description, expense_date, status')
      .eq('tenant_id', tenantId)
      .order('expense_date', { ascending: false })
      .limit(MAX_INITIAL_FINANCE_ROWS_PER_TYPE)
  ]);

  if (revenueTotalsResponse.error) {
    throw new Error(`[getFinancialOverview] revenue total query failed: ${revenueTotalsResponse.error.message}`);
  }
  if (expensesTotalsResponse.error) {
    throw new Error(`[getFinancialOverview] expenses total query failed: ${expensesTotalsResponse.error.message}`);
  }
  if (revenueResponse.error) {
    throw new Error(`[getFinancialOverview] revenue query failed: ${revenueResponse.error.message}`);
  }
  if (expensesResponse.error) {
    throw new Error(`[getFinancialOverview] expenses query failed: ${expensesResponse.error.message}`);
  }

  const revenueTotals = (revenueTotalsResponse.data as unknown as Pick<RevenueDBRow, 'amount' | 'status'>[]) || [];
  const expensesTotals = (expensesTotalsResponse.data as unknown as Pick<ExpenseDBRow, 'amount' | 'status'>[]) || [];
  const revenueData = (revenueResponse.data as unknown as RevenueDBRow[]) || [];
  const expensesData = (expensesResponse.data as unknown as ExpenseDBRow[]) || [];

  // revenue.status === 'confirmed' (verified from DB)
  const dbRevenue = revenueTotals
    .filter((r) => r.status === 'confirmed')
    .reduce((acc: number, curr) => acc + (Number(curr.amount) || 0), 0);

  // expenses.status === 'approved' (verified from DB)
  const dbExpense = expensesTotals
    .filter((e) => e.status === 'approved' || e.status === 'paid')
    .reduce((acc: number, curr) => acc + (Number(curr.amount) || 0), 0);

  const totalBalance = dbRevenue - dbExpense;

  const mappedRevenues: MappedTransaction[] = revenueData.map((r) => {
    const customer = r.bookings?.customers;
    const customerName = customer
      ? `Khách ${customer.name_mother}${customer.name_baby ? ` - Hồ sơ ${customer.name_baby}` : ''}`
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
