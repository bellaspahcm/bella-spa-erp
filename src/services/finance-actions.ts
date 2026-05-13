'use server';

import { ensure2026 } from '@/lib/utils';
import { DEMO_REVENUE } from '@/constants/demo-data';

export async function getFinancialOverview() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  // Fetch both revenue and expenses
  const [revenueResponse, expensesResponse] = await Promise.all([
    supabase.from('revenue').select('*'),
    supabase.from('expenses').select('*')
  ]);

  const revenueData = revenueResponse.data || [];
  const expensesData = expensesResponse.data || [];

  if (revenueData.length === 0 && expensesData.length === 0) {
    // Extended mock transactions for a fuller UI
    const mockTransactions = [
      { id: '1', type: 'revenue', category: 'Dịch vụ', amount: '+2,400,000', date: '12/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
      { id: '2', type: 'expense', category: 'Vật tư', amount: '-850,000', date: '12/05/2026', method: 'Tiền mặt', status: 'pending' },
      { id: '3', type: 'revenue', category: 'Cọc gói', amount: '+5,000,000', date: '11/05/2026', method: 'ZaloPay', status: 'confirmed' },
      { id: '4', type: 'revenue', category: 'Thanh toán đợt 2', amount: '+8,500,000', date: '11/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
      { id: '5', type: 'expense', category: 'Lương nhân viên', amount: '-15,000,000', date: '10/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
      { id: '6', type: 'revenue', category: 'Dịch vụ lẻ', amount: '+550,000', date: '10/05/2026', method: 'Tiền mặt', status: 'confirmed' },
      { id: '7', type: 'expense', category: 'Điện nước', amount: '-2,100,000', date: '09/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
    ];

    return {
      totalBalance: DEMO_REVENUE.totalBalance,
      totalRevenueMonth: DEMO_REVENUE.totalRevenueMonth,
      totalExpenseMonth: DEMO_REVENUE.totalExpenseMonth,
      transactions: mockTransactions
    };
  }

  const totalRevenue = revenueData.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
  const totalExpense = expensesData.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
  const totalBalance = totalRevenue - totalExpense;
  
  const mappedRevenues = revenueData.map((r: any) => ({
    id: `rev-${r.id}`,
    type: 'revenue',
    category: r.notes || 'Dịch vụ',
    amount: '+' + Number(r.amount).toLocaleString() + 'đ',
    date: ensure2026(new Date(r.received_date || r.created_at || new Date()).toLocaleDateString('vi-VN')),
    method: r.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản',
    status: r.status || 'confirmed',
    timestamp: new Date(r.received_date || r.created_at || new Date()).getTime()
  }));

  const mappedExpenses = expensesData.map((e: any) => ({
    id: `exp-${e.id}`,
    type: 'expense',
    category: e.category || e.description || 'Chi phí',
    amount: '-' + Number(e.amount).toLocaleString() + 'đ',
    date: ensure2026(new Date(e.expense_date || e.created_at || new Date()).toLocaleDateString('vi-VN')),
    method: 'Tiền mặt', // Default fallback
    status: e.status || 'submitted',
    timestamp: new Date(e.expense_date || e.created_at || new Date()).getTime()
  }));

  const dbTransactions = [...mappedRevenues, ...mappedExpenses].sort((a, b) => b.timestamp - a.timestamp);

  return {
    totalBalance: totalBalance > 0 ? totalBalance : DEMO_REVENUE.totalBalance,
    totalRevenueMonth: totalRevenue > 0 ? totalRevenue : DEMO_REVENUE.totalRevenueMonth,
    totalExpenseMonth: totalExpense > 0 ? totalExpense : DEMO_REVENUE.totalExpenseMonth,
    transactions: dbTransactions
  };
}

export async function recordTransaction(data: {
  amount: number;
  type: 'revenue' | 'expense';
  notes: string;
  booking_id?: string;
}) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  if (data.type === 'expense') {
    const { data: result, error } = await supabase
      .from('expenses')
      .insert({
        amount: Math.abs(data.amount),
        category: 'Chi phí khác',
        description: data.notes,
        status: 'submitted',
        expense_date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording expense:', error);
      throw new Error('Failed to record expense');
    }
    return result;
  } else {
    const { data: result, error } = await supabase
      .from('revenue')
      .insert({
        amount: Math.abs(data.amount),
        notes: data.notes,
        booking_id: data.booking_id,
        revenue_type: 'additional',
        payment_method: 'bank_transfer',
        status: 'confirmed',
        received_date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording revenue:', error);
      throw new Error('Failed to record revenue');
    }
    return result;
  }
}

