'use server';

import { createClient } from '@/lib/supabase-server';
import { ensure2026 } from '@/lib/utils';
import { DEMO_REVENUE } from '@/constants/demo-data';

export async function getFinancialOverview() {
  const supabase = (await createClient()) as any;

  const { data: revenueData, error: revenueError } = await supabase
    .from('revenue')
    .select('*')
    .order('created_at', { ascending: false });

  if (revenueError) {
    console.error('Error fetching finance data:', revenueError);
    return {
      totalBalance: 0,
      totalRevenueMonth: 0,
      totalExpenseMonth: 0,
      transactions: []
    };
  }

  const totalBalance = revenueData?.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0;
  
  // Simple mock for demo purposes if table is empty
  const mockTransactions = [
    { id: '1', type: 'revenue', category: 'Dịch vụ', amount: '+2,400,000', date: '11/05/2026', method: 'Chuyển khoản', status: 'confirmed' },
    { id: '2', type: 'expense', category: 'Vật tư', amount: '-850,000', date: '11/05/2026', method: 'Tiền mặt', status: 'pending' },
    { id: '3', type: 'revenue', category: 'Cọc gói', amount: '+5,000,000', date: '10/05/2026', method: 'ZaloPay', status: 'confirmed' },
  ];

  const dbTransactions = (revenueData || []).map((r: any) => ({
    id: r.id,
    type: Number(r.amount) >= 0 ? 'revenue' : 'expense',
    category: r.notes || 'Dịch vụ',
    amount: (Number(r.amount) >= 0 ? '+' : '') + Number(r.amount).toLocaleString() + 'đ',
    date: ensure2026(new Date(r.created_at).toLocaleDateString('vi-VN')),
    method: 'Chuyển khoản',
    status: r.status || 'confirmed'
  }));

  const finalRevenueMonth = totalBalance > 0 ? totalBalance : DEMO_REVENUE.totalRevenueMonth;
  const finalExpenseMonth = DEMO_REVENUE.totalExpenseMonth;

  return {
    totalBalance: totalBalance > 0 ? totalBalance : DEMO_REVENUE.totalBalance,
    totalRevenueMonth: finalRevenueMonth,
    totalExpenseMonth: finalExpenseMonth,
    transactions: dbTransactions.length > 0 ? dbTransactions : mockTransactions
  };
}

export async function recordTransaction(data: {
  amount: number;
  type: 'revenue' | 'expense';
  notes: string;
  booking_id?: string;
}) {
  const supabase = (await createClient()) as any;

  const actualAmount = data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount);

  const { data: result, error } = await supabase
    .from('revenue')
    .insert({
      amount: actualAmount,
      notes: data.notes,
      booking_id: data.booking_id,
      status: 'confirmed',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error recording transaction:', error);
    throw new Error('Failed to record transaction');
  }

  return result;
}
