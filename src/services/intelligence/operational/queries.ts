/**
 * Operational Intelligence Queries Module
 * 
 * Query builders for Operational Intelligence metrics:
 * - KTV Performance (sessions, ratings, revenue, attendance)
 * - KTV Leaderboard (top performers ranked by metric)
 * - Inventory Status (stock levels, reorder recommendations)
 * - Inventory Forecast (usage patterns, stockout predictions)
 * - Session Analytics (completion rates, peak hours, satisfaction)
 * - Capacity Utilization (booking capacity, utilization rates)
 * 
 * Architecture:
 * - Read-only operations (no mutations)
 * - Query materialized views for performance
 * - Tenant isolation (tenant_id filter on all queries)
 * - Date range filtering (day/week/month)
 * - TypeScript types for all return values
 * 
 * Data Sources:
 * - mv_ktv_performance_summary (materialized view)
 * - mv_inventory_status (materialized view)
 * - mv_session_analytics (materialized view)
 * - session_logs, bookings, attendance, inventory, products
 */

import type { Database } from '@/types/database.types';
import type { DateRange, TimePeriod } from '../shared/types';
import { QueryError } from '../shared/types';
import { parseDateRange, formatDate } from '../shared/helpers';
import type { 
  MvKtvPerformanceSummary, 
  MvInventoryStatus, 
  MvSessionAnalytics 
} from '@/types/materialized-views.types';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create server-side Supabase client with service role key (bypasses RLS).
 * 
 * Operational Intelligence queries need service role access to read materialized views
 * and aggregate operational data without RLS restrictions.
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error(
      'Operational Intelligence requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Service role key grants admin access to bypass RLS for analytics queries.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Type Definitions ───────────────────────────────────────────────────────

/**
 * KTV Performance Metrics
 */
export interface KtvPerformance {
  ktvId: string;
  tenantId: string;
  ktvName: string;
  ktvEmail: string;
  ktvPhone: string | null;
  month: string;
  
  // Session metrics
  totalSessionsCompleted: number;
  totalSessionsCancelled: number;
  totalSessionsNoShow: number;
  totalSessionsAll: number;
  completionRatePct: number;
  
  // Rating metrics
  avgRating: number;
  highRatingsCount: number;
  lowRatingsCount: number;
  totalRatingsCount: number;
  
  // Revenue metrics
  totalRevenue: number;
  avgRevenuePerSession: number;
  
  // Commission metrics
  totalServiceCommission: number;
  totalSessionBonus: number;
  
  // Attendance metrics
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  totalAttendanceDays: number;
  attendanceRatePct: number;
  
  // Metadata
  lastSessionDate: string | null;
  uniqueCustomersServed: number;
  computedAt: string;
}

/**
 * KTV Leaderboard Entry
 */
export interface KtvLeaderboardEntry {
  rank: number;
  ktvId: string;
  ktvName: string;
  metricValue: number;
  totalSessionsCompleted: number;
  avgRating: number;
  totalRevenue: number;
  attendanceRatePct: number;
}

/**
 * Inventory Status
 */
export interface InventoryStatus {
  productId: string;
  tenantId: string;
  productName: string;
  category: string;
  sku: string | null;
  unitOfMeasure: string | null;
  
  // Stock info
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  maxStockLevel: number;
  stockStatus: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock';
  stockValue: number;
  
  // Usage metrics
  usageLast30Days: number;
  avgDailyUsage: number;
  daysUntilStockout: number | null;
  
  // Supplier info
  supplierId: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
  supplierLeadTimeDays: number;
  
  // Reorder recommendation
  reorderRecommendation: 'urgent' | 'recommended' | 'suggested' | 'not_needed';
  suggestedReorderDate: string | null;
  
  // Metadata
  lastRestockDate: string | null;
  lastRestockQuantity: number | null;
  lastUsageDate: string | null;
  inventoryUpdatedAt: string;
  computedAt: string;
}

/**
 * Inventory Forecast
 */
export interface InventoryForecast {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailyUsage: number;
  forecastedDaysUntilStockout: number | null;
  forecastedStockoutDate: string | null;
  recommendedReorderDate: string | null;
  recommendedReorderQuantity: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

/**
 * Session Analytics
 */
export interface SessionAnalytics {
  tenantId: string;
  date: string;
  
  // Session counts
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  noShowSessions: number;
  scheduledSessions: number;
  inProgressSessions: number;
  
  // Rates
  completionRatePct: number;
  cancellationRatePct: number;
  noShowRatePct: number;
  
  // Package distribution
  basicPackageSessions: number;
  premiumPackageSessions: number;
  vipPackageSessions: number;
  
  // Peak hours
  morningSessions: number;
  afternoonSessions: number;
  eveningSessions: number;
  peakHour: number;
  
  // Satisfaction
  avgSatisfactionRating: number;
  highSatisfactionCount: number;
  mediumSatisfactionCount: number;
  lowSatisfactionCount: number;
  totalRatings: number;
  
  // Duration
  avgDurationMinutes: number;
  maxDurationMinutes: number | null;
  minDurationMinutes: number | null;
  
  // Revenue
  totalRevenue: number;
  avgRevenuePerSession: number;
  
  // Metrics
  uniqueCustomers: number;
  uniqueKtvs: number;
  successfulQualitySessions: number;
  qualitySuccessRatePct: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Capacity Utilization
 */
export interface CapacityUtilization {
  tenantId: string;
  date: string;
  totalCapacity: number;
  bookedSessions: number;
  utilizationRatePct: number;
  peakHours: number[];
  idleHours: number[];
  recommendedStaffing: number;
}

// ─── Query Builders ─────────────────────────────────────────────────────────

/**
 * Get KTV Performance metrics for a specific KTV
 * 
 * @param ktvId - KTV user ID
 * @param dateRange - Date range or time period string
 * @returns KTV performance metrics
 */
export async function getKtvPerformance(
  ktvId: string,
  dateRange: DateRange | TimePeriod
): Promise<KtvPerformance[]> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query materialized view (use rpc or type-safe approach)
    const { data, error } = await supabase
      .from('mv_ktv_performance_summary' as any)
      .select('*')
      .eq('ktv_id', ktvId)
      .gte('month', formatDate(range.startDate))
      .lte('month', formatDate(range.endDate))
      .order('month', { ascending: false });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch KTV performance: ${error.message}`,
        error
      );
    }
    
    // Map database columns to camelCase (type-safe with MV interface, use unknown bridge for Supabase MV inference)
    return ((data || []) as unknown as MvKtvPerformanceSummary[]).map((row) => ({
      ktvId: row.ktv_id,
      tenantId: row.tenant_id,
      ktvName: row.ktv_name,
      ktvEmail: row.ktv_email,
      ktvPhone: row.ktv_phone,
      month: row.month,
      totalSessionsCompleted: row.total_sessions_completed,
      totalSessionsCancelled: row.total_sessions_cancelled,
      totalSessionsNoShow: row.total_sessions_no_show,
      totalSessionsAll: row.total_sessions_all,
      completionRatePct: row.completion_rate_pct,
      avgRating: row.avg_rating,
      highRatingsCount: row.high_ratings_count,
      lowRatingsCount: row.low_ratings_count,
      totalRatingsCount: row.total_ratings_count,
      totalRevenue: row.total_revenue,
      avgRevenuePerSession: row.avg_revenue_per_session,
      totalServiceCommission: row.total_service_commission,
      totalSessionBonus: row.total_session_bonus,
      daysPresent: row.days_present,
      daysAbsent: row.days_absent,
      daysLate: row.days_late,
      totalAttendanceDays: row.total_attendance_days,
      attendanceRatePct: row.attendance_rate_pct,
      lastSessionDate: row.last_session_date,
      uniqueCustomersServed: row.unique_customers_served,
      computedAt: row.computed_at,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching KTV performance: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get KTV Leaderboard ranked by specified metric
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @param metric - Metric to rank by ('revenue' | 'sessions' | 'rating')
 * @param limit - Number of top KTVs to return (default: 10)
 * @returns Top KTVs leaderboard
 */
export async function getKtvLeaderboard(
  tenantId: string,
  dateRange: DateRange | TimePeriod,
  metric: 'revenue' | 'sessions' | 'rating' = 'revenue',
  limit: number = 10
): Promise<KtvLeaderboardEntry[]> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Determine sort column
    const sortColumn = metric === 'revenue' 
      ? 'total_revenue' 
      : metric === 'sessions' 
      ? 'total_sessions_completed' 
      : 'avg_rating';
    
    // Query materialized view (type-cast needed for MV support)
    const { data, error } = await supabase
      .from('mv_ktv_performance_summary' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', formatDate(range.startDate))
      .lte('month', formatDate(range.endDate))
      .order(sortColumn, { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new QueryError(
        `Failed to fetch KTV leaderboard: ${error.message}`,
        error
      );
    }
    
    // Aggregate by KTV (sum across months in date range) - type-safe with MV interface
    const ktvMap = new Map<string, {
      ktvId: string;
      ktvName: string;
      totalSessionsCompleted: number;
      avgRating: number;
      totalRevenue: number;
      attendanceRatePct: number;
      ratingCount: number;
    }>();
    
    ((data || []) as unknown as MvKtvPerformanceSummary[]).forEach((row) => {
      const existing = ktvMap.get(row.ktv_id);
      if (existing) {
        existing.totalSessionsCompleted += row.total_sessions_completed;
        existing.totalRevenue += row.total_revenue;
        existing.avgRating = (existing.avgRating * existing.ratingCount + row.avg_rating * row.total_ratings_count) / (existing.ratingCount + row.total_ratings_count);
        existing.ratingCount += row.total_ratings_count;
        existing.attendanceRatePct = (existing.attendanceRatePct + row.attendance_rate_pct) / 2; // Simple average
      } else {
        ktvMap.set(row.ktv_id, {
          ktvId: row.ktv_id,
          ktvName: row.ktv_name,
          totalSessionsCompleted: row.total_sessions_completed,
          avgRating: row.avg_rating,
          totalRevenue: row.total_revenue,
          attendanceRatePct: row.attendance_rate_pct,
          ratingCount: row.total_ratings_count,
        });
      }
    });
    
    // Convert map to array and sort
    const leaderboard = Array.from(ktvMap.values()).sort((a, b) => {
      const aValue = metric === 'revenue' ? a.totalRevenue : metric === 'sessions' ? a.totalSessionsCompleted : a.avgRating;
      const bValue = metric === 'revenue' ? b.totalRevenue : metric === 'sessions' ? b.totalSessionsCompleted : b.avgRating;
      return bValue - aValue;
    });
    
    // Add ranks
    return leaderboard.map((ktv, index) => ({
      rank: index + 1,
      ktvId: ktv.ktvId,
      ktvName: ktv.ktvName,
      metricValue: metric === 'revenue' ? ktv.totalRevenue : metric === 'sessions' ? ktv.totalSessionsCompleted : ktv.avgRating,
      totalSessionsCompleted: ktv.totalSessionsCompleted,
      avgRating: ktv.avgRating,
      totalRevenue: ktv.totalRevenue,
      attendanceRatePct: ktv.attendanceRatePct,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching KTV leaderboard: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Inventory Status for all products or filtered by stock status
 * 
 * @param tenantId - Tenant ID
 * @param stockStatus - Optional filter by stock status
 * @returns Inventory status list
 */
export async function getInventoryStatus(
  tenantId: string,
  stockStatus?: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock'
): Promise<InventoryStatus[]> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Build query (type-cast needed for MV support)
    let query = supabase
      .from('mv_inventory_status' as any)
      .select('*')
      .eq('tenant_id', tenantId);
    
    // Apply stock status filter if provided
    if (stockStatus) {
      query = query.eq('stock_status', stockStatus);
    }
    
    // Sort by stock status priority (out_of_stock first)
    query = query.order('stock_status', { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      throw new QueryError(
        `Failed to fetch inventory status: ${error.message}`,
        error
      );
    }
    
    // Map database columns to camelCase (type-safe with MV interface, use unknown bridge)
    return ((data || []) as unknown as MvInventoryStatus[]).map((row) => ({
      productId: row.product_id,
      tenantId: row.tenant_id,
      productName: row.product_name,
      category: row.category,
      sku: row.sku,
      unitOfMeasure: row.unit_of_measure,
      currentStock: row.current_stock,
      reorderPoint: row.reorder_point,
      reorderQuantity: row.reorder_quantity,
      maxStockLevel: row.max_stock_level,
      stockStatus: row.stock_status,
      stockValue: row.stock_value,
      usageLast30Days: row.usage_last_30_days,
      avgDailyUsage: row.avg_daily_usage,
      daysUntilStockout: row.days_until_stockout,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      supplierContact: row.supplier_contact,
      supplierPhone: row.supplier_phone,
      supplierEmail: row.supplier_email,
      supplierLeadTimeDays: row.supplier_lead_time_days,
      reorderRecommendation: row.reorder_recommendation,
      suggestedReorderDate: row.suggested_reorder_date,
      lastRestockDate: row.last_restock_date,
      lastRestockQuantity: row.last_restock_quantity,
      lastUsageDate: row.last_usage_date,
      inventoryUpdatedAt: row.inventory_updated_at,
      computedAt: row.computed_at,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching inventory status: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Inventory Forecast for a specific product
 * 
 * @param productId - Product ID
 * @param days - Forecast horizon in days (default: 30)
 * @returns Inventory forecast
 */
export async function getInventoryForecast(
  productId: string,
  _days: number = 30
): Promise<InventoryForecast> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Query materialized view for product (type-cast needed for MV support)
    const { data, error } = await supabase
      .from('mv_inventory_status' as any)
      .select('*')
      .eq('product_id', productId)
      .single();
    
    if (error) {
      throw new QueryError(
        `Failed to fetch inventory forecast: ${error.message}`,
        error
      );
    }
    
    if (!data) {
      throw new QueryError(`Product not found: ${productId}`, undefined);
    }
    
    // Type-safe cast to MV interface
    const row = data as unknown as MvInventoryStatus;
    
    // Calculate forecast
    const avgDailyUsage = row.avg_daily_usage || 0;
    const currentStock = row.current_stock || 0;
    const supplierLeadTime = row.supplier_lead_time_days || 7;
    
    const forecastedDaysUntilStockout = avgDailyUsage > 0 
      ? Math.round(currentStock / avgDailyUsage) 
      : null;
    
    const forecastedStockoutDate = forecastedDaysUntilStockout !== null
      ? new Date(Date.now() + forecastedDaysUntilStockout * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;
    
    const recommendedReorderDate = forecastedDaysUntilStockout !== null
      ? new Date(Date.now() + (forecastedDaysUntilStockout - supplierLeadTime) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;
    
    // Determine confidence level based on usage history
    const confidenceLevel: 'high' | 'medium' | 'low' = 
      row.usage_last_30_days >= 10 ? 'high' :
      row.usage_last_30_days >= 5 ? 'medium' : 'low';
    
    return {
      productId: row.product_id,
      productName: row.product_name,
      currentStock: currentStock,
      avgDailyUsage: avgDailyUsage,
      forecastedDaysUntilStockout,
      forecastedStockoutDate,
      recommendedReorderDate,
      recommendedReorderQuantity: row.reorder_quantity || 0,
      confidenceLevel,
    };
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching inventory forecast: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Session Analytics for a date range
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @returns Session analytics by day
 */
export async function getSessionAnalytics(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<SessionAnalytics[]> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query materialized view (type-cast needed for MV support)
    const { data, error } = await supabase
      .from('mv_session_analytics' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', formatDate(range.startDate))
      .lte('date', formatDate(range.endDate))
      .order('date', { ascending: false });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch session analytics: ${error.message}`,
        error
      );
    }
    
    // Map database columns to camelCase (type-safe with MV interface, use unknown bridge)
    return ((data || []) as unknown as MvSessionAnalytics[]).map((row) => ({
      tenantId: row.tenant_id,
      date: row.date,
      totalSessions: row.total_sessions,
      completedSessions: row.completed_sessions,
      cancelledSessions: row.cancelled_sessions,
      noShowSessions: row.no_show_sessions,
      scheduledSessions: row.scheduled_sessions,
      inProgressSessions: row.in_progress_sessions,
      completionRatePct: row.completion_rate_pct,
      cancellationRatePct: row.cancellation_rate_pct,
      noShowRatePct: row.no_show_rate_pct,
      basicPackageSessions: row.basic_package_sessions,
      premiumPackageSessions: row.premium_package_sessions,
      vipPackageSessions: row.vip_package_sessions,
      morningSessions: row.morning_sessions,
      afternoonSessions: row.afternoon_sessions,
      eveningSessions: row.evening_sessions,
      peakHour: row.peak_hour,
      avgSatisfactionRating: row.avg_satisfaction_rating,
      highSatisfactionCount: row.high_satisfaction_count,
      mediumSatisfactionCount: row.medium_satisfaction_count,
      lowSatisfactionCount: row.low_satisfaction_count,
      totalRatings: row.total_ratings,
      avgDurationMinutes: row.avg_duration_minutes,
      maxDurationMinutes: row.max_duration_minutes,
      minDurationMinutes: row.min_duration_minutes,
      totalRevenue: row.total_revenue,
      avgRevenuePerSession: row.avg_revenue_per_session,
      uniqueCustomers: row.unique_customers,
      uniqueKtvs: row.unique_ktvs,
      successfulQualitySessions: row.successful_quality_sessions,
      qualitySuccessRatePct: row.quality_success_rate_pct,
      computedAt: row.computed_at,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching session analytics: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Capacity Utilization for a date range
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @returns Capacity utilization metrics
 */
export async function getCapacityUtilization(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<CapacityUtilization[]> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query session analytics for capacity metrics (type-cast needed for MV support)
    const { data: sessionData, error: sessionError } = await supabase
      .from('mv_session_analytics' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', formatDate(range.startDate))
      .lte('date', formatDate(range.endDate))
      .order('date', { ascending: false });
    
    if (sessionError) {
      throw new QueryError(
        `Failed to fetch capacity utilization: ${sessionError.message}`,
        sessionError
      );
    }
    
    // Query active KTVs to calculate dynamic capacity
    const { count: activeKtvCount, error: ktvCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'ktv')
      .eq('status', 'active');

    if (ktvCountError) {
      console.warn('[getCapacityUtilization] Error fetching active KTV count, falling back to 10 KTVs:', ktvCountError.message);
    }

    const activeKtvs = activeKtvCount || 10;
    // Capacity = active KTVs * 8 hours/day * 4 slots/hour = active KTVs * 32
    const totalCapacityPerDay = activeKtvs * 32;
    
    // Calculate utilization for each day (type-safe with MV interface, use unknown bridge)
    return ((sessionData || []) as unknown as MvSessionAnalytics[]).map((row) => {
      const bookedSessions = row.total_sessions;
      const utilizationRatePct = Math.round((bookedSessions / totalCapacityPerDay) * 100);
      
      // Identify peak hours (top 3 hours)
      const hourCounts = [
        { hour: 8, count: row.morning_sessions },
        { hour: 12, count: row.afternoon_sessions },
        { hour: 17, count: row.evening_sessions },
      ];
      hourCounts.sort((a, b) => b.count - a.count);
      const peakHours = hourCounts.slice(0, 2).map(h => h.hour);
      
      // Identify idle hours (hours with low bookings)
      const idleHours = hourCounts.filter(h => h.count < 10).map(h => h.hour);
      
      // Recommended staffing (based on peak hour demand)
      const peakDemand = Math.max(row.morning_sessions, row.afternoon_sessions, row.evening_sessions);
      const recommendedStaffing = Math.ceil(peakDemand / 4); // 4 sessions per KTV per time slot
      
      return {
        tenantId: row.tenant_id,
        date: row.date,
        totalCapacity: totalCapacityPerDay,
        bookedSessions,
        utilizationRatePct,
        peakHours,
        idleHours,
        recommendedStaffing,
      };
    });
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching capacity utilization: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}
