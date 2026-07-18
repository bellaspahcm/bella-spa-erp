/**
 * Operational Intelligence Queries - Simplified Version
 * 
 * Simple implementations that query base tables directly.
 */

import type { Database } from '@/types/database.types';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create service role client
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role credentials');
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Get KTV Leaderboard - Simplified
 */
export async function getKTVLeaderboard(tenantId: string) {
  const supabase = await createServiceRoleClient();

  // Query users with KTV role
  const { data: ktvs, error: ktvError } = await supabase
    .from('users')
    .select('id, full_name, phone')
    .eq('tenant_id', tenantId)
    .eq('role', 'ktv');

  if (ktvError) {
    throw ktvError;
  }

  // Fetch completed sessions with ratings
  const { data: sessions, error: sessionError } = await supabase
    .from('session_logs')
    .select('completed_by_ktv_id, rating')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (sessionError) {
    throw sessionError;
  }

  const sessionsByKtv = new Map<string, typeof sessions>();
  (sessions || []).forEach(s => {
    if (s.completed_by_ktv_id) {
      const list = sessionsByKtv.get(s.completed_by_ktv_id) || [];
      list.push(s);
      sessionsByKtv.set(s.completed_by_ktv_id, list);
    }
  });

  const DEFAULT_KTV_SESSION_COMMISSION = 100000; // 100,000 VND

  const leaderboard = (ktvs || []).map((ktv) => {
    const ktvSessions = sessionsByKtv.get(ktv.id) || [];
    const totalSessions = ktvSessions.length;
    
    // Average rating
    const ratedSessions = ktvSessions.filter(s => s.rating != null);
    const sumRatings = ratedSessions.reduce((sum, s) => sum + Number(s.rating || 0), 0);
    const avgRating = ratedSessions.length > 0 ? Math.round((sumRatings / ratedSessions.length) * 100) / 100 : 0;
    const customerSatisfactionScore = avgRating * 20; // Scale to 0-100

    const totalRevenue = totalSessions * DEFAULT_KTV_SESSION_COMMISSION;
    
    // Simple performance score: combination of completed sessions and average rating
    // Max 100. Assume target is 40 sessions per month (weighted 50%) and 5-star rating (weighted 50%).
    const sessionsComponent = Math.min(50, (totalSessions / 40) * 50);
    const ratingComponent = avgRating * 10;
    const performanceScore = Math.round(sessionsComponent + ratingComponent);

    return {
      tenantId,
      ktvId: ktv.id,
      ktvName: ktv.full_name || 'Unknown',
      ktvPhone: ktv.phone || '',
      rank: 1, // Will be set after sorting
      totalSessions,
      totalRevenue,
      avgRating,
      customerSatisfactionScore,
      kpiScore: performanceScore,
      performanceScore,
      computedAt: new Date().toISOString(),
    };
  });

  // Sort by performanceScore descending
  leaderboard.sort((a, b) => b.performanceScore - a.performanceScore);

  // Set rank
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });

  return leaderboard;
}

/**
 * Get Session Analytics - Simplified
 */
export async function getSessionAnalytics(tenantId: string) {
  const supabase = await createServiceRoleClient();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endDate = now.toISOString();

  // Query session_logs table
  const { data: sessions, error } = await supabase
    .from('session_logs')
    .select('id, created_at, status, actual_duration, start_time, end_time')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    throw error;
  }

  const totalSessions = sessions?.length || 0;
  const completedSessions = (sessions || []).filter(s => s.status === 'completed').length;
  const cancelledSessions = (sessions || []).filter(s => s.status === 'cancelled').length;

  // Calculate average duration in minutes
  const completedWithDuration = (sessions || []).filter(s => s.status === 'completed' && (s.actual_duration != null || (s.start_time && s.end_time)));
  const sumDuration = completedWithDuration.reduce((sum, s) => {
    if (s.actual_duration != null) {
      return sum + s.actual_duration;
    } else if (s.start_time && s.end_time) {
      const diffMs = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
      return sum + Math.round(diffMs / 60000);
    }
    return sum;
  }, 0);
  const avgDuration = completedWithDuration.length > 0 ? Math.round(sumDuration / completedWithDuration.length) : 60; // default 60 mins

  // Find peak hours
  const hoursCount = new Array(24).fill(0);
  (sessions || []).forEach(s => {
    if (s.created_at) {
      const hour = new Date(s.created_at).getHours();
      hoursCount[hour]++;
    }
  });
  let peakHour = 14; // default 14
  let maxHourCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hoursCount[h] > maxHourCount) {
      maxHourCount = hoursCount[h];
      peakHour = h;
    }
  }
  const peakHourStart = `${peakHour.toString().padStart(2, '0')}:00`;
  const peakHourEnd = `${((peakHour + 2) % 24).toString().padStart(2, '0')}:00`;

  const utilizationRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100 * 100) / 100 : 0;

  return [{
    tenantId,
    date: startDate,
    totalSessions,
    completedSessions,
    cancelledSessions,
    avgDuration,
    peakHourStart,
    peakHourEnd,
    utilizationRate,
    computedAt: new Date().toISOString(),
  }];
}

