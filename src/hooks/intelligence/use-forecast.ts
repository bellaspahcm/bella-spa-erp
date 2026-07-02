/**
 * Forecast Intelligence API Hooks
 * Phase 8 Task #4: Dashboard Integration
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ForecastResult {
  forecast_type: 'revenue' | 'churn' | 'demand';
  model_name: string;
  period_start_date: string;
  period_end_date: string;
  forecasted_value: number;
  confidence_lower: number;
  confidence_upper: number;
  accuracy_pct: number | null;
  metadata: Record<string, any>;
}

export interface ForecastResponse {
  success: boolean;
  data: ForecastResult | ForecastResult[];
  metadata: {
    cached: boolean;
    execution_time_ms: number;
    cache_key?: string;
    ttl?: number;
  };
}

export interface ForecastOptions {
  tenantId: string;
  months?: number;
  model?: 'simple_moving_average' | 'exponential_smoothing' | 'linear_regression';
  enabled?: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchRevenueForecast(options: ForecastOptions): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    months: String(options.months || 1),
    ...(options.model && { model: options.model })
  });
  
  const response = await fetch(`/api/intelligence/forecast/revenue?${params}`);
  
  if (!response.ok) {
    throw new Error(`Revenue forecast failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchChurnForecast(options: ForecastOptions): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    months: String(options.months || 1)
  });
  
  const response = await fetch(`/api/intelligence/forecast/churn?${params}`);
  
  if (!response.ok) {
    throw new Error(`Churn forecast failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchDemandForecast(options: ForecastOptions): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    months: String(options.months || 1)
  });
  
  const response = await fetch(`/api/intelligence/forecast/demand?${params}`);
  
  if (!response.ok) {
    throw new Error(`Demand forecast failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchAllForecasts(options: ForecastOptions): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    months: String(options.months || 1)
  });
  
  const response = await fetch(`/api/intelligence/forecast/all?${params}`);
  
  if (!response.ok) {
    throw new Error(`All forecasts failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchForecastAccuracy(tenantId: string): Promise<ForecastResponse> {
  const params = new URLSearchParams({ tenant_id: tenantId });
  
  const response = await fetch(`/api/intelligence/forecast/accuracy?${params}`);
  
  if (!response.ok) {
    throw new Error(`Forecast accuracy failed: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook for revenue forecast
 * 
 * @example
 * const { data, isLoading, error, refetch } = useRevenueForecast({
 *   tenantId: 'tenant-123',
 *   months: 3,
 *   model: 'linear_regression'
 * });
 */
export function useRevenueForecast(
  options: ForecastOptions,
  queryOptions?: Omit<UseQueryOptions<ForecastResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecast', 'revenue', options.tenantId, options.months, options.model],
    queryFn: () => fetchRevenueForecast(options),
    enabled: options.enabled !== false,
    staleTime: 12 * 60 * 60 * 1000, // 12 hours (matches backend TTL)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for churn forecast
 * 
 * @example
 * const { data, isLoading, error } = useChurnForecast({
 *   tenantId: 'tenant-123',
 *   months: 1
 * });
 */
export function useChurnForecast(
  options: ForecastOptions,
  queryOptions?: Omit<UseQueryOptions<ForecastResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecast', 'churn', options.tenantId, options.months],
    queryFn: () => fetchChurnForecast(options),
    enabled: options.enabled !== false,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (matches backend TTL)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for demand forecast
 * 
 * @example
 * const { data, isLoading, error } = useDemandForecast({
 *   tenantId: 'tenant-123',
 *   months: 1
 * });
 */
export function useDemandForecast(
  options: ForecastOptions,
  queryOptions?: Omit<UseQueryOptions<ForecastResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecast', 'demand', options.tenantId, options.months],
    queryFn: () => fetchDemandForecast(options),
    enabled: options.enabled !== false,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours (matches backend TTL)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for all forecasts (revenue, churn, demand) in parallel
 * 
 * @example
 * const { data, isLoading, error } = useAllForecasts({
 *   tenantId: 'tenant-123',
 *   months: 1
 * });
 * 
 * if (data?.success) {
 *   const { revenue, churn, demand } = data.data;
 * }
 */
export function useAllForecasts(
  options: ForecastOptions,
  queryOptions?: Omit<UseQueryOptions<ForecastResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecast', 'all', options.tenantId, options.months],
    queryFn: () => fetchAllForecasts(options),
    enabled: options.enabled !== false,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours (shortest TTL among all forecast types)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for forecast accuracy metrics
 * 
 * @example
 * const { data, isLoading, error } = useForecastAccuracy('tenant-123');
 * 
 * if (data?.success) {
 *   console.log('Revenue accuracy:', data.data.revenue_accuracy);
 *   console.log('Best model:', data.data.metadata.best_model_by_type.revenue);
 * }
 */
export function useForecastAccuracy(
  tenantId: string,
  queryOptions?: Omit<UseQueryOptions<ForecastResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecast', 'accuracy', tenantId],
    queryFn: () => fetchForecastAccuracy(tenantId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for manual forecast refresh (bypasses cache)
 * 
 * @example
 * const refreshForecast = useRefreshForecast();
 * 
 * await refreshForecast({
 *   type: 'revenue',
 *   tenantId: 'tenant-123',
 *   months: 3
 * });
 */
export function useRefreshForecast() {
  return useCallback(async (options: ForecastOptions & { type: 'revenue' | 'churn' | 'demand' | 'all' }) => {
    const { type, ...fetchOptions } = options;
    
    let fetchFn: (opts: ForecastOptions) => Promise<ForecastResponse>;
    
    switch (type) {
      case 'revenue':
        fetchFn = fetchRevenueForecast;
        break;
      case 'churn':
        fetchFn = fetchChurnForecast;
        break;
      case 'demand':
        fetchFn = fetchDemandForecast;
        break;
      case 'all':
        fetchFn = fetchAllForecasts;
        break;
      default:
        throw new Error(`Unknown forecast type: ${type}`);
    }
    
    return fetchFn(fetchOptions);
  }, []);
}

/**
 * Hook to check if forecast data is cached
 * 
 * @example
 * const { data } = useRevenueForecast({ tenantId: 'tenant-123' });
 * const isCached = data?.metadata.cached;
 * const cacheAge = Date.now() - (data?.metadata.cached_at || Date.now());
 */
export function useForecastCacheStatus(response?: ForecastResponse) {
  return {
    isCached: response?.metadata.cached || false,
    executionTime: response?.metadata.execution_time_ms || 0,
    cacheKey: response?.metadata.cache_key,
    ttl: response?.metadata.ttl
  };
}
