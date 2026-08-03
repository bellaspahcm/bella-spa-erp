/**
 * Bella Auto Phase 9 - Demand Forecasting Service
 * 
 * Manages demand forecasting for inventory planning.
 * Foundation layer - actual ML models to be integrated later.
 * 
 * Features:
 * - Store and retrieve demand forecasts
 * - Inventory recommendation engine
 * - Trend analysis
 * - Seasonality detection
 * - Stock alert system
 * 
 * @module bella-auto/services/DemandForecastingService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type DemandForecast = Database['public']['Tables']['auto_demand_forecasts']['Row'];
type DemandForecastInsert = Database['public']['Tables']['auto_demand_forecasts']['Insert'];

type ForecastPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type TrendDirection = 'increasing' | 'stable' | 'decreasing';
type Urgency = 'normal' | 'moderate' | 'urgent';

interface CreateForecastParams {
  tenantId: string;
  forecastDate: string;
  forecastPeriod: ForecastPeriod;
  periodStart: string;
  periodEnd: string;
  make: string;
  model?: string;
  variant?: string;
  color?: string;
  predictedDemand: number;
  predictedDemandMin?: number;
  predictedDemandMax?: number;
  confidenceLevel?: number;
  currentStock?: number;
  inTransit?: number;
  reserved?: number;
  recommendedOrderQuantity?: number;
  recommendedOrderDate?: string;
  urgency?: Urgency;
  historicalAvgMonthlySales?: number;
  trendDirection?: TrendDirection;
  seasonalityFactor?: number;
  modelName?: string;
  modelVersion?: string;
  modelAccuracy?: number;
  featuresUsed?: any;
  createdBy?: string;
}

export class DemandForecastingService {
  /**
   * Create new demand forecast
   */
  static async create(params: CreateForecastParams): Promise<DemandForecast> {
    const supabase = getPrimaryClient();
    
    // Calculate available stock
    const available = (params.currentStock || 0) - (params.reserved || 0);
    
    const forecastData: DemandForecastInsert = {
      tenant_id: params.tenantId,
      forecast_date: params.forecastDate,
      forecast_period: params.forecastPeriod,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      make: params.make,
      model: params.model,
      variant: params.variant,
      color: params.color,
      predicted_demand: params.predictedDemand,
      predicted_demand_min: params.predictedDemandMin,
      predicted_demand_max: params.predictedDemandMax,
      confidence_level: params.confidenceLevel,
      current_stock: params.currentStock || 0,
      in_transit: params.inTransit || 0,
      reserved: params.reserved || 0,
      available,
      recommended_order_quantity: params.recommendedOrderQuantity,
      recommended_order_date: params.recommendedOrderDate,
      urgency: params.urgency || 'normal',
      historical_avg_monthly_sales: params.historicalAvgMonthlySales,
      trend_direction: params.trendDirection,
      seasonality_factor: params.seasonalityFactor,
      model_name: params.modelName || 'demand-forecast-v1',
      model_version: params.modelVersion,
      model_accuracy: params.modelAccuracy,
      features_used: params.featuresUsed as any,
      status: 'active',
      created_by: params.createdBy,
    };
    
    const { data, error } = await supabase
      .from('auto_demand_forecasts')
      .insert(forecastData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create demand forecast: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get forecast by ID
   */
  static async getById(forecastId: string, tenantId: string): Promise<DemandForecast | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_demand_forecasts')
      .select('*')
      .eq('id', forecastId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch demand forecast: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get latest forecast for specific vehicle
   */
  static async getLatestForVehicle(
    tenantId: string,
    make: string,
    model?: string,
    variant?: string,
    color?: string
  ): Promise<DemandForecast | null> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_demand_forecasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('make', make)
      .eq('status', 'active')
      .order('forecast_date', { ascending: false })
      .limit(1);
    
    if (model) query = query.eq('model', model);
    if (variant) query = query.eq('variant', variant);
    if (color) query = query.eq('color', color);
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch latest forecast: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get active forecasts for period
   */
  static async getForPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<DemandForecast[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_demand_forecasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('forecast_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch forecasts for period: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get urgent forecasts (stock alerts)
   */
  static async getUrgentForecasts(tenantId: string): Promise<DemandForecast[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_demand_forecasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('urgency', ['moderate', 'urgent'])
      .order('urgency', { ascending: false })
      .order('forecast_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch urgent forecasts: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get forecasts by make/model
   */
  static async getByVehicle(
    tenantId: string,
    make: string,
    model?: string
  ): Promise<DemandForecast[]> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_demand_forecasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('make', make)
      .eq('status', 'active')
      .order('forecast_date', { ascending: false });
    
    if (model) {
      query = query.eq('model', model);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch forecasts by vehicle: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Supersede old forecasts (when creating new ones)
   */
  static async supersede(
    tenantId: string,
    make: string,
    model?: string,
    variant?: string,
    color?: string
  ): Promise<number> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_demand_forecasts')
      .update({ status: 'superseded' })
      .eq('tenant_id', tenantId)
      .eq('make', make)
      .eq('status', 'active');
    
    if (model) query = query.eq('model', model);
    if (variant) query = query.eq('variant', variant);
    if (color) query = query.eq('color', color);
    
    const { data, error } = await query.select();
    
    if (error) {
      throw new Error(`Failed to supersede forecasts: ${error.message}`);
    }
    
    return data?.length || 0;
  }
  
  /**
   * Simple demand forecast calculation (rule-based, before ML)
   * Uses historical average with trend and seasonality adjustments
   */
  static calculateSimpleForecast(params: {
    historicalSales: number[];
    trendMultiplier?: number;
    seasonalityFactor?: number;
  }): {
    predictedDemand: number;
    predictedDemandMin: number;
    predictedDemandMax: number;
    confidenceLevel: number;
    trendDirection: TrendDirection;
  } {
    const { historicalSales, trendMultiplier = 1.0, seasonalityFactor = 1.0 } = params;
    
    if (historicalSales.length === 0) {
      return {
        predictedDemand: 0,
        predictedDemandMin: 0,
        predictedDemandMax: 0,
        confidenceLevel: 0,
        trendDirection: 'stable',
      };
    }
    
    // Calculate average
    const avg = historicalSales.reduce((sum, val) => sum + val, 0) / historicalSales.length;
    
    // Detect trend
    let trendDirection: TrendDirection = 'stable';
    if (historicalSales.length >= 3) {
      const recent = historicalSales.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
      const older = historicalSales.slice(0, -3).reduce((sum, val) => sum + val, 0) / (historicalSales.length - 3);
      
      if (recent > older * 1.1) trendDirection = 'increasing';
      else if (recent < older * 0.9) trendDirection = 'decreasing';
    }
    
    // Calculate predicted demand
    const predictedDemand = Math.round(avg * trendMultiplier * seasonalityFactor);
    
    // Calculate variance for confidence bounds
    const variance = historicalSales.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / historicalSales.length;
    const stdDev = Math.sqrt(variance);
    
    const predictedDemandMin = Math.max(0, Math.round(predictedDemand - stdDev));
    const predictedDemandMax = Math.round(predictedDemand + stdDev);
    
    // Confidence level based on data points and variance
    const confidenceLevel = Math.min(
      95,
      (historicalSales.length / 12) * 100 * (1 - Math.min(1, stdDev / avg))
    );
    
    return {
      predictedDemand,
      predictedDemandMin,
      predictedDemandMax,
      confidenceLevel: Math.round(confidenceLevel * 100) / 100,
      trendDirection,
    };
  }
  
  /**
   * Calculate recommended order quantity
   */
  static calculateRecommendedOrder(params: {
    predictedDemand: number;
    currentStock: number;
    inTransit: number;
    reserved: number;
    safetyStockDays?: number;
    leadTimeDays?: number;
  }): {
    recommendedOrderQuantity: number;
    urgency: Urgency;
    recommendedOrderDate: string;
  } {
    const {
      predictedDemand,
      currentStock,
      inTransit,
      reserved,
      safetyStockDays = 7,
      leadTimeDays = 30,
    } = params;
    
    const available = currentStock - reserved;
    const totalAvailable = available + inTransit;
    
    // Safety stock calculation
    const safetyStock = Math.ceil((predictedDemand / 30) * safetyStockDays);
    
    // Calculate shortfall
    const shortfall = predictedDemand + safetyStock - totalAvailable;
    const recommendedOrderQuantity = Math.max(0, shortfall);
    
    // Determine urgency
    let urgency: Urgency = 'normal';
    const daysUntilStockout = available > 0 
      ? Math.floor((available / predictedDemand) * 30)
      : 0;
    
    if (daysUntilStockout <= leadTimeDays) {
      urgency = 'urgent';
    } else if (daysUntilStockout <= leadTimeDays + 14) {
      urgency = 'moderate';
    }
    
    // Recommended order date
    const daysUntilOrder = Math.max(0, daysUntilStockout - leadTimeDays);
    const recommendedOrderDate = new Date(Date.now() + daysUntilOrder * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    return {
      recommendedOrderQuantity,
      urgency,
      recommendedOrderDate,
    };
  }
  
  /**
   * Get forecast summary statistics
   */
  static async getStatistics(tenantId: string, dateRange?: { start: string; end: string }) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_demand_forecasts')
      .select('predicted_demand, urgency, confidence_level, trend_direction')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
    
    if (dateRange) {
      query = query
        .gte('forecast_date', dateRange.start)
        .lte('forecast_date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch forecast statistics: ${error.message}`);
    }
    
    const stats = {
      total: data.length,
      totalPredictedDemand: 0,
      averageConfidence: 0,
      byUrgency: { normal: 0, moderate: 0, urgent: 0 },
      byTrend: { increasing: 0, stable: 0, decreasing: 0 },
    };
    
    let totalConfidence = 0;
    
    data.forEach(forecast => {
      stats.totalPredictedDemand += forecast.predicted_demand || 0;
      
      if (forecast.confidence_level) {
        totalConfidence += Number(forecast.confidence_level);
      }
      
      if (forecast.urgency) {
        stats.byUrgency[forecast.urgency as Urgency]++;
      }
      
      if (forecast.trend_direction) {
        stats.byTrend[forecast.trend_direction as TrendDirection]++;
      }
    });
    
    stats.averageConfidence = data.length > 0 ? totalConfidence / data.length : 0;
    
    return stats;
  }
}
