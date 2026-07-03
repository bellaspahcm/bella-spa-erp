/**
 * Operational Intelligence API Hooks
 * 
 * React Query hooks for consuming Operational Intelligence Layer APIs:
 * - KTV performance metrics
 * - Inventory optimization
 * - Session utilization analytics
 * 
 * CRITICAL: These hooks use React Query with properly configured staleTime 
 * matching backend TTL to prevent redundant API calls and respect cache-first strategy.
 * 
 * AGENTS.md COMPLIANCE:
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
 * KTV Performance Metrics (from Phase 2)
 */
interface KTVPerformanceMetrics {
  ktvId: string
  ktvName: string
  totalSessions: number
  completedSessions: number
  canceledSessions: number
  completionRate: number
  averageRating: number
  totalRevenue: number
  averageRevenuePerSession: number
  topServices: Array<{
    serviceId: string
    serviceName: string
    sessionCount: number
    revenue: number
  }>
  performanceScore: number
  rank: number
}

/**
 * Inventory Optimization Data
 */
interface InventoryOptimization {
  productId: string
  productName: string
  currentStock: number
  optimalStock: number
  reorderPoint: number
  avgDailyUsage: number
  daysUntilStockout: number
  recommendedOrderQuantity: number
  priority: 'high' | 'medium' | 'low'
  costImpact: number
}

/**
 * Session Utilization Analytics
 */
interface SessionUtilization {
  date: string
  totalAvailableSlots: number
  bookedSlots: number
  completedSlots: number
  canceledSlots: number
  utilizationRate: number
  revenuePerSlot: number
  peakHours: Array<{
    hour: number
    bookingCount: number
    utilizationRate: number
  }>
}

// ============================================================================
// QUERY KEYS (for cache management)
// ============================================================================

export const operationalKeys = {
  all: ['intelligence', 'operational'] as const,
  ktvPerformance: (month: string, year: string) => 
    [...operationalKeys.all, 'ktv-performance', month, year] as const,
  inventoryOptimization: (threshold?: number) => 
    [...operationalKeys.all, 'inventory-optimization', threshold] as const,
  sessionUtilization: (startDate: string, endDate: string) => 
    [...operationalKeys.all, 'session-utilization', startDate, endDate] as const,
}

// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