/**
 * Get Inventory Status - queries mv_inventory_status materialized view
 */
export async function getInventoryStatus(tenantId: string, stockStatus?: string): Promise<InventoryStatus[]> {
  const supabase = await createServiceRoleClient();

  let query = supabase
    .from('mv_inventory_status' as any)
    .select('*')
    .eq('tenant_id', tenantId);

  if (stockStatus) {
    query = query.eq('stock_status', stockStatus);
  }

  // Sort: out_of_stock first, then low_stock, medium_stock, high_stock
  query = query.order('stock_status', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data || []) as any[]).map((row) => ({
    tenantId: row.tenant_id,
    productId: row.product_id,
    productName: row.product_name,
    category: row.category,
    sku: row.sku,
    unitOfMeasure: row.unit_of_measure,
    currentStock: Number(row.current_stock),
    reorderLevel: Number(row.reorder_point),
    reorderPoint: Number(row.reorder_point),
    reorderQuantity: Number(row.reorder_quantity),
    maxStockLevel: Number(row.max_stock_level),
    stockStatus: row.stock_status,
    stockValue: Number(row.stock_value),
    usageLast30Days: Number(row.usage_last_30_days),
    avgDailyUsage: Number(row.avg_daily_usage),
    daysUntilStockout: row.days_until_stockout !== null ? Number(row.days_until_stockout) : null,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierContact: row.supplier_contact,
    supplierPhone: row.supplier_phone,
    supplierEmail: row.supplier_email,
    supplierLeadTimeDays: Number(row.supplier_lead_time_days),
    reorderRecommendation: row.reorder_recommendation,
    suggestedReorderDate: row.suggested_reorder_date,
    lastRestockDate: row.last_restock_date,
    lastRestockQuantity: row.last_restock_quantity !== null ? Number(row.last_restock_quantity) : null,
    lastUsageDate: row.last_usage_date,
    inventoryUpdatedAt: row.inventory_updated_at,
    computedAt: row.computed_at,
  }));
}

/**
 * Get Capacity Utilization - Simplified
 */
export async function getCapacityUtilization(tenantId: string) {
  const supabase = await createServiceRoleClient();
  const startDate = new Date().toISOString().slice(0, 10);

  // Get active KTVs
  const { data: ktvs, error: ktvError } = await supabase
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'ktv');

  if (ktvError) {
    throw ktvError;
  }

  // Count completed/scheduled sessions today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: sessions, error: sessionError } = await supabase
    .from('session_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('created_at', todayStart.toISOString())
    .lte('created_at', todayEnd.toISOString());

  if (sessionError) {
    throw sessionError;
  }

  const activeKtvCount = ktvs?.length || 0;
  const totalCapacity = Math.max(10, activeKtvCount * 4); // each KTV can do 4 sessions/day, minimum capacity 10
  const usedCapacity = sessions?.length || 0;
  const availableCapacity = Math.max(0, totalCapacity - usedCapacity);
  const utilizationRate = Math.round((usedCapacity / totalCapacity) * 100);

  return [{
    tenantId,
    date: startDate,
    totalCapacity,
    usedCapacity,
    availableCapacity,
    utilizationRate,
    peakUtilization: Math.min(100, utilizationRate + 15),
    computedAt: new Date().toISOString(),
  }];
}

/**
 * Get KTV Performance - Simplified (for single KTV detail)
 */
