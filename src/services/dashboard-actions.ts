'use server';

import { createClient } from '@/lib/supabase-server';
import { ensure2026 } from '@/lib/utils';
import { DEMO_SESSIONS, DEMO_TECH_TOP } from '@/constants/demo-data';

export async function getDashboardStats(startDate?: string, endDate?: string) {
  const supabase = (await createClient()) as any;

  const now = new Date();
  const today = now.toLocaleDateString('en-CA'); 
  const currentMonthStart = startDate || today.substring(0, 7) + '-01';
  const currentMonthEnd = endDate || today.substring(0, 7) + '-31';

  // Calculate previous month range relative to currentMonthStart
  const currentStart = new Date(currentMonthStart);
  const prevMonthDate = new Date(currentStart);
  prevMonthDate.setMonth(currentStart.getMonth() - 1);
  const prevMonthStart = prevMonthDate.toISOString().substring(0, 7) + '-01';
  
  // Last day of previous month
  const prevMonthEndObj = new Date(currentStart);
  prevMonthEndObj.setDate(0); // 0th day of current month is last day of prev month
  const prevMonthEnd = prevMonthEndObj.toISOString().substring(0, 10);

  // Calculate yesterday
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = yesterdayDate.toLocaleDateString('en-CA');

  // Parallel fetching for performance
  const [
    { count: totalCustomers },
    { count: customersAtStartOfMonth },
    { count: todayBookings },
    { count: yesterdayBookings },
    { data: revenueData },
    { data: prevRevenueData },
    { data: ratingsData },
    { data: prevRatingsData }
  ] = await Promise.all([
    // Total Customers
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }).lt('created_at', currentMonthStart),
    
    // Today Bookings
    supabase.from('session_logs').select('*', { count: 'exact', head: true }).eq('assigned_date', today),
    supabase.from('session_logs').select('*', { count: 'exact', head: true }).eq('assigned_date', yesterday),
    
    // Revenue
    supabase.from('revenue').select('amount').gte('received_date', currentMonthStart).lte('received_date', currentMonthEnd),
    supabase.from('revenue').select('amount').gte('received_date', prevMonthStart).lte('received_date', prevMonthEnd),
    
    // Ratings
    supabase.from('session_reviews').select('rating').gte('created_at', currentMonthStart).lte('created_at', currentMonthEnd),
    supabase.from('session_reviews').select('rating').gte('created_at', prevMonthStart).lte('created_at', prevMonthEnd)
  ]);

  // Calculations
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Customers Trend (New this month vs total before)
  const customersTrend = calcTrend(totalCustomers || 0, customersAtStartOfMonth || 0);

  // Bookings Trend
  const bookingsTrend = calcTrend(todayBookings || 0, yesterdayBookings || 0);

  // Revenue
  const totalRevenue = revenueData?.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0;
  const prevRevenue = prevRevenueData?.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0;
  const revenueTrend = calcTrend(totalRevenue, prevRevenue);

  // Ratings
  const avgRating = ratingsData?.length 
    ? (ratingsData.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratingsData.length).toFixed(1) 
    : '5.0';
  const prevAvgRating = prevRatingsData?.length
    ? (prevRatingsData.reduce((acc: number, curr: any) => acc + curr.rating, 0) / prevRatingsData.length)
    : 5.0;
  const ratingsTrend = calcTrend(Number(avgRating), Number(prevAvgRating));

  return {
    totalCustomers: {
      value: (totalCustomers || 0).toLocaleString(),
      trend: customersTrend
    },
    todayBookings: {
      value: (todayBookings || 0).toString(),
      trend: bookingsTrend
    },
    totalRevenue: {
      value: totalRevenue > 0 ? (totalRevenue / 1000000).toFixed(1) + 'M' : '0M',
      trend: revenueTrend
    },
    avgRating: {
      value: avgRating,
      trend: ratingsTrend
    }
  };
}

export async function getUpcomingSessions() {
  const supabase = (await createClient()) as any;
  const today = new Date().toLocaleDateString('en-CA');

  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        package_id,
        customers (
          name_mother
        ),
        assigned_ktv:users!bookings_assigned_ktv_id_fkey (
          full_name
        )
      )
    `)
    .eq('status', 'scheduled') // Only pending tasks as requested before
    .gte('assigned_date', today)
    .order('assigned_date', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Error fetching upcoming sessions:', error);
    return DEMO_SESSIONS; // Only fallback on actual error, not empty data
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
    return DEMO_TECH_TOP;
  }

  return (data || []).map((user: any) => {
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
  
  // Fetch data for the last 6 months
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const { data, error } = await supabase
    .from('session_logs')
    .select('assigned_date')
    .gte('assigned_date', sixMonthsAgo.toLocaleDateString('en-CA'))
    .lte('assigned_date', todayStr);

  const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
  const monthMap: Record<string, number> = {};
  
  // Initialize months in order
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = monthNames[d.getMonth()];
    monthMap[label] = 0;
  }

  data?.forEach((s: any) => {
    const date = new Date(s.assigned_date);
    const label = monthNames[date.getMonth()];
    if (monthMap[label] !== undefined) {
      monthMap[label]++;
    }
  });

  return Object.entries(monthMap).map(([name, count]) => ({
    name,
    customers: count
  }));
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

// Bundle everything into a single request for faster page loading
export async function getFullDashboardData(startDate?: string, endDate?: string) {
  const [statsData, sessionsData, ktvsData, alertsData, perfData] = await Promise.all([
    getDashboardStats(startDate, endDate),
    getUpcomingSessions(),
    getTopTechnicians(),
    getImportantAlerts(),
    getMonthlyPerformance()
  ]);

  return {
    statsData,
    sessionsData,
    ktvsData,
    alertsData,
    perfData
  };
}
