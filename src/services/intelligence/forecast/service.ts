/**
 * Forecast Service - Unified Interface
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Provides a unified interface for all forecasting operations with caching
 */

import { createClient } from '@/lib/supabase-server';
import { forecastRevenue } from './revenue-forecast';
import { forecastChurn } from './churn-forecast';
import { forecastDemand } from './demand-forecast';
import type {
  ForecastInput,
  RevenueForecastResult,
  ChurnForecastResult,
  DemandForecastResult,
  ForecastResponse,
  BulkForecastResponse,
  ForecastAccuracySummary,
  ModelComparisonResult,
  ForecastType,
  ForecastHorizon,
  ModelName,
} from './types';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_TTL = {
  revenue: 6 * 60 * 60 * 1000, // 6 hours
  churn: 12 * 60 * 60 * 1000, // 12 hours
  demand: 3 * 60 * 60 * 1000, // 3 hours
};

function requireString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  throw new Error(`[ForecastService] Invalid string field: ${field}`);
}

function requireNumber(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numberValue)) {
    return numberValue;
  }
  throw new Error(`[ForecastService] Invalid number field: ${field}`);
}

function optionalNumber(row: Record<string, unknown>, field: string): number | null {
  const value = row[field];
  if (value === null || value === undefined) {
    return null;
  }
  return requireNumber(row, field);
}

function requireBoolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value === 'boolean') {
    return value;
  }
  throw new Error(`[ForecastService] Invalid boolean field: ${field}`);
}

function requireForecastType(row: Record<string, unknown>, field: string): ForecastType {
  const value = requireString(row, field);
  switch (value) {
    case 'revenue':
    case 'churn':
    case 'demand':
      return value;
    default:
      throw new Error(`[ForecastService] Invalid forecast type: ${value}`);
  }
}

function requireForecastHorizon(row: Record<string, unknown>, field: string): ForecastHorizon {
  const value = requireNumber(row, field);
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 30:
    case 60:
    case 90:
      return value;
    default:
      throw new Error(`[ForecastService] Invalid forecast horizon: ${value}`);
  }
}

function requireModelName(row: Record<string, unknown>, field: string): ModelName {
  const value = requireString(row, field);
  switch (value) {
    case 'simple_moving_average':
    case 'exponential_smoothing':
    case 'linear_regression':
    case 'arima':
    case 'prophet':
    case 'logistic_regression':
    case 'random_forest':
      return value;
    default:
      throw new Error(`[ForecastService] Invalid model name: ${value}`);
  }
}

function mapForecastAccuracySummary(row: Record<string, unknown>): ForecastAccuracySummary {
  return {
    tenantId: requireString(row, 'tenant_id'),
    forecastType: requireForecastType(row, 'forecast_type'),
    modelName: requireModelName(row, 'model_name'),
    modelVersion: requireString(row, 'model_version'),
    forecastHorizon: requireForecastHorizon(row, 'forecast_horizon'),
    totalForecasts: requireNumber(row, 'total_forecasts'),
    forecastsWithinCi: requireNumber(row, 'forecasts_within_ci'),
    avgAccuracyPct: requireNumber(row, 'avg_accuracy_pct'),
    medianAccuracyPct: requireNumber(row, 'median_accuracy_pct'),
    minAccuracyPct: requireNumber(row, 'min_accuracy_pct'),
    maxAccuracyPct: requireNumber(row, 'max_accuracy_pct'),
    avgError: requireNumber(row, 'avg_error'),
    avgMape: requireNumber(row, 'avg_mape'),
    medianError: requireNumber(row, 'median_error'),
    stddevError: requireNumber(row, 'stddev_error'),
    ciCoveragePct: requireNumber(row, 'ci_coverage_pct'),
    avgBias: requireNumber(row, 'avg_bias'),
    avgBiasPct: requireNumber(row, 'avg_bias_pct'),
    recentAccuracyPct: optionalNumber(row, 'recent_accuracy_pct'),
    recentError: optionalNumber(row, 'recent_error'),
    earliestForecastDate: requireString(row, 'earliest_forecast_date'),
    latestForecastDate: requireString(row, 'latest_forecast_date'),
    lastUpdated: requireString(row, 'last_updated'),
    accuracyRank: requireNumber(row, 'accuracy_rank'),
    isBestModel: requireBoolean(row, 'is_best_model'),
  };
}

