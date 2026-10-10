'use server';

import type { KtvPerformanceViewModel } from '@/core/services/analytics/dashboard-actions';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { getCurrentUser } from './user-actions';

type KtvLeaderboardRow = Database['public']['Functions']['get_ktv_leaderboard']['Returns'][number];
type RatingStar = 1 | 2 | 3 | 4 | 5;

export interface CustomerRatingDistributionViewModel {
  star: RatingStar;
  count: number;
  percentage: number;
}

interface CustomerRatingDistributionRow {
  rating: number | null;
}

function requireBeautyDashboardTenant(tenantId: string | null | undefined) {
  if (!tenantId) {
    throw new Error('Không xác định được đơn vị kinh doanh cho dashboard');
  }
  return tenantId;
}

function monthRange(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function currentMonthStart() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  return `${today.substring(0, 7)}-01`;
}

function formatCurrency(val: number) {
  if (val >= 1000000) return `+${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `+${(val / 1000).toFixed(0)}k`;
  return `+${val}`;
}

export async function getBeautyDashboardTopTechnicians(): Promise<KtvPerformanceViewModel[]> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = requireBeautyDashboardTenant(currentUser?.tenant_id);
  const month = currentMonthStart();

  const { data, error } = await supabase.rpc('get_ktv_leaderboard', {
    p_tenant_id: tenantId,
    p_month: month,
  });

  if (error) {
    throw new Error(`Failed to fetch beauty dashboard top technicians: ${error.message}`);
  }

  const leaderData = (data || []) as KtvLeaderboardRow[];

  return leaderData.slice(0, 3).map((u) => {
    const averageRating = u.average_rating === null || u.average_rating === undefined
      ? null
      : Number(u.average_rating);

    return {
      name: u.full_name,
      sessions: Number(u.sessions || 0),
      rating: averageRating === null ? '—' : averageRating.toFixed(1),
      status: averageRating === null ? 'Chưa có dữ liệu' : averageRating >= 4.8 ? 'Xuất Sắc' : 'Tốt',
      bonus: formatCurrency(Number(u.total_kpi_bonus || 0)),
    };
  });
}

export async function getBeautyDashboardCustomerRatingDistribution(
  startDate?: string,
  endDate?: string
): Promise<CustomerRatingDistributionViewModel[]> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = requireBeautyDashboardTenant(currentUser?.tenant_id);
  const monthStart = startDate || currentMonthStart();
  const monthEnd = endDate || monthRange(monthStart);

  const { data, error } = await supabase
    .from('session_reviews')
    .select('rating')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd);

  if (error) {
    throw new Error(`Failed to fetch beauty dashboard customer rating distribution: ${error.message}`);
  }

  const counts: Record<RatingStar, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const review of ((data as CustomerRatingDistributionRow[] | null) || [])) {
    const star = Number(review.rating);
    if (star >= 1 && star <= 5 && Number.isInteger(star)) {
      counts[star as RatingStar] += 1;
    }
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return ([5, 4, 3, 2, 1] as const).map((star) => ({
    star,
    count: counts[star],
    percentage: total > 0 ? Math.round((counts[star] / total) * 100) : 0,
  }));
}
