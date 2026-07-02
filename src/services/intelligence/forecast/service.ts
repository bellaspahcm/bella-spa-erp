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
  ForecastHorizon,
} from './types';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_TTL = {
  revenue: 6 * 60 * 60 * 1000, // 6 hours
  churn: 12 * 60 * 60 * 1000, // 12 hours
  demand: 3 * 60 * 60 * 1000, // 3 hours
};

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
    } catch (error: any) {
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
          message: error.message || 'Failed to generate revenue forecast',
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
    } catch (error: any) {
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
          message: error.message || 'Failed to generate churn forecast',
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
    } catch (error: any) {
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
          message: error.message || 'Failed to generate demand forecast',
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
    
    try {
      // Generate all forecasts in parallel
      const [revenueResponse, churnResponse, demandServiceResponse, demandPackageResponse] = await Promise.all([
        this.getRevenueForecast({ tenantId, forecastType: 'revenue', forecastHorizon: horizons.revenue as ForecastHorizon }),
        this.getChurnForecast({ tenantId, forecastType: 'churn', forecastHorizon: horizons.churn }),
        this.getDemandForecast({ tenantId, forecastType: 'demand', forecastHorizon: horizons.demand as ForecastHorizon, itemType: 'service' }),
        this.getDemandForecast({ tenantId, forecastType: 'demand', forecastHorizon: horizons.demand as ForecastHorizon, itemType: 'package' }),
      ]);
      
      if (!revenueResponse.success || !churnResponse.success || !demandServiceResponse.success) {
        throw new Error('One or more forecasts failed');
      }
      
      // Merge service and package demand forecasts
      const demandResult: DemandForecastResult = {
        ...demandServiceResponse.data,
        forecasts: [
          ...demandServiceResponse.data.forecasts,
          ...demandPackageResponse.data.forecasts,
        ],
        summary: {
          ...demandServiceResponse.data.summary,
          totalPredictedDemand: 
            demandServiceResponse.data.summary.totalPredictedDemand +
            demandPackageResponse.data.summary.totalPredictedDemand,
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
    } catch (error: any) {
      throw new Error(`Failed to generate bulk forecasts: ${error.message}`);
    }
  }
  
  // ==========================================================================
  // FORECAST ACCURACY METRICS
  // ==========================================================================
  
  async getForecastAccuracy(
    tenantId: string,
    forecastType: 'revenue' | 'churn' | 'demand'
  ): Promise<ForecastAccuracySummary[]> {
    const supabase = await createClient();
    
    // Note: View not in generated types yet, using type cast
    const { data, error } = await (supabase as any)
      .from('mv_forecast_accuracy')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('forecast_type', forecastType)
      .order('accuracy_rank');
    
    if (error) {
      throw new Error(`Failed to fetch forecast accuracy: ${error.message}`);
    }
    
    return (data || []) as ForecastAccuracySummary[];
  }
  
  async compareModels(
    tenantId: string,
    forecastType: 'revenue' | 'churn' | 'demand',
    forecastHorizon: number
  ): Promise<ModelComparisonResult[]> {
    const supabase = await createClient();
    
    // Note: RPC not in generated types yet, using type cast
    const { data, error } = await (supabase as any).rpc('compare_forecast_models', {
      p_tenant_id: tenantId,
      p_forecast_type: forecastType,
      p_forecast_horizon: forecastHorizon,
    });
    
    if (error) {
      throw new Error(`Failed to compare models: ${error.message}`);
    }
    
    return (data || []) as ModelComparisonResult[];
  }
  
  // ==========================================================================
  // CACHING HELPERS
  // ==========================================================================
  
  private async getCachedForecast<T>(
    tenantId: string,
    forecastType: string,
    cacheKey: string | number
  ): Promise<T | null> {
    // Simple in-memory cache (could be replaced with Redis)
    // For now, return null to always compute fresh
    return null;
  }
  
  private async cacheForecast<T>(
    tenantId: string,
    forecastType: string,
    cacheKey: string | number,
    data: T,
    ttl: number
  ): Promise<void> {
    // Simple in-memory cache (could be replaced with Redis)
    // For now, do nothing
  }
}

// Export singleton instance
export const forecastService = ForecastService.getInstance();
