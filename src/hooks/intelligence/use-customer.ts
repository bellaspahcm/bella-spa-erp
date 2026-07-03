/**
 * Customer Intelligence API Hooks
 * 
 * React Query hooks for consuming Customer Intelligence Layer APIs:
 * - Customer segmentation
 * - Customer Lifetime Value (CLV) predictions
 * - Churn risk analysis
 * - Customer behavior insights
 * 
 * CRITICAL: These hooks use React Query with properly configured staleTime 
 * matching backend TTL to prevent redundant API calls and respect cache-first strategy.
 * 
 * AGENTS.MD COMPLIANCE:
 * - Never use `any` type without proper type guards
 * - Cache-first strategy with appropriate TTL
 * - Tenant isolation at all layers
 * - IntelligenceResponse format for APIs
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Standard Intelligence Layer Response format
 */
interface IntelligenceResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  metadata: {
    computedAt: string
    cached: boolean
    cacheAge?: number
    executionTime?: number
  }
}

/**
 * Customer Segmentation Data
 */
interface CustomerSegment {
  segmentId: string
  segmentName: string
  description: string
  customerCount: number
  averageCLV: number
  averageVisitFrequency: number
  averageSpendPerVisit: number
  churnRate: number
  characteristics: string[]
  recommendedActions: string[]
}

/**
 * Customer Lifetime Value Prediction
 */
interface CustomerCLV {
  customerId: string
  customerName: string
  currentCLV: number
  predictedCLV12Months: number
  predictedCLV24Months: number
  confidenceScore: number
  rfmSegment: string
  topServices: string[]
  churnRisk: 'low' | 'medium' | 'high'
}

/**
 * Churn Risk Analysis
 */
interface ChurnRisk {
  customerId: string
  customerName: string
  churnProbability: number
  churnRiskLevel: 'low' | 'medium' | 'high'
  daysSinceLastVisit: number
  visitFrequencyTrend: 'increasing' | 'stable' | 'decreasing'
  spendingTrend: 'increasing' | 'stable' | 'decreasing'
  riskFactors: string[]
  retentionRecommendations: string[]
}

/**
 * Customer Behavior Insights
 */
interface CustomerBehaviorInsights {
  totalCustomers: number
  activeCustomers: number
  newCustomersThisMonth: number
  returningCustomers: number
  averageVisitFrequency: number
  averageSpendPerCustomer: number
  topServicesByCustomerCount: Array<{
    serviceId: string
    serviceName: string
    customerCount: number
  }>
  peakVisitDays: string[]
  peakVisitHours: number[]
}

// ============================================================================
// QUERY KEYS (for cache management)
// ============================================================================

export const customerKeys = {
  all: ['intelligence', 'customer'] as const,
  segmentation: (minCustomers?: number) => 
    [...customerKeys.all, 'segmentation', minCustomers] as const,
  clvPrediction: (customerId?: string) => 
    [...customerKeys.all, 'clv-prediction', customerId] as const,
  churnRisk: (threshold?: number) => 
    [...customerKeys.all, 'churn-risk', threshold] as const,
  behaviorInsights: (startDate: string, endDate: string) => 
    [...customerKeys.all, 'behavior-insights', startDate, endDate] as const,
}

// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

