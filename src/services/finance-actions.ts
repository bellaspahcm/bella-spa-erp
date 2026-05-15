'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { revalidatePath } from 'next/cache';



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



  // ONLY sum if status is 'confirmed'
  const dbRevenue = revenueData
    .filter((r: any) => r.status === 'confirmed')
    .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    
  const dbExpense = expensesData
    .filter((e: any) => e.payment_status === 'paid')
    .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
  
  // Cumulative balance
  const totalBalance = dbRevenue - dbExpense;
  const totalRevenueMonth = dbRevenue;
  const totalExpenseMonth = dbExpense;
  
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
      date: new Date(r.received_date || r.created_at || new Date()).toLocaleDateString('vi-VN'),
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
      date: new Date(e.expense_date || e.created_at || new Date()).toLocaleDateString('vi-VN'),
      method: 'Chuyển khoản', 
      status: e.payment_status === 'paid' ? 'confirmed' : 'pending',
      details: e.description || 'Chi phí vận hành',
      timestamp: new Date(e.expense_date || e.created_at || new Date()).getTime()
    };
  });

  const allTransactions = [...mappedRevenues, ...mappedExpenses].sort((a, b) => {
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

  // If revenue, fetch details first to apply loyalty points
  if (type === 'revenue') {
    const { data: revData, error: fetchError } = await supabase
      .from('revenue')
      .select('amount, booking_id')
      .eq('id', id)
      .single();

    if (!fetchError && revData?.booking_id) {
      // Get customer_id from booking
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('customer_id')
        .eq('id', revData.booking_id)
        .single();

      if (bookingData?.customer_id) {
        const points = Math.floor(Number(revData.amount) / 100000);
        if (points > 0) {
          await supabase.rpc('increment_loyalty_points', { 
            p_customer_id: bookingData.customer_id, 
            p_points: points 
          });
        }
      }
    }
  }

  const { error } = await supabase
    .from(table)
    .update(
      type === 'revenue' 
        ? { status: 'confirmed' } 
        : { payment_status: 'paid' }
    )
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
  category: string;
  notes: string;
  status?: string;
  booking_id?: string;
}) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) throw new Error('Tenant ID not found for current user session');

  if (data.type === 'expense') {
    const expenseNumber = `EXP-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;
    const { data: result, error } = await supabase
      .from('expenses')
      .insert({
        expense_number: expenseNumber,
        amount: Math.abs(data.amount),
        category: data.category || 'other_admin',
        description: data.notes,
        payment_status: data.status === 'confirmed' ? 'paid' : 'pending',
        expense_date: new Date().toISOString().split('T')[0],
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
        booking_id: data.booking_id || null,
        revenue_type: data.category === 'additional' ? 'additional' : 'package_payment',
        payment_method: 'bank_transfer',
        status: data.status || 'pending',
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

export async function getMonthlyPnL(month?: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) throw new Error('Tenant ID not found');

  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase.rpc('get_monthly_pnl', {
    p_tenant_id: tenantId,
    p_month: targetMonth
  });

  if (error) {
    console.error('Error fetching monthly P&L:', error);
    return null;
  }

  return data?.[0] || null;
}

export async function getServicePerformance() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) throw new Error('Tenant ID not found');

  const { data, error } = await supabase.rpc('get_service_performance', {
    p_tenant_id: tenantId
  });

  if (error) {
    console.error('Error fetching service performance:', error);
    return [];
  }

  return data || [];
}

export async function lockMonth(month: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) throw new Error('Tenant ID not found');

  const { error } = await supabase.rpc('lock_monthly_records', {
    p_tenant_id: tenantId,
    p_month: month
  });

  if (error) {
    console.error('Error locking month:', error);
    throw new Error('Failed to lock month');
  }

  revalidatePath('/dashboard/finance');
  return { success: true };
}
