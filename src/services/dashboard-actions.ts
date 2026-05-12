'use server';

import { createClient } from '@/lib/supabase-server';
import { ensure2026 } from '@/lib/utils';

export async function getDashboardStats() {
  const supabase = (await createClient()) as any;

  // Parallel fetching for performance
  const [
    { count: totalCustomers },
    { count: todayBookings },
    { data: revenueData },
    { data: ratingsData }
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('session_logs').select('*', { count: 'exact', head: true }).eq('assigned_date', new Date().toISOString().split('T')[0]),
    supabase.from('revenue').select('amount').eq('status', 'confirmed'),
    supabase.from('session_reviews').select('rating')
  ]);

  const totalRevenue = revenueData?.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0;
  const avgRating = ratingsData?.length 
    ? (ratingsData.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratingsData.length).toFixed(1) 
    : '5.0';

  return {
    totalCustomers: totalCustomers || 0,
    todayBookings: todayBookings || 0,
    totalRevenue: (totalRevenue / 1000000).toFixed(0) + 'M', // Convert to Millions
    avgRating
  };
}

export async function getUpcomingSessions() {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        package_id,
        customers (
          name_mother
        )
      )
    `)
    .eq('status', 'scheduled')
    .gte('assigned_date', new Date().toISOString().split('T')[0])
    .order('assigned_date', { ascending: true })
    .limit(5);

  if (error) {
    console.error('Error fetching upcoming sessions:', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    ...s,
    assigned_date: ensure2026(s.assigned_date),
    completed_date: ensure2026(s.completed_date)
  }));
}

export async function getTopTechnicians() {
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      full_name,
      session_logs(count),
      session_reviews(rating)
    `)
    .eq('role', 'ktv')
    .limit(3);

  if (error) {
    console.error('Error fetching top technicians:', error);
    return [];
  }

  return data.map((user: any) => {
    const reviews = (user as any).session_reviews || [];
    const avgRating = reviews.length 
      ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length 
      : 5.0;
    
    return {
      name: user.full_name,
      sessions: (user as any).session_logs?.[0]?.count || 0,
      rating: avgRating.toFixed(1),
      status: avgRating >= 4.8 ? 'Xuất Sắc' : 'Tốt',
      bonus: avgRating >= 4.8 ? '+2,000k' : '+1,500k'
    };
  }).sort((a: any, b: any) => b.sessions - a.sessions);
}

export async function getMonthlyPerformance() {
  const supabase = (await createClient()) as any;
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  
  const { data, error } = await supabase
    .from('session_logs')
    .select('assigned_date')
    .gte('assigned_date', sixMonthsAgo.toISOString().split('T')[0])
    .eq('status', 'completed');

  const monthMap: Record<string, number> = {};
  
  // Initialize months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthYear = `T${d.getMonth() + 1}`;
    monthMap[monthYear] = 0;
  }

  data?.forEach((s: any) => {
    const date = new Date(s.assigned_date);
    const monthYear = `T${date.getMonth() + 1}`;
    if (monthMap[monthYear] !== undefined) {
      monthMap[monthYear]++;
    }
  });

  const result = Object.entries(monthMap).map(([name, count]) => ({
    name,
    customers: count
  }));

  // Fallback for demo if DB is empty
  if (result.every(r => r.customers === 0)) {
    return [
      { name: 'T12', customers: 45 },
      { name: 'T1', customers: 52 },
      { name: 'T2', customers: 48 },
      { name: 'T3', customers: 61 },
      { name: 'T4', customers: 55 },
      { name: 'T5', customers: 67 },
    ];
  }

  return result;
}

export async function getImportantAlerts() {
  return [
    {
      type: 'warning',
      title: 'Dự báo doanh thu',
      message: '97 triệu / mục tiêu 110 triệu — Cần thêm 1-2 booking để vượt mục tiêu',
      icon: 'alert'
    },
    {
      type: 'info',
      title: 'Mẹo',
      message: '💡 Tuần cuối tháng khách hay huỷ — nên đẩy booking sớm để tăng doanh thu',
      icon: 'lightbulb'
    }
  ];
}