async function fetchCustomerSegmentation(
  minCustomers?: number
): Promise<IntelligenceResponse<CustomerSegment[]>> {
  const url = minCustomers 
    ? `/api/intelligence/customer/segmentation?minCustomers=${minCustomers}`
    : '/api/intelligence/customer/segmentation'

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchCustomerCLV(
  customerId?: string
): Promise<IntelligenceResponse<CustomerCLV | CustomerCLV[]>> {
  const url = customerId 
    ? `/api/intelligence/customer/ltv?customerId=${customerId}`
    : '/api/intelligence/customer/ltv'

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchChurnRisk(
  threshold?: number
): Promise<IntelligenceResponse<ChurnRisk[]>> {
  const url = threshold 
    ? `/api/intelligence/customer/churn-risk?threshold=${threshold}`
    : '/api/intelligence/customer/churn-risk'

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook: Customer Segmentation
 * 
 * Fetches customer segmentation data (RFM, behavioral clusters).
 * 
 * Cache Strategy:
 * - staleTime: 24 hours (segmentation data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param minCustomers - Optional minimum customers per segment
 * @param options - React Query options
 */
export function useCustomerSegmentation(
  minCustomers?: number,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<CustomerSegment[]>, Error> {
  return useQuery({
    queryKey: customerKeys.segmentation(minCustomers),
    queryFn: () => fetchCustomerSegmentation(minCustomers),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Customer Lifetime Value Prediction
 * 
 * Fetches CLV predictions for all customers or a specific customer.
 * 
 * Cache Strategy:
 * - staleTime: 24 hours (CLV predictions update daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param customerId - Optional customer ID (if omitted, fetches all)
 * @param options - React Query options
 */
export function useCustomerCLV(
  customerId?: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<CustomerCLV | CustomerCLV[]>, Error> {
  return useQuery({
    queryKey: customerKeys.clvPrediction(customerId),
    queryFn: () => fetchCustomerCLV(customerId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Churn Risk Analysis
 * 
 * Fetches churn risk predictions for all customers or high-risk customers.
 * 
 * Cache Strategy:
 * - staleTime: 24 hours (churn risk predictions update daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param threshold - Optional churn probability threshold (0-1)
 * @param options - React Query options
 */
export function useChurnRisk(
  threshold?: number,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<ChurnRisk[]>, Error> {
  return useQuery({
    queryKey: customerKeys.churnRisk(threshold),
    queryFn: () => fetchChurnRisk(threshold),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Fetch All Customer Data in Parallel
 * 
 * Convenience hook to fetch all customer intelligence data at once.
 * Uses React Query's parallel query execution for optimal performance.
 * 
 * @param params - Parameters for all queries
 */
export function useAllCustomerData(params: {
  minCustomersPerSegment?: number
  clvCustomerId?: string
  churnThreshold?: number
}) {
  const segmentation = useCustomerSegmentation(params.minCustomersPerSegment)
  const clvPrediction = useCustomerCLV(params.clvCustomerId)
  const churnRisk = useChurnRisk(params.churnThreshold)

  return {
    segmentation,
    clvPrediction,
    churnRisk,
    isLoading: 
      segmentation.isLoading || 
      clvPrediction.isLoading || 
      churnRisk.isLoading,
    isError: 
      segmentation.isError || 
      clvPrediction.isError || 
      churnRisk.isError,
    errors: {
      segmentation: segmentation.error,
      clvPrediction: clvPrediction.error,
      churnRisk: churnRisk.error,
    },
  }
}

/**
 * Hook: Refresh Customer Data Cache
 * 
 * Mutation to manually trigger cache invalidation and refetch for customer data.
 * Useful for "Refresh" buttons in dashboards.
 * 
 * Usage:
 * ```tsx
 * const { mutate: refresh, isPending } = useRefreshCustomerData()
 * <button onClick={() => refresh('all')} disabled={isPending}>
 *   Làm mới
 * </button>
 * ```
 */
export function useRefreshCustomerData(): UseMutationResult<
  void,
  Error,
  'all' | 'segmentation' | 'clv-prediction' | 'churn-risk',
  unknown
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      target: 'all' | 'segmentation' | 'clv-prediction' | 'churn-risk'
    ) => {
      if (target === 'all') {
        await queryClient.invalidateQueries({ queryKey: customerKeys.all })
      } else {
        await queryClient.invalidateQueries({ 
          queryKey: [...customerKeys.all, target] 
        })
      }
    },
    onSuccess: () => {
      // Optional: Show toast notification
      console.log('[Customer Intelligence] Cache invalidated, refetching...')
    },
  })
}

/**
 * Hook: Check Customer Cache Status
 * 
 * Utility hook to check if customer data is cached and fresh.
 * Useful for showing cache indicators in UI.
 * 
 * @returns Cache status for all customer queries
 */
export function useCustomerCacheStatus() {
  const queryClient = useQueryClient()

  const getQueryCacheStatus = (queryKey: readonly unknown[]) => {
    const queryState = queryClient.getQueryState(queryKey)
    return {
      isCached: !!queryState,
      isFresh: queryState ? Date.now() - queryState.dataUpdatedAt < 12 * 60 * 60 * 1000 : false,
      lastUpdated: queryState?.dataUpdatedAt,
    }
  }

  return {
    segmentation: (minCustomers?: number) => 
      getQueryCacheStatus(customerKeys.segmentation(minCustomers)),
    clvPrediction: (customerId?: string) => 
      getQueryCacheStatus(customerKeys.clvPrediction(customerId)),
    churnRisk: (threshold?: number) => 
      getQueryCacheStatus(customerKeys.churnRisk(threshold)),
  }
}
