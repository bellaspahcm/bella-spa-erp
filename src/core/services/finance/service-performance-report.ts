'use server';

import { calculatePriceAfterDiscount } from '@/lib/business-rules/payment';
import { resolveTenantId } from './shared';
import type { ServiceBookingDBRow } from './types';

export async function getServicePerformance() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const tenantId = await resolveTenantId();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('package_name, full_price, discount_percent, completed_sessions, total_sessions, ktv_commission, status')
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'cancelled');

  if (error) throw new Error(`[getServicePerformance] bookings query failed: ${error.message}`);

    const typedBookings = (bookings as unknown as ServiceBookingDBRow[]) || [];

    // Aggregate by package_name
    const byPackage: Record<string, {
      package_name: string;
      total_bookings: number;
      total_revenue: number;
      total_ktv_cost: number;
      completedSessions: number;
      totalSessions: number;
    }> = {};

    typedBookings.forEach((b) => {
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
      const actualPrice = calculatePriceAfterDiscount({
        fullPrice: b.full_price,
        discountPercent: b.discount_percent,
      });
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
}
