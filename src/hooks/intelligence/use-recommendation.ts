/**
 * Recommendation Engine API Hooks
 * Phase 8 Task #4: Dashboard Integration
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface RecommendationItem {
  recommended_item_id: string;
  item_name?: string;
  relevance_score: number;
  rank_position: number;
  algorithm_used: string;
  metadata?: Record<string, any>;
}

export interface RecommendationResponse {
  success: boolean;
  data: RecommendationItem[];
  metadata: {
    cached: boolean;
    execution_time_ms: number;
    customer_id?: string;
    algorithm?: string;
    total_recommendations?: number;
  };
}

export interface RecommendationOptions {
  tenantId: string;
  customerId: string;
  limit?: number;
  algorithm?: 'collaborative_filtering' | 'content_based' | 'rfm_based' | 'hybrid';
  enabled?: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchServiceRecommendations(options: RecommendationOptions): Promise<RecommendationResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    customer_id: options.customerId,
    limit: String(options.limit || 5),
    ...(options.algorithm && { algorithm: options.algorithm })
  });
  
  const response = await fetch(`/api/intelligence/recommendation/service?${params}`);
  
  if (!response.ok) {
    throw new Error(`Service recommendations failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchPackageRecommendations(options: RecommendationOptions & { budget?: number }): Promise<RecommendationResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    customer_id: options.customerId,
    limit: String(options.limit || 5),
    ...(options.budget && { budget: String(options.budget) })
  });
  
  const response = await fetch(`/api/intelligence/recommendation/package?${params}`);
  
  if (!response.ok) {
    throw new Error(`Package recommendations failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchUpsellRecommendations(options: RecommendationOptions): Promise<RecommendationResponse> {
  const params = new URLSearchParams({
    tenant_id: options.tenantId,
    customer_id: options.customerId,
    limit: String(options.limit || 5)
  });
  
  const response = await fetch(`/api/intelligence/recommendation/upsell?${params}`);
  
  if (!response.ok) {
    throw new Error(`Upsell recommendations failed: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook for service recommendations
 * 
 * @example
 * const { data, isLoading, error } = useServiceRecommendations({
 *   tenantId: 'tenant-123',
 *   customerId: 'customer-456',
 *   limit: 5,
 *   algorithm: 'hybrid'
 * });
 */
export function useServiceRecommendations(
  options: RecommendationOptions,
  queryOptions?: Omit<UseQueryOptions<RecommendationResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['recommendation', 'service', options.tenantId, options.customerId, options.limit, options.algorithm],
    queryFn: () => fetchServiceRecommendations(options),
    enabled: options.enabled !== false && !!options.customerId,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours (matches backend TTL)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for package recommendations
 * 
 * @example
 * const { data, isLoading, error } = usePackageRecommendations({
 *   tenantId: 'tenant-123',
 *   customerId: 'customer-456',
 *   budget: 5000000,
 *   limit: 3
 * });
 */
export function usePackageRecommendations(
  options: RecommendationOptions & { budget?: number },
  queryOptions?: Omit<UseQueryOptions<RecommendationResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['recommendation', 'package', options.tenantId, options.customerId, options.budget, options.limit],
    queryFn: () => fetchPackageRecommendations(options),
    enabled: options.enabled !== false && !!options.customerId,
    staleTime: 12 * 60 * 60 * 1000, // 12 hours (matches backend TTL)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for upsell recommendations (market basket analysis)
 * 
 * @example
 * const { data, isLoading, error } = useUpsellRecommendations({
 *   tenantId: 'tenant-123',
 *   customerId: 'customer-456',
 *   limit: 3
 * });
 */
export function useUpsellRecommendations(
  options: RecommendationOptions,
  queryOptions?: Omit<UseQueryOptions<RecommendationResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['recommendation', 'upsell', options.tenantId, options.customerId, options.limit],
    queryFn: () => fetchUpsellRecommendations(options),
    enabled: options.enabled !== false && !!options.customerId,
    staleTime: 3 * 60 * 60 * 1000, // 3 hours (matches backend TTL)
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook to fetch all recommendation types in parallel
 * 
 * @example
 * const recommendations = useAllRecommendations({
 *   tenantId: 'tenant-123',
 *   customerId: 'customer-456',
 *   limit: 5
 * });
 * 
 * if (recommendations.isLoading) return <Loading />;
 * 
 * const { services, packages, upsells } = recommendations;
 */
export function useAllRecommendations(options: RecommendationOptions & { budget?: number }) {
  const services = useServiceRecommendations(options);
  const packages = usePackageRecommendations(options);
  const upsells = useUpsellRecommendations(options);
  
  return {
    services,
    packages,
    upsells,
    isLoading: services.isLoading || packages.isLoading || upsells.isLoading,
    isError: services.isError || packages.isError || upsells.isError,
    error: services.error || packages.error || upsells.error,
    hasAnyData: services.data || packages.data || upsells.data
  };
}