function mapModelComparisonResult(row: Record<string, unknown>): ModelComparisonResult {
  return {
    modelName: requireModelName(row, 'model_name'),
    modelVersion: requireString(row, 'model_version'),
    avgAccuracyPct: requireNumber(row, 'avg_accuracy_pct'),
    avgMape: requireNumber(row, 'avg_mape'),
    ciCoveragePct: requireNumber(row, 'ci_coverage_pct'),
    totalForecasts: requireNumber(row, 'total_forecasts'),
    recentAccuracyPct: optionalNumber(row, 'recent_accuracy_pct'),
    accuracyRank: requireNumber(row, 'accuracy_rank'),
  };
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class ForecastService {
  private static instance: ForecastService;
  
  private constructor() {}
  
  public static getInstance(): ForecastService {
    if (!ForecastService.instance) {
      ForecastService.instance = new ForecastService();
    }
    return ForecastService.instance;
  }
  
  // ==========================================================================
  // REVENUE FORECASTING
  // ==========================================================================
  
  async getRevenueForecast(
    input: ForecastInput
  ): Promise<ForecastResponse<RevenueForecastResult>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cached = await this.getCachedForecast<RevenueForecastResult>(
        input.tenantId,
        'revenue',
        input.forecastHorizon
      );
      
      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            generatedAt: new Date().toISOString(),
            modelName: cached.modelName,
            modelVersion: cached.modelVersion,
            confidenceLevel: cached.confidenceLevel,
            dataSource: 'cache',
          },
        };
      }
      
      // Generate new forecast
      const result = await forecastRevenue(input);
      
      // Cache the result
      await this.cacheForecast(
        input.tenantId,
        'revenue',
        input.forecastHorizon,
        result,
        CACHE_TTL.revenue
      );
      
      const computationTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          generatedAt: new Date().toISOString(),
          modelName: result.modelName,
          modelVersion: result.modelVersion,
          confidenceLevel: result.confidenceLevel,
          dataSource: 'computation',
          computationTime,
        },
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return {
        success: false,
        data: {} as RevenueForecastResult,
        meta: {
          generatedAt: new Date().toISOString(),
          modelName: input.modelName || 'exponential_smoothing',
          modelVersion: 'v1.0',
          confidenceLevel: input.confidenceLevel || 0.95,
          dataSource: 'computation',
          computationTime: Date.now() - startTime,
        },
        error: {
          code: 'FORECAST_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate revenue forecast',
          details: error,
        },
      };
    }
  }
  
  // ==========================================================================
  // CHURN FORECASTING
  // ==========================================================================
  
  async getChurnForecast(
    input: ForecastInput
  ): Promise<ForecastResponse<ChurnForecastResult>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cached = await this.getCachedForecast<ChurnForecastResult>(
        input.tenantId,
        'churn',
        input.forecastHorizon
      );
      
      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            generatedAt: new Date().toISOString(),
            modelName: cached.modelName,
            modelVersion: cached.modelVersion,
            confidenceLevel: 0.80,
            dataSource: 'cache',
          },
        };
      }
      
      // Generate new forecast
      const result = await forecastChurn(input);
      
      // Cache the result
      await this.cacheForecast(
        input.tenantId,
        'churn',
        input.forecastHorizon,
        result,
        CACHE_TTL.churn
      );
      
      const computationTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          generatedAt: new Date().toISOString(),
          modelName: result.modelName,
          modelVersion: result.modelVersion,
          confidenceLevel: 0.80,
          dataSource: 'computation',
          computationTime,
        },
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return {
        success: false,
        data: {} as ChurnForecastResult,
        meta: {
          generatedAt: new Date().toISOString(),
          modelName: 'logistic_regression',
          modelVersion: 'v1.0',
          confidenceLevel: 0.80,
          dataSource: 'computation',
          computationTime: Date.now() - startTime,
        },
        error: {
          code: 'FORECAST_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate churn forecast',
          details: error,
        },
      };
    }
  }
  
  // ==========================================================================
  // DEMAND FORECASTING
  // ==========================================================================
  
  async getDemandForecast(
    input: ForecastInput & { itemType: 'service' | 'package' }
  ): Promise<ForecastResponse<DemandForecastResult>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `${input.forecastHorizon}_${input.itemType}`;
      const cached = await this.getCachedForecast<DemandForecastResult>(
        input.tenantId,
        'demand',
        cacheKey
      );
      
      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            generatedAt: new Date().toISOString(),
            modelName: cached.modelName,
            modelVersion: cached.modelVersion,
            confidenceLevel: 0.90,
            dataSource: 'cache',
          },
        };
      }
      
      // Generate new forecast
      const result = await forecastDemand(input);
      
      // Cache the result
      await this.cacheForecast(
        input.tenantId,
        'demand',
        cacheKey,
        result,
        CACHE_TTL.demand
      );
      
      const computationTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          generatedAt: new Date().toISOString(),
          modelName: result.modelName,
          modelVersion: result.modelVersion,
          confidenceLevel: 0.90,
          dataSource: 'computation',
          computationTime,
        },
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return {
        success: false,
        data: {} as DemandForecastResult,
        meta: {
          generatedAt: new Date().toISOString(),
          modelName: 'simple_moving_average',
          modelVersion: 'v1.0',
          confidenceLevel: 0.90,
          dataSource: 'computation',
          computationTime: Date.now() - startTime,
        },
        error: {
          code: 'FORECAST_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate demand forecast',
          details: error,
        },
      };
    }
  }
  
  // ==========================================================================
  // BULK FORECASTING
  // ==========================================================================
  
  async getAllForecasts(
    tenantId: string,
    horizons: {
      revenue: number;
      churn: 30 | 60 | 90;
      demand: number;
    }
  ): Promise<BulkForecastResponse> {
    const startTime = Date.now();
    
    // Generate all forecasts in parallel; individual failures degrade gracefully
    const [revenueResponse, churnResponse, demandServiceResponse, demandPackageResponse] = await Promise.all([
      this.getRevenueForecast({ tenantId, forecastType: 'revenue', forecastHorizon: horizons.revenue as ForecastHorizon }),
      this.getChurnForecast({ tenantId, forecastType: 'churn', forecastHorizon: horizons.churn }),
      this.getDemandForecast({ tenantId, forecastType: 'demand', forecastHorizon: horizons.demand as ForecastHorizon, itemType: 'service' }),
      this.getDemandForecast({ tenantId, forecastType: 'demand', forecastHorizon: horizons.demand as ForecastHorizon, itemType: 'package' }),
    ]);
    
    // Merge service and package demand forecasts
    const serviceForecasts = demandServiceResponse.data?.forecasts || [];
    const packageForecasts = demandPackageResponse.data?.forecasts || [];
    const demandResult: DemandForecastResult = {
      ...(demandServiceResponse.data || {} as DemandForecastResult),
      forecasts: [...serviceForecasts, ...packageForecasts],
      summary: {
        ...(demandServiceResponse.data?.summary || { totalPredictedDemand: 0, avgDailyDemand: 0, peakDemandDate: '', peakDemandValue: 0, trend: 'stable' as const }),
        totalPredictedDemand:
          (demandServiceResponse.data?.summary?.totalPredictedDemand || 0) +
          (demandPackageResponse.data?.summary?.totalPredictedDemand || 0),
      },
    };
    
    return {
      success: true,
      data: {
        revenue: revenueResponse.data,
        churn: churnResponse.data,
        demand: demandResult,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        totalComputationTime: Date.now() - startTime,
      },
    };
  }
  
  // ==========================================================================
  // FORECAST ACCURACY METRICS
  // ==========================================================================
  
  async getForecastAccuracy(
    tenantId: string,
    forecastType: 'revenue' | 'churn' | 'demand'
  ): Promise<ForecastAccuracySummary[]> {
    const supabase = await createClient();
    
    try {
      type SupabaseFrom = { from: (t: string) => { select: (cols: string) => { eq: (...args: unknown[]) => { eq: (...args: unknown[]) => { order: (col: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } } } } };
      const { data, error } = await (supabase as unknown as SupabaseFrom)
        .from('mv_forecast_accuracy')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('forecast_type', forecastType)
        .order('accuracy_rank');
      
      if (error) {
        throw error;
      }
      
      return (data || []).map(mapForecastAccuracySummary);
    } catch (viewError) {
      // mv_forecast_accuracy view not yet created — return empty array gracefully
      console.warn('[ForecastService] mv_forecast_accuracy not available:', viewError);
      return [];
    }
  }
  
  async compareModels(
    tenantId: string,
    forecastType: 'revenue' | 'churn' | 'demand',
    forecastHorizon: number
  ): Promise<ModelComparisonResult[]> {
    const supabase = await createClient();
    
    type SupabaseRpc = { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
    const { data, error } = await (supabase as unknown as SupabaseRpc).rpc('compare_forecast_models', {
      p_tenant_id: tenantId,
      p_forecast_type: forecastType,
      p_forecast_horizon: forecastHorizon,
    });
    
    if (error) {
      throw new Error(`Failed to compare models: ${error.message}`);
    }
    
    return (data || []).map(mapModelComparisonResult);
  }
  
  // ==========================================================================
  // CACHING HELPERS
  // ==========================================================================
  
  private async getCachedForecast<T>(
    _tenantId: string,
    _forecastType: string,
    _cacheKey: string | number
  ): Promise<T | null> {
    // Simple in-memory cache (could be replaced with Redis)
    // For now, return null to always compute fresh
    return null;
  }
  
  private async cacheForecast<T>(
    _tenantId: string,
    _forecastType: string,
    _cacheKey: string | number,
    _data: T,
    _ttl: number
  ): Promise<void> {
    // Simple in-memory cache (could be replaced with Redis)
    // For now, do nothing
  }
}

// Export singleton instance
export const forecastService = ForecastService.getInstance();