async function fetchKTVLeaderboard(
  startDate: string, 
  endDate: string
): Promise<IntelligenceResponse<KTVPerformanceMetrics[]>> {
  const response = await fetch(
    `/api/intelligence/operational/ktv-leaderboard?startDate=${startDate}&endDate=${endDate}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchInventoryStatus(
  threshold?: number
): Promise<IntelligenceResponse<InventoryOptimization[]>> {
  const url = threshold 
    ? `/api/intelligence/operational/inventory-status?stockStatus=low_stock`
    : '/api/intelligence/operational/inventory-status'

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

async function fetchSessionAnalytics(
  startDate: string,
  endDate: string
): Promise<IntelligenceResponse<SessionUtilization[]>> {
  const response = await fetch(
    `/api/intelligence/operational/session-analytics?startDate=${startDate}&endDate=${endDate}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

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
 * Hook: KTV Leaderboard
 * 
 * Fetches leaderboard metrics for all KTVs in a date range.
 * 
 * Cache Strategy:
 * - staleTime: 6 hours (KTV performance data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param options - React Query options
 */
export function useKTVPerformance(
  month: string,
  year: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<KTVPerformanceMetrics[]>, Error> {
  // Convert month/year to date range
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
  
  return useQuery({
    queryKey: operationalKeys.ktvPerformance(month, year),
    queryFn: () => fetchKTVLeaderboard(startDate, endDate),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 12 * 60 * 60 * 1000, // 12 hours (cacheTime renamed to gcTime in v5)
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Inventory Status
 * 
 * Fetches inventory status (stock levels, reorder points).
 * 
 * Cache Strategy:
 * - staleTime: 12 hours (inventory data changes slowly)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param threshold - Optional stockout threshold (days)
 * @param options - React Query options
 */
export function useInventoryOptimization(
  threshold?: number,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<InventoryOptimization[]>, Error> {
  return useQuery({
    queryKey: operationalKeys.inventoryOptimization(threshold),
    queryFn: () => fetchInventoryStatus(threshold),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Session Analytics
 * 
 * Fetches session analytics metrics for a date range (booking rates, peak hours).
 * 
 * Cache Strategy:
 * - staleTime: 6 hours (utilization data updates throughout the day)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param options - React Query options
 */
export function useSessionUtilization(
  startDate: string,
  endDate: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<SessionUtilization[]>, Error> {
  return useQuery({
    queryKey: operationalKeys.sessionUtilization(startDate, endDate),
    queryFn: () => fetchSessionAnalytics(startDate, endDate),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 12 * 60 * 60 * 1000, // 12 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Fetch All Operational Data in Parallel
 * 
 * Convenience hook to fetch all operational intelligence data at once.
 * Uses React Query's parallel query execution for optimal performance.
 * 
 * @param params - Parameters for all queries
 */
export function useAllOperationalData(params: {
  month: string
  year: string
  inventoryThreshold?: number
  sessionStartDate: string
  sessionEndDate: string
}) {
  const ktvPerformance = useKTVPerformance(params.month, params.year)
  const inventoryOptimization = useInventoryOptimization(params.inventoryThreshold)
  const sessionUtilization = useSessionUtilization(
    params.sessionStartDate,
    params.sessionEndDate
  )

  return {
    ktvPerformance,
    inventoryOptimization,
    sessionUtilization,
    isLoading: 
      ktvPerformance.isLoading || 
      inventoryOptimization.isLoading || 
      sessionUtilization.isLoading,
    isError: 
      ktvPerformance.isError || 
      inventoryOptimization.isError || 
      sessionUtilization.isError,
    errors: {
      ktvPerformance: ktvPerformance.error,
      inventoryOptimization: inventoryOptimization.error,
      sessionUtilization: sessionUtilization.error,
    },
  }
}

/**
 * Hook: Refresh Operational Data Cache
 * 
 * Mutation to manually trigger cache invalidation and refetch for operational data.
 * Useful for "Refresh" buttons in dashboards.
 * 
 * Usage:
 * ```tsx
 * const { mutate: refresh, isPending } = useRefreshOperationalData()
 * <button onClick={() => refresh('ktv-performance')} disabled={isPending}>
 *   Làm mới
 * </button>
 * ```
 */
export function useRefreshOperationalData(): UseMutationResult<
  void,
  Error,
  'all' | 'ktv-performance' | 'inventory-optimization' | 'session-utilization',
  unknown
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      target: 'all' | 'ktv-performance' | 'inventory-optimization' | 'session-utilization'
    ) => {
      if (target === 'all') {
        await queryClient.invalidateQueries({ queryKey: operationalKeys.all })
      } else {
        await queryClient.invalidateQueries({ 
          queryKey: [...operationalKeys.all, target] 
        })
      }
    },
    onSuccess: () => {
      // Optional: Show toast notification
      console.log('[Operational Intelligence] Cache invalidated, refetching...')
    },
  })
}

/**
 * Hook: Check Operational Cache Status
 * 
 * Utility hook to check if operational data is cached and fresh.
 * Useful for showing cache indicators in UI.
 * 
 * @returns Cache status for all operational queries
 */
export function useOperationalCacheStatus() {
  const queryClient = useQueryClient()

  const getQueryCacheStatus = (queryKey: readonly unknown[]) => {
    const queryState = queryClient.getQueryState(queryKey)
    return {
      isCached: !!queryState,
      isFresh: queryState ? Date.now() - queryState.dataUpdatedAt < 6 * 60 * 60 * 1000 : false,
      lastUpdated: queryState?.dataUpdatedAt,
    }
  }

  return {
    ktvPerformance: (month: string, year: string) => 
      getQueryCacheStatus(operationalKeys.ktvPerformance(month, year)),
    inventoryOptimization: (threshold?: number) => 
      getQueryCacheStatus(operationalKeys.inventoryOptimization(threshold)),
    sessionUtilization: (startDate: string, endDate: string) => 
      getQueryCacheStatus(operationalKeys.sessionUtilization(startDate, endDate)),
  }
}