export async function getKTVPerformance(tenantId: string, ktvId: string) {
  const supabase = await createServiceRoleClient();

  const { data: ktv, error: ktvError } = await supabase
    .from('users')
    .select('id, full_name, phone')
    .eq('tenant_id', tenantId)
    .eq('id', ktvId)
    .single();

  if (ktvError) {
    throw ktvError;
  }

  // Fetch KTV sessions
  const { data: sessions, error: sessionError } = await supabase
    .from('session_logs')
    .select('status, rating')
    .eq('tenant_id', tenantId)
    .eq('completed_by_ktv_id', ktvId);

  if (sessionError) {
    throw sessionError;
  }

  const completedSessions = (sessions || []).filter(s => s.status === 'completed').length;
  const totalSessions = (sessions || []).length;

  const ratedSessions = (sessions || []).filter(s => s.status === 'completed' && s.rating != null);
  const sumRatings = ratedSessions.reduce((sum, s) => sum + Number(s.rating || 0), 0);
  const avgRating = ratedSessions.length > 0 ? Math.round((sumRatings / ratedSessions.length) * 100) / 100 : 0;
  const customerSatisfactionScore = avgRating * 20;

  const DEFAULT_KTV_SESSION_COMMISSION = 100000;
  const totalRevenue = completedSessions * DEFAULT_KTV_SESSION_COMMISSION;

  const sessionsComponent = Math.min(50, (completedSessions / 40) * 50);
  const ratingComponent = avgRating * 10;
  const performanceScore = Math.round(sessionsComponent + ratingComponent);

  return [{
    tenantId,
    ktvId: ktv.id,
    ktvName: ktv.full_name || 'Unknown',
    ktvPhone: ktv.phone || '',
    totalSessions,
    completedSessions,
    totalRevenue,
    avgRating,
    customerSatisfactionScore,
    kpiScore: performanceScore,
    performanceScore,
    computedAt: new Date().toISOString(),
  }];
}

/**
 * Get Inventory Forecast - Placeholder
 */
export async function getInventoryForecast(tenantId: string, productId: string) {
  return null;
}

// Export types
export interface KTVLeaderboard {
  tenantId: string;
  ktvId: string;
  ktvName: string;
  ktvPhone: string;
  rank: number;
  totalSessions: number;
  totalRevenue: number;
  avgRating: number;
  customerSatisfactionScore: number;
  kpiScore: number;
  performanceScore: number;
  computedAt: string;
}

export interface SessionAnalytics {
  tenantId: string;
  date: string;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  avgDuration: number;
  peakHourStart: string;
  peakHourEnd: string;
  utilizationRate: number;
  computedAt: string;
}

export interface InventoryStatus {
  tenantId: string;
  productId: string;
  productName: string;
  category: string;
  sku: string | null;
  unitOfMeasure: string | null;
  currentStock: number;
  reorderLevel: number;
  reorderPoint: number;
  reorderQuantity: number;
  maxStockLevel: number;
  stockStatus: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock';
  stockValue: number;
  usageLast30Days: number;
  avgDailyUsage: number;
  daysUntilStockout: number | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
  supplierLeadTimeDays: number;
  reorderRecommendation: 'urgent' | 'recommended' | 'suggested' | 'not_needed';
  suggestedReorderDate: string | null;
  lastRestockDate: string | null;
  lastRestockQuantity: number | null;
  lastUsageDate: string | null;
  inventoryUpdatedAt: string;
  computedAt: string;
}


export interface KTVPerformanceSimple {
  tenantId: string;
  ktvId: string;
  ktvName: string;
  ktvPhone: string;
  totalSessions: number;
  completedSessions: number;
  totalRevenue: number;
  avgRating: number;
  customerSatisfactionScore: number;
  kpiScore: number;
  performanceScore: number;
  computedAt: string;
}

export interface KTVLeaderboardSimple {
  tenantId: string;
  ktvId: string;
  ktvName: string;
  ktvPhone: string;
  rank: number;
  totalSessions: number;
  totalRevenue: number;
  avgRating: number;
  customerSatisfactionScore: number;
  kpiScore: number;
  performanceScore: number;
  computedAt: string;
}

export interface CapacityUtilizationSimple {
  tenantId: string;
  date: string;
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  utilizationRate: number;
  peakUtilization: number;
  computedAt: string;
}

export type CapacityUtilization = CapacityUtilizationSimple;
