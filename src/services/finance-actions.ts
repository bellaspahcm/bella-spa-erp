'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { revalidatePath } from 'next/cache';
import { ensure2026 } from '@/lib/utils';
import { DEMO_REVENUE } from '@/constants/demo-data';

export async function getFinancialOverview() {
  const supabase = await createClient() as any;
  const currentUser = await getCurrentUser();

  // Security: KTVs cannot see financial overview
  if (currentUser?.role === 'ktv') {
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      balance: 0,
      transactions: []
    };
  }

  // Fetch both revenue and expenses with relations
  const [revenueResponse, expensesResponse] = await Promise.all([
    supabase.from('revenue').select(`
      *,
      bookings (
        package_name,
        customers (
          name_mother,
          name_baby
        )
      )
    `).order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false })
  ]);

  const revenueData = revenueResponse.data || [];
  const expensesData = expensesResponse.data || [];

  // Mock transactions as baseline
  const mockTransactions = [
    { id: 'm1', type: 'revenue', category: 'Dịch vụ', amount: '+2,400,000', date: '12/05/2026', method: 'Chuyển khoản', status: 'confirmed', details: 'Gói chăm sóc cơ bản - Mẹ Lan' },
    { id: 'm2', type: 'expense', category: 'Vật tư', amount: '-850,000', date: '12/05/2026', method: 'Tiền mặt', status: 'pending', details: 'Mua khăn và tinh dầu' },
    { id: 'm3', type: 'revenue', category: 'Cọc gói', amount: '+5,000,000', date: '11/05/2026', method: 'ZaloPay', status: 'confirmed', details: 'Gói VIP 21 buổi - Mẹ Vy' },
    { id: 'm4', type: 'revenue', category: 'Thanh toán đợt 2', amount: '+8,500,000', date: '11/05/2026', method: 'Chuyển khoản', status: 'confirmed', details: 'Gói tắm bé - Mẹ Hà' },
    { id: 'm5', type: 'expense', category: 'Lương nhân viên', amount: '-15,000,000', date: '10/05/2026', method: 'Chuyển khoản', status: 'confirmed', details: 'Lương KTV tháng 4' },
    { id: 'm6', type: 'revenue', category: 'Dịch vụ lẻ', amount: '+550,000', date: '10/05/2026', method: 'Tiền mặt', status: 'confirmed', details: 'Massage mặt - Khách lẻ' },
    { id: 'm7', type: 'expense', category: 'Điện nước', amount: '-2,100,000', date: '09/05/2026', method: 'Chuyển khoản', status: 'confirmed', details: 'Thanh toán tiền điện tháng 4' },
  ];

  // ONLY sum if status is 'confirmed'
  const dbRevenue = revenueData
    .filter((r: any) => r.status === 'confirmed')
    .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    
  const dbExpense = expensesData
    .filter((e: any) => e.status === 'confirmed')
    .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
  
  // Cumulative balance
  const totalBalance = DEMO_REVENUE.totalBalance + (dbRevenue - dbExpense);
  const totalRevenueMonth = DEMO_REVENUE.totalRevenueMonth + dbRevenue;
  const totalExpenseMonth = DEMO_REVENUE.totalExpenseMonth + dbExpense;
  
  const mappedRevenues = revenueData.map((r: any) => {
    const customer = r.bookings?.customers;
    const customerName = customer ? `Mẹ ${customer.name_mother}${customer.name_baby ? ` & Bé ${customer.name_baby}` : ''}` : 'Khách hàng';
    const packageName = r.bookings?.package_name || 'Dịch vụ';
    
    return {
      id: `rev-${r.id}`,
      dbId: r.id,
      type: 'revenue',
      category: r.revenue_type === 'additional' ? 'Phát sinh' : (r.notes || 'Dịch vụ'),
      amountNum: Number(r.amount) || 0,
      amount: '+' + Number(r.amount).toLocaleString() + 'đ',
      date: ensure2026(new Date(r.received_date || r.created_at || new Date()).toLocaleDateString('vi-VN')),
      method: r.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản',
      status: r.status === 'pending' ? 'pending' : (r.status || 'confirmed'),
      details: r.revenue_type === 'additional' ? (r.notes || customerName) : `${packageName} - ${customerName}`,
      timestamp: new Date(r.received_date || r.created_at || new Date()).getTime()
    };
  });

  const mappedExpenses = expensesData.map((e: any) => {
    // Map database enum values back to user-friendly Vietnamese labels
    const categoryMap: Record<string, string> = {
      'salary': 'Lương nhân viên',
      'other_admin': 'Chi phí khác',
      'marketing': 'Marketing',
      'office_rent': 'Tiền thuê văn phòng',
      'utilities': 'Điện nước'
    };
    
    return {
      id: `exp-${e.id}`,
      dbId: e.id,
      type: 'expense',
      category: categoryMap[e.category] || e.category || 'Chi phí',
      amountNum: Number(e.amount) || 0,
      amount: '-' + Number(e.amount).toLocaleString() + 'đ',
      date: ensure2026(new Date(e.expense_date || e.created_at || new Date()).toLocaleDateString('vi-VN')),
      method: 'Chuyển khoản', 
      status: e.status === 'submitted' ? 'pending' : (e.status === 'approved' ? 'confirmed' : 'pending'),
      details: e.description || 'Chi phí vận hành',
      timestamp: new Date(e.expense_date || e.created_at || new Date()).getTime()
    };
  });

  // Combine mock and real transactions
  const dbTransactions = [...mappedRevenues, ...mappedExpenses];
  const allTransactions = [...dbTransactions, ...mockTransactions].sort((a, b) => {
    const timeA = (a as any).timestamp || 0;
    const timeB = (b as any).timestamp || 0;
    return timeB - timeA;
  });

  return {
    totalBalance,
    totalRevenueMonth,
    totalExpenseMonth,
    transactions: allTransactions
  };
}

export async function confirmTransaction(id: string, type: 'revenue' | 'expense') {
  const supabase = (await createClient()) as any;
  const table = type === 'revenue' ? 'revenue' : 'expenses';

  console.log(`Confirming ${type} with ID: ${id} in table: ${table}`);

  const { error } = await supabase
    .from(table)
    .update({ status: type === 'revenue' ? 'confirmed' : 'approved' })
    .eq('id', id);

  if (error) {
    console.error(`Error confirming ${type}:`, error);
    throw new Error(`Failed to confirm ${type}: ${error.message}`);
  }

  // Force revalidation of the finance page
  revalidatePath('/dashboard/finance');

  return { success: true };
}

export async function recordTransaction(data: {
  amount: number;
  type: 'revenue' | 'expense';
  notes: string;
  booking_id?: string;
}) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  if (data.type === 'expense') {
    const { data: result, error } = await supabase
      .from('expenses')
      .insert({
        amount: Math.abs(data.amount),
        category: 'other_admin',
        description: data.notes,
        status: 'submitted',
        expense_date: new Date().toISOString(),
        tenant_id: tenantId
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
        status: 'pending', // Default to pending as requested
        received_date: new Date().toISOString(),
        tenant_id: tenantId
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording revenue:', error);
      throw new Error('Failed to record revenue');
    }
    
    // Force revalidation
    revalidatePath('/dashboard/finance');
    
    return result;
  }
}
