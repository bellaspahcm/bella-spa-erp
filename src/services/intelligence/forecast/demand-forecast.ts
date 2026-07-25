/**
 * Demand Forecasting Service
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Implements demand forecasting for services and packages using:
 * - Time series analysis with seasonality
 * - Moving average with trend detection
 * - Day-of-week and time-of-month patterns
 */

import { createClient } from '@/lib/supabase-server';
import type {
  ForecastInput,
  DemandForecastResult,
  ItemDemandForecast,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

interface HistoricalDemandData {
  date: string; // YYYY-MM-DD
  itemId: string;
  itemName: string;
  itemType: 'service' | 'package';
  demand: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayOfMonth: number;
  weekOfMonth: number;
}

interface SeasonalityFactors {
  dayOfWeekFactors: number[]; // Length 7
  weekOfMonthFactors: number[]; // Length 4-5
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_VERSION = 'v1.0';
const DEFAULT_CONFIDENCE_LEVEL = 0.90;

// ============================================================================
// MAIN FORECAST FUNCTION
// ============================================================================

export async function forecastDemand(
  input: ForecastInput & { itemType: 'service' | 'package' }
): Promise<DemandForecastResult> {
  const supabase = await createClient();
  
  // Validate horizon (1-4 weeks)
  if (input.forecastHorizon < 1 || input.forecastHorizon > 4) {
    throw new Error('Demand forecast horizon must be 1-4 weeks');
  }
  
  // Fetch historical demand data
  const historicalData = await fetchHistoricalDemand(
    supabase,
    input.tenantId,
    input.itemType,
    input.startDate
  );
  
  if (historicalData.length === 0) {
    return {
      tenantId: input.tenantId,
      modelName: 'simple_moving_average',
      modelVersion: MODEL_VERSION,
      horizon: input.forecastHorizon,
      itemType: input.itemType,
      forecasts: [],
      summary: {
        totalPredictedDemand: 0,
        avgDailyDemand: 0,
        peakDemandDate: new Date().toISOString().split('T')[0],
        peakDemandValue: 0,
        trend: 'stable' as const,
      },
    };
  }
  
  // Group by item
  const itemGroups = groupByItem(historicalData);
  
  // Generate forecasts for each item
  const allForecasts: ItemDemandForecast[] = [];
  
  for (const [_itemKey, itemData] of Object.entries(itemGroups)) {
    if (itemData.length < 14) {
      // Need at least 2 weeks of data
      continue;
    }
    
    const itemForecasts = forecastItemDemand(
      itemData,
      input.forecastHorizon,
      input.confidenceLevel || DEFAULT_CONFIDENCE_LEVEL
    );
    
    allForecasts.push(...itemForecasts);
  }
  
  if (allForecasts.length === 0) {
    return {
      tenantId: input.tenantId,
      modelName: 'simple_moving_average',
      modelVersion: MODEL_VERSION,
      horizon: input.forecastHorizon,
      itemType: input.itemType,
      forecasts: [],
      summary: {
        totalPredictedDemand: 0,
        avgDailyDemand: 0,
        peakDemandDate: new Date().toISOString().split('T')[0],
        peakDemandValue: 0,
        trend: 'stable' as const,
      },
    };
  }
  
  // Calculate summary statistics
  const summary = calculateDemandSummary(allForecasts);
  
  // Get accuracy metrics if available
  const accuracy = await getDemandAccuracy(supabase, input.tenantId);
  
  // Save forecast results
  await saveDemandForecasts(
    supabase,
    input.tenantId,
    allForecasts,
    input.forecastHorizon
  );
  
  return {
    tenantId: input.tenantId,
    modelName: 'simple_moving_average',
    modelVersion: MODEL_VERSION,
    horizon: input.forecastHorizon,
    itemType: input.itemType,
    forecasts: allForecasts,
    summary,
    accuracy: accuracy || undefined,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchHistoricalDemand(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  itemType: 'service' | 'package',
  startDate?: string
): Promise<HistoricalDemandData[]> {
  const lookbackDays = 90; // 3 months of historical data
  const endDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  
  try {
    type SupabaseRpc = { rpc: (fn: string, params: Record<string, unknown>) => any };
    if (itemType === 'service') {
      // Get service demand from sessions
      // Note: RPC not in generated types yet, using type cast
      const { data, error } = await (supabase as unknown as SupabaseRpc).rpc('get_service_demand_history', {
        p_tenant_id: tenantId,
        p_start_date: startDate || defaultStartDate,
        p_end_date: endDate,
      });
      
      if (error) {
        throw error;
      }
      
      return ((data || []) as unknown as Record<string, unknown>[]).map(transformServiceDemand);
    } else {
      // Get package demand from bookings
      // Note: RPC not in generated types yet, using type cast
      const { data, error } = await (supabase as unknown as SupabaseRpc).rpc('get_package_demand_history', {
        p_tenant_id: tenantId,
        p_start_date: startDate || defaultStartDate,
        p_end_date: endDate,
      });
      
      if (error) {
        throw error;
      }
      
      return ((data || []) as unknown as Record<string, unknown>[]).map(transformPackageDemand);
    }
  } catch (rpcError) {
    console.warn('[Demand Forecast] RPC not available, falling back to base table query:', rpcError);
    // Fallback: Query base table
    if (itemType === 'service') {
      // Query session_logs
      const { data, error } = await supabase
        .from('session_logs')
        .select('created_at, booking_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate || defaultStartDate);
      
      if (error) {
        throw error; // Throw database execution error as per Rule #1
      }
      
      // Group sessions by day
      const dailyMap = new Map<string, number>();
      (data || []).forEach(row => {
        if (row.created_at) {
          const dateStr = row.created_at.split('T')[0];
          dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
        }
      });
      
      return Array.from(dailyMap.entries()).map(([date, count]) => {
        const d = new Date(date);
        return {
          date,
          itemId: 'all_services',
          itemName: 'All Services',
          itemType: 'service' as const,
          demand: count,
          dayOfWeek: d.getDay(),
          dayOfMonth: d.getDate(),
          weekOfMonth: Math.ceil(d.getDate() / 7),
        };
      });
    } else {
      // Query bookings
      const { data, error } = await supabase
        .from('bookings')
        .select('created_at, package_name, package_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate || defaultStartDate);
      
      if (error) {
        throw error; // Throw database execution error as per Rule #1
      }
      
      // Group bookings by day and package
      const dailyMap = new Map<string, { date: string; itemId: string; itemName: string; count: number }>();
      (data || []).forEach(row => {
        if (row.created_at) {
          const dateStr = row.created_at.split('T')[0];
          const packageId = row.package_id || 'custom_booking';
          const packageName = row.package_name || 'Custom Booking';
          const key = `${dateStr}_${packageId}`;
          
          const existing = dailyMap.get(key) || { date: dateStr, itemId: packageId, itemName: packageName, count: 0 };
          existing.count++;
          dailyMap.set(key, existing);
        }
      });
      
      return Array.from(dailyMap.values()).map(item => {
        const d = new Date(item.date);
        return {
          date: item.date,
          itemId: item.itemId,
          itemName: item.itemName,
          itemType: 'package' as const,
          demand: item.count,
          dayOfWeek: d.getDay(),
          dayOfMonth: d.getDate(),
          weekOfMonth: Math.ceil(d.getDate() / 7),
        };
      });
    }
  }
}

function transformServiceDemand(row: Record<string, unknown>): HistoricalDemandData {
  const dateStr = String(row.date);
  const date = new Date(dateStr);
  return {
    date: dateStr,
    itemId: String(row.service_id),
    itemName: String(row.service_name),
    itemType: 'service',
    demand: Number(row.demand) || 0,
    dayOfWeek: date.getDay(),
    dayOfMonth: date.getDate(),
    weekOfMonth: Math.ceil(date.getDate() / 7),
  };
}

function transformPackageDemand(row: Record<string, unknown>): HistoricalDemandData {
  const dateStr = String(row.date);
  const date = new Date(dateStr);
  return {
    date: dateStr,
    itemId: String(row.package_id),
    itemName: String(row.package_name),
    itemType: 'package',
    demand: Number(row.demand) || 0,
    dayOfWeek: date.getDay(),
    dayOfMonth: date.getDate(),
    weekOfMonth: Math.ceil(date.getDate() / 7),
  };
}

async function getDemandAccuracy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<{ avgAccuracyPct: number; avgMape: number } | null> {
  // Note: View not in generated types yet, using type cast
  type SupabaseFrom = { from: (t: string) => any };
  const { data, error } = await (supabase as unknown as SupabaseFrom)
    .from('mv_forecast_accuracy')
    .select('avg_accuracy_pct, avg_mape')
    .eq('tenant_id', tenantId)
    .eq('forecast_type', 'demand')
    .eq('is_best_model', true)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    avgAccuracyPct: Number(data.avg_accuracy_pct) || 0,
    avgMape: Number(data.avg_mape) || 0,
  };
}

// ============================================================================
// DATA GROUPING
// ============================================================================

function groupByItem(
  data: HistoricalDemandData[]
): Record<string, HistoricalDemandData[]> {
  const groups: Record<string, HistoricalDemandData[]> = {};
  
  for (const row of data) {
    const key = `${row.itemType}_${row.itemId}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }
  
  // Sort each group by date
  for (const key in groups) {
    groups[key].sort((a, b) => a.date.localeCompare(b.date));
  }
  
  return groups;
}

// ============================================================================
// FORECASTING ALGORITHMS
// ============================================================================

function forecastItemDemand(
  historicalData: HistoricalDemandData[],
  horizonWeeks: number,
  confidenceLevel: number
): ItemDemandForecast[] {
  // Calculate seasonality factors
  const seasonalityFactors = calculateSeasonalityFactors(historicalData);
  
  // Calculate baseline demand (7-day moving average)
  const recentData = historicalData.slice(-14); // Last 2 weeks
  const baselineDemand = recentData.reduce((sum, d) => sum + d.demand, 0) / recentData.length;
  
  // Calculate trend
  const trend = calculateTrend(historicalData);
  
  // Calculate standard deviation for confidence intervals
  const demands = historicalData.map((d) => d.demand);
  const meanDemand = demands.reduce((sum, v) => sum + v, 0) / demands.length;
  const variance = demands.reduce((sum, v) => sum + Math.pow(v - meanDemand, 2), 0) / demands.length;
  const stdDev = Math.sqrt(variance);
  
  const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.90 ? 1.645 : 1.96;
  
  // Generate forecasts for each day
  const forecasts: ItemDemandForecast[] = [];
  const lastDate = new Date(historicalData[historicalData.length - 1].date);
  const firstItem = historicalData[0];
  
  const daysToForecast = horizonWeeks * 7;
  
  for (let i = 0; i < daysToForecast; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(forecastDate.getDate() + i + 1);
    
    const dayOfWeek = forecastDate.getDay();
    const weekOfMonth = Math.ceil(forecastDate.getDate() / 7);
    
    // Apply seasonality
    const dayOfWeekFactor = seasonalityFactors.dayOfWeekFactors[dayOfWeek];
    const weekOfMonthFactor = seasonalityFactors.weekOfMonthFactors[Math.min(weekOfMonth - 1, 4)];
    const seasonalityFactor = (dayOfWeekFactor + weekOfMonthFactor) / 2;
    
    // Apply trend
    const trendFactor = 1 + (trend * (i + 1) / daysToForecast);
    
    // Calculate predicted demand
    const predictedDemand = Math.round(
      Math.max(0, baselineDemand * seasonalityFactor * trendFactor)
    );
    
    forecasts.push({
      itemId: firstItem.itemId,
      itemName: firstItem.itemName,
      itemType: firstItem.itemType,
      date: forecastDate.toISOString().split('T')[0],
      predictedDemand,
      confidenceLower: Math.max(0, Math.round(predictedDemand - zScore * stdDev)),
      confidenceUpper: Math.round(predictedDemand + zScore * stdDev),
      seasonalityFactor: Math.round(seasonalityFactor * 100) / 100,
      trendFactor: Math.round(trendFactor * 100) / 100,
    });
  }
  
  return forecasts;
}

function calculateSeasonalityFactors(data: HistoricalDemandData[]): SeasonalityFactors {
  // Calculate average demand for each day of week
  const dayOfWeekDemands: Record<number, number[]> = {};
  const weekOfMonthDemands: Record<number, number[]> = {};
  
  for (const row of data) {
    if (!dayOfWeekDemands[row.dayOfWeek]) {
      dayOfWeekDemands[row.dayOfWeek] = [];
    }
    dayOfWeekDemands[row.dayOfWeek].push(row.demand);
    
    const weekIdx = Math.min(row.weekOfMonth - 1, 4); // Cap at week 5
    if (!weekOfMonthDemands[weekIdx]) {
      weekOfMonthDemands[weekIdx] = [];
    }
    weekOfMonthDemands[weekIdx].push(row.demand);
  }
  
  // Calculate overall average
  const overallAvg = data.reduce((sum, d) => sum + d.demand, 0) / data.length;
  
  // Calculate day-of-week factors (normalized to 1.0)
  const dayOfWeekFactors: number[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDemands = dayOfWeekDemands[i] || [];
    const dayAvg = dayDemands.length > 0
      ? dayDemands.reduce((sum, v) => sum + v, 0) / dayDemands.length
      : overallAvg;
    dayOfWeekFactors.push(overallAvg > 0 ? dayAvg / overallAvg : 1.0);
  }
  
  // Calculate week-of-month factors (normalized to 1.0)
  const weekOfMonthFactors: number[] = [];
  for (let i = 0; i < 5; i++) {
    const weekDemands = weekOfMonthDemands[i] || [];
    const weekAvg = weekDemands.length > 0
      ? weekDemands.reduce((sum, v) => sum + v, 0) / weekDemands.length
      : overallAvg;
    weekOfMonthFactors.push(overallAvg > 0 ? weekAvg / overallAvg : 1.0);
  }
  
  return {
    dayOfWeekFactors,
    weekOfMonthFactors,
  };
}

function calculateTrend(data: HistoricalDemandData[]): number {
  if (data.length < 7) {
    return 0; // No trend
  }
  
  // Compare recent week vs. previous week
  const recentWeek = data.slice(-7);
  const previousWeek = data.slice(-14, -7);
  
  const recentAvg = recentWeek.reduce((sum, d) => sum + d.demand, 0) / recentWeek.length;
  const previousAvg = previousWeek.reduce((sum, d) => sum + d.demand, 0) / previousWeek.length;
  
  if (previousAvg === 0) {
    return 0;
  }
  
  // Calculate percentage change
  const trend = (recentAvg - previousAvg) / previousAvg;
  
  // Cap trend at ±20% to avoid extreme forecasts
  return Math.max(-0.2, Math.min(0.2, trend));
}

// ============================================================================
// SUMMARY CALCULATIONS
// ============================================================================

function calculateDemandSummary(forecasts: ItemDemandForecast[]) {
  const totalPredictedDemand = forecasts.reduce((sum, f) => sum + f.predictedDemand, 0);
  const avgDailyDemand = Math.round(totalPredictedDemand / forecasts.length);
  
  // Find peak demand
  const peakForecast = forecasts.reduce((max, f) => 
    f.predictedDemand > max.predictedDemand ? f : max
  , forecasts[0]);
  
  // Determine trend
  const firstWeek = forecasts.slice(0, 7);
  const lastWeek = forecasts.slice(-7);
  const firstWeekAvg = firstWeek.reduce((sum, f) => sum + f.predictedDemand, 0) / firstWeek.length;
  const lastWeekAvg = lastWeek.reduce((sum, f) => sum + f.predictedDemand, 0) / lastWeek.length;
  
  const trendThreshold = 0.05; // 5%
  let trend: 'increasing' | 'decreasing' | 'stable';
  if ((lastWeekAvg - firstWeekAvg) / firstWeekAvg > trendThreshold) {
    trend = 'increasing';
  } else if ((firstWeekAvg - lastWeekAvg) / firstWeekAvg > trendThreshold) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }
  
  return {
    totalPredictedDemand,
    avgDailyDemand,
    peakDemandDate: peakForecast.date,
    peakDemandValue: peakForecast.predictedDemand,
    trend,
  };
}

// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

async function saveDemandForecasts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  forecasts: ItemDemandForecast[],
  horizonWeeks: number
): Promise<void> {
  const forecastRecords = forecasts.map((forecast) => ({
    tenant_id: tenantId,
    forecast_type: 'demand',
    model_version: MODEL_VERSION,
    model_name: 'simple_moving_average',
    forecast_date: forecast.date,
    forecast_horizon: horizonWeeks,
    predicted_value: forecast.predictedDemand,
    confidence_lower: forecast.confidenceLower,
    confidence_upper: forecast.confidenceUpper,
    confidence_level: 0.90,
    features: {
      item_id: forecast.itemId,
      item_name: forecast.itemName,
      item_type: forecast.itemType,
      seasonality_factor: forecast.seasonalityFactor,
      trend_factor: forecast.trendFactor,
    },
  }));
  
  type SupabaseFrom = { from: (t: string) => any };
  const { error } = await (supabase as unknown as SupabaseFrom)
    .from('forecast_results')
    .upsert(forecastRecords, {
      onConflict: 'tenant_id,forecast_type,model_name,model_version,forecast_date,forecast_horizon',
    });
  
  if (error) {
    console.error('Failed to save demand forecasts:', error);
    // Non-critical error, don't throw
  }
}
