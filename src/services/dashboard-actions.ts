'use server';





export async function getDashboardStats(startDate?: string, endDate?: string, todayDate?: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  const now = new Date();
  const today = todayDate || now.toISOString().split('T')[0];
  const currentMonthStart = startDate || today.substring(0, 7) + '-01';
  const currentMonthEnd = endDate || today.substring(0, 7) + '-31';

  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_start_date: currentMonthStart,
    p_end_date: currentMonthEnd,
    p_today: today,
    p_tenant_id: tenantId
  });

  if (error) {
    console.error('Error calling get_dashboard_summary:', error);
    // Fallback to empty stats if RPC fails (e.g. migration not applied yet)
    return {
      totalCustomers: { value: '0', trend: 0 },
      todayBookings: { value: '0', trend: 0 },
      totalRevenue: { value: '0M', trend: 0 },
      avgRating: { value: '5.0', trend: 0 }
    };
  }

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const customersTrend = calcTrend(data.total_customers, data.customers_prev);
  const bookingsTrend = calcTrend(data.today_bookings, data.yesterday_bookings);
  const revenueTrend = calcTrend(data.total_revenue, data.prev_revenue);
  const ratingsTrend = calcTrend(data.avg_rating, data.prev_avg_rating);

  return {
    totalCustomers: {
      value: data.total_customers.toLocaleString(),
      trend: customersTrend
    },
    todayBookings: {
      value: data.today_bookings.toString(),
      trend: bookingsTrend
    },
    totalRevenue: {
      value: data.total_revenue > 0 ? (data.total_revenue / 1000000).toFixed(1) + 'M' : '0M',
      trend: revenueTrend
    },
    avgRating: {
      value: data.avg_rating.toFixed(1),
      trend: ratingsTrend
    }
  };
}

export async function getUpcomingSessions(date?: string) {
  try {
    const { getCalendarSessions } = await import('./booking-actions');
    const allSessions = await getCalendarSessions();
    
    // Get today's date in local time YYYY-MM-DD if not provided
    let todayStr = date;
    if (!todayStr) {
      const now = new Date();
      todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // Filter the already processed sessions for Today and Not Completed
    const todaySessions = allSessions.filter((s: any) => {
      // getCalendarSessions already handles predictive logic and returns assigned_date
      const isToday = s.assigned_date === todayStr;
      const isNotCompleted = s.status !== 'completed';
      return isToday && isNotCompleted;
    });

    // Return the filtered results
    return todaySessions.sort((a, b) => (a.assigned_time || '').localeCompare(b.assigned_time || ''));
  } catch (error) {
    console.error('Error in getUpcomingSessions:', error);
    return [];
  }
}

export async function getTopTechnicians() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      full_name,
      session_logs(count),
      session_reviews(rating)
    `)
    .eq('role', 'ktv')
    .eq('tenant_id', tenantId)
    .limit(3);

  if (error) {
    console.error('Error fetching top technicians:', error);
    return [];
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
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return [];
  
  const { data, error } = await supabase.rpc('get_monthly_performance_v2', {
    p_tenant_id: tenantId
  });

  if (error) {
    // Return empty array if RPC fails
    return [];
  }

  return (data || []).map((row: any) => ({
    name: row.month_label,
    customers: row.customers_count,
    revenue: Number((row.revenue_amount / 1000000).toFixed(1)),
    expense: Number((row.expense_amount / 1000000).toFixed(1)),
    rating: Number(row.avg_rating.toFixed(1))
  }));
}

export async function getImportantAlerts() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return [];

  const { data, error } = await supabase.rpc('get_important_alerts', {
    p_tenant_id: tenantId
  });

  if (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }

  return data || [];
}

// Bundle everything into a single request for faster page loading
export async function getFullDashboardData(startDate?: string, endDate?: string, todayDate?: string) {
  const [statsData, sessionsData, ktvsData, alertsData, perfData] = await Promise.all([
    getDashboardStats(startDate, endDate, todayDate),
    getUpcomingSessions(todayDate),
    getTopTechnicians(),
    getImportantAlerts(),
    getMonthlyPerformance()
  ]);

  // Synchronize stats with the actual retrieved sessions for consistency
  // especially since getUpcomingSessions uses predictive logic
  if (statsData && statsData.todayBookings && sessionsData) {
    statsData.todayBookings.value = sessionsData.length.toString();
  }

  return {
    statsData,
    sessionsData,
    ktvsData,
    alertsData,
    perfData
  };
}
